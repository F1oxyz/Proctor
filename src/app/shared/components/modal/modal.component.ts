/**
 * Modal reutilizable con backdrop, animación de entrada y soporte Escape.
 * Content projection: [modal-header] | (body) | [modal-footer]
 *
 * Uso:
 *   <app-modal [abierto]="mostrarModal()" (cerrar)="mostrarModal.set(false)">
 *     <h2 modal-header>Título</h2>
 *     <p>Cuerpo del modal...</p>
 *     <div modal-footer>
 *       <app-btn variante="primary" (clicked)="guardar()">Guardar</app-btn>
 *     </div>
 *   </app-modal>
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  computed,
  booleanAttribute,
  inject,
  DestroyRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'contents', // no debe tener posición propia; overlay es absoluto
  },
  template: `
    @if (abierto()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        (click)="onBackdropClick()"
        aria-hidden="true"
      ></div>

      <!-- Panel del modal -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="relative bg-white rounded-xl shadow-xl w-full border border-gray-100
                 animate-in fade-in zoom-in-95 duration-200"
          [class]="anchoClase()"
          (click)="$event.stopPropagation()"
        >
          <!-- Botón X para cerrar -->
          @if (mostrarCerrar()) {
            <button
              (click)="cerrar.emit()"
              class="absolute top-4 right-4 p-1 rounded-md text-slate-400
                     hover:text-brand hover:bg-brand/10 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          }

          <!-- Header proyectado -->
          <div class="px-6 pt-6 pb-0">
            <ng-content select="[modal-header]" />
          </div>

          <!-- Cuerpo proyectado -->
          <div class="px-6 py-5">
            <ng-content />
          </div>

          <!-- Footer proyectado -->
          <div class="px-6 pb-6 flex items-center justify-end gap-3">
            <ng-content select="[modal-footer]" />
          </div>

        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  abierto               = input(false, { transform: booleanAttribute });
  ancho                 = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  mostrarCerrar         = input(true, { transform: booleanAttribute });
  /** Poner en false para modales destructivos donde no se debe cerrar por accidente. */
  cerrarAlClickBackdrop = input(true, { transform: booleanAttribute });

  /** El padre decide si realmente cierra actualizando [abierto]. */
  cerrar = output<void>();

  /** Clase Tailwind para el ancho máximo del panel */
  anchoClase = computed(() => {
    const anchos: Record<string, string> = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
    };
    return anchos[this.ancho()] ?? 'max-w-md';
  });

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.document.body.style.overflow = 'hidden';
      } else {
        this.document.body.style.overflow = '';
      }
    });

    // Restaurar overflow si el componente se destruye con el modal todavía abierto
    this.destroyRef.onDestroy(() => {
      this.document.body.style.overflow = '';
    });

    effect(() => {
      if (this.abierto()) {
        const handler = (e: KeyboardEvent) => {
          if (e.key === 'Escape') this.cerrar.emit();
        };
        this.document.addEventListener('keydown', handler);
        return () => this.document.removeEventListener('keydown', handler);
      }
      return;
    });
  }

  onBackdropClick() {
    if (this.cerrarAlClickBackdrop()) {
      this.cerrar.emit();
    }
  }
}