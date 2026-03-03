// =============================================================
// shared/components/btn/btn.component.ts
// Botón reutilizable con variantes de estilo, tamaños y estado
// de carga (spinner animado).
//
// Variantes:
//   'primary'   → Azul (acciones principales)
//   'secondary' → Contorno gris (acciones secundarias)
//   'danger'    → Rojo (acciones destructivas)
//   'ghost'     → Transparente con texto (acciones terciarias)
//   'dark'      → Slate-800 oscuro (Iniciar Sesión, Crear Cuenta)
//
// Tamaños:
//   'sm'  → py-1.5 text-xs
//   'md'  → py-2.5 text-sm (default)
//   'lg'  → py-3 text-base
//
// Uso:
//   <app-btn variante="primary" (clicked)="guardar()">Guardar</app-btn>
//   <app-btn variante="danger" [loading]="guardando()">Eliminar</app-btn>
//   <app-btn variante="secondary" tipo="button">Cancelar</app-btn>
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  booleanAttribute,
} from '@angular/core';

export type BtnVariante = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark';
export type BtnTamano = 'sm' | 'md' | 'lg';
export type BtnTipo = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-btn',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // El host es display:contents para no romper layouts flex/grid del padre
    'class': 'contents',
  },
  template: `
    <button
      [type]="tipo()"
      [disabled]="disabled() || loading()"
      [class]="clases()"
      (click)="!disabled() && !loading() && clicked.emit()"
      [attr.aria-disabled]="disabled() || loading()"
      [attr.aria-busy]="loading()"
    >
      <!-- Spinner de carga -->
      @if (loading()) {
        <svg
          class="animate-spin shrink-0"
          [class]="iconSize()"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      }
      <!-- Contenido proyectado (texto, íconos, etc.) -->
      <ng-content />
    </button>
  `,
})
export class BtnComponent {
  // ── Inputs ─────────────────────────────────────────────

  /** Variante de estilo del botón. Default: 'primary' */
  variante = input<BtnVariante>('primary');

  /** Tamaño del botón. Default: 'md' */
  tamano = input<BtnTamano>('md');

  /** Tipo HTML del botón. Default: 'button' */
  tipo = input<BtnTipo>('button');

  /** Si true, muestra un spinner y deshabilita el botón */
  loading = input(false, { transform: booleanAttribute });

  /** Si true, deshabilita el botón sin mostrar spinner */
  disabled = input(false, { transform: booleanAttribute });

  /** Si true, el botón ocupa el 100% del ancho del contenedor */
  fullWidth = input(false, { transform: booleanAttribute });

  // ── Outputs ────────────────────────────────────────────

  /** Emitido al hacer clic (solo si no está disabled ni loading) */
  clicked = output<void>();

  // ── Computed ───────────────────────────────────────────

  /** Tamaño del ícono del spinner según el tamaño del botón */
  iconSize = computed(() => {
    const sizes: Record<BtnTamano, string> = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };
    return sizes[this.tamano()];
  });

  /** Clases de Tailwind calculadas según variante, tamaño y estado */
  clases = computed(() => {
    const base = [
      'inline-flex items-center justify-center gap-2',
      'font-medium rounded-lg transition-colors cursor-pointer',
      'focus:outline-none focus:ring-2 focus:ring-offset-1',
      'disabled:cursor-not-allowed',
    ];

    // Tamaños
    const tamanos: Record<BtnTamano, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-5 py-3 text-base',
    };

    // Variantes
    const variantes: Record<BtnVariante, string> = {
      primary:
        'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 focus:ring-blue-500',
      secondary:
        'bg-white text-slate-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400 focus:ring-gray-300',
      danger:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300 focus:ring-red-500',
      ghost:
        'bg-transparent text-slate-600 hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-300 focus:ring-gray-300',
      dark:
        'bg-slate-800 text-white hover:bg-slate-900 active:bg-black disabled:bg-slate-300 focus:ring-slate-500',
    };

    const width = this.fullWidth() ? 'w-full' : '';

    return [
      ...base,
      tamanos[this.tamano()],
      variantes[this.variante()],
      width,
    ]
      .filter(Boolean)
      .join(' ');
  });
}