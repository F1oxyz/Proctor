// =============================================================
// features/docente/pages/examenes/components/modal-iniciar-examen/
// modal-iniciar-examen.component.ts
//
// Modal para configurar e iniciar un examen.
// Componente dumb: recibe datos via inputs y emite eventos.
// La creación de la sesión la maneja ExamenesComponent.
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { Examen } from '../../../../../../shared/models';
import { IniciarExamenPayload } from '../../../../services/examenes.service';

@Component({
  selector: 'app-modal-iniciar-examen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
      (click)="onBackdropClick($event)"
    >
      <div
        class="bg-white rounded-2xl shadow-xl w-full max-w-md"
        (click)="$event.stopPropagation()"
      >

        <!-- ── Header ────────────────────────────────── -->
        <div class="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 id="modal-titulo" class="text-base font-semibold text-slate-800">
            Configurar e Iniciar Examen
          </h2>
          <button
            type="button"
            (click)="onCerrar()"
            [disabled]="cargando()"
            class="p-1 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- ── Body ──────────────────────────────────── -->
        <div class="px-6 py-5 flex flex-col gap-5">

          <!-- Info del examen -->
          <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div class="w-9 h-9 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-800">{{ examen().titulo }}</p>
              <p class="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                Duración: {{ examen().duracion_min }} minutos
              </p>
            </div>
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

        </div>

        <!-- ── Footer ─────────────────────────────────── -->
        <div class="flex items-center justify-end gap-3 px-6 pb-5">
          <button
            type="button"
            (click)="onCerrar()"
            [disabled]="cargando()"
            class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                   hover:bg-slate-50 rounded-lg transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>

          <button
            type="button"
            (click)="onIniciar()"
            [disabled]="cargando()"
            class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
                   bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (cargando()) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Iniciando...
            } @else {
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
              </svg>
              Iniciar Examen
            }
          </button>
        </div>

      </div>
    </div>
  `,
})
export class ModalIniciarExamenComponent {
  // ── Inputs ─────────────────────────────────────────────
  examen   = input.required<Examen>();
  cargando = input(false);

  // ── Outputs ────────────────────────────────────────────
  iniciar = output<IniciarExamenPayload>();
  cerrar  = output<void>();

  // ── Métodos ────────────────────────────────────────────

  onIniciar(): void {
    this.iniciar.emit({ examenId: this.examen().id, grupoId: this.examen().grupo_id });
  }

  onCerrar(): void {
    if (this.cargando()) return;
    this.cerrar.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCerrar();
    }
  }
}
