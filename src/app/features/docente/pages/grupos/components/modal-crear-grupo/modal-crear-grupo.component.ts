// =============================================================
// features/docente/pages/grupos/components/modal-crear-grupo/
// modal-crear-grupo.component.ts
//
// Modal para crear un nuevo grupo o materia.
// El maestro ingresa:
//   - Nombre del grupo (ej: "Dibujo Industrial - 2do Cuatri")
//   - Lista de alumnos: pega nombres desde Excel, uno por línea
//
// Al guardar:
//   1. Valida que los campos no estén vacíos
//   2. Llama a GruposService.crearGrupo()
//   3. Emite (grupoCreado) para que GruposComponent recargue la vista
//   4. Se cierra automáticamente en caso de éxito
//
// Usa ModalComponent de shared para el wrapper visual.
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  output,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GruposService } from '../../../../services/grupos.service';
import { ModalComponent } from '../../../../../../shared/components/modal/modal.component';
import { BtnComponent } from '../../../../../../shared/components/btn/btn.component';
import { Grupo } from '../../../../../../shared/models';

@Component({
  selector: 'app-modal-crear-grupo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, BtnComponent],
  template: `
    <app-modal
      [abierto]="abierto()"
      ancho="md"
      (cerrar)="onCerrar()"
      [cerrarAlClickBackdrop]="!gruposService.cargando()"
    >
      <!-- ── Header ──────────────────────────────────── -->
      <div modal-header class="mb-1">
        <h2 class="text-base font-semibold text-slate-800">Crear Nuevo Grupo</h2>
        <p class="text-sm text-slate-500 mt-0.5">
          Define la materia y pega la lista de alumnos matriculados.
        </p>
      </div>

      <!-- ── Body ────────────────────────────────────── -->
      <form [formGroup]="form" (ngSubmit)="guardar()" class="flex flex-col gap-5">

        <!-- Nombre del grupo -->
        <div class="flex flex-col gap-1.5">
          <label
            for="nombreGrupo"
            class="text-sm font-medium text-slate-700"
          >
            Nombre del Grupo o Materia
          </label>
          <input
            id="nombreGrupo"
            type="text"
            formControlName="nombre"
            placeholder="Ej. Dibujo Industrial - 2do Cuatri"
            class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800
                   placeholder-slate-400 focus:outline-none focus:ring-2
                   focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            [class.border-red-400]="campoInvalido('nombre')"
            [class.border-gray-200]="!campoInvalido('nombre')"
          />
          @if (campoInvalido('nombre')) {
            <p class="text-xs text-red-500">El nombre del grupo es requerido.</p>
          }
        </div>

        <!-- Lista de alumnos -->
        <div class="flex flex-col gap-1.5">
          <label
            for="listaAlumnos"
            class="text-sm font-medium text-slate-700"
          >
            Lista de Estudiantes
          </label>
          <textarea
            id="listaAlumnos"
            formControlName="listaAlumnos"
            rows="7"
            placeholder="Juan Pérez&#10;María González&#10;Carlos Ruiz&#10;..."
            class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800
                   placeholder-slate-400 resize-y min-h-[140px]
                   focus:outline-none focus:ring-2 focus:ring-blue-500/20
                   focus:border-blue-500 transition-colors font-mono leading-relaxed"
            [class.border-red-400]="campoInvalido('listaAlumnos')"
            [class.border-gray-200]="!campoInvalido('listaAlumnos')"
          ></textarea>

          <!-- Info helper -->
          <p class="text-xs text-slate-400 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            Copia y pega los nombres desde tu lista de Excel. Un alumno por línea.
          </p>

          @if (campoInvalido('listaAlumnos')) {
            <p class="text-xs text-red-500">Agrega al menos un alumno.</p>
          }

          <!-- Contador de alumnos detectados -->
          @if (totalAlumnosDetectados() > 0) {
            <p class="text-xs text-emerald-600 font-medium">
              ✓ {{ totalAlumnosDetectados() }} alumno{{ totalAlumnosDetectados() === 1 ? '' : 's' }} detectado{{ totalAlumnosDetectados() === 1 ? '' : 's' }}
            </p>
          }
        </div>

        <!-- Error del servicio -->
        @if (gruposService.error()) {
          <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
            {{ gruposService.error() }}
          </div>
        }

      </form>

      <!-- ── Footer ───────────────────────────────────── -->
      <div modal-footer>
        <button
          type="button"
          (click)="onCerrar()"
          [disabled]="gruposService.cargando()"
          class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer
                 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>

        <app-btn
          variante="primary"
          tipo="submit"
          [loading]="gruposService.cargando()"
          (clicked)="guardar()"
        >
          Guardar Grupo
        </app-btn>
      </div>

    </app-modal>
  `,
})
export class ModalCrearGrupoComponent {
  readonly gruposService = inject(GruposService);
  private readonly fb = inject(FormBuilder);

  // ── Estado interno ─────────────────────────────────────

  /** Controla si el modal está visible. Se activa desde GruposComponent */
  abierto = signal(false);

  // ── Outputs ────────────────────────────────────────────

  /**
   * Emitido cuando el grupo se crea exitosamente.
   * GruposComponent lo escucha para recargar la tabla.
   */
  grupoCreado = output<Grupo>();

  // ── Formulario ─────────────────────────────────────────

  form = this.fb.group({
    /** Nombre del grupo o materia */
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    /** Texto con nombres separados por \n */
    listaAlumnos: ['', Validators.required],
  });

  // ── Computed ───────────────────────────────────────────

  /**
   * Cuenta cuántos alumnos válidos hay en el textarea en tiempo real.
   * Muestra feedback inmediato al docente mientras escribe/pega.
   */
  totalAlumnosDetectados = computed(() => {
    const texto = this.form.get('listaAlumnos')?.value ?? '';
    return texto
      .split('\n')
      .map((n: string) => n.trim())
      .filter((n: string) => n.length > 0).length;
  });

  // ── Métodos públicos ───────────────────────────────────

  /** Abre el modal y resetea el formulario */
  abrir() {
    this.form.reset();
    this.abierto.set(true);
  }

  /** Cierra el modal si no hay una operación en curso */
  onCerrar() {
    if (this.gruposService.cargando()) return;
    this.abierto.set(false);
    this.form.reset();
  }

  /** Valida y envía el formulario al servicio */
  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre, listaAlumnos } = this.form.value;
    const { data, error } = await this.gruposService.crearGrupo(
      nombre!,
      listaAlumnos!
    );

    if (!error && data) {
      this.grupoCreado.emit(data);
      this.abierto.set(false);
      this.form.reset();
    }
  }

  // ── Helpers ────────────────────────────────────────────

  /** Determina si un campo debe mostrar error visual */
  campoInvalido(campo: string): boolean {
    const ctrl = this.form.get(campo);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }
}