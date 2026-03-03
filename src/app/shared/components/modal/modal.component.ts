// =============================================================
// shared/components/modal/modal.component.ts
// Wrapper reutilizable para modales con backdrop, animación
// de entrada y soporte para teclado (Escape para cerrar).
//
// Estructura interna via content projection:
//   - [modal-header] → Título y descripción del modal
//   - (contenido sin selector) → Cuerpo del modal
//   - [modal-footer] → Botones de acción (Cancelar / Guardar)
//
// El modal maneja su propio backdrop y bloquea el scroll del body.
//
// Uso:
//   <app-modal [abierto]="mostrarModal()" (cerrar)="mostrarModal.set(false)">
//     <h2 modal-header>Crear Nuevo Grupo</h2>
//     <p>Contenido del modal...</p>
//     <div modal-footer>
//       <app-btn variante="secondary" (clicked)="cerrar()">Cancelar</app-btn>
//       <app-btn variante="primary" (clicked)="guardar()">Guardar</app-btn>
//     </div>
//   </app-modal>
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  booleanAttribute,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // El host no debe tener posición; el overlay es absoluto dentro del portal
    'class': 'contents',
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
                     hover:text-slate-600 hover:bg-gray-100 transition-colors cursor-pointer"
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

  // ── Inputs ─────────────────────────────────────────────

  /** Controla si el modal está visible */
  abierto = input(false, { transform: booleanAttribute });

  /**
   * Ancho máximo del modal.
   * 'sm' = max-w-sm, 'md' = max-w-md (default), 'lg' = max-w-lg, 'xl' = max-w-xl
   */
  ancho = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  /**
   * Si true, muestra el botón X en la esquina superior derecha.
   * Default: true
   */
  mostrarCerrar = input(true, { transform: booleanAttribute });

  /**
   * Si true, hacer clic en el backdrop cierra el modal.
   * Default: true. Poner en false para modales críticos (ej: confirmar borrar).
   */
  cerrarAlClickBackdrop = input(true, { transform: booleanAttribute });

  // ── Outputs ────────────────────────────────────────────

  /**
   * Emitido cuando el usuario quiere cerrar el modal
   * (clic en X, backdrop, o tecla Escape).
   * El padre decide si realmente cierra actualizando [abierto].
   */
  cerrar = output<void>();

  // ── Computed ───────────────────────────────────────────

  anchoClase = () => {
    const anchos: Record<string, string> = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
    };
    return anchos[this.ancho()] ?? 'max-w-md';
  };

  // ── Effects ────────────────────────────────────────────

  constructor() {
    // Bloquear scroll del body cuando el modal está abierto
    effect(() => {
      if (this.abierto()) {
        this.document.body.style.overflow = 'hidden';
      } else {
        this.document.body.style.overflow = '';
      }
    });

    // Cerrar con Escape
    effect(() => {
      if (this.abierto()) {
        const handler = (e: KeyboardEvent) => {
          if (e.key === 'Escape') this.cerrar.emit();
        };
        this.document.addEventListener('keydown', handler);
        // Cleanup: se llama cuando el efecto se destruye o re-ejecuta
        return () => this.document.removeEventListener('keydown', handler);
      }
      return;
    });
  }

  // ── Métodos ────────────────────────────────────────────

  onBackdropClick() {
    if (this.cerrarAlClickBackdrop()) {
      this.cerrar.emit();
    }
  }
}