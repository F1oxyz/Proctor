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
import { Router, RouterLink } from '@angular/router';
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
    RouterLink,
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
            {{ esEdicion() ? 'Editar Examen' : 'Crear Nuevo Examen' }}
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
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
                <h2 class="text-sm font-semibold text-slate-700">Detalles del Examen</h2>
              </div>

              <!-- Título + Tiempo + Mínimo aprobatorio en grid -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Título del examen -->
                <div class="md:col-span-3 flex flex-col gap-1.5">
                  <label for="titulo" class="text-xs font-medium text-slate-600">Título del Examen</label>
                  <input
                    id="titulo"
                    type="text"
                    formControlName="titulo"
                    placeholder="ej: Examen Final de Física I"
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
                    Límite de Tiempo (minutos)
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

                <!-- Mínimo aprobatorio -->
                <div class="flex flex-col gap-1.5">
                  <label for="minimo" class="text-xs font-medium text-slate-600">
                    Mínimo Aprobatorio (%)
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <input
                      id="minimo"
                      type="number"
                      formControlName="minimo_aprobatorio"
                      min="0"
                      max="100"
                      class="w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg text-slate-800
                             focus:outline-none focus:ring-2 focus:ring-blue-500/20
                             focus:border-blue-500 transition-colors"
                      [class.border-red-400]="campoInvalido('minimo_aprobatorio')"
                      [class.border-gray-200]="!campoInvalido('minimo_aprobatorio')"
                    />
                  </div>
                  @if (campoInvalido('minimo_aprobatorio')) {
                    <p class="text-xs text-red-500">Debe ser entre 0 y 100.</p>
                  }
                </div>

                <!-- Placeholder de tercera columna para alinear el grid -->
                <div></div>
              </div>

              <!-- Selector de grupo -->
              <div class="flex flex-col gap-1.5">
                <label for="grupo" class="text-xs font-medium text-slate-600">Seleccionar Grupo</label>
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
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#0065e0"><path d="M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z"/></svg>
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
                  Descripción <span class="text-slate-400">(Opcional)</span>
                </label>
                <textarea
                  id="descripcion"
                  formControlName="descripcion"
                  rows="3"
                  placeholder="Agrega instrucciones o detalles sobre este examen..."
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
                  Preguntas
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
                Añadir Otra Pregunta
              </button>
            </div>

            <!-- Error de preguntas (sin preguntas o preguntas incompletas) -->
            @if (errorPreguntas()) {
              <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ errorPreguntas() }}
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
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">ESTADO</p>
                <p class="text-xs text-slate-400">
                  {{ esEdicion() ? 'Editando examen existente' : 'Borrador - Cambios sin guardar' }}
                </p>
              </div>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  (click)="cancelar()"
                  class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                         hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <app-btn
                  variante="primary"
                  tipo="submit"
                  [loading]="examenesService.cargando()"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                  </svg>
                  Guardar Examen
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

  /** Referencia a todas las tarjetas de pregunta para poder marcarlas como tocadas */
  readonly preguntaCards = viewChildren(PreguntaCardComponent);

  /** Mensaje de error de la sección de preguntas (null = sin error) */
  errorPreguntas = signal<string | null>(null);

  // ── Formulario de metadata del examen ─────────────────

  form = this.fb.group({
    titulo:             ['', [Validators.required, Validators.minLength(3)]],
    duracion_min:       [60, [Validators.required, Validators.min(1)]],
    minimo_aprobatorio: [60, [Validators.required, Validators.min(0), Validators.max(100)]],
    grupo_id:           ['', Validators.required],
    descripcion:        [''],
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
          titulo:             examen.titulo,
          duracion_min:       examen.duracion_min,
          minimo_aprobatorio: examen.minimo_aprobatorio ?? 60,
          grupo_id:           examen.grupo_id,
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

  /** Agrega una nueva pregunta vacía al array.
   *  Inicia con 2 opciones (el mínimo); el usuario puede añadir hasta 4.
   */
  agregarPregunta() {
    this.preguntas.update((lista) => [
      ...lista,
      {
        texto: '',
        tipo: 'opcion_multiple',
        opciones: [
          { texto: '', es_correcta: false, orden: 0 },
          { texto: '', es_correcta: false, orden: 1 },
        ],
      },
    ]);
    this.errorPreguntas.set(null);
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
    // Marcar todos los campos como tocados para activar errores inline
    this.form.markAllAsTouched();
    this.preguntaCards().forEach((card) => card.marcarTocado());

    // Validar metadata
    if (this.form.invalid) return;

    // Validar que haya al menos una pregunta
    if (this.preguntas().length === 0) {
      this.errorPreguntas.set('Agrega al menos una pregunta antes de guardar.');
      return;
    }

    // Validar cada pregunta individualmente
    const hayPreguntaInvalida = this.preguntas().some((p) => {
      if (!p.texto.trim()) return true;
      if (p.tipo === 'opcion_multiple') {
        return (
          p.opciones.some((o) => !o.texto.trim()) ||
          !p.opciones.some((o) => o.es_correcta)
        );
      }
      return false;
    });

    if (hayPreguntaInvalida) {
      this.errorPreguntas.set(
        'Revisa las preguntas marcadas: cada una debe tener texto, opciones completas y una respuesta correcta seleccionada.'
      );
      return;
    }

    this.errorPreguntas.set(null);

    const { titulo, duracion_min, minimo_aprobatorio, grupo_id } = this.form.value;

    const payload = {
      titulo:             titulo!,
      duracion_min:       duracion_min!,
      minimo_aprobatorio: minimo_aprobatorio!,
      grupo_id:           grupo_id!,
      preguntas:          this.preguntas(),
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