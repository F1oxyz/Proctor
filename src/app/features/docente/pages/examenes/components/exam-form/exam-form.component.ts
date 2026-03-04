// =============================================================
// features/docente/pages/examenes/components/exam-form/
// exam-form.component.ts
//
// Formulario de creación y edición de exámenes.
// Ruta: /docente/examenes/nuevo  → crear
//       /docente/examenes/:id    → editar
//
// El parámetro :id viene via withComponentInputBinding() en app.config.
// Si id está presente, carga el examen existente para editar.
//
// Funcionalidades:
//   - Campos: Título, Tiempo Límite (minutos), Grupo, Descripción (opcional)
//   - Lista dinámica de PreguntaCardComponent (añadir / eliminar)
//   - Validación global antes de guardar
//   - Botón "Guardar" llama a ExamenesService.crearExamen o actualizarExamen
//   - Botón "Cancelar" regresa a /docente/examenes
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  input,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ExamenesService, PreguntaPayload } from '../../../../services/examenes.service';
import { GruposService } from '../../../../services/grupos.service';
import { PreguntaCardComponent } from '../pregunta-card/pregunta-card.component';
import { NavbarComponent } from '../../../../../../shared/components/navbar/navbar.component';
import { BtnComponent } from '../../../../../../shared/components/btn/btn.component';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-exam-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExamenesService, GruposService],
  imports: [
    ReactiveFormsModule,
    NavbarComponent,
    BtnComponent,
    LoadingSpinnerComponent,
    PreguntaCardComponent,
  ],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <app-navbar modo="default" />

      <main class="flex-1 max-w-3xl mx-auto w-full px-6 py-8">

        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-xs text-slate-400 mb-5" aria-label="Breadcrumb">
          <a routerLink="/docente/examenes" class="hover:text-slate-600 transition-colors cursor-pointer">
            Exámenes
          </a>
          <span aria-hidden="true">›</span>
          <span class="text-slate-600">{{ esEdicion() ? 'Editar Examen' : 'Crear Nuevo Examen' }}</span>
        </nav>

        <!-- Título -->
        <div class="mb-6">
          <h1 class="text-xl font-semibold text-slate-800">
            {{ esEdicion() ? 'Editar Examen' : 'Create New Exam' }}
          </h1>
          <p class="text-sm text-slate-500 mt-1">
            Configura los detalles y diseña las preguntas para la evaluación.
          </p>
        </div>

        @if (examenesService.cargando() && esEdicion()) {
          <app-loading-spinner tamano="md" />
        } @else {
          <form [formGroup]="form" (ngSubmit)="guardar()" class="flex flex-col gap-6">

            <!-- ── Sección Detalles del Examen ────────── -->
            <div class="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
              <div class="flex items-center gap-2 mb-1">
                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/>
                </svg>
                <h2 class="text-sm font-semibold text-slate-700">Exam Details</h2>
              </div>

              <!-- Título + Tiempo en grid -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Título del examen -->
                <div class="md:col-span-2 flex flex-col gap-1.5">
                  <label for="titulo" class="text-xs font-medium text-slate-600">Exam Title</label>
                  <input
                    id="titulo"
                    type="text"
                    formControlName="titulo"
                    placeholder="e.g., Introduction to Physics Final Term"
                    class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800
                           placeholder-slate-400 focus:outline-none focus:ring-2
                           focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    [class.border-red-400]="campoInvalido('titulo')"
                    [class.border-gray-200]="!campoInvalido('titulo')"
                  />
                  @if (campoInvalido('titulo')) {
                    <p class="text-xs text-red-500">El título es requerido.</p>
                  }
                </div>

                <!-- Tiempo límite -->
                <div class="flex flex-col gap-1.5">
                  <label for="duracion" class="text-xs font-medium text-slate-600">
                    Time Limit (minutes)
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                      </svg>
                    </div>
                    <input
                      id="duracion"
                      type="number"
                      formControlName="duracion_min"
                      min="1"
                      max="300"
                      class="w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg text-slate-800
                             focus:outline-none focus:ring-2 focus:ring-blue-500/20
                             focus:border-blue-500 transition-colors"
                      [class.border-red-400]="campoInvalido('duracion_min')"
                      [class.border-gray-200]="!campoInvalido('duracion_min')"
                    />
                  </div>
                  @if (campoInvalido('duracion_min')) {
                    <p class="text-xs text-red-500">Mínimo 1 minuto.</p>
                  }
                </div>
              </div>

              <!-- Selector de grupo -->
              <div class="flex flex-col gap-1.5">
                <label for="grupo" class="text-xs font-medium text-slate-600">Select Group</label>
                <select
                  id="grupo"
                  formControlName="grupo_id"
                  class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800 bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20
                         focus:border-blue-500 transition-colors cursor-pointer"
                  [class.border-red-400]="campoInvalido('grupo_id')"
                  [class.border-gray-200]="!campoInvalido('grupo_id')"
                >
                  <option value="">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87"/>
                    </svg>
                    Seleccionar Grupo
                  </option>
                  @for (grupo of gruposService.grupos(); track grupo.id) {
                    <option [value]="grupo.id">{{ grupo.nombre }}</option>
                  }
                </select>
                @if (campoInvalido('grupo_id')) {
                  <p class="text-xs text-red-500">Selecciona un grupo.</p>
                }
              </div>

              <!-- Descripción opcional -->
              <div class="flex flex-col gap-1.5">
                <label for="descripcion" class="text-xs font-medium text-slate-600">
                  Description <span class="text-slate-400">(Optional)</span>
                </label>
                <textarea
                  id="descripcion"
                  formControlName="descripcion"
                  rows="3"
                  placeholder="Add instructions or details about this exam..."
                  class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg
                         text-slate-800 placeholder-slate-400 resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20
                         focus:border-blue-500 transition-colors"
                ></textarea>
              </div>
            </div>

            <!-- ── Sección Preguntas ──────────────────── -->
            <div class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold text-slate-700">
                  Questions
                  <span class="ml-1.5 text-slate-400 font-normal">
                    Total: {{ preguntas().length }}
                  </span>
                </h2>
              </div>

              <!-- Cards de preguntas -->
              @for (pregunta of preguntas(); track $index; let i = $index) {
                <app-pregunta-card
                  [numero]="i + 1"
                  [preguntaInicial]="pregunta"
                  (eliminar)="eliminarPregunta(i)"
                  (cambio)="onCambioPregunta(i, $event)"
                />
              }

              <!-- Botón agregar pregunta -->
              <button
                type="button"
                (click)="agregarPregunta()"
                class="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl
                       text-sm font-medium text-slate-500 hover:border-blue-300
                       hover:text-blue-600 hover:bg-blue-50/30 transition-colors cursor-pointer
                       flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/>
                </svg>
                Add Another Question
              </button>
            </div>

            <!-- Error si no hay preguntas -->
            @if (mostrarErrorPreguntas()) {
              <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                Agrega al menos una pregunta antes de guardar.
              </div>
            }

            <!-- Error del servicio -->
            @if (examenesService.error()) {
              <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {{ examenesService.error() }}
              </div>
            }

            <!-- ── Footer del formulario ─────────────── -->
            <div class="bg-white rounded-xl border border-gray-100 px-5 py-4
                        flex items-center justify-between">
              <div>
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">STATUS</p>
                <p class="text-xs text-slate-400">
                  {{ esEdicion() ? 'Editando examen existente' : 'Draft - Unsaved changes' }}
                </p>
              </div>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  (click)="cancelar()"
                  class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                         hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <app-btn
                  variante="primary"
                  tipo="submit"
                  [loading]="examenesService.cargando()"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                  </svg>
                  Save Exam
                </app-btn>
              </div>
            </div>

          </form>
        }

      </main>
    </div>
  `,
})
export class ExamFormComponent implements OnInit {
  private readonly router = inject(Router);
  readonly examenesService = inject(ExamenesService);
  readonly gruposService = inject(GruposService);
  private readonly fb = inject(FormBuilder);

  // ── Input de ruta (:id via withComponentInputBinding) ──

  /** UUID del examen a editar. Undefined si es creación nueva */
  id = input<string>();

  // ── Estado ─────────────────────────────────────────────

  /** True si hay un :id en la ruta (modo edición) */
  esEdicion = signal(false);

  /** Array de payloads de preguntas del formulario */
  preguntas = signal<PreguntaPayload[]>([]);

  /** Muestra error si se intenta guardar sin preguntas */
  mostrarErrorPreguntas = signal(false);

  // ── Formulario de metadata del examen ─────────────────

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    duracion_min: [60, [Validators.required, Validators.min(1)]],
    grupo_id: ['', Validators.required],
    descripcion: [''],
  });

  // ── Lifecycle ──────────────────────────────────────────

  async ngOnInit() {
    // Cargar grupos para el selector
    await this.gruposService.cargarGrupos();

    const examenId = this.id();
    if (examenId) {
      // Modo edición: cargar datos existentes
      this.esEdicion.set(true);
      await this.examenesService.cargarExamenCompleto(examenId);

      const examen = this.examenesService.examenActivo();
      if (examen) {
        // Poblar el formulario de metadata
        this.form.patchValue({
          titulo: examen.titulo,
          duracion_min: examen.duracion_min,
          grupo_id: examen.grupo_id,
        });

        // Poblar las preguntas
        this.preguntas.set(
          examen.preguntas.map((p) => ({
            texto: p.texto,
            tipo: p.tipo,
            opciones: p.opciones.map((o) => ({
              texto: o.texto,
              es_correcta: o.es_correcta,
              orden: o.orden,
            })),
          }))
        );
      }
    } else {
      // Modo creación: iniciar con una pregunta vacía
      this.agregarPregunta();
    }
  }

  // ── Métodos ────────────────────────────────────────────

  /** Agrega una nueva pregunta vacía al array */
  agregarPregunta() {
    this.preguntas.update((lista) => [
      ...lista,
      {
        texto: '',
        tipo: 'opcion_multiple',
        opciones: [
          { texto: '', es_correcta: false, orden: 0 },
          { texto: '', es_correcta: false, orden: 1 },
          { texto: '', es_correcta: false, orden: 2 },
          { texto: '', es_correcta: false, orden: 3 },
        ],
      },
    ]);
    this.mostrarErrorPreguntas.set(false);
  }

  /** Elimina la pregunta del índice dado */
  eliminarPregunta(idx: number) {
    this.preguntas.update((lista) => lista.filter((_, i) => i !== idx));
  }

  /**
   * Actualiza la pregunta en el índice dado con el nuevo payload.
   * Llamado desde el output (cambio) de PreguntaCardComponent.
   */
  onCambioPregunta(idx: number, payload: PreguntaPayload) {
    this.preguntas.update((lista) =>
      lista.map((p, i) => (i === idx ? payload : p))
    );
  }

  /** Valida y guarda el examen (crear o actualizar) */
  async guardar() {
    // Validar metadata
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Validar que haya al menos una pregunta
    if (this.preguntas().length === 0) {
      this.mostrarErrorPreguntas.set(true);
      return;
    }

    const { titulo, duracion_min, grupo_id, descripcion } = this.form.value;

    const payload = {
      titulo: titulo!,
      duracion_min: duracion_min!,
      grupo_id: grupo_id!,
      preguntas: this.preguntas(),
    };

    let result;
    const examenId = this.id();

    if (examenId) {
      result = await this.examenesService.actualizarExamen(examenId, payload);
    } else {
      result = await this.examenesService.crearExamen(payload);
    }

    if (!result.error) {
      this.router.navigate(['/docente/examenes']);
    }
  }

  /** Navega de regreso a la lista de exámenes */
  cancelar() {
    this.router.navigate(['/docente/examenes']);
  }

  /** Determina si un campo de metadata debe mostrar error */
  campoInvalido(campo: string): boolean {
    const ctrl = this.form.get(campo);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }
}