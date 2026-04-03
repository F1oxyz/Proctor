// =============================================================
// shared/utils/supabase.utils.ts
// Utilidades genéricas para trabajar con respuestas del cliente
// JS de Supabase.
// =============================================================

/**
 * Helper seguro para JOINs de Supabase.
 *
 * El cliente JS de Supabase infiere los JOINs de FK como arrays
 * aunque la relación sea 1:1. Esta función normaliza ese comportamiento:
 * retorna el primer elemento si el valor es un array, o el valor tal cual
 * si ya es un objeto plano.
 *
 * @example
 * // Supabase puede devolver `examenes` como objeto O como array:
 * const examen = primeroDeArray(row.examenes);
 * const titulo = examen?.titulo ?? '—';
 */
export function primeroDeArray<T>(val: T | T[] | null | undefined): T | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}
