// =============================================================
// shared/components/loading-spinner/loading-spinner.component.ts
// Spinner de carga animado con soporte para overlay de pantalla
// completa y diferentes tamaños.
//
// Tamaños:
//   'sm'  → w-4 h-4  (dentro de botones o inline)
//   'md'  → w-8 h-8  (dentro de secciones)
//   'lg'  → w-12 h-12 (pantalla de carga principal)
//
// Uso:
//   <app-loading-spinner />                  → md, sin overlay
//   <app-loading-spinner tamano="lg" />      → lg, sin overlay
//   <app-loading-spinner [overlay]="true" /> → pantalla completa
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  booleanAttribute,
} from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (overlay()) {
      <!-- Overlay de pantalla completa -->
      <div
        class="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center"
        role="status"
        aria-label="Cargando..."
      >
        <div class="flex flex-col items-center gap-3">
          <ng-container *ngTemplateOutlet="spinnerTpl" />
          @if (mensaje()) {
            <p class="text-sm text-slate-500">{{ mensaje() }}</p>
          }
        </div>
      </div>
    } @else {
      <!-- Spinner inline -->
      <div
        class="flex items-center justify-center"
        role="status"
        [attr.aria-label]="mensaje() || 'Cargando...'"
      >
        <ng-container *ngTemplateOutlet="spinnerTpl" />
      </div>
    }

    <!-- Template del SVG spinner (reutilizado en ambos casos) -->
    <ng-template #spinnerTpl>
      <svg
        [class]="'animate-spin text-blue-600 ' + tamanoClase()"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          class="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </ng-template>
  `,
})
export class LoadingSpinnerComponent {
  /** Tamaño del spinner. Default: 'md' */
  tamano = input<'sm' | 'md' | 'lg'>('md');

  /** Si true, muestra un overlay sobre toda la pantalla */
  overlay = input(false, { transform: booleanAttribute });

  /** Mensaje opcional debajo del spinner (solo en overlay) */
  mensaje = input<string>('');

  /** Clase de tamaño calculada */
  tamanoClase = computed(() => {
    const clases: Record<string, string> = {
      sm: 'w-4 h-4',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
    };
    return clases[this.tamano()] ?? 'w-8 h-8';
  });
}