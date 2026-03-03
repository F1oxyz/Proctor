// =============================================================
// shared/pipes/tiempo-formato.pipe.ts
// Transforma segundos numéricos a formato legible "mm:ss".
// Uso en plantilla: {{ tiempoEnSegundos | tiempoFormato }}
// Uso en código: inject(TiempoFormatoPipe).transform(180) → "3:00"
// =============================================================

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'tiempoFormato',
  // Pure pipe: solo recalcula cuando cambia el valor de entrada.
  // Seguro para usar en componentes OnPush.
  pure: true,
})
export class TiempoFormatoPipe implements PipeTransform {
  /**
   * Convierte segundos a formato "m:ss" o "mm:ss".
   * @param segundos - Número total de segundos (puede ser negativo → muestra "0:00")
   * @returns String formateado. Ej: 65 → "1:05", 3600 → "60:00"
   */
  transform(segundos: number | null | undefined): string {
    if (segundos == null || segundos < 0) return '0:00';

    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);

    // Segundos siempre con 2 dígitos. Minutos sin padding.
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}