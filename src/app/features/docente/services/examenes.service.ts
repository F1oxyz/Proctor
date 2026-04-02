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

/** Examen con nombre de grupo incluido via JOIN (para la lista de exámenes) */
export type ExamenConGrupo = Examen & { grupos?: { nombre: string } | null };

/** Payload que el modal emite al padre para iniciar una sesión */
export interface IniciarExamenPayload {
  examenId: string;
  grupoId: string;
}

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
  /** URL pública de imagen opcional (Supabase Storage bucket question-images) */
  imagen_url?: string | null;
  opciones: OpcionPayload[];
}

/** Payload completo para crear o editar un examen */
export interface ExamenPayload {
  titulo: string;
  descripcion?: string | null;
  duracion_min: number;
  /** Porcentaje mínimo (0-100) para aprobar. Default: 60 */
  minimo_aprobatorio: number;
  grupo_id: string;
  preguntas: PreguntaPayload[];
}

/** Resultado estándar de operaciones del servicio */
interface ServiceResult<T = void> {
  data: T | null;
  error: string | null;
}

/** Resumen de sesión para el historial */
export interface SesionResumen {
  id: string;
  codigo_acceso: string;
  estado: string;
  iniciada_en: string | null;
  finalizada_en: string | null;
  examen_titulo: string;
}

// ── Tipos internos para resultados de queries ─────────────────

/** Fila mínima con ID devuelta por Supabase en consultas de sub-entidades */
interface RowWithId {
  id: string;
}

/** Fila de sesión devuelta por cargarSesionesRecientes.
 *  Supabase infiere el campo de FK como array; se normaliza con primeroDeArray(). */
interface SesionConExamen {
  id: string;
  codigo_acceso: string;
  estado: string;
  iniciada_en: string | null;
  finalizada_en: string | null;
  examenes: { titulo: string } | { titulo: string }[] | null;
}

/**
 * Helper seguro: Supabase infiere JOINs de FK como arrays aunque sean 1:1.
 * Retorna el primer elemento si es array, o el valor tal cual si ya es objeto.
 */
function primeroDeArray<T>(val: T | T[] | null | undefined): T | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

/** Error tipado que Supabase puede arrojar (message siempre está presente) */
interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
}

