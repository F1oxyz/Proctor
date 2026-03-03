// =============================================================
// shared/models/grupo.model.ts
// Representa un grupo o materia creada por un maestro.
// Relación: maestros (1) → grupos (N) → alumnos (N)
// =============================================================

export interface Grupo {
  /** UUID generado por Supabase (gen_random_uuid) */
  id: string;
  /** FK → maestros.id. Solo el maestro dueño puede ver/editar este grupo (RLS) */
  maestro_id: string;
  /** Nombre del grupo o materia. Ej: "Dibujo Industrial - 2do Cuatri" */
  nombre: string;
  /** Descripción opcional del grupo */
  descripcion?: string | null;
  /** Fecha de creación */
  creado_en: string;
}

/**
 * Grupo con conteo de alumnos precalculado.
 * Se usa en la vista de Gestión de Grupos para mostrar stats.
 * No es una tabla real: se obtiene con un JOIN o RPC de Supabase.
 */
export interface GrupoConStats extends Grupo {
  total_alumnos: number;
}