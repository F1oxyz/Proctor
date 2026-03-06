/**
 * examen-activo.service.ts
 * ─────────────────────────────────────────────────────────────────
 * BUGS CORREGIDOS:
 *  - Bug 1: Flujo de unión → nuevo método unirseASala() con estado 'unido'
 *           iniciarExamen() actualiza el registro existente si ya se unió
 *  - Bug 4: SesionActiva incluye iniciada_en para sincronizar el temporizador
 *  - Bug 6: Polling de respaldo cada 4 s cuando la sesión está 'esperando'
 *           (por si Realtime no está configurado en Supabase)
 * ─────────────────────────────────────────────────────────────────
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Tipos locales ─────────────────────────────────────────────────

/** Opción de respuesta tal como viene de la DB */
export interface OpcionActiva {
  id: string;
  texto: string;
  es_correcta: boolean;
  orden: number;
}

/** Pregunta con sus opciones */
export interface PreguntaActiva {
  id: string;
  texto: string;
  tipo: 'opcion_multiple' | 'texto_abierto';
  opciones: OpcionActiva[];
}

/** Datos del alumno seleccionado de la lista */
export interface AlumnoActivo {
  id: string;
  nombre_completo: string;
}

/** Datos de la sesión cargada por código de acceso */
export interface SesionActiva {
  id: string;
  examen_id: string;
  examen_titulo: string;
  grupo_id: string;
  duracion_min: number;
  codigo_acceso: string;
  estado: string;        // 'esperando' | 'activa' | 'finalizada'
  iniciada_en: string | null;  // Bug 4: cuándo inició el examen
}

/** Respuesta guardada localmente mientras el alumno navega */
export interface RespuestaLocal {
  pregunta_id: string;
  opcion_id: string | null;
  respuesta_abierta: string | null;
  respondido_en: string;
}

