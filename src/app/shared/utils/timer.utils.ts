/**
 * Utilidades compartidas para el temporizador de examen.
 *
 * Centraliza dos responsabilidades que estaban duplicadas entre:
 *   - examen.component.ts     (vista del alumno)
 *   - monitor.component.ts    (vista del docente)
 *
 * CRITERIO DE AGOTAMIENTO UNIFICADO: s <= 0
 * El tick que lleva el contador de 1 → 0 muestra "00:00" antes de
 * disparar la acción de fin de tiempo. Usar s <= 1 saltaría ese último
 * segundo visible, cerrando la sesión cuando aún se mostraba "00:01".
 */

/**
 * Calcula los segundos restantes de un examen descontando el tiempo
 * ya transcurrido desde que fue iniciado.
 *
 * @param duracionMin   Duración total del examen en minutos.
 * @param iniciadaEn    Timestamp ISO del momento en que arrancó la sesión.
 *                      Si es null/undefined se devuelve la duración completa.
 * @returns             Segundos restantes (nunca negativo).
 *
 * @example
 * // Examen de 60 min iniciado hace 10 min → 3000 seg restantes
 * calcularSegundosRestantes(60, sesion.iniciada_en)
 */
export function calcularSegundosRestantes(
  duracionMin: number,
  iniciadaEn: string | null | undefined,
): number {
  const totalSeg = duracionMin * 60;
  if (!iniciadaEn) return totalSeg;
  const iniciadaMs = new Date(iniciadaEn).getTime();
  const transcurridos = Math.floor((Date.now() - iniciadaMs) / 1000);
  return Math.max(0, totalSeg - transcurridos);
}

/**
 * Devuelve true cuando el temporizador debe disparar la acción de fin de tiempo.
 *
 * Umbral adoptado: `segundos <= 0`
 * - Garantiza que el tick que decrementa 1 → 0 muestre "00:00" antes de actuar.
 * - Evitar `<= 1` que disparaba el cierre cuando aún se mostraba "00:01".
 *
 * @param segundos  Valor actual del contador (resultado del decremento).
 */
export function tiempoAgotado(segundos: number): boolean {
  return segundos <= 0;
}
