// =============================================================
// pregunta-card.component.ts
//
// BUG 5 CORREGIDO: tipo estaba hardcodeado → toggle entre tipos
// BUG 9 CORREGIDO: opciones dinámicas (inician en 2, máximo 4)
//   - Botón "Agregar opción" visible cuando < 4 opciones
//   - Botón "×" para eliminar una opción cuando > 2
//   - Ninguna opción puede quedar vacía (validación)
//
// FEATURE 2: imagen opcional por pregunta
//   - El docente puede adjuntar una imagen desde su dispositivo
//   - La imagen se sube a Supabase Storage (bucket question-images)
//   - Preview con botón de eliminar
//   - La URL se emite en el PreguntaPayload
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExamenesService, PreguntaPayload, OpcionPayload } from '../../../../services/examenes.service';

const LETRAS_OPCIONES = ['A', 'B', 'C', 'D'] as const;

@Component({
  selector: 'app-pregunta-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="border border-gray-200 rounded-xl overflow-hidden bg-white">

      <!-- ── Header ────────────────────── -->
      <div class="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <span class="text-xs font-semibold text-blue-600 uppercase tracking-wider">
          Pregunta {{ numero() }}
        </span>
        <div class="flex items-center gap-2">
          @if (esValida()) {
            <span class="text-xs text-emerald-600 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              Completa
            </span>
          }
          <button
            type="button"
            (click)="eliminar.emit()"
            class="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            [attr.aria-label]="'Eliminar pregunta ' + numero()"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ── Cuerpo ─────────────────────── -->
      <div class="px-5 py-4 flex flex-col gap-4">

        <!-- Selector de tipo de pregunta (Bug 5) -->
        <div class="flex gap-2">
          <button
            type="button"
            (click)="cambiarTipo('opcion_multiple')"
            class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors"
            [class.bg-blue-600]="tipoActual() === 'opcion_multiple'"
            [class.text-white]="tipoActual() === 'opcion_multiple'"
            [class.border-blue-600]="tipoActual() === 'opcion_multiple'"
            [class.bg-white]="tipoActual() !== 'opcion_multiple'"
            [class.text-slate-600]="tipoActual() !== 'opcion_multiple'"
            [class.border-gray-200]="tipoActual() !== 'opcion_multiple'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Opción múltiple
          </button>
          <button
            type="button"
            (click)="cambiarTipo('texto_abierto')"
            class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors"
            [class.bg-blue-600]="tipoActual() === 'texto_abierto'"
            [class.text-white]="tipoActual() === 'texto_abierto'"
            [class.border-blue-600]="tipoActual() === 'texto_abierto'"
            [class.bg-white]="tipoActual() !== 'texto_abierto'"
            [class.text-slate-600]="tipoActual() !== 'texto_abierto'"
            [class.border-gray-200]="tipoActual() !== 'texto_abierto'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Texto abierto
          </button>
        </div>

        <!-- Texto de la pregunta -->
        <div class="flex flex-col gap-1.5">
          <label [for]="'pregunta-texto-' + numero()" class="text-xs font-medium text-slate-600">
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

        <!-- ── Imagen opcional (Feature 2) ─── -->
        <div class="flex flex-col gap-2">
          <span class="text-xs font-medium text-slate-600">
            Imagen <span class="text-slate-400">(Opcional)</span>
          </span>

          @if (imagenUrl()) {
            <!-- Preview de la imagen subida -->
            <div class="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <img
                [src]="imagenUrl()!"
                alt="Imagen de la pregunta"
                class="w-full max-h-48 object-contain"
              />
              <!-- Botón eliminar -->
              <button
                type="button"
                (click)="eliminarImagen()"
                [disabled]="subiendoImagen()"
                class="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-md
                       opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700
                       disabled:opacity-50"
                aria-label="Eliminar imagen"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          } @else {
            <!-- Botón / zona de upload -->
            <label
              [for]="'img-input-' + numero()"
              class="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300
                     rounded-lg text-xs font-medium text-slate-500 hover:border-blue-400
                     hover:text-blue-600 hover:bg-blue-50/40 transition-colors cursor-pointer"
              [class.opacity-60]="subiendoImagen()"
              [class.pointer-events-none]="subiendoImagen()"
            >
              @if (subiendoImagen()) {
                <svg class="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Subiendo imagen...
              } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Adjuntar imagen a la pregunta
              }
            </label>
            <input
              [id]="'img-input-' + numero()"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              class="hidden"
              (change)="onSeleccionarImagen($event)"
            />
          }

          @if (errorImagen()) {
            <p class="text-xs text-red-500">{{ errorImagen() }}</p>
          }
        </div>

        <!-- Opciones de respuesta (solo para opción múltiple) -->
        @if (tipoActual() === 'opcion_multiple') {
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-600">Opciones de Respuesta</span>
              <span class="text-xs text-slate-400">Marca la respuesta correcta</span>
            </div>
            <div class="flex flex-col gap-2">
              @for (opcion of opciones; track $index; let i = $index) {
                <div
                  class="flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors"
                  [class.border-blue-200]="opcionCorrectaIdx === i"
                  [class.bg-blue-50]="opcionCorrectaIdx === i"
                  [class.border-gray-100]="opcionCorrectaIdx !== i"
                  [class.bg-gray-50]="opcionCorrectaIdx !== i"
                >
                  <input
                    type="radio"
                    [name]="'correcta-' + numero()"
                    [id]="'opcion-' + numero() + '-' + i"
                    [checked]="opcionCorrectaIdx === i"
                    (change)="marcarCorrecta(i)"
                    class="w-4 h-4 text-blue-600 shrink-0 cursor-pointer"
                    [attr.aria-label]="'Marcar opción ' + letras[i] + ' como correcta'"
                  />
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    [class.bg-blue-600]="opcionCorrectaIdx === i"
                    [class.text-white]="opcionCorrectaIdx === i"
                    [class.bg-white]="opcionCorrectaIdx !== i"
                    [class.text-slate-500]="opcionCorrectaIdx !== i"
                    [class.border]="opcionCorrectaIdx !== i"
                    [class.border-gray-300]="opcionCorrectaIdx !== i"
                  >
                    {{ letras[i] }}
                  </span>
                  <input
                    type="text"
                    [(ngModel)]="opciones[i].texto"
                    (ngModelChange)="emitirCambio()"
                    [name]="'opcion-' + numero() + '-' + i"
                    [placeholder]="'Opción ' + letras[i]"
                    class="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none min-w-0"
                    [attr.aria-label]="'Texto de opción ' + letras[i]"
                  />
                  <!-- Bug 9: botón eliminar (solo si hay más de 2 opciones) -->
                  @if (opciones.length > 2) {
                    <button
                      type="button"
                      (click)="eliminarOpcion(i)"
                      class="p-0.5 text-slate-300 hover:text-red-400 transition-colors shrink-0"
                      [attr.aria-label]="'Eliminar opción ' + letras[i]"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Bug 9: botón agregar opción (solo si < 4 opciones) -->
            @if (opciones.length < 4) {
              <button
                type="button"
                (click)="agregarOpcion()"
                class="mt-1 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Agregar opción {{ letras[opciones.length] }}
              </button>
            }

            @if (mostrarErrorOpciones()) {
              <p class="text-xs text-red-500">
                Completa todas las opciones y selecciona la respuesta correcta.
              </p>
            }
          </div>
        }

        <!-- Información para texto abierto -->
        @if (tipoActual() === 'texto_abierto') {
          <div class="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <svg class="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-xs text-slate-500 leading-relaxed">
              El alumno escribirá su respuesta en un campo de texto.
              La calificación de esta pregunta es <strong>manual</strong> — el docente la revisa en la pantalla de resultados.
            </p>
          </div>
        }

      </div>
    </div>
  `,
})
export class PreguntaCardComponent implements OnInit {
  // ── Dependencias ───────────────────────────────────────
  private readonly examenesService = inject(ExamenesService);

  // ── Inputs ─────────────────────────────────────────────
  numero = input.required<number>();
  preguntaInicial = input<PreguntaPayload | null>(null);

  // ── Outputs ────────────────────────────────────────────
  eliminar = output<void>();
  cambio   = output<PreguntaPayload>();

  // ── Estado interno ─────────────────────────────────────

  textoPregunta     = '';
  opcionCorrectaIdx = -1;

  /** Bug 9: empezar con 2 opciones, máximo 4 */
  opciones: { texto: string }[] = [
    { texto: '' }, { texto: '' },
  ];

  /** Bug 5: tipo de pregunta seleccionado */
  readonly tipoActual = signal<'opcion_multiple' | 'texto_abierto'>('opcion_multiple');

  readonly tocado = signal(false);
  readonly letras = LETRAS_OPCIONES;

  // ── Estado imagen (Feature 2) ──────────────────────────

  /** URL pública de la imagen subida (null si no hay) */
  readonly imagenUrl      = signal<string | null>(null);
  /** true mientras se sube la imagen a Storage */
  readonly subiendoImagen = signal(false);
  /** Mensaje de error si la imagen no se pudo subir */
  readonly errorImagen    = signal<string | null>(null);

  // ── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    const inicial = this.preguntaInicial();
    if (inicial) {
      this.textoPregunta = inicial.texto;
      this.tipoActual.set(inicial.tipo);
      this.imagenUrl.set(inicial.imagen_url ?? null);
      if (inicial.tipo === 'opcion_multiple' && inicial.opciones.length > 0) {
        // Bug 9: cargar exactamente las opciones guardadas
        this.opciones = inicial.opciones.map((op) => ({ texto: op.texto }));
        // Garantizar mínimo 2 opciones
        while (this.opciones.length < 2) this.opciones.push({ texto: '' });
        inicial.opciones.forEach((op, i) => {
          if (op.es_correcta) this.opcionCorrectaIdx = i;
        });
      }
    }
  }

  // ── Computed helpers ───────────────────────────────────

  esValida(): boolean {
    if (!this.textoPregunta.trim()) return false;
    if (this.tipoActual() === 'texto_abierto') return true;
    return (
      this.opcionCorrectaIdx >= 0 &&
      this.opciones.every((o) => o.texto.trim().length > 0)
    );
  }

  mostrarErrorTexto(): boolean {
    return this.tocado() && !this.textoPregunta.trim();
  }

  mostrarErrorOpciones(): boolean {
    if (!this.tocado() || this.tipoActual() === 'texto_abierto') return false;
    return (
      this.opcionCorrectaIdx < 0 ||
      this.opciones.some((o) => !o.texto.trim())
    );
  }

  // ── Métodos ────────────────────────────────────────────

  /** Bug 5: cambia tipo y resetea estado irrelevante */
  cambiarTipo(tipo: 'opcion_multiple' | 'texto_abierto'): void {
    this.tipoActual.set(tipo);
    if (tipo === 'texto_abierto') {
      this.opcionCorrectaIdx = -1;
    }
    this.emitirCambio();
  }

  marcarCorrecta(idx: number) {
    this.opcionCorrectaIdx = idx;
    this.emitirCambio();
  }

  /** Bug 9: agregar una opción (hasta máximo 4) */
  agregarOpcion(): void {
    if (this.opciones.length < 4) {
      this.opciones.push({ texto: '' });
      this.emitirCambio();
    }
  }

  /** Bug 9: eliminar una opción (mínimo 2) */
  eliminarOpcion(idx: number): void {
    if (this.opciones.length <= 2) return;
    // Ajustar índice de respuesta correcta
    if (this.opcionCorrectaIdx === idx) {
      this.opcionCorrectaIdx = -1;
    } else if (this.opcionCorrectaIdx > idx) {
      this.opcionCorrectaIdx--;
    }
    this.opciones.splice(idx, 1);
    this.emitirCambio();
  }

  // ── Feature 2: imagen ──────────────────────────────────

  /** Sube la imagen seleccionada al bucket de Supabase Storage */
  async onSeleccionarImagen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    // Validación de tamaño (5 MB máx)
    if (file.size > 5 * 1024 * 1024) {
      this.errorImagen.set('La imagen no debe superar 5 MB.');
      input.value = '';
      return;
    }

    this.subiendoImagen.set(true);
    this.errorImagen.set(null);

    const url = await this.examenesService.subirImagenPregunta(file);

    if (url) {
      this.imagenUrl.set(url);
      this.emitirCambio();
    } else {
      this.errorImagen.set('No se pudo subir la imagen. Intenta de nuevo.');
    }

    this.subiendoImagen.set(false);
    input.value = ''; // reset para permitir re-seleccionar el mismo archivo
  }

  /** Elimina la imagen actual del bucket y limpia el estado */
  async eliminarImagen(): Promise<void> {
    const url = this.imagenUrl();
    if (!url) return;

    this.subiendoImagen.set(true);
    await this.examenesService.eliminarImagenPregunta(url);
    this.imagenUrl.set(null);
    this.subiendoImagen.set(false);
    this.emitirCambio();
  }

  emitirCambio() {
    const payload: PreguntaPayload = {
      texto:      this.textoPregunta,
      tipo:       this.tipoActual(),
      imagen_url: this.imagenUrl(),
      opciones:   this.tipoActual() === 'opcion_multiple'
        ? this.opciones.map((o, i) => ({
            texto:       o.texto,
            es_correcta: i === this.opcionCorrectaIdx,
            orden:       i,
          }))
        : [],
    };
    this.cambio.emit(payload);
  }

  marcarTocado() {
    this.tocado.set(true);
  }
}
