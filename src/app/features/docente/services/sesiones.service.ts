// =============================================================
// features/docente/services/sesiones.service.ts
//
// Servicio del módulo docente que gestiona las sesiones de examen.
//
// Responsabilidades:
//   - Crear una sesión (genera código de acceso único)
//   - Terminar una sesión (cambia estado a 'finalizada')
//   - Suscribirse a cambios en tiempo real de sesion_alumnos
//     via Supabase Realtime (canal Postgres Changes)
//   - Exponer el estado de alumnos conectados como signal
//
// Código de acceso:
//   Se genera en el cliente como 6 caracteres alfanuméricos en mayúsculas.
//   Ej: "AB12CD". El índice único en BD garantiza que no haya duplicados.
//   Si hay colisión, se reintenta una vez.
//
// Realtime:
//   Supabase Realtime escucha INSERT y UPDATE en sesion_alumnos
//   para el sesion_id activo. Actualiza el signal alumnosConectados
//   que MonitorComponent consume directamente.
// =============================================================

import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Sesion,
  SesionAlumnoConDatos,
} from '../../../shared/models';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ServiceResult<T = void> {
  data: T | null;
  error: string | null;
}

@Injectable()
export class SesionesService implements OnDestroy {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  // ── Estado reactivo ────────────────────────────────────

  /** Sesión activa actualmente siendo monitoreada */
  readonly sesionActiva = signal<Sesion | null>(null);

  /** Lista de alumnos conectados a la sesión activa con sus datos */
  readonly alumnosConectados = signal<SesionAlumnoConDatos[]>([]);

  /** Indica si hay una operación en progreso */
  readonly cargando = signal(false);

  /** Error del servicio */
  readonly error = signal<string | null>(null);

  /** Canal de Supabase Realtime activo (null si no hay suscripción) */
  private _canalRealtime: RealtimeChannel | null = null;

  // ── Métodos públicos ───────────────────────────────────

  /**
   * Crea una nueva sesión de examen con un código de acceso único.
   *
   * Flujo:
   *   1. Generar código aleatorio de 6 caracteres
   *   2. Insertar sesión en BD
   *   3. Si hay conflicto de código (UNIQUE), reintentar una vez
   *
   * @param examenId - UUID del examen a activar
   * @param grupoId  - UUID del grupo que realizará el examen (informativo)
   */
  async crearSesion(
    examenId: string,
    _grupoId: string
  ): Promise<ServiceResult<Sesion>> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const maestroId = this.auth.currentUser()?.id;
      if (!maestroId) throw new Error('No hay sesión activa.');

      // Intentar crear con un código único (máx 2 intentos)
      let sesion: Sesion | null = null;
      let intentos = 0;

      while (!sesion && intentos < 2) {
        const codigo = this._generarCodigo();
        const { data, error } = await this.supabase
          .from('sesiones')
          .insert({
            examen_id: examenId,
            maestro_id: maestroId,
            codigo_acceso: codigo,
            estado: 'esperando',
            iniciada_en: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          // Código duplicado → reintentar
          if (error.code === '23505') {
            intentos++;
            continue;
          }
          throw error;
        }
        sesion = data;
      }

      if (!sesion) throw new Error('No se pudo generar un código único.');

      this.sesionActiva.set(sesion);
      return { data: sesion, error: null };
    } catch (err: any) {
      const msg = 'Error al crear la sesión de examen.';
      this.error.set(msg);
      console.error('[SesionesService.crearSesion]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Carga una sesión existente por ID (para cuando el maestro recarga la página).
   * También carga el estado inicial de los alumnos conectados.
   *
   * @param sesionId - UUID de la sesión a cargar
   */
  async cargarSesion(sesionId: string): Promise<void> {
    this.cargando.set(true);

    try {
      // Cargar datos de la sesión
      const { data: sesion, error: errSesion } = await this.supabase
        .from('sesiones')
        .select('*')
        .eq('id', sesionId)
        .single();

      if (errSesion) throw errSesion;
      this.sesionActiva.set(sesion);

      // Cargar alumnos conectados con JOIN de nombre
      await this._cargarAlumnos(sesionId);

      // Iniciar suscripción Realtime
      this.suscribirRealtime(sesionId);
    } catch (err: any) {
      this.error.set('No se pudo cargar la sesión.');
      console.error('[SesionesService.cargarSesion]', err);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Cambia el estado de la sesión a 'finalizada' y guarda la hora de fin.
   * También desuscribe el canal Realtime.
   *
   * @param sesionId - UUID de la sesión a terminar
   */
  async terminarSesion(sesionId: string): Promise<ServiceResult> {
    this.cargando.set(true);

    try {
      const { error } = await this.supabase
        .from('sesiones')
        .update({
          estado: 'finalizada',
          finalizada_en: new Date().toISOString(),
        })
        .eq('id', sesionId);

      if (error) throw error;

      this.desuscribirRealtime();
      this.sesionActiva.update((s) =>
        s ? { ...s, estado: 'finalizada' } : null
      );

      return { data: null, error: null };
    } catch (err: any) {
      const msg = 'No se pudo terminar la sesión.';
      console.error('[SesionesService.terminarSesion]', err);
      return { data: null, error: msg };
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Suscribe el canal Realtime de Supabase para escuchar cambios
   * en sesion_alumnos (INSERT de nuevos alumnos, UPDATE de estado).
   * Actualiza automáticamente el signal alumnosConectados.
   *
   * @param sesionId - UUID de la sesión a monitorear
   */
  suscribirRealtime(sesionId: string): void {
    // Evitar múltiples suscripciones
    this.desuscribirRealtime();

    this._canalRealtime = this.supabase
      .channel(`sesion-monitor-${sesionId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'sesion_alumnos',
          filter: `sesion_id=eq.${sesionId}`,
        },
        async (_payload) => {
          // Al recibir cualquier cambio, recargar la lista completa
          // para tener el JOIN con el nombre del alumno actualizado
          await this._cargarAlumnos(sesionId);
        }
      )
      .subscribe();
  }

  /** Cancela la suscripción Realtime activa */
  desuscribirRealtime(): void {
    if (this._canalRealtime) {
      this.supabase.removeChannel(this._canalRealtime);
      this._canalRealtime = null;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────

  /** Limpia la suscripción Realtime al destruir el servicio */
  ngOnDestroy(): void {
    this.desuscribirRealtime();
  }

  // ── Métodos privados ───────────────────────────────────

  /**
   * Carga los alumnos conectados a una sesión con JOIN del nombre.
   * Se llama al iniciar y cada vez que Realtime notifica un cambio.
   */
  private async _cargarAlumnos(sesionId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('sesion_alumnos')
      .select(`
        *,
        alumno:alumnos ( nombre_completo )
      `)
      .eq('sesion_id', sesionId)
      .order('creado_en', { ascending: true });

    if (!error) {
      this.alumnosConectados.set(data ?? []);
    }
  }

  /**
   * Genera un código de acceso de 6 caracteres alfanuméricos en mayúsculas.
   * Excluye caracteres ambiguos: O, 0, I, 1 para evitar confusiones.
   * Ej: "AB7C2D"
   */
  private _generarCodigo(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }
}