/** Resultado final calculado al enviar */
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
  // ── Dependencias ────────────────────────────────────────────────
  private readonly supabase = inject(SupabaseService);

  // ── Canales Realtime y polling ────────────────────────────────────
  private _canalEstadoSesion: ReturnType<typeof this.supabase.client.channel> | null = null;
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  // ── Estado principal (signals) ───────────────────────────────────

  readonly sesion         = signal<SesionActiva | null>(null);
  readonly alumno         = signal<AlumnoActivo | null>(null);
  readonly listaAlumnos   = signal<AlumnoActivo[]>([]);
  readonly preguntas      = signal<PreguntaActiva[]>([]);
  readonly indicePreguntaActual = signal(0);
  readonly respuestas     = signal<Map<string, RespuestaLocal>>(new Map());
  readonly sesionAlumnoId = signal<string | null>(null);
  readonly tiempoInicio   = signal<number | null>(null);
  readonly resultadoFinal = signal<ResultadoFinal | null>(null);
  readonly cargando       = signal(false);
  readonly error          = signal<string | null>(null);

  // ── Computed ─────────────────────────────────────────────────────

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

  // ── Métodos públicos ────────────────────────────────────────────

  /**
   * Carga los datos de la sesión a partir del código de acceso.
   * También carga la lista de alumnos del grupo para el dropdown.
   */
  async cargarSesionPorCodigo(codigo: string): Promise<boolean> {
    this.cargando.set(true);
    this.error.set(null);

    // Bug 4: incluir iniciada_en en la query
    const { data: sesionData, error: sesionError } = await this.supabase.client
      .from('sesiones')
      .select(`
        id,
        examen_id,
        codigo_acceso,
        estado,
        iniciada_en,
        examenes ( titulo, duracion_min, grupo_id )
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

    const examenJoin = (sesionData as any).examenes;
    const grupoId    = examenJoin?.grupo_id ?? '';

    if (!grupoId) {
      this.error.set('No se pudo determinar el grupo del examen.');
      this.cargando.set(false);
      return false;
    }

    this.sesion.set({
      id:            sesionData.id,
      examen_id:     sesionData.examen_id,
      examen_titulo: examenJoin?.titulo ?? '—',
      grupo_id:      grupoId,
      duracion_min:  examenJoin?.duracion_min ?? 30,
      codigo_acceso: sesionData.codigo_acceso,
      estado:        sesionData.estado,
      iniciada_en:   (sesionData as any).iniciada_en ?? null,  // Bug 4
    });

    // Bug 6: Realtime + polling de respaldo para detectar cambio de estado
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
   * Bug 1: Registra al alumno en la sala de espera con estado 'unido'.
   * El profesor lo verá en el monitor. Se llama antes de iniciarExamen().
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
        // Ya existía un registro (recargó la página), reutilizarlo
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

  /**
   * Carga las preguntas del examen en orden aleatorio.
   */
  async cargarPreguntas(examenId: string): Promise<boolean> {
    this.cargando.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('preguntas')
      .select(`
        id,
        texto,
        tipo,
        opciones ( id, texto, es_correcta, orden )
      `)
      .eq('examen_id', examenId);

    if (error || !data) {
      this.error.set('No se pudieron cargar las preguntas del examen.');
      this.cargando.set(false);
      return false;
    }

    const mezcladas = fisherYates([...data]);
    const conOpcionesMezcladas: PreguntaActiva[] = mezcladas.map((p: any) => ({
      id:      p.id,
      texto:   p.texto,
      tipo:    p.tipo,
      opciones: fisherYates([...(p.opciones ?? [])]),
    }));

    this.preguntas.set(conOpcionesMezcladas);
    this.indicePreguntaActual.set(0);
    this.cargando.set(false);
    return true;
  }

  /**
   * Bug 1: Inicia el examen formal del alumno.
   * Si ya se unió (sesionAlumnoId está seteado), actualiza el registro existente.
   * Si no se unió todavía, inserta uno nuevo.
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
      // Bug 1: Ya se unió con 'unido' → actualizar a 'en_progreso'
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
      // Flujo sin sala de espera previa: INSERT directo
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
    this._detenerPolling(); // Ya en el examen, no necesitamos polling de espera

    const ok = await this.cargarPreguntas(sesion.examen_id);
    this.cargando.set(false);
    return ok;
  }

  /**
   * Guarda la respuesta de la pregunta actual en mapa local y en Supabase.
   */
  async guardarRespuesta(
    opcionId: string | null,
    respuestaAbierta: string | null = null
  ): Promise<void> {
    const pregunta     = this.preguntaActual();
    const sesionAlumno = this.sesionAlumnoId();

    if (!pregunta || !sesionAlumno) return;

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
    }
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
        // Pregunta abierta: requiere revisión manual del docente
        if (respuesta.respuesta_abierta?.trim()) {
          totalCorrectas++; // Provisionalmente correcta hasta revisión
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

  /**
   * Recupera el resultado de Supabase usando el ID de sesion_alumnos.
   * Se usa cuando el alumno recarga la página en /resultado.
   */
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

  /**
   * Recupera el resultado usando el código de sesión y el ID del alumno.
   * Fallback cuando sesionAlumnoId no está en memoria (recarga completa).
   */
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
  }

  // ── Realtime ──────────────────────────────────────────────────────

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
          const nuevoEstado   = (payload.new as any)?.estado;
          const nuevaIniciada = (payload.new as any)?.iniciada_en ?? null;
          if (nuevoEstado) {
            this.sesion.update((s) =>
              s ? { ...s, estado: nuevoEstado, iniciada_en: nuevaIniciada ?? s.iniciada_en } : null
            );
            // Si ya está activa, detener el polling
            if (nuevoEstado === 'activa') this._detenerPolling();
          }
        }
      )
      .subscribe();
  }

  private _desuscribirseDeEstado(): void {
    if (this._canalEstadoSesion) {
      this.supabase.client.removeChannel(this._canalEstadoSesion);
      this._canalEstadoSesion = null;
    }
  }

  /**
   * Bug 6: Polling de respaldo cada 4 s cuando la sesión está 'esperando'.
   * Garantiza que el estado se actualice aunque Realtime no esté configurado.
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
