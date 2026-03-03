// =============================================================
// shared/models/sesion.model.ts
// Una Sesión es una instancia activa de un examen en curso.
// El maestro crea la sesión → se genera un código de acceso →
// los alumnos entran con ese código.
//
// sesion_alumnos es la tabla puente entre sesiones y alumnos,
// y guarda también los resultados finales del alumno.
// =============================================================

/** Estados posibles de una sesión (ENUM en Supabase) */
export type EstadoSesion = 'esperando' | 'activa' | 'finalizada';

/** Estados del alumno dentro de una sesión (ENUM en Supabase) */
export type EstadoAlumnoSesion = 'unido' | 'en_progreso' | 'enviado';

// ─── Sesión ───────────────────────────────────────────────

export interface Sesion {
  /** UUID generado por Supabase */
  id: string;
  /** FK → examenes.id */
  examen_id: string;
  /** FK → maestros.id */
  maestro_id: string;
  /**
   * Código corto y único que los alumnos usan para entrar.
   * Generado al crear la sesión. Ej: "MATH-101", "DI-2024"
   */
  codigo_acceso: string;
  /** Estado actual de la sesión */
  estado: EstadoSesion;
  /** Timestamp de cuando el maestro inició el examen (null si aún no inicia) */
  iniciada_en: string | null;
  /** Timestamp de cuando el maestro terminó el examen (null si no ha finalizado) */
  finalizada_en: string | null;
  /** Fecha de creación */
  creado_en: string;
}

// ─── SesionAlumno ─────────────────────────────────────────

export interface SesionAlumno {
  /** UUID generado por Supabase */
  id: string;
  /** FK → sesiones.id */
  sesion_id: string;
  /** FK → alumnos.id */
  alumno_id: string;
  /**
   * PeerID de PeerJS para la conexión WebRTC.
   * Se registra cuando el alumno comparte su pantalla.
   * NULL si el alumno aún no ha compartido pantalla.
   */
  peer_id: string | null;
  /** Estado actual del alumno en esta sesión */
  estado: EstadoAlumnoSesion;
  /** Timestamp de cuando el alumno comenzó el examen */
  iniciado_en: string | null;
  /** Timestamp de cuando el alumno envió sus respuestas */
  enviado_en: string | null;
  /** Tiempo real usado en minutos (calculado al enviar) */
  tiempo_usado_min: number | null;
  /** Porcentaje de respuestas correctas (0.00 a 100.00) */
  porcentaje: number | null;
  /** Total de preguntas respondidas correctamente */
  total_correctas: number | null;
  /** Total de preguntas respondidas incorrectamente */
  total_incorrectas: number | null;
  /** Fecha de creación */
  creado_en: string;
}

/**
 * SesionAlumno con datos del alumno incluidos via JOIN.
 * Se usa en el panel de monitoreo y en la tabla de resultados.
 */
export interface SesionAlumnoConDatos extends SesionAlumno {
  alumno: {
    nombre_completo: string;
  };
}