// =============================================================
// features/docente/pages/grupos/components/tabla-alumnos/
// tabla-alumnos.component.ts
//
// Tabla que muestra la lista de alumnos de un grupo seleccionado.
// Incluye:
//   - Búsqueda en tiempo real por nombre
//   - Paginación simple (5 alumnos por página)
//   - Avatar con iniciales del alumno
//   - Estado visual (Activo por defecto)
//   - Columna de acciones (placeholder para futuras acciones)
//
// Recibe los alumnos via input() desde GruposComponent.
// No hace llamadas a Supabase directamente (responsabilidad del padre).
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Alumno } from '../../../../../../shared/models';
import { InicialesPipe } from '../../../../../../shared/pipes/iniciales.pipe';
import { EmptyStateComponent } from '../../../../../../shared/components/empty-state/empty-state.component';

/** Cantidad de alumnos por página */
const ALUMNOS_POR_PAGINA = 5;

@Component({
  selector: 'app-tabla-alumnos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InicialesPipe, EmptyStateComponent],
  template: `
    <div class="flex flex-col gap-3">

      <!-- ── Barra de búsqueda y acciones ─────────────── -->
      <div class="flex items-center justify-between gap-3">
        <!-- Búsqueda -->
        <div class="relative flex-1 max-w-xs">
          <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="search"
            [(ngModel)]="busqueda"
            (ngModelChange)="paginaActual.set(1)"
            placeholder="Buscar estudiante o ID..."
            class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg
                   text-slate-800 placeholder-slate-400 bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                   transition-colors"
            aria-label="Buscar alumno"
          />
        </div>

        <!-- Contador de resultados -->
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
                <th class="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Estado
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
                      <!-- Avatar con iniciales -->
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

                  <!-- Grupo (nombre del grupo viene del padre via grupoNombre input) -->
                  <td class="px-4 py-3 hidden md:table-cell">
                    @if (grupoNombre()) {
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs
                                   font-medium bg-blue-50 text-blue-700">
                        {{ grupoNombre() }}
                      </span>
                    }
                  </td>

                  <!-- Estado -->
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
                      Activo
                    </span>
                  </td>

                  <!-- Acciones -->
                  <td class="px-4 py-3 text-right">
                    <button
                      class="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors cursor-pointer"
                      aria-label="Más opciones"
                      title="Más opciones"
                    >
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                      </svg>
                    </button>
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
              <!-- Anterior -->
              <button
                (click)="cambiarPagina(paginaActual() - 1)"
                [disabled]="paginaActual() === 1"
                class="p-1.5 rounded-md text-slate-500 hover:bg-gray-100 disabled:opacity-30
                       disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Página anterior"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>

              <!-- Números de página -->
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

              <!-- Siguiente -->
              <button
                (click)="cambiarPagina(paginaActual() + 1)"
                [disabled]="paginaActual() === totalPaginas()"
                class="p-1.5 rounded-md text-slate-500 hover:bg-gray-100 disabled:opacity-30
                       disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Página siguiente"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        }

      } @else {
        <!-- Estado vacío cuando no hay resultados de búsqueda -->
        <app-empty-state
          icono="alumnos"
          titulo="Sin resultados"
          [mensaje]="busqueda ? 'No se encontró ningún alumno con ese nombre.' : 'Este grupo no tiene alumnos registrados.'"
        />
      }

    </div>
  `,
})
export class TablaAlumnosComponent {
  // ── Inputs ─────────────────────────────────────────────

  /** Lista de alumnos a mostrar (viene de GruposComponent) */
  alumnos = input.required<Alumno[]>();

  /** Nombre del grupo para mostrar en la columna "Grupo Asignado" */
  grupoNombre = input<string>('');

  // ── Estado interno ─────────────────────────────────────

  /** Texto de búsqueda en tiempo real */
  busqueda = '';

  /** Página actual de la paginación (base 1) */
  paginaActual = signal(1);

  // ── Computed ───────────────────────────────────────────

  /** Alumnos filtrados por el texto de búsqueda (case-insensitive) */
  alumnosFiltrados = computed(() => {
    const q = this.busqueda.toLowerCase().trim();
    if (!q) return this.alumnos();
    return this.alumnos().filter((a) =>
      a.nombre_completo.toLowerCase().includes(q)
    );
  });

  /** Total de páginas necesarias */
  totalPaginas = computed(() =>
    Math.ceil(this.alumnosFiltrados().length / ALUMNOS_POR_PAGINA)
  );

  /** Alumnos de la página actual */
  alumnosPagina = computed(() => {
    const inicio = (this.paginaActual() - 1) * ALUMNOS_POR_PAGINA;
    return this.alumnosFiltrados().slice(inicio, inicio + ALUMNOS_POR_PAGINA);
  });

  /** Números de página a mostrar en el paginador */
  paginasVisibles = computed(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  /** Índice del primer alumno en la página actual (para el texto "X a Y de Z") */
  rangoInicio = computed(() =>
    Math.min(
      (this.paginaActual() - 1) * ALUMNOS_POR_PAGINA + 1,
      this.alumnosFiltrados().length
    )
  );

  /** Índice del último alumno en la página actual */
  rangoFin = computed(() =>
    Math.min(
      this.paginaActual() * ALUMNOS_POR_PAGINA,
      this.alumnosFiltrados().length
    )
  );

  // ── Métodos ────────────────────────────────────────────

  /** Cambia la página activa (con validación de límites) */
  cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas()) {
      this.paginaActual.set(pagina);
    }
  }

  /**
   * Genera un color de avatar consistente basado en el nombre.
   * Usa un hash simple del nombre para elegir entre 8 colores predefinidos.
   * El mismo nombre siempre genera el mismo color (determinístico).
   */
  colorAvatar(nombre: string): string {
    const colores = [
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#10b981', // emerald-500
      '#f59e0b', // amber-500
      '#ef4444', // red-500
      '#06b6d4', // cyan-500
      '#ec4899', // pink-500
      '#84cc16', // lime-500
    ];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colores[Math.abs(hash) % colores.length];
  }
}