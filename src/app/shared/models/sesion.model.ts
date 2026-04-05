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
 * SesionAlumno con nombre del alumno aplanado desde el JOIN.
 * Se usa en el panel de monitoreo y en la tabla de resultados.
 */
export interface SesionAlumnoConDatos extends SesionAlumno {
  /** Nombre completo del alumno aplanado desde alumnos.nombre_completo */
  alumno_nombre: string;
}

/**
 * SesionAlumnoConDatos enriquecida con el total de preguntas del examen.
 * Se usa únicamente en la pantalla de resultados del docente (RF-05)
 * para calcular la columna "Sin cumplir" sin necesidad de `as any`.
 */
export interface SesionAlumnoResultado extends SesionAlumnoConDatos {
  /** Total de preguntas del examen. Se inyecta en ResultadosComponent al mapear. */
  total_preguntas: number;
}

// ─── SesionResumen ────────────────────────────────────────

/**
 * Sesión resumida para historiales y listas de sesiones recientes.
 * Se usa tanto en ExamenesService (historial) como en SesionesService (listados).
 * No es una tabla real: se obtiene con un SELECT + JOIN examenes(titulo).
 */
export interface SesionResumen {
  id: string;
  codigo_acceso: string;
  estado: string;          // 'esperando' | 'activa' | 'finalizada'
  iniciada_en: string | null;
  finalizada_en: string | null;
  /** Título del examen asociado (aplanado desde examenes.titulo) */
  examen_titulo: string;
}