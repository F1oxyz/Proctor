// =============================================================
// shared/components/empty-state/empty-state.component.ts
// Pantalla vacía con ícono, título y mensaje descriptivo.
// Se usa cuando una lista no tiene datos (ej: sin grupos,
// sin exámenes, sin alumnos conectados).
//
// Íconos disponibles:
//   'grupos'   → Ícono de personas/grupos
//   'examenes' → Ícono de documento/examen
//   'alumnos'  → Ícono de graduación
//   'monitor'  → Ícono de pantalla/monitor
//   'default'  → Ícono de bandeja vacía
//
// Uso:
//   <app-empty-state
//     icono="grupos"
//     titulo="Sin grupos creados"
//     mensaje="Crea tu primer grupo para comenzar a evaluar."
//   >
//     <!-- Opcional: botón de acción proyectado -->
//     <app-btn variante="primary">Crear Grupo</app-btn>
//   </app-empty-state>
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

export type EmptyStateIcono = 'grupos' | 'examenes' | 'alumnos' | 'monitor' | 'default';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">

      <!-- Ícono en círculo de fondo -->
      <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
        <!-- Grupos -->
        @if (icono() === 'grupos') {
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
        }
        <!-- Exámenes -->
        @if (icono() === 'examenes') {
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
        }
        <!-- Alumnos -->
        @if (icono() === 'alumnos') {
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m0-6l-3.5-1.944M12 20l-9-5"/>
          </svg>
        }
        <!-- Monitor -->
        @if (icono() === 'monitor') {
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        }
        <!-- Default / bandeja -->
        @if (icono() === 'default') {
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
        }
      </div>

      <!-- Textos -->
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold text-slate-700">{{ titulo() }}</h3>
        @if (mensaje()) {
          <p class="text-sm text-slate-400 max-w-xs">{{ mensaje() }}</p>
        }
      </div>

      <!-- Slot para botón u acción opcional -->
      <ng-content />

    </div>
  `,
})
export class EmptyStateComponent {
  /** Ícono a mostrar. Default: 'default' */
  icono = input<EmptyStateIcono>('default');

  /** Título principal del estado vacío */
  titulo = input.required<string>();

  /** Mensaje descriptivo opcional */
  mensaje = input<string>('');
}