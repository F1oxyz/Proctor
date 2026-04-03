

import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

/** Shape del JOIN sesiones → examenes en cargarSesionPorCodigo() */
interface SesionPorCodigoRow {
  id: string;
  examen_id: string;
  codigo_acceso: string;
  estado: string;
  iniciada_en: string | null;
  examenes: {
    titulo: string;
    duracion_min: number;
    grupo_id: string;
    minimo_aprobatorio: number;
  } | null;
}

interface SesionRealtimePayload {
  estado?: string;
  iniciada_en?: string | null;
  [key: string]: unknown;
}

interface PreguntaRaw {
  id: string;
  texto: string;
  tipo: string;
  imagen_url: string | null;
  opciones: Array<{
    id: string;
    texto: string;
    es_correcta: boolean;
    orden: number;
  }> | null;
}

export interface OpcionActiva {
  id: string;
  texto: string;
  es_correcta: boolean;
  orden: number;
}

export interface PreguntaActiva {
  id: string;
  texto: string;
  tipo: 'opcion_multiple' | 'texto_abierto';
  /** URL pública de imagen opcional (puede ser null si no tiene imagen) */
  imagen_url: string | null;
  opciones: OpcionActiva[];
}

export interface AlumnoActivo {
  id: string;
  nombre_completo: string;
}

export interface SesionActiva {
  id: string;
  examen_id: string;
  examen_titulo: string;
  grupo_id: string;
  duracion_min: number;
  /** Porcentaje mínimo (0-100) para aprobar. Viene de examenes.minimo_aprobatorio */
  minimo_aprobatorio: number;
  codigo_acceso: string;
  estado: string;       // 'esperando' | 'activa' | 'finalizada'
  iniciada_en: string | null;
}

export interface RespuestaLocal {
  pregunta_id: string;
  opcion_id: string | null;
  respuesta_abierta: string | null;
  respondido_en: string;
}

export interface ResultadoFinal {
  porcentaje: number;
  total_correctas: number;
  total_incorrectas: number;
  total_sin_contestar: number;
  tiempo_usado_seg: number;
  segundos_promedio: number;
  sesion_alumno_id: string;
}

/** Mezcla un arreglo in-place con el algoritmo Fisher-Yates (sin sesgo) */
function fisherYates<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

@Injectable()
export class ExamenActivoService {
  private readonly supabase = inject(SupabaseService);

  private _canalEstadoSesion: ReturnType<typeof this.supabase.client.channel> | null = null;
  private _pollInterval: ReturnType<typeof setInterval> | null = null;
  /** true cuando Realtime confirmó SUBSCRIBED — indica que el polling no es necesario */
  private _realtimeEstadoActivo = false;

  readonly sesion               = signal<SesionActiva | null>(null);
  readonly alumno               = signal<AlumnoActivo | null>(null);
  readonly listaAlumnos         = signal<AlumnoActivo[]>([]);
  readonly preguntas            = signal<PreguntaActiva[]>([]);
  readonly indicePreguntaActual = signal(0);
  readonly respuestas           = signal<Map<string, RespuestaLocal>>(new Map());
  readonly sesionAlumnoId       = signal<string | null>(null);
  readonly tiempoInicio         = signal<number | null>(null);
  readonly resultadoFinal       = signal<ResultadoFinal | null>(null);
  readonly cargando             = signal(false);
  readonly error                = signal<string | null>(null);
  /** Error transitorio de guardado — se limpia al siguiente upsert exitoso */
  readonly errorGuardado        = signal<string | null>(null);


  readonly preguntaActual = computed(() => {
    const lista = this.preguntas();
    const idx   = this.indicePreguntaActual();
    return lista[idx] ?? null;
  });

  readonly totalPreguntas        = computed(() => this.preguntas().length);
  readonly numeroPreguntaVisible = computed(() => this.indicePreguntaActual() + 1);

  readonly respuestaActual = computed(() => {
    const p = this.preguntaActual();
    if (!p) return null;
    return this.respuestas().get(p.id) ?? null;
  });

  readonly cantidadRespondidas = computed(() => this.respuestas().size);

  readonly todasRespondidas = computed(
    () => this.respuestas().size >= this.preguntas().length
  );


