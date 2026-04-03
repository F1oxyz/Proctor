// =============================================================
// shared/pipes/iniciales.pipe.ts
// Extrae las iniciales de un nombre completo para mostrar
// en los avatares circulares (alumno-tile, tabla de alumnos).
// Uso en plantilla: {{ 'Juan Pérez' | iniciales }} → "JP"
// Uso en plantilla: {{ 'Ana' | iniciales }} → "A"
// =============================================================

import { Pipe, PipeTransform } from '@angular/core';
import { getIniciales } from '../utils/avatar.utils';

@Pipe({
  name: 'iniciales',
  pure: true,
})
export class InicialesPipe implements PipeTransform {
  /**
   * Extrae hasta 2 iniciales en mayúsculas de un nombre completo.
   * Delega en getIniciales() de avatar.utils para tener una única fuente de verdad.
   * @param nombre - Nombre completo. Ej: "Juan Pérez García"
   * @returns Iniciales en mayúsculas. Ej: "JP"
   *          Si el nombre está vacío, retorna "?"
   */
  transform(nombre: string | null | undefined): string {
    return getIniciales(nombre ?? '');
  }
}