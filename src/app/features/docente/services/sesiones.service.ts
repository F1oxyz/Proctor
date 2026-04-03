

import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { SesionAlumnoConDatos } from '../../../shared/models/index';
import { primeroDeArray } from '../../../shared/utils/supabase.utils';

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

/** Supabase infiere alumnos como array aunque sea 1:1 — normalizar con primeroDeArray() */
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

/** Info básica de la sesión activa para el monitor del docente */
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

// Re-export para compatibilidad con imports existentes
export type { SesionResumen } from '../../../shared/models/index';

@Injectable()
export class SesionesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth     = inject(AuthService);

  readonly sesionActiva    = signal<SesionActiva | null>(null);
  readonly alumnosEnSesion = signal<SesionAlumnoConDatos[]>([]);

  readonly cargando = signal(false);
  readonly error    = signal<string | null>(null);

  private realtimeChannel: ReturnType<typeof this.supabase.client.channel> | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  /** true cuando Realtime confirmó SUBSCRIBED — polling se detiene */
  private realtimeActivo = false;


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

    const { data, error } = await this.supabase.client
      .from('sesiones')
      .insert({
        examen_id:     examenId,
        maestro_id:    maestroId,
        codigo_acceso: codigoAcceso,
        estado:        'esperando', // iniciada_en se fija al hacer clic en "Iniciar Examen"
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

    this.sesionActiva.update((s) => (s ? { ...s, estado: 'activa', iniciada_en } : null));
    return true;
  }


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
   * Carga alumnos y activa Realtime + polling fallback.
   * Si Realtime ya está confirmado, solo refresca datos sin re-suscribirse.
   */
  async iniciarMonitoreo(sesionId: string): Promise<void> {
    await this.cargarAlumnosIniciales(sesionId);
    if (!this.realtimeActivo) {
      this.suscribirseARealtime(sesionId);
      this._iniciarPolling(sesionId);
    }
  }


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

  /** Llamar en MonitorComponent.ngOnDestroy(). */
  destruir(): void {
    this.desuscribirseDeRealtime();
    this._detenerPolling();
    this.sesionActiva.set(null);
    this.alumnosEnSesion.set([]);
    this.error.set(null);
  }

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
          this._detenerPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Realtime no disponible → polling de respaldo
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

  /** Polling de respaldo cada 4 s para cuando Realtime no está disponible. */
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
