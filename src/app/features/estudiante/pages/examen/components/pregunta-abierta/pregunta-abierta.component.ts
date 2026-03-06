/**
 * pregunta-abierta.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Renderiza una pregunta de texto libre para que el alumno
 * escriba su respuesta. El maestro la revisará manualmente.
 *
 * ARQUITECTURA:
 *  - Componente dumb: recibe `pregunta` y `valorActual`
 *  - Emite `respuestaChange` con el texto ingresado (debounced en ms)
 *  - OnPush
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  effect,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { PreguntaActiva } from '../../../../services/examen-activo.service';

@Component({
  selector: 'app-pregunta-abierta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
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

      <!-- Badge informativo -->
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span class="text-xs font-medium text-amber-700">Respuesta abierta — revisa la redacción</span>
      </div>

      <!-- Área de texto -->
      <div>
        <textarea
          [(ngModel)]="textoLocal"
          (ngModelChange)="onCambio($event)"
          placeholder="Escribe tu respuesta aquí..."
          rows="6"
          maxlength="2000"
          class="w-full px-4 py-3 text-sm text-slate-800 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 leading-relaxed"
          aria-label="Tu respuesta"
        ></textarea>

        <!-- Contador de caracteres -->
        <div class="flex items-center justify-between mt-1.5">
          <p class="text-xs text-slate-400">
            El docente revisará esta respuesta manualmente.
          </p>
          <p class="text-xs text-slate-400">
            {{ textoLocal.length }} / 2000
          </p>
        </div>
      </div>

    </div>
  `,
})
export class PreguntaAbiertaComponent {
  // ── Inputs ───────────────────────────────────────────────────────

  /** Datos de la pregunta actual */
  pregunta = input.required<PreguntaActiva>();

  /** Texto ya guardado para esta pregunta (si el alumno regresó) */
  valorActual = input<string | null>(null);

  // ── Outputs ──────────────────────────────────────────────────────

  /** Emite el texto cada vez que el alumno escribe */
  respuestaChange = output<string>();

  // ── Estado local ─────────────────────────────────────────────────

  /** Texto local del textarea */
  textoLocal = '';

  /** Timer para debounce de guardado (evita llamadas excesivas a Supabase) */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** true cuando la imagen se muestra en overlay a pantalla completa */
  readonly imagenExpandida = signal(false);

  constructor() {
    // Sincronizar el textarea cuando cambia la pregunta o el valor guardado
    effect(() => {
      this.textoLocal = this.valorActual() ?? '';
    });
  }

  // ── Métodos ─────────────────────────────────────────────────────

  /**
   * Emite el cambio con debounce de 800ms para no llamar a Supabase
   * en cada pulsación de teclado.
   */
  onCambio(texto: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.respuestaChange.emit(texto);
    }, 800);
  }
}