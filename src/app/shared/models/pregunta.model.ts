// =============================================================
// shared/models/pregunta.model.ts
// Modelos relacionados a preguntas y opciones de respuesta.
// NOTA: Estos tipos ya están definidos dentro de examen.model.ts
// como parte del modelo completo del examen. Este archivo los
// re-exporta de forma independiente para poder importarlos
// directamente sin necesidad de traer todo el modelo de examen.
//
// Relación en BD:
//   examenes (1) → preguntas (N) → opciones (N)
//
// La tabla `preguntas` NO tiene columna `orden` (ver PDF de BD).
// El orden se maneja de forma aleatoria en la vista del alumno.
// =============================================================

// Re-exportamos desde examen.model para mantener una sola fuente de verdad.
// Si necesitas importar solo tipos de preguntas u opciones sin cargar
// el modelo de examen completo, usa este archivo.
export type {
  TipoPregunta,
  Pregunta,
  PreguntaConOpciones,
  Opcion,
} from './examen.model';