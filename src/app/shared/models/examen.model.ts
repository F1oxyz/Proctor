// =============================================================
// shared/models/examen.model.ts
// Representa un examen creado por un maestro para un grupo.
// Relación: grupos (1) → examenes (N) → preguntas (N) → opciones (N)
// =============================================================

/** Tipos de pregunta soportados (ENUM en Supabase) */
export type TipoPregunta = 'opcion_multiple' | 'texto_abierto';

// ─── Examen ───────────────────────────────────────────────

export interface Examen {
  /** UUID generado por Supabase */
  id: string;
  /** FK → grupos.id. El examen pertenece a un grupo específico */
  grupo_id: string;
  /** FK → maestros.id. Usado para RLS (solo el maestro dueño puede editarlo) */
  maestro_id: string;
  /** Título del examen. Ej: "Examen Final - Dibujo Industrial" */
  titulo: string;
  /** Duración en minutos. Default: 30 */
  duracion_min: number;
  /** Fecha de creación */
  creado_en: string;
}

/**
 * Examen completo con preguntas y sus opciones.
 * Se usa al cargar el formulario de edición y en la vista del alumno.
 */
export interface ExamenCompleto extends Examen {
  preguntas: PreguntaConOpciones[];
}

// ─── Pregunta ─────────────────────────────────────────────

export interface Pregunta {
  /** UUID generado por Supabase */
  id: string;
  /** FK → examenes.id */
  examen_id: string;
  /** Texto de la pregunta */
  texto: string;
  /**
   * Tipo de pregunta (ENUM en Supabase).
   * - 'opcion_multiple': muestra opciones A/B/C/D
   * - 'texto_abierto': el alumno escribe su respuesta
   */
  tipo: TipoPregunta;
  /** Fecha de creación */
  creado_en: string;
}

/** Pregunta con sus opciones de respuesta incluidas */
export interface PreguntaConOpciones extends Pregunta {
  opciones: Opcion[];
}

// ─── Opción ───────────────────────────────────────────────

export interface Opcion {
  /** UUID generado por Supabase */
  id: string;
  /** FK → preguntas.id */
  pregunta_id: string;
  /** Texto de la opción. Ej: "F = ma" */
  texto: string;
  /** Si es true, esta opción es la respuesta correcta */
  es_correcta: boolean;
  /** Posición visual de la opción (0, 1, 2, 3 → A, B, C, D) */
  orden: number;
}