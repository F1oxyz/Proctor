

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  providers: [GruposService], // scope local: se destruye al salir de la ruta
  imports: [
    NavbarComponent,
    BtnComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    ModalCrearGrupoComponent,
    TablaAlumnosComponent,
    FormsModule,
  ],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">

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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          <!-- Total Estudiantes -->
          <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--color-brand)"><path d="M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z"/></svg>
            </div>
            <div>
              <p class="text-xs text-slate-500">Total Estudiantes</p>
              <p class="text-2xl font-semibold text-slate-800">{{ gruposService.totalAlumnos() }}</p>
            </div>
          </div>

          <!-- Grupos creados -->
          <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-brand" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
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
            [class.border-brand]="tabActivo() === 'activos'"
            [class.text-brand]="tabActivo() === 'activos'"
            [class.border-transparent]="tabActivo() !== 'activos'"
            [class.text-slate-500]="tabActivo() !== 'activos'"
            (click)="tabActivo.set('activos')"
            [attr.aria-selected]="tabActivo() === 'activos'"
          >
            Grupos Activos
            <span class="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-brand/10 text-brand">
              {{ gruposService.grupos().length }}
            </span>
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
                                <div class="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--color-brand)"><path d="M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z"/></svg>
                      </div>
                      <div>
                        <h3 class="text-sm font-semibold text-slate-800">{{ grupo.nombre }}</h3>
                        <p class="text-xs text-slate-500">
                          {{ grupo.total_alumnos }} alumno{{ grupo.total_alumnos === 1 ? '' : 's' }} registrado{{ grupo.total_alumnos === 1 ? '' : 's' }}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        (click)="toggleAlumnos(grupo)"
                        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                               text-slate-600 hover:text-brand hover:bg-brand/10
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
                          (editarAlumno)="onEditarAlumno($event)"
                          (eliminarAlumno)="confirmarEliminarAlumno($event)"
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

      <!-- ── Confirmación de eliminación de GRUPO ─────── -->
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

      <!-- ── Modal editar nombre de ALUMNO ─────────────── -->
      @if (alumnoAEditar()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialogo-editar-alumno"
        >
          <div class="bg-white rounded-xl border border-gray-100 shadow-xl p-6 max-w-sm w-full">
            <h3 id="dialogo-editar-alumno" class="text-base font-semibold text-slate-800 mb-1">
              Editar nombre
            </h3>
            <p class="text-sm text-slate-500 mb-4">Ingresa el nuevo nombre del alumno.</p>
            <input
              type="text"
              [(ngModel)]="nombreEditado"
              placeholder="Nombre completo"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                     text-slate-800 placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand
                     transition-colors mb-4"
              (keydown.enter)="guardarNombreAlumno()"
            />
            @if (errorAlumno()) {
              <p class="text-xs text-red-500 mb-3">{{ errorAlumno() }}</p>
            }
            <div class="flex justify-end gap-3">
              <button
                (click)="cerrarModalEditarAlumno()"
                class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                       hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <app-btn
                variante="primary"
                [loading]="guardandoAlumno()"
                (clicked)="guardarNombreAlumno()"
              >
                Guardar
              </app-btn>
            </div>
          </div>
        </div>
      }

      <!-- ── Confirmación de eliminación de ALUMNO ─────── -->
      @if (alumnoAEliminar()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialogo-eliminar-alumno"
        >
          <div class="bg-white rounded-xl border border-gray-100 shadow-xl p-6 max-w-sm w-full">
            <h3 id="dialogo-eliminar-alumno" class="text-base font-semibold text-slate-800 mb-1">
              Eliminar alumno
            </h3>
            <p class="text-sm text-slate-500 mb-5">
              ¿Estás seguro de eliminar a
              <strong class="text-slate-700">{{ alumnoAEliminar()!.nombre_completo }}</strong>?
              Esta acción no se puede deshacer.
            </p>
            @if (errorAlumno()) {
              <p class="text-xs text-red-500 mb-3">{{ errorAlumno() }}</p>
            }
            <div class="flex justify-end gap-3">
              <button
                (click)="alumnoAEliminar.set(null)"
                class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                       hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <app-btn
                variante="danger"
                [loading]="guardandoAlumno()"
                (clicked)="ejecutarEliminarAlumno()"
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

  private readonly modalCrear = viewChild.required<ModalCrearGrupoComponent>('modalCrear');

  tabActivo      = signal<'activos' | 'archivados' | 'pendientes'>('activos');
  grupoExpandido = signal<string | null>(null);
  grupoAEliminar = signal<GrupoConStats | null>(null);

  alumnoAEditar   = signal<Alumno | null>(null);
  alumnoAEliminar = signal<Alumno | null>(null);
  nombreEditado   = '';
  guardandoAlumno = signal(false);
  errorAlumno     = signal<string | null>(null);

  ngOnInit() {
    this.gruposService.cargarGrupos();
  }

  abrirModalCrear() {
    this.modalCrear().abrir();
  }

  async toggleAlumnos(grupo: GrupoConStats) {
    if (this.grupoExpandido() === grupo.id) {
      this.grupoExpandido.set(null);
      return;
    }
    this.grupoExpandido.set(grupo.id);
    await this.gruposService.cargarAlumnos(grupo.id);
  }

  confirmarEliminar(grupo: GrupoConStats) {
    this.grupoAEliminar.set(grupo);
  }

  async eliminarGrupo() {
    const grupo = this.grupoAEliminar();
    if (!grupo) return;

    const { error } = await this.gruposService.eliminarGrupo(grupo.id);

    if (!error) {
      if (this.grupoExpandido() === grupo.id) {
        this.grupoExpandido.set(null);
      }
      this.grupoAEliminar.set(null);
    }
  }

  // Grupos ya se recargan en el servicio; este callback existe para
  // poder agregar feedback adicional (toast, etc.) en el futuro.
  onGrupoCreado() {}

  onEditarAlumno(alumno: Alumno): void {
    this.alumnoAEditar.set(alumno);
    this.nombreEditado = alumno.nombre_completo;
    this.errorAlumno.set(null);
  }

  cerrarModalEditarAlumno(): void {
    this.alumnoAEditar.set(null);
    this.errorAlumno.set(null);
  }

  async guardarNombreAlumno(): Promise<void> {
    const alumno = this.alumnoAEditar();
    if (!alumno) return;
    const nombre = this.nombreEditado.trim();
    if (!nombre) {
      this.errorAlumno.set('El nombre no puede estar vacío.');
      return;
    }

    this.guardandoAlumno.set(true);
    this.errorAlumno.set(null);

    const { error } = await this.gruposService.editarAlumno(alumno.id, nombre);

    this.guardandoAlumno.set(false);

    if (error) {
      this.errorAlumno.set(error);
    } else {
      this.alumnoAEditar.set(null);
    }
  }

  confirmarEliminarAlumno(alumno: Alumno): void {
    this.alumnoAEliminar.set(alumno);
    this.errorAlumno.set(null);
  }

  async ejecutarEliminarAlumno(): Promise<void> {
    const alumno = this.alumnoAEliminar();
    if (!alumno) return;

    this.guardandoAlumno.set(true);
    this.errorAlumno.set(null);

    const { error } = await this.gruposService.eliminarAlumno(alumno.id);

    this.guardandoAlumno.set(false);

    if (error) {
      this.errorAlumno.set(error);
    } else {
      this.alumnoAEliminar.set(null);
    }
  }
}