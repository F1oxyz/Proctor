// =============================================================
// features/docente/services/grupos.service.ts
//
// Servicio exclusivo del módulo docente para gestionar grupos
// y sus alumnos. Interactúa directamente con Supabase usando
// el cliente singleton de SupabaseService.
//
// Responsabilidades:
//   - Listar grupos del maestro autenticado (con conteo de alumnos)
//   - Crear un grupo nuevo y registrar su lista de alumnos
//   - Listar alumnos de un grupo específico
//   - Eliminar un grupo (CASCADE borra sus alumnos en BD)
//
// RLS activo en Supabase:
//   - grupos: solo el maestro dueño (maestro_id = auth.uid())
//   - alumnos: solo el maestro dueño del grupo padre
//   - alumnos_anon_select: los alumnos pueden leer la lista (para sala espera)
//
// IMPORTANTE: Este servicio NUNCA debe inyectarse en features/estudiante.
//             Cada feature tiene sus propios servicios (ver arquitectura).
// =============================================================

import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Grupo, GrupoConStats, Alumno } from '../../../shared/models';

/** Resultado estándar de operaciones del servicio */
interface ServiceResult<T = void> {
  data: T | null;
  error: string | null;
}

@Injectable()
export class GruposService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  // ── Estado reactivo ────────────────────────────────────

  /** Lista de grupos del docente con conteo de alumnos */
  readonly grupos = signal<GrupoConStats[]>([]);

  /** Alumnos del grupo actualmente seleccionado */
  readonly alumnosGrupoActivo = signal<Alumno[]>([]);

  /** Indica si hay una operación en progreso */
  readonly cargando = signal(false);

  /** Error global del servicio (null si no hay error) */
  readonly error = signal<string | null>(null);

  /** Total de alumnos sumando todos los grupos */
  readonly totalAlumnos = computed(() =>
    this.grupos().reduce((acc, g) => acc + g.total_alumnos, 0)
  );

  // ── Métodos públicos ───────────────────────────────────

  /**
   * Carga todos los grupos del maestro autenticado.
   * Hace un JOIN para obtener el conteo de alumnos por grupo.
   * Popula el signal `grupos`.
   */
  async cargarGrupos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabase
        .from('grupos')
        .select(`
          id,
          maestro_id,
          nombre,
          descripcion,
          creado_en,
          alumnos(count)
        `)
        .order('creado_en', { ascending: false });

      if (error) throw error;

      // Mapear el resultado de Supabase al tipo GrupoConStats
      // Supabase devuelve alumnos(count) como [{ count: N }]
      const gruposConStats: GrupoConStats[] = (data ?? []).map((g: any) => ({
        id: g.id,
        maestro_id: g.maestro_id,
        nombre: g.nombre,
        descripcion: g.descripcion,
        creado_en: g.creado_en,
        total_alumnos: g.alumnos?.[0]?.count ?? 0,
      }));

      this.grupos.set(gruposConStats);
    } catch (err: any) {
      this.error.set('No se pudieron cargar los grupos. Intenta nuevamente.');
      console.error('[GruposService.cargarGrupos]', err);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Crea un nuevo grupo y registra todos sus alumnos en una sola operación.
   *
   * Flujo:
   *   1. Insertar registro en tabla `grupos`
   *   2. Parsear el texto de alumnos (un nombre por línea)
   *   3. Insertar todos los alumnos en tabla `alumnos` con bulk insert
   *   4. Recargar la lista de grupos
   *
   * @param nombre - Nombre del grupo o materia. Ej: "Dibujo Industrial - 2do Cuatri"
   * @param listaAlumnos - Texto con nombres separados por salto de línea
   * @returns ServiceResult con el grupo creado o un mensaje de error
   */
  async crearGrupo(
    nombre: string,
    listaAlumnos: string
  ): Promise<ServiceResult<Grupo>> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const maestroId = this.auth.currentUser()?.id;
      if (!maestroId) throw new Error('No hay sesión activa.');

      // ── 1. Crear el grupo ────────────────────────────
      const { data: grupo, error: errorGrupo } = await this.supabase
        .from('grupos')
        .insert({ nombre: nombre.trim(), maestro_id: maestroId })
        .select()
        .single();

      if (errorGrupo) throw errorGrupo;

      // ── 2. Parsear nombres de alumnos ────────────────
      // Separar por salto de línea, limpiar espacios, descartar vacíos
      const nombres = listaAlumnos
        .split('\n')
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      // ── 3. Insertar alumnos en bulk (si hay nombres) ─
      if (nombres.length > 0) {
        const alumnosPayload = nombres.map((nombre_completo) => ({
          grupo_id: grupo.id,
          nombre_completo,
        }));

        const { error: errorAlumnos } = await this.supabase
          .from('alumnos')
          .insert(alumnosPayload);

        if (errorAlumnos) throw errorAlumnos;
      }

      // ── 4. Recargar lista ────────────────────────────
      await this.cargarGrupos();

      return { data: grupo, error: null };
    } catch (err: any) {
      const msg = 'Error al crear el grupo. Intenta nuevamente.';
      this.error.set(msg);
      console.error('[GruposService.crearGrupo]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Carga los alumnos de un grupo específico.
   * Popula el signal `alumnosGrupoActivo`.
   *
   * @param grupoId - UUID del grupo a consultar
   */
  async cargarAlumnos(grupoId: string): Promise<void> {
    this.cargando.set(true);

    try {
      const { data, error } = await this.supabase
        .from('alumnos')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('nombre_completo', { ascending: true });

      if (error) throw error;

      this.alumnosGrupoActivo.set(data ?? []);
    } catch (err: any) {
      console.error('[GruposService.cargarAlumnos]', err);
      this.alumnosGrupoActivo.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Elimina un grupo por ID.
   * La BD elimina en cascada todos sus alumnos (ON DELETE CASCADE).
   * Recarga la lista de grupos tras eliminar.
   *
   * @param grupoId - UUID del grupo a eliminar
   */
  async eliminarGrupo(grupoId: string): Promise<ServiceResult> {
    this.cargando.set(true);

    try {
      const { error } = await this.supabase
        .from('grupos')
        .delete()
        .eq('id', grupoId);

      if (error) throw error;

      // Actualizar el signal localmente (más rápido que recargar de BD)
      this.grupos.update((lista) => lista.filter((g) => g.id !== grupoId));

      return { data: null, error: null };
    } catch (err: any) {
      const msg = 'No se pudo eliminar el grupo.';
      console.error('[GruposService.eliminarGrupo]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }
}