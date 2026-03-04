// =============================================================
// features/docente/pages/examenes/examenes.component.ts
//
// Lista de exámenes del maestro autenticado.
// Muestra cada examen como una tarjeta con:
//   - Título y duración
//   - Nombre del grupo al que pertenece
//   - Botón "Iniciar" → abre ModalIniciarExamenComponent
//   - Botón "Editar"  → navega a /docente/examenes/:id
//   - Botón "Eliminar" → confirma y borra
//
// Provee ExamenesService y GruposService en su injector.
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  viewChild,
  computed,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExamenesService } from '../../services/examenes.service';
import { GruposService } from '../../services/grupos.service';
import { SesionesService } from '../../services/sesiones.service';
import { ModalIniciarExamenComponent } from './components/modal-iniciar-examen/modal-iniciar-examen.component';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { BtnComponent } from '../../../../shared/components/btn/btn.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { Examen } from '../../../../shared/models';

@Component({
  selector: 'app-examenes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExamenesService, GruposService, SesionesService],
  imports: [
    RouterLink,
    NavbarComponent,
    BtnComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    ModalIniciarExamenComponent,
  ],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <app-navbar modo="default" />

      <main class="flex-1 max-w-6xl mx-auto w-full px-6 py-8">

        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
          <div>
            <h1 class="text-xl font-semibold text-slate-800">Mis Exámenes</h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Crea y administra tus evaluaciones académicas.
            </p>
          </div>
          <app-btn variante="primary" (clicked)="crearNuevo()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Nuevo Examen
          </app-btn>
        </div>

        <!-- Loading inicial -->
        @if (examenesService.cargando() && examenesService.examenes().length === 0) {
          <app-loading-spinner tamano="md" />
        }

        <!-- Error -->
        @if (examenesService.error()) {
          <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {{ examenesService.error() }}
          </div>
        }

        <!-- Lista de exámenes -->
        @if (!examenesService.cargando() || examenesService.examenes().length > 0) {
          @if (examenesService.examenes().length === 0) {
            <app-empty-state
              icono="examenes"
              titulo="Sin exámenes creados"
              mensaje="Crea tu primer examen y asígnalo a un grupo."
            >
              <app-btn variante="primary" (clicked)="crearNuevo()">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Crear mi primer examen
              </app-btn>
            </app-empty-state>
          } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (examen of examenesService.examenes(); track examen.id) {
                <div class="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4
                            hover:border-gray-200 transition-colors">

                  <!-- Ícono + Título -->
                  <div class="flex items-start gap-3">
                    <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h3 class="text-sm font-semibold text-slate-800 truncate">{{ examen.titulo }}</h3>
                      <div class="flex items-center gap-3 mt-1">
                        <!-- Duración -->
                        <span class="text-xs text-slate-400 flex items-center gap-1">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                          </svg>
                          {{ examen.duracion_min }} min
                        </span>
                        <!-- Grupo -->
                        <span class="text-xs text-slate-400 truncate">
                          {{ nombreGrupo(examen.grupo_id) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Acciones -->
                  <div class="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <!-- Iniciar -->
                    <app-btn
                      variante="primary"
                      tamano="sm"
                      [fullWidth]="true"
                      (clicked)="abrirIniciarExamen(examen)"
                    >
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                      </svg>
                      Iniciar
                    </app-btn>

                    <!-- Editar -->
                    <button
                      (click)="editar(examen)"
                      class="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs
                             font-medium text-slate-600 border border-gray-200 rounded-lg
                             hover:bg-gray-50 transition-colors cursor-pointer"
                      [attr.aria-label]="'Editar ' + examen.titulo"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      Editar
                    </button>

                    <!-- Eliminar -->
                    <button
                      (click)="confirmarEliminar(examen)"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-red-500
                             hover:bg-red-50 transition-colors cursor-pointer"
                      [attr.aria-label]="'Eliminar ' + examen.titulo"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>

                </div>
              }
            </div>
          }
        }

      </main>

      <!-- Modal iniciar examen -->
      <app-modal-iniciar-examen
        #modalIniciar
        (sesionIniciada)="onSesionIniciada($event)"
      />

      <!-- Diálogo confirmación eliminar -->
      @if (examenAEliminar()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog" aria-modal="true"
        >
          <div class="bg-white rounded-xl border border-gray-100 shadow-xl p-6 max-w-sm w-full">
            <h3 class="text-base font-semibold text-slate-800 mb-1">Eliminar examen</h3>
            <p class="text-sm text-slate-500 mb-5">
              ¿Eliminar <strong class="text-slate-700">{{ examenAEliminar()!.titulo }}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div class="flex justify-end gap-3">
              <button
                (click)="examenAEliminar.set(null)"
                class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50
                       rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <app-btn
                variante="danger"
                [loading]="examenesService.cargando()"
                (clicked)="eliminarExamen()"
              >
                Eliminar
              </app-btn>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class ExamenesComponent implements OnInit {
  private readonly router = inject(Router);
  readonly examenesService = inject(ExamenesService);
  readonly gruposService = inject(GruposService);

  private readonly modalIniciar =
    viewChild.required<ModalIniciarExamenComponent>('modalIniciar');

  examenAEliminar = signal<Examen | null>(null);

  ngOnInit() {
    this.examenesService.cargarExamenes();
    this.gruposService.cargarGrupos();
  }

  crearNuevo() {
    this.router.navigate(['/docente/examenes/nuevo']);
  }

  editar(examen: Examen) {
    this.router.navigate(['/docente/examenes', examen.id]);
  }

  abrirIniciarExamen(examen: Examen) {
    this.modalIniciar().abrir(examen, this.gruposService.grupos());
  }

  onSesionIniciada(sesionId: string) {
    this.router.navigate(['/docente/monitor', sesionId]);
  }

  confirmarEliminar(examen: Examen) {
    this.examenAEliminar.set(examen);
  }

  async eliminarExamen() {
    const examen = this.examenAEliminar();
    if (!examen) return;
    const { error } = await this.examenesService.eliminarExamen(examen.id);
    if (!error) this.examenAEliminar.set(null);
  }

  /**
   * Obtiene el nombre del grupo por ID para mostrar en la tarjeta.
   * Busca en el signal de grupos cargados.
   */
  nombreGrupo(grupoId: string): string {
    return (
      this.gruposService.grupos().find((g) => g.id === grupoId)?.nombre ?? '—'
    );
  }
}