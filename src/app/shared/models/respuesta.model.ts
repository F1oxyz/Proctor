// =============================================================
// shared/models/respuesta.model.ts
// Representa la respuesta de un alumno a una pregunta específica
// dentro de una sesión. Los alumnos insertan sus respuestas de
// forma anónima (acceso anon de Supabase, sin JWT).
//
// Regla de unicidad: (sesion_alumno_id, pregunta_id) UNIQUE
// → cada alumno solo puede responder una vez por pregunta.
// =============================================================

export interface Respuesta {
  /** UUID generado por Supabase */
  id: string;
  /** FK → sesion_alumnos.id */
  sesion_alumno_id: string;
  /** FK → preguntas.id */
  pregunta_id: string;
  /**
   * FK → opciones.id (nullable).
   * Solo se llena en preguntas de tipo 'opcion_multiple'.
   * NULL en preguntas abiertas.
   */
  opcion_id: string | null;
  /**
   * Si la respuesta fue correcta.
   * - En opcion_multiple: se calcula automáticamente al insertar (via opciones.es_correcta).
   * - En texto_abierto: NULL hasta que el maestro la revise manualmente.
   */
  es_correcta: boolean | null;
  /**
   * Texto de respuesta abierta.
   * Solo se llena en preguntas de tipo 'texto_abierto'.
   * NULL en preguntas de opción múltiple.
   */
  respuesta_abierta: string | null;
  /** Timestamp de cuando el alumno respondió */
  respondido_en: string;
}