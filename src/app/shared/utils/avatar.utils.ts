/**
 * Utilidades compartidas para avatares.
 *
 * Estas funciones estaban duplicadas en:
 *   - tabla-alumnos.component.ts
 *   - fila-resultado.component.ts
 *   - alumno-tile.component.ts
 *   - navbar.component.ts
 *   - examen.component.ts
 *   - resultado-alumno.component.ts
 */

/** Paleta de colores para avatares generados por hash */
const COLORES_AVATAR = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

/**
 * Genera un color de avatar determinístico basado en el nombre.
 * El mismo nombre siempre produce el mismo color.
 *
 * @param nombre Nombre completo del alumno/usuario
 * @returns Color hexadecimal (ej: '#3b82f6')
 */
export function colorAvatar(nombre: string): string {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORES_AVATAR[Math.abs(hash) % COLORES_AVATAR.length];
}

/**
 * Genera las iniciales de un nombre (máximo 2 caracteres, mayúsculas).
 *
 * @param nombre Nombre completo (ej: 'Juan Pérez García')
 * @returns Iniciales (ej: 'JP'). '?' si el nombre está vacío.
 *
 * @example
 * getIniciales('Juan Pérez')   // → 'JP'
 * getIniciales('Ana')          // → 'A'
 * getIniciales('')             // → '?'
 */
export function getIniciales(nombre: string): string {
  if (!nombre?.trim()) return '?';
  const palabras = nombre.trim().split(/\s+/);
  return palabras.length >= 2
    ? (palabras[0][0] + palabras[1][0]).toUpperCase()
    : palabras[0][0].toUpperCase();
}
