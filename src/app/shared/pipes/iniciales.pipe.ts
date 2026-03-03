// =============================================================
// shared/pipes/iniciales.pipe.ts
// Extrae las iniciales de un nombre completo para mostrar
// en los avatares circulares (alumno-tile, tabla de alumnos).
// Uso en plantilla: {{ 'Juan Pérez' | iniciales }} → "JP"
// Uso en plantilla: {{ 'Ana' | iniciales }} → "A"
// =============================================================

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'iniciales',
  pure: true,
})
export class InicialesPipe implements PipeTransform {
  /**
   * Extrae hasta 2 iniciales en mayúsculas de un nombre completo.
   * @param nombre - Nombre completo. Ej: "Juan Pérez García"
   * @returns Iniciales en mayúsculas. Ej: "JP"
   *          Si el nombre está vacío, retorna "??"
   */
  transform(nombre: string | null | undefined): string {
    if (!nombre?.trim()) return '??';

    const palabras = nombre.trim().split(/\s+/);

    if (palabras.length === 1) {
      // Un solo nombre: primera letra
      return palabras[0].charAt(0).toUpperCase();
    }

    // Tomar primera letra del primer nombre y primer letra del primer apellido
    return (palabras[0].charAt(0) + palabras[1].charAt(0)).toUpperCase();
  }
}