@Injectable()
export class ExamenesService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  // ── Estado reactivo ────────────────────────────────────

  /** Lista de exámenes del docente (sin preguntas, solo metadata + nombre de grupo) */
  readonly examenes = signal<ExamenConGrupo[]>([]);

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
        .select('*, grupos(nombre)')
        .order('creado_en', { ascending: false });

      if (error) throw error;
      this.examenes.set(data ?? []);
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
          titulo:             payload.titulo,
          descripcion:        payload.descripcion ?? null,
          duracion_min:       payload.duracion_min,
          minimo_aprobatorio: payload.minimo_aprobatorio,
          grupo_id:           payload.grupo_id,
          maestro_id:         maestroId,
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
    } catch (err: unknown) {
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
   * GUARDRAIL: Si el examen ya tiene sesiones con estado 'activa' o 'finalizada',
   * se bloquea la edición para proteger la integridad del historial.
   * Solo se permite editar si todas las sesiones están en 'esperando'
   * (sesión creada pero aún no iniciada) o si no tiene sesiones.
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
      // ── 0. Guardrail: verificar si hay sesiones con historial ──
      const { data: sesionesConHistorial, error: errGuard } = await this.supabase
        .from('sesiones')
        .select('id')
        .eq('examen_id', examenId)
        .in('estado', ['activa', 'finalizada'])
        .limit(1);

      if (errGuard) throw errGuard;

      if (sesionesConHistorial && sesionesConHistorial.length > 0) {
        const msg =
          'No se puede editar este examen porque ya tiene sesiones iniciadas o finalizadas. ' +
          'Crear un examen nuevo preserva la integridad del historial.';
        this.error.set(msg);
        this.cargando.set(false);
        return { data: null, error: msg };
      }

      // ── 1. Actualizar metadata del examen ────────────
      const { data: examen, error: errExamen } = await this.supabase
        .from('examenes')
        .update({
          titulo:             payload.titulo,
          descripcion:        payload.descripcion ?? null,
          duracion_min:       payload.duracion_min,
          minimo_aprobatorio: payload.minimo_aprobatorio,
          grupo_id:           payload.grupo_id,
        })
        .eq('id', examenId)
        .select()
        .single();

      if (errExamen) throw errExamen;

      // ── 2. Borrar respuestas antiguas antes de borrar preguntas ──
      // (FK: respuestas.pregunta_id → preguntas.id con RESTRICT bloquea el delete)
      // Ruta A: borrar por pregunta_id directamente
      const { data: preguntasActuales } = await this.supabase
        .from('preguntas')
        .select('id')
        .eq('examen_id', examenId);

      const preguntaIdsActuales = (preguntasActuales ?? []).map((p: RowWithId) => p.id);
      if (preguntaIdsActuales.length > 0) {
        await this.supabase
          .from('respuestas')
          .delete()
          .in('pregunta_id', preguntaIdsActuales);
      }

      // Ruta B: borrar por sesion_alumno_id (fallback si RLS bloquea ruta A)
      // Obtenemos sesiones de este examen → sesion_alumnos → respuestas
      const { data: sesionesDelExamen } = await this.supabase
        .from('sesiones')
        .select('id')
        .eq('examen_id', examenId);

      const sesionIds = (sesionesDelExamen ?? []).map((s: RowWithId) => s.id);
      if (sesionIds.length > 0) {
        const { data: sesionAlumnosData } = await this.supabase
          .from('sesion_alumnos')
          .select('id')
          .in('sesion_id', sesionIds);

        const sesionAlumnoIds = (sesionAlumnosData ?? []).map((sa: RowWithId) => sa.id);
        if (sesionAlumnoIds.length > 0) {
          await this.supabase
            .from('respuestas')
            .delete()
            .in('sesion_alumno_id', sesionAlumnoIds);
        }
      }

      // ── 3. Borrar preguntas antiguas (CASCADE elimina opciones) ──
      const { error: errDelete } = await this.supabase
        .from('preguntas')
        .delete()
        .eq('examen_id', examenId);

      if (errDelete) throw errDelete;

      // ── 4. Re-insertar preguntas y opciones ──────────
      if (payload.preguntas.length > 0) {
        await this._insertarPreguntasYOpciones(examenId, payload.preguntas);
      }

      await this.cargarExamenes();
      return { data: examen, error: null };
    } catch (err: unknown) {
      const msg = 'Error al guardar el examen. Intenta nuevamente.';
      this.error.set(msg);
      console.error('[ExamenesService.actualizarExamen]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Elimina un examen junto con todas sus sesiones asociadas.
   * Bug 4: primero elimina sesiones (FK constraint), luego el examen.
   *
   * @param examenId - UUID del examen a eliminar
   */
  async eliminarExamen(examenId: string): Promise<ServiceResult> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      // 1. Borrar respuestas primero (FK: respuestas.pregunta_id → preguntas.id)
      const { data: preguntasDelExamen } = await this.supabase
        .from('preguntas')
        .select('id')
        .eq('examen_id', examenId);

      const preguntaIds = (preguntasDelExamen ?? []).map((p: RowWithId) => p.id);
      if (preguntaIds.length > 0) {
        await this.supabase
          .from('respuestas')
          .delete()
          .in('pregunta_id', preguntaIds);
      }

      // 2. Eliminar sesiones asociadas (FK bloquea eliminar el examen directamente)
      const { error: errSesiones } = await this.supabase
        .from('sesiones')
        .delete()
        .eq('examen_id', examenId);

      if (errSesiones) throw errSesiones;

      // 3. Eliminar el examen (CASCADE borra preguntas y opciones)
      const { error } = await this.supabase
        .from('examenes')
        .delete()
        .eq('id', examenId);

      if (error) throw error;

      this.examenes.update((lista) => lista.filter((e) => e.id !== examenId));
      return { data: null, error: null };
    } catch (err: unknown) {
      const msg = 'No se pudo eliminar el examen. Verifica que no haya sesiones activas.';
      this.error.set(msg);
      console.error('[ExamenesService.eliminarExamen]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Carga el historial de sesiones del maestro.
   * Bug 6: permite ver sesiones pasadas con enlace a resultados.
   */
  async cargarSesionesRecientes(): Promise<SesionResumen[]> {
    try {
      const maestroId = this.auth.currentUser()?.id;
      if (!maestroId) return [];

      const { data } = await this.supabase
        .from('sesiones')
        .select('id, codigo_acceso, estado, iniciada_en, finalizada_en, examenes(titulo)')
        .eq('maestro_id', maestroId)
        .order('iniciada_en', { ascending: false })
        .limit(15);

      return (data ?? []).map((s: SesionConExamen) => ({
        id:             s.id,
        codigo_acceso:  s.codigo_acceso,
        estado:         s.estado,
        iniciada_en:    s.iniciada_en,
        finalizada_en:  s.finalizada_en,
        examen_titulo:  primeroDeArray(s.examenes)?.titulo ?? '—',
      }));
    } catch {
      return [];
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
      examen_id:  examenId,
      texto:      p.texto,
      tipo:       p.tipo,
      imagen_url: p.imagen_url ?? null,
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

  // ── Storage (imágenes de preguntas) ────────────────────

  /**
   * Sube un archivo de imagen al bucket `question-images`.
   * Retorna la URL pública o null si falló.
   */
  async subirImagenPregunta(file: File): Promise<string | null> {
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await this.supabase.storage
      .from('question-images')
      .upload(path, file, { upsert: false });

    if (error) {
      console.error('[ExamenesService] subirImagenPregunta:', error);
      return null;
    }

    const { data } = this.supabase.storage
      .from('question-images')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Elimina una imagen del bucket a partir de su URL pública.
   */
  async eliminarImagenPregunta(url: string): Promise<void> {
    const marker = '/question-images/';
    const idx    = url.indexOf(marker);
    if (idx === -1) return;

    const path = url.slice(idx + marker.length);

    const { error } = await this.supabase.storage
      .from('question-images')
      .remove([path]);

    if (error) console.error('[ExamenesService] eliminarImagenPregunta:', error);
  }
}
