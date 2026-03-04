// =============================================================
// features/docente/pages/examenes/components/pregunta-card/
// pregunta-card.component.ts
//
// Tarjeta editable que representa una pregunta dentro del
// formulario de creación/edición de examen.
//
// Muestra:
//   - Encabezado "PREGUNTA N" con botón de eliminar
//   - Campo de texto de la pregunta
//   - Cuatro opciones de respuesta (A, B, C, D)
//   - Radio button para marcar la opción correcta
//   - Campo de texto para cada opción
//
// Emite cambios al padre (ExamFormComponent) via output()
// para mantener el estado centralizado en el formulario.
//
// Uso:
//   <app-pregunta-card
//     [pregunta]="preguntaForm"
//     [numero]="i + 1"
//     (eliminar)="eliminarPregunta(i)"
//     (cambio)="onCambioPregunta(i, $event)"
//   />
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PreguntaPayload, OpcionPayload } from '../../../../services/examenes.service';

/** Letras de las opciones para visualización */
const LETRAS_OPCIONES = ['A', 'B', 'C', 'D'] as const;

@Component({
  selector: 'app-pregunta-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="border border-gray-200 rounded-xl overflow-hidden bg-white">

      <!-- ── Header de la pregunta ────────────────────── -->
      <div class="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <span class="text-xs font-semibold text-blue-600 uppercase tracking-wider">
          Pregunta {{ numero() }}
        </span>
        <div class="flex items-center gap-2">
          <!-- Indicador de completitud -->
          @if (esValida()) {
            <span class="text-xs text-emerald-600 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              Completa
            </span>
          }
          <!-- Botón eliminar pregunta -->
          <button
            type="button"
            (click)="eliminar.emit()"
            class="p-1.5 rounded-md text-slate-400 hover:text-red-500
                   hover:bg-red-50 transition-colors cursor-pointer"
            [attr.aria-label]="'Eliminar pregunta ' + numero()"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ── Cuerpo de la pregunta ─────────────────────── -->
      <div class="px-5 py-4 flex flex-col gap-4">

        <!-- Texto de la pregunta -->
        <div class="flex flex-col gap-1.5">
          <label
            [for]="'pregunta-texto-' + numero()"
            class="text-xs font-medium text-slate-600"
          >
            Texto de la Pregunta
          </label>
          <input
            [id]="'pregunta-texto-' + numero()"
            type="text"
            [(ngModel)]="textoPregunta"
            (ngModelChange)="emitirCambio()"
            [name]="'pregunta-' + numero()"
            placeholder="Ej: ¿Qué es la Segunda Ley de Newton?"
            class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800
                   placeholder-slate-400 focus:outline-none focus:ring-2
                   focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            [class.border-gray-200]="!mostrarErrorTexto()"
            [class.border-red-400]="mostrarErrorTexto()"
          />
          @if (mostrarErrorTexto()) {
            <p class="text-xs text-red-500">El texto de la pregunta es requerido.</p>
          }
        </div>

        <!-- Opciones de respuesta -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-600">Opciones de Respuesta</span>
            <span class="text-xs text-slate-400">Selecciona el radio de la respuesta correcta</span>
          </div>

          <div class="flex flex-col gap-2">
            @for (opcion of opciones; track $index; let i = $index) {
              <div
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors"
                [class.border-blue-200]="opcionCorrectaIdx === i"
                [class.bg-blue-50]="opcionCorrectaIdx === i"
                [class.border-gray-100]="opcionCorrectaIdx !== i"
                [class.bg-gray-50]="opcionCorrectaIdx !== i"
              >
                <!-- Radio button para marcar correcta -->
                <input
                  type="radio"
                  [name]="'correcta-' + numero()"
                  [id]="'opcion-' + numero() + '-' + i"
                  [checked]="opcionCorrectaIdx === i"
                  (change)="marcarCorrecta(i)"
                  class="w-4 h-4 text-blue-600 shrink-0 cursor-pointer"
                  [attr.aria-label]="'Marcar opción ' + letras[i] + ' como correcta'"
                />

                <!-- Letra identificadora -->
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  [class.bg-blue-600]="opcionCorrectaIdx === i"
                  [class.text-white]="opcionCorrectaIdx === i"
                  [class.bg-white]="opcionCorrectaIdx !== i"
                  [class.text-slate-500]="opcionCorrectaIdx !== i"
                  [class.border]="opcionCorrectaIdx !== i"
                  [class.border-gray-300]="opcionCorrectaIdx !== i"
                  aria-hidden="true"
                >
                  {{ letras[i] }}
                </span>

                <!-- Texto de la opción -->
                <input
                  type="text"
                  [(ngModel)]="opciones[i].texto"
                  (ngModelChange)="emitirCambio()"
                  [name]="'opcion-' + numero() + '-' + i"
                  [placeholder]="'Opción ' + letras[i]"
                  class="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400
                         focus:outline-none"
                  [attr.aria-label]="'Texto de opción ' + letras[i]"
                />
              </div>
            }
          </div>

          @if (mostrarErrorOpciones()) {
            <p class="text-xs text-red-500">
              Completa todas las opciones y selecciona la respuesta correcta.
            </p>
          }
        </div>

      </div>
    </div>
  `,
})
export class PreguntaCardComponent implements OnInit {
  // ── Inputs ─────────────────────────────────────────────

  /** Número de pregunta para mostrar en el header (1-based) */
  numero = input.required<number>();

  /**
   * Datos iniciales de la pregunta (para modo edición).
   * Si es una pregunta nueva, puede ser null.
   */
  preguntaInicial = input<PreguntaPayload | null>(null);

  // ── Outputs ────────────────────────────────────────────

  /** Emitido al hacer clic en "Eliminar pregunta" */
  eliminar = output<void>();

  /**
   * Emitido cada vez que cambia cualquier campo de la pregunta.
   * El padre actualiza su array de preguntas con este payload.
   */
  cambio = output<PreguntaPayload>();

  // ── Estado interno ─────────────────────────────────────

  /** Texto del enunciado de la pregunta */
  textoPregunta = '';

  /** Índice de la opción marcada como correcta (0-3), -1 si ninguna */
  opcionCorrectaIdx = -1;

  /** Array mutable de las 4 opciones */
  opciones: { texto: string }[] = [
    { texto: '' },
    { texto: '' },
    { texto: '' },
    { texto: '' },
  ];

  /** Si el usuario intentó guardar, muestra errores de validación */
  tocado = signal(false);

  /** Letras para mostrar en cada opción */
  readonly letras = LETRAS_OPCIONES;

  // ── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    // Si hay datos iniciales (modo edición), cargarlos
    const inicial = this.preguntaInicial();
    if (inicial) {
      this.textoPregunta = inicial.texto;
      // Cargar opciones y detectar cuál es la correcta
      inicial.opciones.forEach((op, i) => {
        if (this.opciones[i]) {
          this.opciones[i].texto = op.texto;
        }
        if (op.es_correcta) {
          this.opcionCorrectaIdx = i;
        }
      });
    }
  }

  // ── Computed helpers ───────────────────────────────────

  /** True si la pregunta tiene texto y tiene una opción correcta marcada */
  esValida(): boolean {
    return (
      this.textoPregunta.trim().length > 0 &&
      this.opcionCorrectaIdx >= 0 &&
      this.opciones.every((o) => o.texto.trim().length > 0)
    );
  }

  /** Muestra error en el texto de la pregunta si está tocado y vacío */
  mostrarErrorTexto(): boolean {
    return this.tocado() && !this.textoPregunta.trim();
  }

  /** Muestra error en las opciones si está tocado y alguna está vacía o sin correcta */
  mostrarErrorOpciones(): boolean {
    if (!this.tocado()) return false;
    return (
      this.opcionCorrectaIdx < 0 ||
      this.opciones.some((o) => !o.texto.trim())
    );
  }

  // ── Métodos ────────────────────────────────────────────

  /** Marca la opción del índice dado como correcta */
  marcarCorrecta(idx: number) {
    this.opcionCorrectaIdx = idx;
    this.emitirCambio();
  }

  /** Construye y emite el PreguntaPayload actualizado al padre */
  emitirCambio() {
    const payload: PreguntaPayload = {
      texto: this.textoPregunta,
      tipo: 'opcion_multiple',
      opciones: this.opciones.map((o, i) => ({
        texto: o.texto,
        es_correcta: i === this.opcionCorrectaIdx,
        orden: i,
      })),
    };
    this.cambio.emit(payload);
  }

  /** Expone método para que el padre marque como tocado (al intentar guardar) */
  marcarTocado() {
    this.tocado.set(true);
  }
}