  async cargarSesionPorCodigo(codigo: string): Promise<boolean> {
    this.cargando.set(true);
    this.error.set(null);

    const { data: sesionData, error: sesionError } = await this.supabase.client
      .from('sesiones')
      .select(`
        id,
        examen_id,
        codigo_acceso,
        estado,
        iniciada_en,
        examenes ( titulo, duracion_min, grupo_id, minimo_aprobatorio )
      `)
      .eq('codigo_acceso', codigo.trim().toUpperCase())
      .single();

    if (sesionError || !sesionData) {
      this.error.set('Código de examen inválido o no encontrado.');
      this.cargando.set(false);
      return false;
    }

    if (!['esperando', 'activa'].includes(sesionData.estado)) {
      this.error.set('Este examen ya ha finalizado.');
      this.cargando.set(false);
      return false;
    }

    const row        = sesionData as unknown as SesionPorCodigoRow;
    const examenJoin = row.examenes;
    const grupoId    = examenJoin?.grupo_id ?? '';

    if (!grupoId) {
      this.error.set('No se pudo determinar el grupo del examen.');
      this.cargando.set(false);
      return false;
    }

    this.sesion.set({
      id:                 row.id,
      examen_id:          row.examen_id,
      examen_titulo:      examenJoin?.titulo ?? '—',
      grupo_id:           grupoId,
      duracion_min:       examenJoin?.duracion_min ?? 30,
      minimo_aprobatorio: examenJoin?.minimo_aprobatorio ?? 60,
      codigo_acceso:      row.codigo_acceso,
      estado:             row.estado,
      iniciada_en:        row.iniciada_en ?? null,
    });

    this._suscribirseACambiosEstado(sesionData.id);
    if (sesionData.estado === 'esperando') {
      this._iniciarPolling(sesionData.id);
    }

    const { data: alumnosData, error: alumnosError } = await this.supabase.client
      .from('alumnos')
      .select('id, nombre_completo')
      .eq('grupo_id', grupoId)
      .order('nombre_completo', { ascending: true });

    if (alumnosError) {
      this.error.set('No se pudo cargar la lista de alumnos.');
      this.cargando.set(false);
      return false;
    }

    this.listaAlumnos.set(alumnosData ?? []);
    this.cargando.set(false);
    return true;
  }

