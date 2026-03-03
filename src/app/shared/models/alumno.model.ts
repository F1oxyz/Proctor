// =============================================================
// shared/models/alumno.model.ts
// Representa a un estudiante dentro de un grupo.
// Los alumnos NO tienen cuenta de Supabase Auth; solo existen
// como registros en esta tabla. El maestro los crea pegando
// una lista de nombres (uno por línea) al crear un grupo.
// =============================================================

export interface Alumno {
  /** UUID generado por Supabase */
  id: string;
  /** FK → grupos.id. Al borrar el grupo se borran sus alumnos (CASCADE) */
  grupo_id: string;
  /** Nombre completo del alumno. Se muestra en el <select> de la sala de espera */
  nombre_completo: string;
  /** Fecha de creación */
  creado_en: string;
}