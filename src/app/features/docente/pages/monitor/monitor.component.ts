// =============================================================
// features/docente/pages/monitor/monitor.component.ts
//
// Sala de monitoreo en vivo del docente.
// Ruta: /docente/monitor/:sesionId
//
// El parámetro sesionId viene via withComponentInputBinding().
//
// Funcionalidades:
//   - Grid de AlumnoTileComponent (4 columnas en desktop)
//   - Navbar en modo 'monitor' con: código de acceso, contador
//     de alumnos activos, tiempo restante, botón "End Session"
//   - Barra de estado inferior: conteo por categoría
//   - Botón "Broadcast" para enviar mensaje a todos (placeholder)
//   - Modal de pantalla expandida al hacer clic en una tile
//   - Indicador "Last synced" con tiempo desde última actualización
//
// Flujo de inicio:
//   1. OnInit → SesionesService.cargarSesion(sesionId)
//     - Carga metadata de la sesión
//     - Carga alumnos conectados
//     - Suscribe Realtime de Supabase
//   2. PeerService.inicializarComoReceptor(sesionId)
//     - Crea Peer con ID predecible
//   3. PeerService.escucharLlamadas()
//     - Acepta streams entrantes de alumnos
//   4. Computed: mapear alumnosConectados ↔ streams de PeerService
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SesionesService } from '../../services/sesiones.service';
import { PeerService } from '../../../../core/services/peer.service';
import { AlumnoTileComponent } from './components/alumno-tile/alumno-tile.component';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { BtnComponent } from '../../../../shared/components/btn/btn.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { TiempoFormatoPipe } from '../../../../shared/pipes/tiempo-formato.pipe';
import { SesionAlumnoConDatos } from '../../../../shared/models';

