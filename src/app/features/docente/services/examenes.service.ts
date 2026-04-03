/**
 * Servicio de gestión de exámenes (solo docente).
 *
 * Patrón de escritura crear/editar — sin transacciones nativas en Supabase JS:
 *   1. Upsert del examen
 *   2. Delete de preguntas antiguas (CASCADE elimina sus opciones)
 *   3. Insert de nuevas preguntas
 *   4. Insert de opciones en bulk
 *
 * RLS: examenes filtra por maestro_id = auth.uid().
 *      preguntas/opciones se heredan via JOIN con examenes.
 *
 * IMPORTANTE: No inyectar en features/estudiante.
 */

import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Examen,
  ExamenCompleto,
  PreguntaConOpciones,
  Opcion,
  SesionResumen,
  ServiceResult,
} from '../../../shared/models';
import { primeroDeArray } from '../../../shared/utils/supabase.utils';

/** Examen con nombre de grupo incluido via JOIN (para la lista de exámenes) */
export type ExamenConGrupo = Examen & { grupos?: { nombre: string } | null };

// Re-export para compatibilidad con imports existentes
export type { SesionResumen } from '../../../shared/models/index';

export interface IniciarExamenPayload {
  examenId: string;
  grupoId: string;
}

export interface OpcionPayload {
  texto: string;
  es_correcta: boolean;
  orden: number;
}

export interface PreguntaPayload {
  texto: string;
  tipo: 'opcion_multiple' | 'texto_abierto';
  /** URL pública de imagen opcional (Supabase Storage bucket question-images) */
  imagen_url?: string | null;
  opciones: OpcionPayload[];
}

export interface ExamenPayload {
  titulo: string;
  descripcion?: string | null;
  duracion_min: number;
  /** Porcentaje mínimo (0-100) para aprobar. Default: 60 */
  minimo_aprobatorio: number;
  grupo_id: string;
  preguntas: PreguntaPayload[];
}

interface RowWithId {
  id: string;
}

/** Supabase infiere examenes como array aunque sea 1:1 — normalizar con primeroDeArray() */
interface SesionConExamen {
  id: string;
  codigo_acceso: string;
  estado: string;
  iniciada_en: string | null;
  finalizada_en: string | null;
  examenes: { titulo: string } | { titulo: string }[] | null;
}

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
}

@Injectable()
export class ExamenesService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  readonly examenes    = signal<ExamenConGrupo[]>([]);
  readonly examenActivo = signal<ExamenCompleto | null>(null);
  readonly cargando    = signal(false);
  readonly error       = signal<string | null>(null);

  /** Carga metadata de exámenes (sin preguntas). Para edición usar cargarExamenCompleto(). */
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

  /** Carga preguntas y opciones del examen. Popula `examenActivo`. */
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


  async crearExamen(payload: ExamenPayload): Promise<ServiceResult<Examen>> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const maestroId = this.auth.currentUser()?.id;
      if (!maestroId) throw new Error('No hay sesión activa.');

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
   *
   * Estrategia: borrar preguntas antiguas + re-insertar (más simple que diff).
   * GUARDRAIL: bloquea edición si hay sesiones 'activa' o 'finalizada' — protege
   * integridad del historial. Solo permite editar si todas las sesiones están en
   * 'esperando' o si no hay sesiones.
   */
  async actualizarExamen(
    examenId: string,
    payload: ExamenPayload
  ): Promise<ServiceResult<Examen>> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      // Guardrail: bloquear si hay historial activo/finalizado
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

      // FK respuestas.pregunta_id → preguntas.id es RESTRICT, hay que borrar en orden.
      // Ruta A: borrar por pregunta_id
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

      // Ruta B: fallback por sesion_alumno_id si RLS bloquea ruta A
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

      // CASCADE elimina opciones automáticamente
      const { error: errDelete } = await this.supabase
        .from('preguntas')
        .delete()
        .eq('examen_id', examenId);

      if (errDelete) throw errDelete;

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
   * Elimina un examen. Orden de borrado requerido por FK constraints:
   * respuestas → sesiones → examen (preguntas/opciones por CASCADE).
   */
  async eliminarExamen(examenId: string): Promise<ServiceResult> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      // 1. Respuestas (FK: respuestas.pregunta_id → preguntas.id)
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

      // 2. Sesiones (FK bloquea eliminar el examen directamente)
      const { error: errSesiones } = await this.supabase
        .from('sesiones')
        .delete()
        .eq('examen_id', examenId);

      if (errSesiones) throw errSesiones;

      // 3. Examen (CASCADE borra preguntas y opciones)
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

  /** Inserta preguntas + opciones en bulk. Usado por crearExamen y actualizarExamen. */
  private async _insertarPreguntasYOpciones(
    examenId: string,
    preguntas: PreguntaPayload[]
  ): Promise<void> {
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

    // Supabase devuelve las preguntas en el mismo orden que fueron insertadas
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

    if (opcionesPayload.length > 0) {
      const { error: errOpciones } = await this.supabase
        .from('opciones')
        .insert(opcionesPayload);

      if (errOpciones) throw errOpciones;
    }
  }

  /** Sube imagen al bucket `question-images` (el componente ya la optimizó a WebP). */
  async subirImagenPregunta(file: File): Promise<string | null> {
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'webp';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await this.supabase.storage
      .from('question-images')
      .upload(path, file, { upsert: false, contentType: file.type });

    if (error) {
      console.error('[ExamenesService] subirImagenPregunta:', error);
      return null;
    }

    const { data } = this.supabase.storage
      .from('question-images')
      .getPublicUrl(path);

    return data.publicUrl;
  }


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
