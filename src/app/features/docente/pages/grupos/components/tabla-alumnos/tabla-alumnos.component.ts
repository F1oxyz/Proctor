// =============================================================
// tabla-alumnos.component.ts
//
// BUGS CORREGIDOS:
//  - Bug 8: busqueda era string plano → convertido a signal()
//  - Bug 9: botón Acciones sin dropdown → menú con opciones
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Alumno } from '../../../../../../shared/models';
import { InicialesPipe } from '../../../../../../shared/pipes/iniciales.pipe';
import { EmptyStateComponent } from '../../../../../../shared/components/empty-state/empty-state.component';

const ALUMNOS_POR_PAGINA = 5;

@Component({
  selector: 'app-tabla-alumnos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InicialesPipe, EmptyStateComponent],
  template: `
    <div class="flex flex-col gap-3">

      <!-- ── Barra de búsqueda ─────────────── -->
      <div class="flex items-center justify-between gap-3">
        <div class="relative flex-1 max-w-xs">
          <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="search"
            [ngModel]="busqueda()"
            (ngModelChange)="onBusquedaChange($event)"
            placeholder="Buscar estudiante o ID..."
            class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg
                   text-slate-800 placeholder-slate-400 bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                   transition-colors"
            aria-label="Buscar alumno"
          />
        </div>
        <span class="text-xs text-slate-400 shrink-0">
          {{ alumnosFiltrados().length }} resultado{{ alumnosFiltrados().length === 1 ? '' : 's' }}
        </span>
      </div>

      <!-- ── Tabla ────────────────────────────────────── -->
      @if (alumnosFiltrados().length > 0) {
        <div class="border border-gray-100 rounded-lg overflow-hidden">
          <table class="w-full text-sm" role="table" aria-label="Lista de estudiantes">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100">
                <th class="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Nombre del Estudiante
                </th>
                <th class="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                  Grupo Asignado
                </th>
                <th class="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              @for (alumno of alumnosPagina(); track alumno.id) {
                <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">

                  <!-- Avatar + Nombre -->
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-8 h-8 rounded-full flex items-center justify-center
                               text-xs font-semibold text-white shrink-0"
                        [style.background-color]="colorAvatar(alumno.nombre_completo)"
                        [attr.aria-label]="'Avatar de ' + alumno.nombre_completo"
                      >
                        {{ alumno.nombre_completo | iniciales }}
                      </div>
                      <span class="font-medium text-slate-800">{{ alumno.nombre_completo }}</span>
                    </div>
                  </td>

                  <!-- Grupo -->
                  <td class="px-4 py-3 hidden md:table-cell">
                    @if (grupoNombre()) {
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs
                                   font-medium bg-blue-50 text-blue-700">
                        {{ grupoNombre() }}
                      </span>
                    }
                  </td>

                  <!-- Acciones: botones directos -->
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        (click)="onEditarAlumno(alumno)"
                        class="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        (click)="onEliminarAlumno(alumno)"
                        class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
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

        <!-- ── Paginación ──────────────────────────────── -->
        @if (totalPaginas() > 1) {
          <div class="flex items-center justify-between px-1">
            <span class="text-xs text-slate-400">
              Mostrando {{ rangoInicio() }} a {{ rangoFin() }} de {{ alumnosFiltrados().length }} resultados
            </span>
            <div class="flex items-center gap-1">
              <button
                (click)="cambiarPagina(paginaActual() - 1)"
                [disabled]="paginaActual() === 1"
                class="p-1.5 rounded-md text-slate-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Página anterior"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              @for (pagina of paginasVisibles(); track pagina) {
                <button
                  (click)="cambiarPagina(pagina)"
                  class="w-7 h-7 rounded-md text-xs font-medium transition-colors cursor-pointer"
                  [class.bg-blue-600]="pagina === paginaActual()"
                  [class.text-white]="pagina === paginaActual()"
                  [class.text-slate-600]="pagina !== paginaActual()"
                  [class.hover:bg-gray-100]="pagina !== paginaActual()"
                  [attr.aria-current]="pagina === paginaActual() ? 'page' : null"
                >
                  {{ pagina }}
                </button>
              }
              <button
                (click)="cambiarPagina(paginaActual() + 1)"
                [disabled]="paginaActual() === totalPaginas()"
                class="p-1.5 rounded-md text-slate-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Página siguiente"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        }

      } @else {
        <app-empty-state
          icono="alumnos"
          titulo="Sin resultados"
          [mensaje]="busqueda() ? 'No se encontró ningún alumno con ese nombre.' : 'Este grupo no tiene alumnos registrados.'"
        />
      }

    </div>
  `,
})
export class TablaAlumnosComponent {
  // ── Inputs ─────────────────────────────────────────────
  alumnos = input.required<Alumno[]>();
  grupoNombre = input<string>('');

  // ── Outputs ────────────────────────────────────────────
  editarAlumno = output<Alumno>();
  eliminarAlumno = output<Alumno>();

  // ── Estado interno ─────────────────────────────────────
  // Bug 8: convertido a signal para que computed() lo rastree
  readonly busqueda = signal('');
  readonly paginaActual = signal(1);

  // ── Computed ───────────────────────────────────────────

  readonly alumnosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.alumnos();
    return this.alumnos().filter((a) =>
      a.nombre_completo.toLowerCase().includes(q)
    );
  });

  readonly totalPaginas = computed(() =>
    Math.ceil(this.alumnosFiltrados().length / ALUMNOS_POR_PAGINA)
  );

  readonly alumnosPagina = computed(() => {
    const inicio = (this.paginaActual() - 1) * ALUMNOS_POR_PAGINA;
    return this.alumnosFiltrados().slice(inicio, inicio + ALUMNOS_POR_PAGINA);
  });

  readonly paginasVisibles = computed(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  readonly rangoInicio = computed(() =>
    Math.min(
      (this.paginaActual() - 1) * ALUMNOS_POR_PAGINA + 1,
      this.alumnosFiltrados().length
    )
  );

  readonly rangoFin = computed(() =>
    Math.min(
      this.paginaActual() * ALUMNOS_POR_PAGINA,
      this.alumnosFiltrados().length
    )
  );

  // ── Métodos ────────────────────────────────────────────

  onBusquedaChange(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas()) {
      this.paginaActual.set(pagina);
    }
  }

  // Acciones (emiten outputs al padre)

  onEditarAlumno(alumno: Alumno): void {
    this.editarAlumno.emit(alumno);
  }

  onEliminarAlumno(alumno: Alumno): void {
    this.eliminarAlumno.emit(alumno);
  }

  colorAvatar(nombre: string): string {
    const colores = [
      '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
      '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
    ];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colores[Math.abs(hash) % colores.length];
  }
}