  /**
   * Registra al alumno en sesion_alumnos con estado 'unido'.
   * El docente lo verá en el monitor antes de que inicie el examen.
   * Llamar antes de iniciarExamen().
   */
  async unirseASala(alumno: AlumnoActivo, peerId = ''): Promise<boolean> {
    const sesion = this.sesion();
    if (!sesion) {
      this.error.set('No hay sesión activa.');
      return false;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.alumno.set(alumno);

    const { data, error } = await this.supabase.client
      .from('sesion_alumnos')
      .insert({
        sesion_id: sesion.id,
        alumno_id: alumno.id,
        peer_id:   peerId || null,
        estado:    'unido',
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        // Duplicate key: recargó la página, reutilizar el registro existente
        const { data: existente } = await this.supabase.client
          .from('sesion_alumnos')
          .select('id')
          .eq('sesion_id', sesion.id)
          .eq('alumno_id', alumno.id)
          .single();

        if (existente) {
          this.sesionAlumnoId.set(existente.id);
          this.cargando.set(false);
          return true;
        }
      }
      this.error.set('No se pudo unirse a la sala. Intenta de nuevo.');
      console.error('[ExamenActivoService] unirseASala:', error);
      this.cargando.set(false);
      return false;
    }

    this.sesionAlumnoId.set(data.id);
    this.cargando.set(false);
    return true;
  }


  async cargarPreguntas(examenId: string): Promise<boolean> {
    this.cargando.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('preguntas')
      .select(`
        id,
        texto,
        tipo,
        imagen_url,
        opciones ( id, texto, es_correcta, orden )
      `)
      .eq('examen_id', examenId);

    if (error || !data) {
      this.error.set('No se pudieron cargar las preguntas del examen.');
      this.cargando.set(false);
      return false;
    }

    const mezcladas = fisherYates([...data]);
    const conOpcionesMezcladas: PreguntaActiva[] = (mezcladas as PreguntaRaw[]).map((p) => ({
      id:         p.id,
      texto:      p.texto,
      tipo:       p.tipo as PreguntaActiva['tipo'],
      imagen_url: p.imagen_url ?? null,
      opciones:   fisherYates([...(p.opciones ?? [])]),
    }));

    this.preguntas.set(conOpcionesMezcladas);
    this.indicePreguntaActual.set(0);
    this.cargando.set(false);
    return true;
  }

  /**
   * Inicia el examen. Si el alumno ya pasó por la sala de espera
   * (sesionAlumnoId está seteado), actualiza el registro de 'unido' a 'en_progreso'.
   * Si no, inserta directamente.
   */
  async iniciarExamen(alumno: AlumnoActivo, peerId = ''): Promise<boolean> {
    const sesion = this.sesion();
    if (!sesion) {
      this.error.set('No hay sesión activa.');
      return false;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.alumno.set(alumno);

    const sesionAlumnoExistenteId = this.sesionAlumnoId();

    if (sesionAlumnoExistenteId) {
      const { error } = await this.supabase.client
        .from('sesion_alumnos')
        .update({
          estado:      'en_progreso',
          peer_id:     peerId || null,
          iniciado_en: new Date().toISOString(),
        })
        .eq('id', sesionAlumnoExistenteId);

      if (error) {
        this.error.set('No se pudo iniciar el examen. Intenta de nuevo.');
        console.error('[ExamenActivoService] iniciarExamen UPDATE:', error);
        this.cargando.set(false);
        return false;
      }
    } else {
      // Sin sala de espera previa: INSERT directo
      const { data, error } = await this.supabase.client
        .from('sesion_alumnos')
        .insert({
          sesion_id:   sesion.id,
          alumno_id:   alumno.id,
          peer_id:     peerId || null,
          estado:      'en_progreso',
          iniciado_en: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !data) {
        if (error?.code === '23505') {
          const { data: existente } = await this.supabase.client
            .from('sesion_alumnos')
            .select('id')
            .eq('sesion_id', sesion.id)
            .eq('alumno_id', alumno.id)
            .single();

          if (existente) {
            this.sesionAlumnoId.set(existente.id);
            this.tiempoInicio.set(Date.now());
            await this.cargarPreguntas(sesion.examen_id);
            this.cargando.set(false);
            return true;
          }
        }
        this.error.set('No se pudo registrar en el examen. Intenta de nuevo.');
        console.error('[ExamenActivoService] iniciarExamen INSERT:', error);
        this.cargando.set(false);
        return false;
      }
      this.sesionAlumnoId.set(data.id);
    }

    this.tiempoInicio.set(Date.now());
    this._detenerPolling();

    const ok = await this.cargarPreguntas(sesion.examen_id);
    this.cargando.set(false);
    return ok;
  }

  /** Parchea el peer_id cuando PeerJS terminó de inicializar después de unirseASala(). */
  async actualizarPeerId(sesionAlumnoId: string, peerId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('sesion_alumnos')
      .update({ peer_id: peerId })
      .eq('id', sesionAlumnoId);

    if (error) {
      console.warn('[ExamenActivoService] actualizarPeerId:', error);
    }
  }

  /**
   * Guarda la respuesta en memoria local (optimista) y en Supabase.
   * Retorna false si el upsert falló y setea `errorGuardado` para la UI.
   */
  async guardarRespuesta(
    opcionId: string | null,
    respuestaAbierta: string | null = null
  ): Promise<boolean> {
    const pregunta     = this.preguntaActual();
    const sesionAlumno = this.sesionAlumnoId();

    if (!pregunta || !sesionAlumno) return false;

    this.errorGuardado.set(null);

    const registro: RespuestaLocal = {
      pregunta_id:       pregunta.id,
      opcion_id:         opcionId,
      respuesta_abierta: respuestaAbierta,
      respondido_en:     new Date().toISOString(),
    };

    this.respuestas.update((mapa) => {
      const nuevo = new Map(mapa);
      nuevo.set(pregunta.id, registro);
      return nuevo;
    });

    const { error } = await this.supabase.client
      .from('respuestas')
      .upsert(
        {
          sesion_alumno_id:  sesionAlumno,
          pregunta_id:       pregunta.id,
          opcion_id:         opcionId,
          respuesta_abierta: respuestaAbierta,
          respondido_en:     registro.respondido_en,
          es_correcta: opcionId
            ? (pregunta.opciones.find((o) => o.id === opcionId)?.es_correcta ?? null)
            : null,
        },
        { onConflict: 'sesion_alumno_id,pregunta_id' }
      );

    if (error) {
      console.warn('[ExamenActivoService] guardarRespuesta upsert:', error);
      this.errorGuardado.set('No se pudo guardar la respuesta. Verificá tu conexión.');
      return false;
    }

    return true;
  }

  siguientePregunta(): void {
    const total = this.totalPreguntas();
    const actual = this.indicePreguntaActual();
    if (actual < total - 1) this.indicePreguntaActual.set(actual + 1);
  }

  preguntaAnterior(): void {
    const actual = this.indicePreguntaActual();
    if (actual > 0) this.indicePreguntaActual.set(actual - 1);
  }

  irAPregunta(indice: number): void {
    const total = this.totalPreguntas();
    if (indice >= 0 && indice < total) this.indicePreguntaActual.set(indice);
  }

  /**
   * Envía el examen: calcula el resultado y actualiza sesion_alumnos.
   */
  async enviarExamen(tiempoRestanteSeg: number): Promise<ResultadoFinal | null> {
    const sesionAlumnoId = this.sesionAlumnoId();
    const sesion         = this.sesion();
    const preguntas      = this.preguntas();
    const respuestas     = this.respuestas();
    const tiempoInicio   = this.tiempoInicio();

    if (!sesionAlumnoId || !sesion || !tiempoInicio) return null;

    this.cargando.set(true);

    const duracionTotalSeg = sesion.duracion_min * 60;
    const tiempoUsadoSeg   = Math.max(0, duracionTotalSeg - tiempoRestanteSeg);

    let totalCorrectas    = 0;
    let totalIncorrectas  = 0;
    let totalSinContestar = 0;

    for (const pregunta of preguntas) {
      const respuesta = respuestas.get(pregunta.id);

      if (!respuesta) {
        totalSinContestar++;
        continue;
      }

      if (pregunta.tipo === 'opcion_multiple') {
        const opcionElegida = pregunta.opciones.find(
          (o) => o.id === respuesta.opcion_id
        );
        if (opcionElegida?.es_correcta) {
          totalCorrectas++;
        } else {
          totalIncorrectas++;
        }
      } else {
        // Abierta: provisionalmente correcta si tiene texto (revisión manual del docente)
        if (respuesta.respuesta_abierta?.trim()) {
          totalCorrectas++;
        } else {
          totalSinContestar++;
        }
      }
    }

    const totalRespondidas = totalCorrectas + totalIncorrectas;
    const porcentaje = preguntas.length > 0
      ? Math.round((totalCorrectas / preguntas.length) * 100)
      : 0;
    const segundosPromedio = totalRespondidas > 0
      ? Math.round(tiempoUsadoSeg / totalRespondidas)
      : 0;

    const { error: updateError } = await this.supabase.client
      .from('sesion_alumnos')
      .update({
        estado:            'enviado',
        enviado_en:        new Date().toISOString(),
        tiempo_usado_min:  Math.round(tiempoUsadoSeg / 60),
        porcentaje:        porcentaje,
        total_correctas:   totalCorrectas,
        total_incorrectas: totalIncorrectas,
      })
      .eq('id', sesionAlumnoId);

    if (updateError) {
      console.error('[ExamenActivoService] enviarExamen update:', updateError);
      this.error.set('No se pudo enviar el examen. Verificá tu conexión e intentá de nuevo.');
      this.cargando.set(false);
      return null;
    }

    const resultado: ResultadoFinal = {
      porcentaje,
      total_correctas:    totalCorrectas,
      total_incorrectas:  totalIncorrectas,
      total_sin_contestar: totalSinContestar,
      tiempo_usado_seg:   tiempoUsadoSeg,
      segundos_promedio:  segundosPromedio,
      sesion_alumno_id:   sesionAlumnoId,
    };

    this.resultadoFinal.set(resultado);
    this.cargando.set(false);
    return resultado;
  }

  /** Recupera el resultado desde Supabase. Usado cuando el alumno recarga /resultado. */
  async recuperarResultado(sesionAlumnoId: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('sesion_alumnos')
      .select('id, porcentaje, total_correctas, total_incorrectas, tiempo_usado_min')
      .eq('id', sesionAlumnoId)
      .single();

    if (!data) return;

    this.resultadoFinal.set({
      porcentaje:           data.porcentaje         ?? 0,
      total_correctas:      data.total_correctas    ?? 0,
      total_incorrectas:    data.total_incorrectas  ?? 0,
      total_sin_contestar:  0,
      tiempo_usado_seg:     (data.tiempo_usado_min  ?? 0) * 60,
      segundos_promedio:    0,
      sesion_alumno_id:     data.id,
    });
  }

  /** Fallback: recupera el resultado cuando sesionAlumnoId no está en memoria (recarga completa). */
  async recuperarResultadoPorCodigo(codigo: string, alumnoId: string): Promise<void> {
    const { data: sesion } = await this.supabase.client
      .from('sesiones')
      .select('id')
      .eq('codigo_acceso', codigo.trim().toUpperCase())
      .single();

    if (!sesion) return;

    const { data } = await this.supabase.client
      .from('sesion_alumnos')
      .select('id, porcentaje, total_correctas, total_incorrectas, tiempo_usado_min')
      .eq('sesion_id', sesion.id)
      .eq('alumno_id', alumnoId)
      .single();

    if (!data) return;

    this.sesionAlumnoId.set(data.id);
    this.resultadoFinal.set({
      porcentaje:           data.porcentaje         ?? 0,
      total_correctas:      data.total_correctas    ?? 0,
      total_incorrectas:    data.total_incorrectas  ?? 0,
      total_sin_contestar:  0,
      tiempo_usado_seg:     (data.tiempo_usado_min  ?? 0) * 60,
      segundos_promedio:    0,
      sesion_alumno_id:     data.id,
    });
  }

  reset(): void {
    this._desuscribirseDeEstado();
    this._detenerPolling();
    this.sesion.set(null);
    this.alumno.set(null);
    this.listaAlumnos.set([]);
    this.preguntas.set([]);
    this.indicePreguntaActual.set(0);
    this.respuestas.set(new Map());
    this.sesionAlumnoId.set(null);
    this.tiempoInicio.set(null);
    this.resultadoFinal.set(null);
    this.error.set(null);
    this.errorGuardado.set(null);
  }

  private _suscribirseACambiosEstado(sesionId: string): void {
    this._desuscribirseDeEstado();

    this._canalEstadoSesion = this.supabase.client
      .channel(`sala-espera-${sesionId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'sesiones',
          filter: `id=eq.${sesionId}`,
        },
        (payload) => {
          const newRow        = payload.new as SesionRealtimePayload;
          const nuevoEstado   = newRow?.estado;
          const nuevaIniciada = (newRow?.iniciada_en as string | null | undefined) ?? null;
          if (nuevoEstado) {
            this.sesion.update((s) =>
              s ? { ...s, estado: nuevoEstado, iniciada_en: nuevaIniciada ?? s.iniciada_en } : null
            );
            if (nuevoEstado === 'activa') this._detenerPolling();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this._realtimeEstadoActivo = true;
          this._detenerPolling();
          console.log(`[ExamenActivoService] Realtime activo para sesión: ${sesionId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Realtime no disponible → polling de respaldo
          this._realtimeEstadoActivo = false;
          if (this.sesion()?.estado === 'esperando') {
            this._iniciarPolling(sesionId);
          }
          console.warn(`[ExamenActivoService] Realtime ${status} — polling de respaldo activado.`);
        }
      });
  }

  private _desuscribirseDeEstado(): void {
    if (this._canalEstadoSesion) {
      this.supabase.client.removeChannel(this._canalEstadoSesion);
      this._canalEstadoSesion = null;
    }
    this._realtimeEstadoActivo = false;
  }

  /**
   * Polling de respaldo cada 4 s para cuando Realtime no está disponible.
   * Se detiene automáticamente cuando la sesión cambia de 'esperando'.
   */
  private _iniciarPolling(sesionId: string): void {
    this._detenerPolling();
    this._pollInterval = setInterval(async () => {
      const sesionActual = this.sesion();
      if (!sesionActual || sesionActual.estado !== 'esperando') {
        this._detenerPolling();
        return;
      }

      const { data } = await this.supabase.client
        .from('sesiones')
        .select('estado, iniciada_en')
        .eq('id', sesionId)
        .single();

      if (data && data.estado !== sesionActual.estado) {
        this.sesion.update((s) =>
          s ? { ...s, estado: data.estado, iniciada_en: data.iniciada_en ?? s.iniciada_en } : null
        );
        if (data.estado === 'activa') this._detenerPolling();
      }
    }, 4000);
  }

  private _detenerPolling(): void {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }
}
