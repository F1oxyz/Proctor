// =============================================================
// features/docente/services/examenes.service.ts
//
// Servicio exclusivo del módulo docente para gestionar exámenes,
// sus preguntas y opciones de respuesta.
//
// Responsabilidades:
//   - Listar exámenes del maestro autenticado
//   - Crear / actualizar un examen completo (con preguntas y opciones)
//   - Cargar un examen completo para edición
//   - Eliminar un examen (CASCADE borra preguntas y opciones en BD)
//
// Patrón de escritura (crear/editar):
//   La BD no tiene transacciones nativas en el cliente JS de Supabase,
//   por lo que usamos el siguiente orden para garantizar consistencia:
//     1. Upsert del examen (insert o update)
//     2. Delete de preguntas antiguas (CASCADE borra sus opciones)
//     3. Insert de nuevas preguntas
//     4. Insert de opciones para cada pregunta
//
// RLS activo:
//   - examenes: maestro_id = auth.uid()
//   - preguntas / opciones: via JOIN con examenes (maestro_id)
//
// IMPORTANTE: Este servicio NUNCA se inyecta en features/estudiante.
// =============================================================

import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Examen,
  ExamenCompleto,
  PreguntaConOpciones,
  Opcion,
} from '../../../shared/models';

/** Payload para crear/editar una opción de respuesta */
export interface OpcionPayload {
  texto: string;
  es_correcta: boolean;
  orden: number;
}

/** Payload para crear/editar una pregunta con sus opciones */
export interface PreguntaPayload {
  texto: string;
  tipo: 'opcion_multiple' | 'texto_abierto';
  opciones: OpcionPayload[];
}

/** Payload completo para crear o editar un examen */
export interface ExamenPayload {
  titulo: string;
  duracion_min: number;
  grupo_id: string;
  preguntas: PreguntaPayload[];
}

/** Resultado estándar de operaciones del servicio */
interface ServiceResult<T = void> {
  data: T | null;
  error: string | null;
}