@Component({
  selector: 'app-monitor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SesionesService],
  imports: [
    FormsModule,
    NavbarComponent,
    BtnComponent,
    LoadingSpinnerComponent,
    AlumnoTileComponent,
    TiempoFormatoPipe,
  ],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">

      <!-- ── Navbar Monitor ─────────────────────────────── -->
      <header class="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <!-- Izquierda: Logo + sesión -->
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
            </svg>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-800">Proctor View</p>
            <p class="text-xs text-slate-400">
              Session #{{ sesionId()?.substring(0, 4)?.toUpperCase() }}
            </p>
          </div>
        </div>

        <!-- Centro: indicador Live Monitoring -->
        <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
          <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true"></span>
          <span class="text-xs font-semibold text-emerald-700">Live Monitoring</span>
        </div>

        <!-- Derecha: Acciones -->
        <div class="flex items-center gap-3">
          <button
            class="p-2 rounded-lg text-slate-500 hover:bg-gray-50 transition-colors cursor-pointer"
            aria-label="Configuración"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>

          <app-btn
            variante="danger"
            tamano="sm"
            [loading]="sesionesService.cargando()"
            (clicked)="confirmarTerminar()"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            End Session
          </app-btn>
        </div>
      </header>

      <!-- ── Subheader: info del examen ─────────────────── -->
      <div class="bg-white border-b border-gray-50 px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <!-- Código de examen -->
          @if (sesionesService.sesionActiva()) {
            <div>
              <span class="text-xs text-slate-400">Código de acceso</span>
              <p class="text-lg font-bold text-slate-800 tracking-widest font-mono">
                {{ sesionesService.sesionActiva()!.codigo_acceso }}
              </p>
            </div>
          }

          <div class="w-px h-8 bg-gray-100" aria-hidden="true"></div>

          <!-- Alumnos conectados -->
          <div class="flex items-center gap-1.5 text-sm text-slate-600">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            <span class="font-semibold">{{ alumnosActivos() }}/{{ sesionesService.alumnosConectados().length }}</span>
            <span class="text-slate-400">Students</span>
          </div>
        </div>

        <!-- Búsqueda + Broadcast -->
        <div class="flex items-center gap-3">
          <div class="relative">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <input
              type="search"
              [(ngModel)]="busqueda"
              placeholder="Search student..."
              class="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-48
                     focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                     transition-colors text-slate-700 placeholder-slate-400"
            />
          </div>

          <app-btn variante="secondary" tamano="sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
            </svg>
            Broadcast
          </app-btn>
        </div>
      </div>

      <!-- ── Contenido principal ──────────────────────── -->
      <main class="flex-1 p-6">

        @if (sesionesService.cargando() && sesionesService.alumnosConectados().length === 0) {
          <app-loading-spinner tamano="md" mensaje="Iniciando sala de monitoreo..." />
        } @else if (sesionesService.error()) {
          <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {{ sesionesService.error() }}
          </div>
        } @else if (alumnosFiltrados().length === 0 && sesionesService.alumnosConectados().length === 0) {
          <!-- Estado vacío: esperando que se conecten alumnos -->
          <div class="flex flex-col items-center justify-center h-64 gap-4">
            <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <svg class="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-semibold text-slate-600">Esperando estudiantes...</p>
              <p class="text-xs text-slate-400 mt-1">
                Comparte el código
                <strong class="font-mono text-slate-600">
                  {{ sesionesService.sesionActiva()?.codigo_acceso ?? '——' }}
                </strong>
                con tus alumnos
              </p>
            </div>
          </div>
        } @else {
          <!-- Grid de tiles de alumnos -->
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            @for (alumno of alumnosFiltrados(); track alumno.id) {
              <app-alumno-tile
                [alumno]="alumno"
                [stream]="streamDeAlumno(alumno.peer_id)"
                (expandir)="abrirExpandido($event)"
              />
            }
          </div>
        }

      </main>

      <!-- ── Barra de estado inferior ─────────────────── -->
      <footer class="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-5 text-xs">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
            <span class="text-slate-600">Active ({{ alumnosActivos() }})</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true"></span>
            <span class="text-slate-600">Idle ({{ alumnosIdle() }})</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-red-500" aria-hidden="true"></span>
            <span class="text-slate-600">Flagged (0)</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-gray-300" aria-hidden="true"></span>
            <span class="text-slate-600">Offline ({{ alumnosOffline() }})</span>
          </span>
        </div>

        <!-- Último sync -->
        <span class="text-xs text-slate-400 flex items-center gap-1.5">
          Last synced: Just now
          <button
            class="text-blue-500 hover:text-blue-700 cursor-pointer"
            (click)="sincronizar()"
            aria-label="Sincronizar ahora"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </span>
      </footer>

      <!-- ── Modal pantalla expandida ───────────────────── -->
      @if (alumnoExpandido()) {
        <div
          class="fixed inset-0 z-50 bg-black/90 flex flex-col"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'Pantalla de ' + alumnoExpandido()!.alumno?.nombre_completo"
        >
          <!-- Header del modal -->
          <div class="flex items-center justify-between px-6 py-4">
            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold text-white">
                {{ alumnoExpandido()!.alumno?.nombre_completo }}
              </span>
              <span class="text-xs text-gray-400">{{ alumnoExpandido()!.estado }}</span>
            </div>
            <button
              (click)="alumnoExpandido.set(null)"
              class="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10
                     transition-colors cursor-pointer"
              aria-label="Cerrar vista expandida"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Video expandido -->
          <div class="flex-1 flex items-center justify-center p-6">
            @if (streamDeAlumno(alumnoExpandido()!.peer_id)) {
              <video
                #videoExpandido
                autoplay
                muted
                playsinline
                class="max-w-full max-h-full rounded-lg"
              ></video>
            } @else {
              <div class="text-gray-500 text-center">
                <svg class="w-16 h-16 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p class="text-sm">Sin stream disponible</p>
              </div>
            }
          </div>
        </div>
      }

      <!-- ── Confirmación terminar sesión ─────────────── -->
      @if (mostrarConfirmTerminar()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog" aria-modal="true"
        >
          <div class="bg-white rounded-xl border border-gray-100 shadow-xl p-6 max-w-sm w-full">
            <h3 class="text-base font-semibold text-slate-800 mb-1">¿Terminar sesión?</h3>
            <p class="text-sm text-slate-500 mb-5">
              Esta acción desconectará a todos los alumnos y finalizará el examen.
              No se puede deshacer.
            </p>
            <div class="flex justify-end gap-3">
              <button
                (click)="mostrarConfirmTerminar.set(false)"
                class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50
                       rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <app-btn
                variante="danger"
                [loading]="sesionesService.cargando()"
                (clicked)="terminarSesion()"
              >
                Terminar sesión
              </app-btn>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class MonitorComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly sesionesService = inject(SesionesService);
  private readonly peerService = inject(PeerService);

  // ── Input de ruta ──────────────────────────────────────

  /** UUID de la sesión a monitorear (viene de /docente/monitor/:sesionId) */
  sesionId = input<string>();

  // ── Estado interno ─────────────────────────────────────

  /** Texto de búsqueda para filtrar alumnos */
  busqueda = '';

  /** Alumno cuya pantalla está expandida en modal */
  alumnoExpandido = signal<SesionAlumnoConDatos | null>(null);

  /** Controla la visibilidad del diálogo de confirmar terminar */
  mostrarConfirmTerminar = signal(false);

  // ── Computed ───────────────────────────────────────────

  /** Alumnos filtrados por búsqueda */
  alumnosFiltrados = computed(() => {
    const q = this.busqueda.toLowerCase().trim();
    if (!q) return this.sesionesService.alumnosConectados();
    return this.sesionesService.alumnosConectados().filter((a) =>
      a.alumno?.nombre_completo?.toLowerCase().includes(q)
    );
  });

  /** Alumnos con stream activo */
  alumnosActivos = computed(
    () =>
      this.sesionesService
        .alumnosConectados()
        .filter((a) => a.estado === 'en_progreso' && a.peer_id).length
  );

  /** Alumnos conectados pero sin actividad reciente */
  alumnosIdle = computed(
    () =>
      this.sesionesService
        .alumnosConectados()
        .filter((a) => a.estado === 'unido' && a.peer_id).length
  );

  /** Alumnos sin conectar */
  alumnosOffline = computed(
    () =>
      this.sesionesService
        .alumnosConectados()
        .filter((a) => !a.peer_id).length
  );

  // ── Lifecycle ──────────────────────────────────────────

  async ngOnInit() {
    const id = this.sesionId();
    if (!id) {
      this.router.navigate(['/docente/grupos']);
      return;
    }

    // Cargar sesión y suscribir Realtime
    await this.sesionesService.cargarSesion(id);

    // Inicializar PeerJS como receptor de pantallas
    try {
      await this.peerService.inicializarComoReceptor(id);
      this.peerService.escucharLlamadas();
    } catch (err) {
      console.error('[MonitorComponent] Error inicializando PeerJS:', err);
      // No es fatal — el monitor sigue funcionando sin WebRTC
    }
  }

  ngOnDestroy() {
    this.sesionesService.desuscribirRealtime();
    // No destruir PeerService aquí porque es singleton (providedIn: 'root')
    // Se destruye explícitamente al terminar la sesión
  }

  // ── Métodos ────────────────────────────────────────────

  /**
   * Obtiene el MediaStream de un alumno por su peer_id.
   * Devuelve null si no hay stream disponible.
   */
  streamDeAlumno(peerId: string | null | undefined): MediaStream | null {
    if (!peerId) return null;
    return this.peerService.streams().get(peerId) ?? null;
  }

  /** Abre el modal de pantalla expandida */
  abrirExpandido(alumno: SesionAlumnoConDatos) {
    this.alumnoExpandido.set(alumno);
  }

  /** Muestra el diálogo de confirmación para terminar la sesión */
  confirmarTerminar() {
    this.mostrarConfirmTerminar.set(true);
  }

  /** Termina la sesión y navega a resultados */
  async terminarSesion() {
    const id = this.sesionId();
    if (!id) return;

    const { error } = await this.sesionesService.terminarSesion(id);
    if (!error) {
      this.peerService.destruir();
      this.router.navigate(['/docente/resultados', id]);
    }
    this.mostrarConfirmTerminar.set(false);
  }

  /** Recarga manualmente el estado de alumnos */
  async sincronizar() {
    const id = this.sesionId();
    if (id) await this.sesionesService.cargarSesion(id);
  }
}