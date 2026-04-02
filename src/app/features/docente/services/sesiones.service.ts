/**
 * sesiones.service.ts
 * ─────────────────────────────────────────────────────────────────
 * Servicio del módulo Docente para gestionar el ciclo de vida
 * completo de una sesión de examen.
 *
 * CAMBIOS:
 *  - Bug 7: crearSesion() crea con estado 'esperando' (no 'activa')
 *  - Bug 7: iniciarExamenActivo() cambia estado a 'activa' y fija iniciada_en
 *  - Bug 10: cargarSesion() obtiene total de alumnos del grupo
 * ─────────────────────────────────────────────────────────────────
 */

import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { SesionAlumnoConDatos } from '../../../shared/models/index';

// ── Tipos internos para resultados de queries ─────────────────

/**
 * Helper seguro: Supabase infiere JOINs de FK como arrays aunque sean 1:1.
 * Retorna el primer elemento si es array, o el valor tal cual si ya es objeto.
 */
function primeroDeArray<T>(val: T | T[] | null | undefined): T | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

/** Shape del JOIN sesiones → examenes → grupos en cargarSesion() */
interface SesionQueryRow {
  id: string;
  codigo_acceso: string;
  iniciada_en: string | null;
  estado: string;
  examenes: {
    titulo: string;
    duracion_min: number;
    grupo_id: string;
    grupos: { nombre: string } | null;
  } | null;
}

/** Shape del alumno raw devuelto por cargarAlumnosIniciales().
 *  Supabase infiere el campo de FK como array; se normaliza con primeroDeArray(). */
interface SesionAlumnoRaw {
  id: string;
  alumno_id: string;
  peer_id: string | null;
  estado: string;
  iniciado_en: string | null;
  enviado_en: string | null;
  tiempo_usado_min: number | null;
  porcentaje: number | null;
  total_correctas: number | null;
  total_incorrectas: number | null;
  alumnos: { nombre_completo: string } | { nombre_completo: string }[] | null;
}

/** Info básica de la sesión activa para el monitor */
export interface SesionActiva {
  id: string;
  codigo_acceso: string;
  examen_titulo: string;
  grupo_nombre: string;
  duracion_min: number;
  iniciada_en: string;
  estado: string;         // 'esperando' | 'activa' | 'finalizada'
  total_alumnos: number;  // total de alumnos del grupo (para el contador del navbar)
}

/** Sesión reciente para historial */
export interface SesionResumen {
  id: string;
  codigo_acceso: string;
  estado: string;
  iniciada_en: string | null;
  finalizada_en: string | null;
  examen_titulo: string;
}

@Injectable()
export class SesionesService {
  // ── Dependencias ────────────────────────────────────────────────
  private readonly supabase = inject(SupabaseService);
  private readonly auth     = inject(AuthService);

  // ── Estado con signals ───────────────────────────────────────────

  /** Datos de la sesión que está activa en el monitor */
  readonly sesionActiva = signal<SesionActiva | null>(null);

  /**
   * Lista reactiva de alumnos en la sesión.
   * Se actualiza en tiempo real via Supabase Realtime.
   */
  readonly alumnosEnSesion = signal<SesionAlumnoConDatos[]>([]);

  readonly cargando = signal(false);
  readonly error    = signal<string | null>(null);

  /** Referencia al canal de Realtime para poder desuscribirse */
  private realtimeChannel: ReturnType<
    typeof this.supabase.client.channel
  > | null = null;

  /** Intervalo de polling fallback cuando Realtime no está disponible */
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  /** true cuando Realtime confirmó SUBSCRIBED — el polling se degrada */
  private realtimeActivo = false;

  // ── Métodos públicos ────────────────────────────────────────────

