/**
 * Estado vacío con ícono, título y mensaje descriptivo.
 * Íconos disponibles: 'grupos' | 'examenes' | 'alumnos' | 'monitor' | 'default'
 */

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

      <div class="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
        @if (icono() === 'grupos') {
          <svg class="w-8 h-8 text-brand" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
        }
        @if (icono() === 'examenes') {
          <svg class="w-8 h-8 text-brand" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
        }
        @if (icono() === 'alumnos') {
          <svg class="w-8 h-8 text-brand" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m0-6l-3.5-1.944M12 20l-9-5"/>
          </svg>
        }
        @if (icono() === 'monitor') {
          <svg class="w-8 h-8 text-brand" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        }
        @if (icono() === 'default') {
          <svg class="w-8 h-8 text-brand" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
        }
      </div>

      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold text-slate-700">{{ titulo() }}</h3>
        @if (mensaje()) {
          <p class="text-sm text-slate-400 max-w-xs">{{ mensaje() }}</p>
        }
      </div>

      <ng-content />

    </div>
  `,
})
export class EmptyStateComponent {
  icono  = input<EmptyStateIcono>('default');
  titulo = input.required<string>();
  mensaje = input<string>('');
}