@Injectable()
export class ExamenesService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  // ── Estado reactivo ────────────────────────────────────

  /** Lista de exámenes del docente (sin preguntas, solo metadata) */
  readonly examenes = signal<Examen[]>([]);

  /** Examen actualmente en edición (cargado completo con preguntas) */
  readonly examenActivo = signal<ExamenCompleto | null>(null);

  /** Indica si hay una operación en progreso */
  readonly cargando = signal(false);

  /** Error global del servicio */
  readonly error = signal<string | null>(null);

  // ── Métodos públicos ───────────────────────────────────

  /**
   * Carga todos los exámenes del maestro autenticado.
   * Solo trae metadata del examen, sin preguntas (más eficiente para la lista).
   * Para editar un examen, usar cargarExamenCompleto(id).
   */
  async cargarExamenes(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabase
        .from('examenes')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) throw error;
      this.examenes.set(data ?? []);
    } catch (err: any) {
      this.error.set('No se pudieron cargar los exámenes.');
      console.error('[ExamenesService.cargarExamenes]', err);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Carga un examen completo con todas sus preguntas y opciones.
   * Se usa al entrar al formulario de edición.
   * Popula el signal examenActivo.
   *
   * @param examenId - UUID del examen a cargar
   */
  async cargarExamenCompleto(examenId: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    this.examenActivo.set(null);

    try {
      const { data, error } = await this.supabase
        .from('examenes')
        .select(`
          *,
          preguntas (
            *,
            opciones ( * )
          )
        `)
        .eq('id', examenId)
        .single();

      if (error) throw error;

      // Ordenar opciones por campo `orden` para mostrarlas en el orden correcto
      const examenFormateado: ExamenCompleto = {
        ...data,
        preguntas: (data.preguntas ?? []).map((p: PreguntaConOpciones) => ({
          ...p,
          opciones: [...(p.opciones ?? [])].sort((a: Opcion, b: Opcion) => a.orden - b.orden),
        })),
      };

      this.examenActivo.set(examenFormateado);
    } catch (err: any) {
      this.error.set('No se pudo cargar el examen.');
      console.error('[ExamenesService.cargarExamenCompleto]', err);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Crea un examen nuevo con sus preguntas y opciones.
   *
   * Flujo:
   *   1. Insert examen → obtener ID
   *   2. Insert preguntas en bulk → obtener IDs
   *   3. Insert opciones en bulk asociadas a cada pregunta
   *
   * @param payload - Datos completos del examen a crear
   * @returns ServiceResult con el examen creado
   */
  async crearExamen(payload: ExamenPayload): Promise<ServiceResult<Examen>> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const maestroId = this.auth.currentUser()?.id;
      if (!maestroId) throw new Error('No hay sesión activa.');

      // ── 1. Crear examen ──────────────────────────────
      const { data: examen, error: errExamen } = await this.supabase
        .from('examenes')
        .insert({
          titulo: payload.titulo,
          duracion_min: payload.duracion_min,
          grupo_id: payload.grupo_id,
          maestro_id: maestroId,
        })
        .select()
        .single();

      if (errExamen) throw errExamen;

      // ── 2. Crear preguntas en bulk ───────────────────
      if (payload.preguntas.length > 0) {
        await this._insertarPreguntasYOpciones(examen.id, payload.preguntas);
      }

      await this.cargarExamenes();
      return { data: examen, error: null };
    } catch (err: any) {
      const msg = 'Error al crear el examen. Intenta nuevamente.';
      this.error.set(msg);
      console.error('[ExamenesService.crearExamen]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Actualiza un examen existente.
   * Estrategia: borrar todas las preguntas antiguas y re-insertar.
   * Esto simplifica el manejo de cambios en preguntas y opciones.
   *
   * @param examenId - UUID del examen a actualizar
   * @param payload - Nuevos datos del examen
   */
  async actualizarExamen(
    examenId: string,
    payload: ExamenPayload
  ): Promise<ServiceResult<Examen>> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      // ── 1. Actualizar metadata del examen ────────────
      const { data: examen, error: errExamen } = await this.supabase
        .from('examenes')
        .update({
          titulo: payload.titulo,
          duracion_min: payload.duracion_min,
          grupo_id: payload.grupo_id,
        })
        .eq('id', examenId)
        .select()
        .single();

      if (errExamen) throw errExamen;

      // ── 2. Borrar preguntas antiguas (CASCADE elimina opciones) ──
      const { error: errDelete } = await this.supabase
        .from('preguntas')
        .delete()
        .eq('examen_id', examenId);

      if (errDelete) throw errDelete;

      // ── 3. Re-insertar preguntas y opciones ──────────
      if (payload.preguntas.length > 0) {
        await this._insertarPreguntasYOpciones(examenId, payload.preguntas);
      }

      await this.cargarExamenes();
      return { data: examen, error: null };
    } catch (err: any) {
      const msg = 'Error al guardar el examen. Intenta nuevamente.';
      this.error.set(msg);
      console.error('[ExamenesService.actualizarExamen]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Elimina un examen. La BD elimina en cascade sus preguntas y opciones.
   *
   * @param examenId - UUID del examen a eliminar
   */
  async eliminarExamen(examenId: string): Promise<ServiceResult> {
    this.cargando.set(true);

    try {
      const { error } = await this.supabase
        .from('examenes')
        .delete()
        .eq('id', examenId);

      if (error) throw error;

      // Actualizar signal localmente sin recargar de BD
      this.examenes.update((lista) => lista.filter((e) => e.id !== examenId));
      return { data: null, error: null };
    } catch (err: any) {
      const msg = 'No se pudo eliminar el examen.';
      console.error('[ExamenesService.eliminarExamen]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  // ── Métodos privados ───────────────────────────────────

  /**
   * Helper interno: inserta preguntas y sus opciones en bulk.
   * Se llama tanto desde crearExamen como actualizarExamen.
   *
   * @param examenId - UUID del examen al que pertenecen las preguntas
   * @param preguntas - Array de payloads de preguntas con opciones
   */
  private async _insertarPreguntasYOpciones(
    examenId: string,
    preguntas: PreguntaPayload[]
  ): Promise<void> {
    // Insertar todas las preguntas en una sola query
    const preguntasPayload = preguntas.map((p) => ({
      examen_id: examenId,
      texto: p.texto,
      tipo: p.tipo,
    }));

    const { data: preguntasCreadas, error: errPreguntas } = await this.supabase
      .from('preguntas')
      .insert(preguntasPayload)
      .select();

    if (errPreguntas) throw errPreguntas;

    // Construir payload de opciones mapeando cada opción al ID de su pregunta
    // Las preguntas se devuelven en el mismo orden que fueron insertadas
    const opcionesPayload: Array<{
      pregunta_id: string;
      texto: string;
      es_correcta: boolean;
      orden: number;
    }> = [];

    preguntas.forEach((pregunta, idx) => {
      const preguntaCreada = preguntasCreadas[idx];
      if (!preguntaCreada) return;

      pregunta.opciones.forEach((opcion) => {
        opcionesPayload.push({
          pregunta_id: preguntaCreada.id,
          texto: opcion.texto,
          es_correcta: opcion.es_correcta,
          orden: opcion.orden,
        });
      });
    });

    // Insertar todas las opciones en una sola query (bulk)
    if (opcionesPayload.length > 0) {
      const { error: errOpciones } = await this.supabase
        .from('opciones')
        .insert(opcionesPayload);

      if (errOpciones) throw errOpciones;
    }
  }
}