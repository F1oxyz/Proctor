// =============================================================
// features/docente/pages/grupos/grupos.component.ts
//
// Página principal de gestión de grupos del docente autenticado.
// Es la primera pantalla que ve el maestro tras iniciar sesión.
//
// Funcionalidades:
//   - Stats en cards: Total Alumnos, Exámenes Activos, Promedio General
//   - Tabs: Grupos Activos | Archivados | Pendientes (solo Activos funcional por ahora)
//   - Lista de grupos en tarjetas con:
//       · Nombre del grupo
//       · Conteo de alumnos
//       · Botón de ver alumnos (expande la tabla)
//       · Botón de eliminar grupo
//   - Tabla de alumnos expandible por grupo (TablaAlumnosComponent)
//   - Botón "+ Crear Nuevo Grupo" que abre ModalCrearGrupoComponent
//   - Estado vacío si no hay grupos (EmptyStateComponent)
//
// Provee GruposService en su propio injector (no en root)
// para que su estado se destruya al salir de esta ruta.
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  viewChild,
} from '@angular/core';
import { GruposService } from '../../services/grupos.service';
import { ModalCrearGrupoComponent } from './components/modal-crear-grupo/modal-crear-grupo.component';
import { TablaAlumnosComponent } from './components/tabla-alumnos/tabla-alumnos.component';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { BtnComponent } from '../../../../shared/components/btn/btn.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { Alumno, GrupoConStats } from '../../../../shared/models';

