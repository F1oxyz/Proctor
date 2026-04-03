/**
 * Botón reutilizable con variantes, tamaños y estado de carga.
 * Variantes: primary | secondary | danger | ghost | dark
 * Tamaños: sm | md (default) | lg
 */

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
    'class': 'contents', // display:contents para no romper layouts flex/grid del padre
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
      <ng-content />
    </button>
  `,
})
export class BtnComponent {
  variante  = input<BtnVariante>('primary');
  tamano    = input<BtnTamano>('md');
  tipo      = input<BtnTipo>('button');
  loading   = input(false, { transform: booleanAttribute });
  disabled  = input(false, { transform: booleanAttribute });
  fullWidth = input(false, { transform: booleanAttribute });

  clicked = output<void>();

  iconSize = computed(() => {
    const sizes: Record<BtnTamano, string> = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };
    return sizes[this.tamano()];
  });

  clases = computed(() => {
    const base = [
      'inline-flex items-center justify-center gap-2',
      'font-medium rounded-lg transition-colors cursor-pointer',
      'focus:outline-none focus:ring-2 focus:ring-offset-1',
      'disabled:cursor-not-allowed',
    ];

    const tamanos: Record<BtnTamano, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-5 py-3 text-base',
    };

    const variantes: Record<BtnVariante, string> = {
      primary:
        'bg-brand text-white hover:bg-brand/90 active:bg-brand/80 disabled:bg-brand/30 focus:ring-brand',
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