  /**
   * Crea una nueva sesión en Supabase para el examen/grupo dados.
   * Genera un código de acceso único de 6 caracteres.
   * Bug 7: ahora se crea con estado 'esperando', no 'activa'.
   *
   * @param examenId UUID del examen a iniciar
   * @param grupoId  UUID del grupo que presentará el examen
   * @returns UUID de la sesión creada, o null si falló
   */
  async crearSesion(examenId: string, grupoId: string): Promise<string | null> {
    this.cargando.set(true);
    this.error.set(null);

    const maestroId = this.auth.currentUser()?.id;
    if (!maestroId) {
      this.error.set('No hay sesión activa de docente.');
      this.cargando.set(false);
      return null;
    }

    const codigoAcceso = await this.generarCodigoUnico();

    // Bug 7: crear con estado 'esperando' — el profesor decide cuándo iniciar
    const { data, error } = await this.supabase.client
      .from('sesiones')
      .insert({
        examen_id:     examenId,
        maestro_id:    maestroId,
        codigo_acceso: codigoAcceso,
        estado:        'esperando',
        // iniciada_en se fija cuando el profesor hace clic en "Iniciar Examen"
      })
      .select('id')
      .single();

    if (error || !data) {
      this.error.set('No se pudo crear la sesión. Intenta de nuevo.');
      console.error('[SesionesService] crearSesion:', error);
      this.cargando.set(false);
      return null;
    }

    this.cargando.set(false);
    return data.id;
  }

  /**
   * Cambia el estado de la sesión a 'activa' y fija la hora de inicio.
   * Llamar cuando el profesor hace clic en "Iniciar Examen" en el monitor.
   *
   * @param sesionId UUID de la sesión
   * @returns true si el cambio fue exitoso
   */
  async iniciarExamenActivo(sesionId: string): Promise<boolean> {
    const iniciada_en = new Date().toISOString();

    const { error } = await this.supabase.client
      .from('sesiones')
      .update({
        estado:      'activa',
        iniciada_en,
      })
      .eq('id', sesionId);

    if (error) {
      console.error('[SesionesService] iniciarExamenActivo:', error);
      return false;
    }

    // Bug 6: actualizar iniciada_en en el signal local también
    this.sesionActiva.update((s) => (s ? { ...s, estado: 'activa', iniciada_en } : null));
    return true;
  }

  /**
   * Carga los datos completos de una sesión existente.
   * Bug 10: también carga el total de alumnos del grupo.
   *
   * @param sesionId UUID de la sesión a cargar
   */
  async cargarSesion(sesionId: string): Promise<boolean> {
    this.cargando.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('sesiones')
      .select(`
        id,
        codigo_acceso,
        iniciada_en,
        estado,
        examenes (
          titulo,
          duracion_min,
          grupo_id,
          grupos ( nombre )
        )
      `)
      .eq('id', sesionId)
      .single();

    if (error || !data) {
      this.error.set('No se encontró la sesión especificada.');
      this.cargando.set(false);
      return false;
    }

    const row = data as unknown as SesionQueryRow;
    const examen = row.examenes;
    const grupoId = examen?.grupo_id ?? '';

    // Bug 10: contar alumnos del grupo para el contador del navbar
    let totalAlumnos = 0;
    if (grupoId) {
      const { count } = await this.supabase.client
        .from('alumnos')
        .select('*', { count: 'exact', head: true })
        .eq('grupo_id', grupoId);
      totalAlumnos = count ?? 0;
    }

    this.sesionActiva.set({
      id:            row.id,
      codigo_acceso: row.codigo_acceso,
      examen_titulo: examen?.titulo ?? '—',
      grupo_nombre:  examen?.grupos?.nombre ?? '—',
      duracion_min:  examen?.duracion_min ?? 30,
      iniciada_en:   row.iniciada_en ?? new Date().toISOString(),
      estado:        row.estado ?? 'esperando',
      total_alumnos: totalAlumnos,
    });

    this.cargando.set(false);
    return true;
  }

  /**
   * Carga la lista inicial de alumnos del grupo de la sesión
   * y luego activa la suscripción de Realtime + polling fallback
   * para actualizaciones en vivo aunque Realtime no esté habilitado en el proyecto.
   *
   * Si ya hay un canal Realtime activo y confirmado (realtimeActivo = true),
   * solo refresca los datos sin re-suscribirse ni reiniciar el polling.
   *
   * @param sesionId UUID de la sesión activa
   */
  async iniciarMonitoreo(sesionId: string): Promise<void> {
    await this.cargarAlumnosIniciales(sesionId);
    // Evitar re-suscripción si Realtime ya está confirmado
    if (!this.realtimeActivo) {
      this.suscribirseARealtime(sesionId);
      this._iniciarPolling(sesionId);
    }
  }

