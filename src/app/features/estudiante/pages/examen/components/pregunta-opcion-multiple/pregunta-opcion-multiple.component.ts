/**
 * pregunta-opcion-multiple.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Renderiza una pregunta de opción múltiple con sus 4 opciones.
 *
 * DISEÑO (según PDF - página 8):
 *  - Texto de pregunta en negritas grandes
 *  - 4 opciones como botones seleccionables (radio estilo card)
 *  - La opción seleccionada se resalta con borde azul
 *  - Navegación Anterior / Siguiente en el footer
 *
 * ARQUITECTURA:
 *  - Componente dumb: recibe datos, emite selección
 *  - No sabe si la respuesta es correcta (eso solo se calcula al enviar)
 *  - OnPush
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
} from '@angular/core';
import { PreguntaActiva, OpcionActiva } from '../../../../services/examen-activo.service';

@Component({
  selector: 'app-pregunta-opcion-multiple',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">

      <!-- Imagen opcional de la pregunta -->
      @if (pregunta().imagen_url) {
        <div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <button
            type="button"
            class="w-full cursor-zoom-in"
            aria-label="Ver imagen en pantalla completa"
            (click)="imagenExpandida.set(true)"
          >
            <img
              [src]="pregunta().imagen_url!"
              alt="Imagen de la pregunta"
              class="w-full max-h-56 object-contain"
            />
          </button>
          <p class="text-center text-xs text-slate-400 py-1">
            Toca para ampliar
          </p>
        </div>
      }

      <!-- Modal de imagen ampliada -->
      @if (imagenExpandida()) {
        <div
          class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          (click)="imagenExpandida.set(false)"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
        >
          <img
            [src]="pregunta().imagen_url!"
            alt="Imagen ampliada de la pregunta"
            class="max-w-full max-h-full rounded-xl shadow-2xl"
            (click)="$event.stopPropagation()"
          />
          <button
            type="button"
            class="absolute top-4 right-4 p-2 text-white bg-black/40 rounded-full hover:bg-black/60 transition-colors"
            (click)="imagenExpandida.set(false)"
            aria-label="Cerrar imagen"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }

      <!-- Texto de la pregunta -->
      <h2 class="text-lg font-bold text-slate-900 leading-snug">
        {{ pregunta().texto }}
      </h2>

      <!-- Opciones de respuesta -->
      <div class="space-y-3" role="radiogroup" [attr.aria-label]="pregunta().texto">
        @for (opcion of pregunta().opciones; track opcion.id) {
          <button
            type="button"
            (click)="seleccionar(opcion)"
            class="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            [class.border-blue-500]="opcionSeleccionadaId() === opcion.id"
            [class.bg-blue-50]="opcionSeleccionadaId() === opcion.id"
            [class.border-slate-200]="opcionSeleccionadaId() !== opcion.id"
            [class.bg-white]="opcionSeleccionadaId() !== opcion.id"
            [class.hover:border-slate-300]="opcionSeleccionadaId() !== opcion.id"
            [attr.role]="'radio'"
            [attr.aria-checked]="opcionSeleccionadaId() === opcion.id"
            [attr.aria-label]="opcion.texto"
          >
            <!-- Indicador radio circular -->
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              [class.border-blue-600]="opcionSeleccionadaId() === opcion.id"
              [class.bg-blue-600]="opcionSeleccionadaId() === opcion.id"
              [class.border-slate-300]="opcionSeleccionadaId() !== opcion.id"
            >
              @if (opcionSeleccionadaId() === opcion.id) {
                <div class="w-2 h-2 rounded-full bg-white"></div>
              }
            </div>

            <!-- Texto de la opción -->
            <span
              class="text-sm leading-relaxed"
              [class.font-medium]="opcionSeleccionadaId() === opcion.id"
              [class.text-blue-700]="opcionSeleccionadaId() === opcion.id"
              [class.text-slate-700]="opcionSeleccionadaId() !== opcion.id"
            >
              {{ opcion.texto }}
            </span>

          </button>
        }
      </div>

    </div>
  `,
})
export class PreguntaOpcionMultipleComponent {
  // ── Inputs ───────────────────────────────────────────────────────

  /** Datos de la pregunta actual */
  pregunta = input.required<PreguntaActiva>();

  /** ID de la opción que el alumno ya seleccionó (null si no ha elegido) */
  opcionSeleccionadaId = input<string | null>(null);

  // ── Estado local ─────────────────────────────────────────────────

  /** true cuando la imagen se muestra en overlay a pantalla completa */
  readonly imagenExpandida = signal(false);

  // ── Outputs ──────────────────────────────────────────────────────

  /** Emite la opción elegida cuando el alumno la presiona */
  opcionElegida = output<OpcionActiva>();

  // ── Métodos ─────────────────────────────────────────────────────

  /**
   * Emite la opción seleccionada hacia ExamenComponent.
   * ExamenComponent llama a ExamenActivoService.guardarRespuesta().
   */
  seleccionar(opcion: OpcionActiva): void {
    this.opcionElegida.emit(opcion);
  }
}