// =============================================================
// features/docente/pages/examenes/components/modal-iniciar-examen/
// modal-iniciar-examen.component.ts
//
// Modal que aparece cuando el maestro hace clic en "Iniciar Examen".
// Permite al maestro:
//   1. Ver el nombre y duración del examen seleccionado
//   2. Seleccionar el grupo al que se le aplicará el examen
//   3. Confirmar para iniciar la sesión
//
// Al confirmar:
//   - Llama a SesionesService.crearSesion(examenId, grupoId)
//   - El servicio genera el código de acceso y crea la sesión en BD
//   - Emite (sesionIniciada) con el ID de sesión para que el padre
//     navegue a /docente/monitor/:sesionId
//
// Usa ModalComponent de shared para el wrapper visual.
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  output,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../../../shared/components/modal/modal.component';
import { BtnComponent } from '../../../../../../shared/components/btn/btn.component';
import { Examen, Grupo } from '../../../../../../shared/models';
import { SesionesService } from '../../../../services/sesiones.service';

@Component({
  selector: 'app-modal-iniciar-examen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModalComponent, BtnComponent],
  template: `
    <app-modal
      [abierto]="abierto()"
      ancho="md"
      (cerrar)="onCerrar()"
    >
      <!-- ── Header ──────────────────────────────────── -->
      <div modal-header class="mb-1">
        <h2 class="text-base font-semibold text-slate-800">Configurar e Iniciar Examen</h2>
      </div>

      <!-- ── Body ────────────────────────────────────── -->
      <div class="flex flex-col gap-5">

        <!-- Info del examen seleccionado -->
        @if (examen()) {
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div class="w-9 h-9 bg-white rounded-lg border border-gray-200 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-800">{{ examen()!.titulo }}</p>
              <p class="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                Duración: {{ examen()!.duracion_min }} minutos
              </p>
            </div>
          </div>
        }

        <!-- Selector de grupo -->
        <div class="flex flex-col gap-1.5">
          <label for="grupo-select" class="text-sm font-medium text-slate-700">
            Selecciona el grupo a evaluar
          </label>
          <select
            id="grupo-select"
            [(ngModel)]="grupoSeleccionadoId"
            class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800 bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                   transition-colors cursor-pointer"
            [class.border-red-400]="mostrarErrorGrupo()"
            [class.border-gray-200]="!mostrarErrorGrupo()"
          >
            <option value="">Seleccionar grupo...</option>
            @for (grupo of grupos(); track grupo.id) {
              <option [value]="grupo.id">{{ grupo.nombre }}</option>
            }
          </select>
          @if (mostrarErrorGrupo()) {
            <p class="text-xs text-red-500">Selecciona un grupo para continuar.</p>
          }
        </div>

        <!-- Aviso informativo -->
        <div class="flex items-start gap-2.5 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <svg class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
          <p class="text-xs text-blue-700 leading-relaxed">
            Al iniciar, se generará el código de acceso y serás redirigido a la
            <strong>Sala de Monitoreo en Vivo</strong> para recibir las pantallas de los estudiantes.
          </p>
        </div>

        <!-- Error del servicio -->
        @if (sesionesService.error()) {
          <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
            {{ sesionesService.error() }}
          </div>
        }

      </div>

      <!-- ── Footer ───────────────────────────────────── -->
      <div modal-footer>
        <button
          type="button"
          (click)="onCerrar()"
          [disabled]="sesionesService.cargando()"
          class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer
                 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>

        <app-btn
          variante="primary"
          [loading]="sesionesService.cargando()"
          (clicked)="iniciarExamen()"
        >
          <!-- Ícono play -->
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
          </svg>
          Iniciar Examen
        </app-btn>
      </div>

    </app-modal>
  `,
})
export class ModalIniciarExamenComponent {
  readonly sesionesService = inject(SesionesService);

  // ── Estado interno ─────────────────────────────────────

  abierto = signal(false);

  /** Examen a iniciar (se pasa al abrir el modal) */
  examen = signal<Examen | null>(null);

  /** Lista de grupos del docente para el selector */
  grupos = signal<Grupo[]>([]);

  /** ID del grupo seleccionado en el <select> */
  grupoSeleccionadoId = '';

  /** Muestra error si se intenta iniciar sin seleccionar grupo */
  mostrarErrorGrupo = signal(false);

  // ── Outputs ────────────────────────────────────────────

  /**
   * Emitido cuando la sesión se crea exitosamente.
   * El padre (ExamenesComponent) navega a /docente/monitor/:sesionId
   */
  sesionIniciada = output<string>();

  // ── Métodos públicos ───────────────────────────────────

  /**
   * Abre el modal con el examen y grupos dados.
   * @param examen - Examen que se va a iniciar
   * @param grupos - Lista de grupos del docente para el selector
   */
  abrir(examen: Examen, grupos: Grupo[]) {
    this.examen.set(examen);
    this.grupos.set(grupos);
    this.grupoSeleccionadoId = examen.grupo_id ?? '';
    this.mostrarErrorGrupo.set(false);
    this.sesionesService.error.set(null);
    this.abierto.set(true);
  }

  /** Cierra el modal y limpia estado */
  onCerrar() {
    if (this.sesionesService.cargando()) return;
    this.abierto.set(false);
    this.grupoSeleccionadoId = '';
  }

  /** Valida y crea la sesión en Supabase */
  async iniciarExamen() {
    if (!this.grupoSeleccionadoId) {
      this.mostrarErrorGrupo.set(true);
      return;
    }
    this.mostrarErrorGrupo.set(false);

    const examen = this.examen();
    if (!examen) return;

    const { data, error } = await this.sesionesService.crearSesion(
      examen.id,
      this.grupoSeleccionadoId
    );

    if (!error && data) {
      this.sesionIniciada.emit(data.id);
      this.abierto.set(false);
    }
  }
}