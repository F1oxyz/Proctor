/**
 * Servicio de gestión de grupos y alumnos (solo docente).
 *
 * RLS: grupos filtra por maestro_id = auth.uid().
 *      alumnos hereda del grupo padre.
 *      Política alumnos_anon_select permite que el alumno lea la lista en sala de espera.
 *
 * IMPORTANTE: No inyectar en features/estudiante.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Grupo, GrupoConStats, Alumno, ServiceResult } from '../../../shared/models';

@Injectable()
export class GruposService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  readonly grupos             = signal<GrupoConStats[]>([]);
  readonly alumnosGrupoActivo = signal<Alumno[]>([]);
  readonly cargando           = signal(false);
  readonly error              = signal<string | null>(null);
  readonly totalAlumnos       = computed(() =>
    this.grupos().reduce((acc, g) => acc + g.total_alumnos, 0)
  );


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


  async crearGrupo(
    nombre: string,
    listaAlumnos: string
  ): Promise<ServiceResult<Grupo>> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const maestroId = this.auth.currentUser()?.id;
      if (!maestroId) throw new Error('No hay sesión activa.');

      const { data: grupo, error: errorGrupo } = await this.supabase
        .from('grupos')
        .insert({ nombre: nombre.trim(), maestro_id: maestroId })
        .select()
        .single();

      if (errorGrupo) throw errorGrupo;

      const nombres = listaAlumnos
        .split('\n')
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

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


  async editarAlumno(alumnoId: string, nuevoNombre: string): Promise<ServiceResult> {
    try {
      const { error } = await this.supabase
        .from('alumnos')
        .update({ nombre_completo: nuevoNombre.trim() })
        .eq('id', alumnoId);

      if (error) throw error;

      this.alumnosGrupoActivo.update((lista) =>
        lista.map((a) =>
          a.id === alumnoId ? { ...a, nombre_completo: nuevoNombre.trim() } : a
        )
      );

      return { data: null, error: null };
    } catch (err: any) {
      const msg = 'No se pudo actualizar el nombre del alumno.';
      console.error('[GruposService.editarAlumno]', err);
      return { data: null, error: msg };
    }
  }

  /** CASCADE en BD elimina sesion_alumnos y respuestas del alumno. */
  async eliminarAlumno(alumnoId: string): Promise<ServiceResult> {
    try {
      const alumno = this.alumnosGrupoActivo().find((a) => a.id === alumnoId);

      const { error } = await this.supabase
        .from('alumnos')
        .delete()
        .eq('id', alumnoId);

      if (error) throw error;

      this.alumnosGrupoActivo.update((lista) =>
        lista.filter((a) => a.id !== alumnoId)
      );

      if (alumno?.grupo_id) {
        this.grupos.update((lista) =>
          lista.map((g) =>
            g.id === alumno.grupo_id
              ? { ...g, total_alumnos: Math.max(0, g.total_alumnos - 1) }
              : g
          )
        );
      }

      return { data: null, error: null };
    } catch (err: any) {
      const msg = 'No se pudo eliminar al alumno.';
      console.error('[GruposService.eliminarAlumno]', err);
      return { data: null, error: msg };
    }
  }

  /** CASCADE en BD elimina todos sus alumnos. */
  async eliminarGrupo(grupoId: string): Promise<ServiceResult> {
    this.cargando.set(true);

    try {
      const { error } = await this.supabase
        .from('grupos')
        .delete()
        .eq('id', grupoId);

      if (error) throw error;

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