  /**
   * Finaliza la sesión: cambia estado a 'finalizada' en Supabase
   * y cancela la suscripción de Realtime.
   *
   * @param sesionId UUID de la sesión a finalizar
   */
  async finalizarSesion(sesionId: string): Promise<boolean> {
    this.cargando.set(true);

    const { error } = await this.supabase.client
      .from('sesiones')
      .update({
        estado:        'finalizada',
        finalizada_en: new Date().toISOString(),
      })
      .eq('id', sesionId);

    this.cargando.set(false);

    if (error) {
      this.error.set('No se pudo finalizar la sesión.');
      console.error('[SesionesService] finalizarSesion:', error);
      return false;
    }

    this.desuscribirseDeRealtime();
    return true;
  }

  /**
   * Cancela la suscripción de Realtime y limpia el estado.
   * Llamar en ngOnDestroy del MonitorComponent.
   */
  destruir(): void {
    this.desuscribirseDeRealtime();
    this._detenerPolling();
    this.sesionActiva.set(null);
    this.alumnosEnSesion.set([]);
    this.error.set(null);
  }

  // ── Métodos privados ────────────────────────────────────────────

  private async cargarAlumnosIniciales(sesionId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('sesion_alumnos')
      .select(`
        id,
        alumno_id,
        peer_id,
        estado,
        iniciado_en,
        enviado_en,
        tiempo_usado_min,
        porcentaje,
        total_correctas,
        total_incorrectas,
        alumnos ( nombre_completo )
      `)
      .eq('sesion_id', sesionId)
      .order('alumnos(nombre_completo)', { ascending: true });

    if (error) {
      console.error('[SesionesService] cargarAlumnosIniciales:', error);
      return;
    }

    const enriquecidos = this.enriquecerAlumnos(data ?? []);
    this.alumnosEnSesion.set(enriquecidos);
  }

  private suscribirseARealtime(sesionId: string): void {
    this.desuscribirseDeRealtime();
    this.realtimeActivo = false;

    this.realtimeChannel = this.supabase.client
      .channel(`sesion-${sesionId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'sesion_alumnos',
          filter: `sesion_id=eq.${sesionId}`,
        },
        async (payload) => {
          await this.cargarAlumnosIniciales(sesionId);
          console.log('[SesionesService] Realtime evento:', payload.eventType);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[SesionesService] Realtime activo para sesión: ${sesionId}`);
          this.realtimeActivo = true;
          // Realtime confirmado → el polling ya no es necesario
          this._detenerPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Realtime falló o se cerró → reactivar polling como fallback
          this.realtimeActivo = false;
          this._iniciarPolling(sesionId);
          console.warn(`[SesionesService] Realtime ${status} — polling de respaldo activado.`);
        }
      });
  }

  private desuscribirseDeRealtime(): void {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.realtimeActivo = false;
  }

  /**
   * Inicia un polling cada 4 segundos como fallback al Realtime.
   * Garantiza actualizaciones aunque Realtime no esté habilitado en el proyecto.
   */
  private _iniciarPolling(sesionId: string): void {
    this._detenerPolling();
    this.pollingInterval = setInterval(async () => {
      await this.cargarAlumnosIniciales(sesionId);
    }, 4000);
  }

  private _detenerPolling(): void {
    if (this.pollingInterval != null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async generarCodigoUnico(): Promise<string> {
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    const generarCodigo = () =>
      Array.from({ length: 6 }, () =>
        CHARS[Math.floor(Math.random() * CHARS.length)]
      ).join('');

    for (let intento = 0; intento < 10; intento++) {
      const codigo = generarCodigo();

      const { data } = await this.supabase.client
        .from('sesiones')
        .select('id')
        .eq('codigo_acceso', codigo)
        .maybeSingle();

      if (!data) return codigo;
    }

    return generarCodigo() + Date.now().toString(36).slice(-2).toUpperCase();
  }

  private enriquecerAlumnos(data: SesionAlumnoRaw[]): SesionAlumnoConDatos[] {
    return data.map((sa) => ({
      id:                sa.id,
      sesion_id:         '',   // no incluido en la query; placeholder para el tipo
      alumno_id:         sa.alumno_id,
      peer_id:           sa.peer_id,
      estado:            sa.estado as SesionAlumnoConDatos['estado'],
      iniciado_en:       sa.iniciado_en,
      enviado_en:        sa.enviado_en,
      tiempo_usado_min:  sa.tiempo_usado_min,
      porcentaje:        sa.porcentaje,
      total_correctas:   sa.total_correctas,
      total_incorrectas: sa.total_incorrectas,
      creado_en:         '',   // no incluido en la query; placeholder para el tipo
      alumno_nombre:     primeroDeArray(sa.alumnos)?.nombre_completo ?? '—',
    }));
  }
}