@Component({
  selector: 'app-grupos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // GruposService vive en el injector de este componente.
  // Se destruye al navegar fuera de /docente/grupos.
  providers: [GruposService],
  imports: [
    NavbarComponent,
    BtnComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    ModalCrearGrupoComponent,
    TablaAlumnosComponent,
  ],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">

      <!-- Navbar en modo docente -->
      <app-navbar modo="default" />

      <!-- Contenido principal -->
      <main class="flex-1 max-w-6xl mx-auto w-full px-6 py-8">

        <!-- ── Header de página ──────────────────────── -->
        <div class="flex items-start justify-between mb-6">
          <div>
            <h1 class="text-xl font-semibold text-slate-800">Gestión de Grupos</h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Administra tus clases, estudiantes y asignaciones académicas.
            </p>
          </div>
          <app-btn
            variante="primary"
            (clicked)="abrirModalCrear()"
          >
            <!-- Ícono + -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Crear Nuevo Grupo
          </app-btn>
        </div>

        <!-- ── Stats cards ───────────────────────────── -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

          <!-- Total Estudiantes -->
          <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <div>
              <p class="text-xs text-slate-500">Total Estudiantes</p>
              <p class="text-2xl font-semibold text-slate-800">{{ gruposService.totalAlumnos() }}</p>
            </div>
          </div>

          <!-- Exámenes Activos (placeholder — se llenará en Paso 4) -->
          <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <p class="text-xs text-slate-500">Exámenes Activos</p>
              <p class="text-2xl font-semibold text-slate-800">—</p>
            </div>
          </div>

          <!-- Grupos creados -->
          <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <div>
              <p class="text-xs text-slate-500">Grupos Creados</p>
              <p class="text-2xl font-semibold text-slate-800">{{ gruposService.grupos().length }}</p>
            </div>
          </div>

        </div>

        <!-- ── Tabs ──────────────────────────────────── -->
        <div class="flex items-center gap-1 border-b border-gray-100 mb-5">
          <button
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer"
            [class.border-blue-600]="tabActivo() === 'activos'"
            [class.text-blue-600]="tabActivo() === 'activos'"
            [class.border-transparent]="tabActivo() !== 'activos'"
            [class.text-slate-500]="tabActivo() !== 'activos'"
            (click)="tabActivo.set('activos')"
            [attr.aria-selected]="tabActivo() === 'activos'"
          >
            Grupos Activos
            <span class="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600">
              {{ gruposService.grupos().length }}
            </span>
          </button>

          <!-- Tabs placeholder (funcionalidad futura) -->
          <button
            class="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-slate-400 cursor-not-allowed"
            disabled aria-disabled="true"
            title="Próximamente"
          >
            Archivados
          </button>
          <button
            class="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-slate-400 cursor-not-allowed"
            disabled aria-disabled="true"
            title="Próximamente"
          >
            Pendientes
          </button>
        </div>

        <!-- ── Loading ───────────────────────────────── -->
        @if (gruposService.cargando() && gruposService.grupos().length === 0) {
          <app-loading-spinner tamano="md" />
        }

        <!-- ── Error global ──────────────────────────── -->
        @if (gruposService.error() && !gruposService.cargando()) {
          <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 flex items-center gap-2">
            <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            {{ gruposService.error() }}
          </div>
        }

        <!-- ── Lista de grupos ───────────────────────── -->
        @if (!gruposService.cargando() || gruposService.grupos().length > 0) {
          @if (gruposService.grupos().length === 0) {
            <!-- Estado vacío -->
            <app-empty-state
              icono="grupos"
              titulo="Sin grupos creados"
              mensaje="Crea tu primer grupo para comenzar a organizar a tus estudiantes."
            >
              <app-btn variante="primary" (clicked)="abrirModalCrear()">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Crear mi primer grupo
              </app-btn>
            </app-empty-state>

          } @else {
            <!-- Tarjetas de grupos -->
            <div class="flex flex-col gap-4">
              @for (grupo of gruposService.grupos(); track grupo.id) {
                <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">

                  <!-- ── Header de la tarjeta del grupo ── -->
                  <div class="flex items-center justify-between px-5 py-4">
                    <div class="flex items-center gap-3">
                      <!-- Ícono del grupo -->
                      <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 class="text-sm font-semibold text-slate-800">{{ grupo.nombre }}</h3>
                        <p class="text-xs text-slate-500">
                          {{ grupo.total_alumnos }} alumno{{ grupo.total_alumnos === 1 ? '' : 's' }} registrado{{ grupo.total_alumnos === 1 ? '' : 's' }}
                        </p>
                      </div>
                    </div>

                    <!-- Acciones del grupo -->
                    <div class="flex items-center gap-2">
                      <!-- Ver/Ocultar alumnos -->
                      <button
                        (click)="toggleAlumnos(grupo)"
                        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                               text-slate-600 hover:text-blue-600 hover:bg-blue-50
                               rounded-md transition-colors cursor-pointer"
                        [attr.aria-expanded]="grupoExpandido() === grupo.id"
                        [attr.aria-label]="grupoExpandido() === grupo.id ? 'Ocultar alumnos' : 'Ver alumnos'"
                      >
                        <svg class="w-3.5 h-3.5 transition-transform"
                             [class.rotate-180]="grupoExpandido() === grupo.id"
                             fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                        </svg>
                        {{ grupoExpandido() === grupo.id ? 'Ocultar' : 'Ver alumnos' }}
                      </button>

                      <!-- Eliminar grupo -->
                      <button
                        (click)="confirmarEliminar(grupo)"
                        class="p-1.5 rounded-md text-slate-400 hover:text-red-500
                               hover:bg-red-50 transition-colors cursor-pointer"
                        [attr.aria-label]="'Eliminar grupo ' + grupo.nombre"
                        title="Eliminar grupo"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- ── Tabla de alumnos expandible ───── -->
                  @if (grupoExpandido() === grupo.id) {
                    <div class="border-t border-gray-100 px-5 py-4">
                      @if (gruposService.cargando()) {
                        <app-loading-spinner tamano="sm" />
                      } @else {
                        <app-tabla-alumnos
                          [alumnos]="gruposService.alumnosGrupoActivo()"
                          [grupoNombre]="grupo.nombre"
                        />
                      }
                    </div>
                  }

                </div>
              }
            </div>
          }
        }

      </main>

      <!-- ── Modal crear grupo ─────────────────────────── -->
      <app-modal-crear-grupo
        #modalCrear
        (grupoCreado)="onGrupoCreado()"
      />

      <!-- ── Confirmación de eliminación ──────────────── -->
      @if (grupoAEliminar()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialogo-eliminar"
        >
          <div class="bg-white rounded-xl border border-gray-100 shadow-xl p-6 max-w-sm w-full">
            <h3 id="dialogo-eliminar" class="text-base font-semibold text-slate-800 mb-1">
              Eliminar grupo
            </h3>
            <p class="text-sm text-slate-500 mb-5">
              ¿Estás seguro de eliminar
              <strong class="text-slate-700">{{ grupoAEliminar()!.nombre }}</strong>?
              Esta acción eliminará también a los
              <strong>{{ grupoAEliminar()!.total_alumnos }} alumno{{ grupoAEliminar()!.total_alumnos === 1 ? '' : 's' }}</strong>
              y no se puede deshacer.
            </p>
            <div class="flex justify-end gap-3">
              <button
                (click)="grupoAEliminar.set(null)"
                class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                       hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <app-btn
                variante="danger"
                [loading]="gruposService.cargando()"
                (clicked)="eliminarGrupo()"
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
export class GruposComponent implements OnInit {
  readonly gruposService = inject(GruposService);

  // ── Referencias a componentes hijos ────────────────────

  /** Referencia al modal de crear grupo para poder abrirlo desde el botón */
  private readonly modalCrear = viewChild.required<ModalCrearGrupoComponent>('modalCrear');

  // ── Estado interno ─────────────────────────────────────

  /** Tab activo: 'activos' | 'archivados' | 'pendientes' */
  tabActivo = signal<'activos' | 'archivados' | 'pendientes'>('activos');

  /** ID del grupo cuya tabla de alumnos está expandida (null = ninguno) */
  grupoExpandido = signal<string | null>(null);

  /** Grupo pendiente de eliminar (muestra diálogo de confirmación) */
  grupoAEliminar = signal<GrupoConStats | null>(null);

  // ── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    // Cargar grupos al montar el componente
    this.gruposService.cargarGrupos();
  }

  // ── Métodos ────────────────────────────────────────────

  /** Abre el modal de crear grupo */
  abrirModalCrear() {
    this.modalCrear().abrir();
  }

  /**
   * Expande o colapsa la tabla de alumnos de un grupo.
   * Si el grupo ya estaba expandido, lo colapsa.
   * Si es otro grupo, carga sus alumnos desde Supabase.
   */
  async toggleAlumnos(grupo: GrupoConStats) {
    if (this.grupoExpandido() === grupo.id) {
      // Colapsar
      this.grupoExpandido.set(null);
      return;
    }
    // Expandir y cargar alumnos
    this.grupoExpandido.set(grupo.id);
    await this.gruposService.cargarAlumnos(grupo.id);
  }

  /**
   * Muestra el diálogo de confirmación de eliminación.
   * La eliminación real ocurre en eliminarGrupo().
   */
  confirmarEliminar(grupo: GrupoConStats) {
    this.grupoAEliminar.set(grupo);
  }

  /** Ejecuta la eliminación tras confirmación del usuario */
  async eliminarGrupo() {
    const grupo = this.grupoAEliminar();
    if (!grupo) return;

    const { error } = await this.gruposService.eliminarGrupo(grupo.id);

    if (!error) {
      // Si el grupo eliminado era el expandido, colapsar la tabla
      if (this.grupoExpandido() === grupo.id) {
        this.grupoExpandido.set(null);
      }
      this.grupoAEliminar.set(null);
    }
  }

  /**
   * Callback cuando el modal emite grupoCreado.
   * Los grupos ya se recargan en el servicio, solo cerramos estado local.
   */
  onGrupoCreado() {
    // El servicio ya recargó los grupos internamente.
    // Aquí se puede agregar feedback adicional si se requiere (toast, etc.)
  }
}