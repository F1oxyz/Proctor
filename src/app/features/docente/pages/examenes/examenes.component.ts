/**
 * examenes.component.ts
 * ─────────────────────────────────────────────────────────────────
 * BUGS CORREGIDOS:
 *  - Bug 4: eliminar examen ahora muestra error si falla
 *  - Bug 6: sección "Historial de Sesiones" para ver resultados pasados
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { ExamenesService, SesionResumen }  from '../../services/examenes.service';
import { SesionesService }  from '../../services/sesiones.service';
import {
  NavbarComponent,
} from '../../../../shared/components/navbar/navbar.component';
import {
  EmptyStateComponent,
} from '../../../../shared/components/empty-state/empty-state.component';
import {
  LoadingSpinnerComponent,
} from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ModalIniciarExamenComponent } from './components/modal-iniciar-examen/modal-iniciar-examen.component';
import { ExamenConGrupo, IniciarExamenPayload } from '../../services/examenes.service';

@Component({
  selector: 'app-examenes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    NavbarComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    ModalIniciarExamenComponent,
  ],
  providers: [ExamenesService, SesionesService],
  template: `
    <app-navbar modo="default" />

    <main class="max-w-5xl mx-auto px-4 py-8">

      <!-- Encabezado -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Mis Exámenes</h1>
          <p class="text-sm text-slate-500 mt-0.5">Crea y gestiona tus evaluaciones.</p>
        </div>
        <a
          routerLink="/docente/examenes/nuevo"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Examen
        </a>
      </div>

      <!-- Error global (Bug 4: se muestra sobre la tabla también) -->
      @if (servicio.error()) {
        <div class="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ servicio.error() }}
          <button type="button" (click)="servicio.error.set(null)" class="ml-auto text-red-500 hover:text-red-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }

      <!-- Loading -->
      @if (servicio.cargando() && servicio.examenes().length === 0) {
        <div class="flex justify-center py-20">
          <app-loading-spinner />
        </div>
      }

      <!-- Lista vacía -->
      @else if (!servicio.cargando() && servicio.examenes().length === 0) {
        <app-empty-state
          icono="examenes"
          titulo="Sin exámenes creados"
          mensaje="Crea tu primer examen para comenzar a evaluar a tus alumnos."
        />
      }

      <!-- Tabla de exámenes -->
      @else {
        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
          <table class="w-full text-sm" role="table">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50">
                <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grupo</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duración</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Creado</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (examen of servicio.examenes(); track examen.id) {
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-3 font-medium text-slate-800">{{ examen.titulo }}</td>
                  <td class="px-4 py-3 text-slate-500">{{ examen.grupos?.nombre ?? '—' }}</td>
                  <td class="px-4 py-3 text-center text-slate-500">{{ examen.duracion_min }} min</td>
                  <td class="px-4 py-3 text-center text-slate-400 text-xs">
                    {{ examen.creado_en | date:'dd/MM/yy' }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-center gap-1">

                      <!-- Editar -->
                      <a
                        [routerLink]="['/docente/examenes', examen.id]"
                        class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="Editar examen"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </a>

                      <!-- Iniciar -->
                      <button
                        type="button"
                        (click)="abrirModalIniciar(examen)"
                        class="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        aria-label="Iniciar sesión de examen"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>

                      <!-- Eliminar -->
                      <button
                        type="button"
                        (click)="confirmarEliminar(examen)"
                        class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Eliminar examen"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ── Bug 6: Historial de Sesiones ── -->
      @if (sesionesRecientes().length > 0) {
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold text-slate-800">Historial de Sesiones</h2>
            <span class="text-xs text-slate-400">Últimas {{ sesionesRecientes().length }} sesiones</span>
          </div>

          <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table class="w-full text-sm" role="table">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50">
                  <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Examen</th>
                  <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                  <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (sesion of sesionesRecientes(); track sesion.id) {
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-3 font-medium text-slate-800">{{ sesion.examen_titulo }}</td>
                    <td class="px-4 py-3">
                      <span class="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded tracking-widest">
                        {{ sesion.codigo_acceso }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      @if (sesion.estado === 'finalizada') {
                        <span class="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Finalizada
                        </span>
                      } @else if (sesion.estado === 'activa') {
                        <span class="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          En curso
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          En espera
                        </span>
                      }
                    </td>
                    <td class="px-4 py-3 text-center text-slate-400 text-xs">
                      {{ sesion.iniciada_en | date:'dd/MM/yy HH:mm' }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      @if (sesion.estado === 'finalizada') {
                        <a
                          [routerLink]="['/docente/resultados', sesion.id]"
                          class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Ver resultados
                        </a>
                      } @else if (sesion.estado !== 'esperando') {
                        <a
                          [routerLink]="['/docente/monitor', sesion.id]"
                          class="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline"
                        >
                          Ir al monitor
                        </a>
                      } @else {
                        <a
                          [routerLink]="['/docente/monitor', sesion.id]"
                          class="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                        >
                          Ir al monitor
                        </a>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

    </main>

    <!-- Modal Iniciar Examen -->
    @if (examenParaIniciar()) {
      <app-modal-iniciar-examen
        [examen]="examenParaIniciar()!"
        [cargando]="iniciandoExamen()"
        (iniciar)="onIniciarExamen($event)"
        (cerrar)="cerrarModalIniciar()"
      />
    }

    <!-- Modal Confirmar Eliminar -->
    @if (examenParaEliminar()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <h3 class="text-base font-bold text-slate-800 mb-2">¿Eliminar examen?</h3>
          <p class="text-sm text-slate-600 mb-1">
            "{{ examenParaEliminar()!.titulo }}" se eliminará permanentemente junto con todas sus preguntas
            y el historial de sesiones.
          </p>
          <p class="text-xs text-amber-600 mb-5">Esta acción no se puede deshacer.</p>
          <div class="flex justify-end gap-3">
            <button type="button" (click)="examenParaEliminar.set(null)"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancelar</button>
            <button type="button" (click)="eliminarExamen()"
              [disabled]="servicio.cargando()"
              class="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-slate-300 rounded-lg flex items-center gap-2">
              @if (servicio.cargando()) {
                <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              }
              Eliminar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ExamenesComponent implements OnInit {
  // ── Dependencias ────────────────────────────────────────────────
  readonly servicio       = inject(ExamenesService);
  private readonly sesionesService = inject(SesionesService);
  private readonly router = inject(Router);

  // ── Estado ───────────────────────────────────────────────────────
  readonly examenParaIniciar  = signal<ExamenConGrupo | null>(null);
  readonly examenParaEliminar = signal<ExamenConGrupo | null>(null);
  readonly iniciandoExamen    = signal(false);

  /** Bug 6: historial de sesiones */
  readonly sesionesRecientes  = signal<SesionResumen[]>([]);

  // ── Ciclo de vida ─────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.servicio.cargarExamenes();

    // Bug 6: cargar historial de sesiones
    const sesiones = await this.servicio.cargarSesionesRecientes();
    this.sesionesRecientes.set(sesiones);
  }

  // ── Handlers ─────────────────────────────────────────────────────

  abrirModalIniciar(examen: ExamenConGrupo): void {
    this.examenParaIniciar.set(examen);
  }

  cerrarModalIniciar(): void {
    this.examenParaIniciar.set(null);
  }

  confirmarEliminar(examen: ExamenConGrupo): void {
    this.examenParaEliminar.set(examen);
  }

  async eliminarExamen(): Promise<void> {
    const examen = this.examenParaEliminar();
    if (!examen) return;
    const result = await this.servicio.eliminarExamen(examen.id);
    this.examenParaEliminar.set(null);
    // Bug 4: si hay error, servicio.error() lo mostrará en el banner global
    if (!result.error) {
      // Refrescar historial de sesiones tras eliminar
      const sesiones = await this.servicio.cargarSesionesRecientes();
      this.sesionesRecientes.set(sesiones);
    }
  }

  onCerrarModal(): void {
    this.examenParaIniciar.set(null);
    this.iniciandoExamen.set(false);
  }

  async onIniciarExamen(payload: IniciarExamenPayload): Promise<void> {
    if (this.iniciandoExamen()) return;

    this.iniciandoExamen.set(true);

    const sesionId = await this.sesionesService.crearSesion(
      payload.examenId,
      payload.grupoId
    );

    this.iniciandoExamen.set(false);

    if (!sesionId) {
      console.error('[ExamenesComponent] No se pudo crear la sesión.');
      return;
    }

    this.cerrarModalIniciar();
    this.router.navigate(['/docente/monitor', sesionId]);
  }
}
