/**
 * monitor.component.ts
 * ─────────────────────────────────────────────────────────────────
 * CAMBIOS:
 *  - Bug 7: timer NO arranca automáticamente. El profesor hace clic en
 *           "Iniciar Examen" en el navbar para arrancar el examen y el timer.
 *  - Bug 10: totalAlumnos pasa el conteo real del grupo (sesionActiva.total_alumnos)
 *  - Bug 11: soporte para cambio de columnas desde el navbar
 *  - Bug 3: iniciarTemporizador() llama _finalizarSesionPorTiempo() cuando llega a 0
 *  - Bug 6: _configurarTemporizador() calcula tiempo restante desde iniciada_en
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SesionesService }       from '../../services/sesiones.service';
import { PeerService }           from '../../../../core/services/peer.service';
import { MonitorNavbarComponent } from './components/monitor-navbar/monitor-navbar.component';
import { AlumnoTileComponent }   from './components/alumno-tile/alumno-tile.component';
import { SesionAlumnoConDatos }  from '../../../../shared/models/index';

@Component({
  selector: 'app-monitor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MonitorNavbarComponent,
    AlumnoTileComponent,
  ],
  providers: [SesionesService],
  template: `
    <div class="min-h-screen bg-slate-100 flex flex-col">

      <!-- ── Navbar del monitor ── -->
      <app-monitor-navbar
        [tituloExamen]="sesiones.sesionActiva()?.examen_titulo ?? ''"
        [codigoExamen]="sesiones.sesionActiva()?.grupo_nombre ?? ''"
        [codigoAcceso]="sesiones.sesionActiva()?.codigo_acceso ?? ''"
        [alumnosConectados]="alumnosConectados()"
        [totalAlumnos]="sesiones.sesionActiva()?.total_alumnos ?? 0"
        [segundosRestantes]="segundosRestantes()"
        [examenIniciado]="examenIniciado()"
        (finalizarSesion)="confirmarFinalizacion()"
        (iniciarExamen)="onIniciarExamen()"
        (cambioColumnas)="columnas.set($event)"
      />

      <!-- ── Contenido principal ── -->
      <main class="flex-1 px-4 py-6 max-w-screen-2xl mx-auto w-full">

        <!-- ── Banner: esperando inicio ── -->
        @if (!examenIniciado()) {
          <div class="mb-6 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-amber-500 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-semibold text-amber-800">Examen en espera</p>
              <p class="text-xs text-amber-600">
                Los alumnos pueden unirse con el código
                <span class="font-mono font-bold bg-amber-100 px-1 rounded">{{ sesiones.sesionActiva()?.codigo_acceso }}</span>.
                Cuando estés listo, haz clic en <strong>"Iniciar Examen"</strong>.
              </p>
            </div>
          </div>
        }

        <!-- ── Loading inicial ── -->
        @if (sesiones.cargando() && sesiones.alumnosEnSesion().length === 0) {
          <div class="flex flex-col items-center justify-center py-24 gap-3">
            <svg class="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <p class="text-sm text-slate-500">Conectando al monitor...</p>
          </div>
        }

        <!-- ── Estado de PeerJS ── -->
        @if (peer.inicializando()) {
          <div class="mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <svg class="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Inicializando transmisión WebRTC...
          </div>
        }

        @if (peer.error()) {
          <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {{ peer.error() }} — Los alumnos podrán conectarse pero no se verán sus pantallas.
          </div>
        }

        <!-- ── Grid de tiles ── -->
        @if (sesiones.alumnosEnSesion().length > 0) {
          <div
            class="grid gap-4"
            [class.grid-cols-2]="columnas() === 2"
            [class.sm:grid-cols-3]="columnas() === 3"
            [class.lg:grid-cols-3]="columnas() === 3"
            [class.sm:grid-cols-3]="columnas() === 4"
            [class.lg:grid-cols-4]="columnas() === 4"
            [class.xl:grid-cols-4]="columnas() === 4"
          >
            @for (alumno of sesiones.alumnosEnSesion(); track alumno.alumno_id) {
              <app-alumno-tile
                [alumno]="alumno"
                [stream]="streamDeAlumno(alumno.alumno_id)"
                (expandir)="abrirPantallaCompleta($event)"
                (enviarRecordatorio)="enviarRecordatorio($event)"
              />
            }
          </div>
        }

        <!-- Estado vacío: ningún alumno se ha unido aún -->
        @else if (!sesiones.cargando()) {
          <div class="flex flex-col items-center justify-center py-24 gap-4">
            <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#0065e0"><path d="M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z"/></svg>
            </div>
            <p class="text-sm font-medium text-slate-600">Esperando que los alumnos se conecten...</p>
            <p class="text-xs text-slate-400">
              Código de acceso:
              <span class="font-mono font-bold text-slate-700 text-sm bg-slate-100 px-2 py-0.5 rounded ml-1">
                {{ sesiones.sesionActiva()?.codigo_acceso }}
              </span>
            </p>
          </div>
        }

      </main>

      <!-- ── Footer: leyenda + última sincronización ── -->
      <footer class="px-4 py-3 bg-white border-t border-slate-200">
        <div class="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-4 flex-wrap text-xs text-slate-500">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              Activo ({{ conteoEstado('activo') }})
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
              Inactivo ({{ conteoEstado('idle') }})
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              Marcado ({{ conteoEstado('flagged') }})
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
              Desconectado ({{ conteoEstado('offline') }})
            </span>
          </div>
          <span class="text-xs text-slate-400 flex items-center gap-1">
            Última sync: ahora
            <button
              type="button"
              (click)="sincronizarManual()"
              class="ml-1 text-blue-500 hover:text-blue-600 transition-colors"
              aria-label="Sincronizar ahora"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </span>
        </div>
      </footer>

    </div>

    <!-- ── Modal confirmación End Session ── -->
    @if (mostrarConfirmacion()) {
      <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <h3 id="modal-titulo" class="text-base font-bold text-slate-800 mb-2">
            ¿Finalizar la sesión?
          </h3>
          <p class="text-sm text-slate-600 mb-1">
            {{ alumnosActivos() }} alumno(s) aún están respondiendo.
          </p>
          <p class="text-sm text-amber-600 mb-5">
            Una vez finalizada, los alumnos no podrán seguir respondiendo y serán redirigidos a sus resultados.
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              (click)="mostrarConfirmacion.set(false)"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="finalizarSesion()"
              [disabled]="finalizando()"
              class="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-2"
            >
              @if (finalizando()) {
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              }
              Sí, finalizar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Modal pantalla completa de alumno ── -->
    @if (alumnoExpandido()) {
      <div
        class="fixed inset-0 bg-black/90 flex flex-col z-50"
        role="dialog"
        aria-modal="true"
        (click)="cerrarPantallaCompleta()"
      >
        <div
          class="flex items-center justify-between px-6 py-4 bg-black/50"
          (click)="$event.stopPropagation()"
        >
          <div>
            <p class="text-white font-semibold">{{ alumnoExpandido()!.alumno_nombre }}</p>
            <p class="text-slate-400 text-xs">Vista expandida</p>
          </div>
          <button
            type="button"
            (click)="cerrarPantallaCompleta()"
            class="p-2 text-white hover:text-slate-300 transition-colors"
            aria-label="Cerrar vista expandida"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 flex items-center justify-center p-4">
          @if (streamDeAlumno(alumnoExpandido()!.alumno_id)) {
            <video #videoExpandido class="max-w-full max-h-full rounded-lg" autoplay muted playsinline></video>
          } @else {
            <p class="text-slate-400 text-sm">Sin stream disponible</p>
          }
        </div>
      </div>
    }
  `,
})
export class MonitorComponent implements OnInit, OnDestroy {
  // ── Dependencias ────────────────────────────────────────────────
  readonly sesiones = inject(SesionesService);
  readonly peer     = inject(PeerService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ── Estado ───────────────────────────────────────────────────────

  readonly segundosRestantes = signal(0);
  private intervaloTimer: ReturnType<typeof setInterval> | null = null;

  /** Bug 7: el examen no ha iniciado hasta que el profesor lo active */
  readonly examenIniciado = signal(false);

  readonly mostrarConfirmacion = signal(false);
  readonly finalizando = signal(false);
  readonly alumnoExpandido = signal<SesionAlumnoConDatos | null>(null);

  /** Bug 11: número de columnas del grid (configurable desde el navbar) */
  readonly columnas = signal<2 | 3 | 4>(4);

  /** Referencia al video de pantalla completa */
  private readonly videoExpandidoEl = viewChild<ElementRef<HTMLVideoElement>>('videoExpandido');

  constructor() {
    // Asignar el stream al elemento <video> cuando se abre pantalla completa
    effect(() => {
      const alumno = this.alumnoExpandido();
      const el = this.videoExpandidoEl()?.nativeElement;
      if (el && alumno) {
        const stream = this.streamDeAlumno(alumno.alumno_id);
        el.srcObject = stream;
        if (stream) el.play().catch(() => {});
      }
    });
  }

  // ── Computed ─────────────────────────────────────────────────────

  readonly alumnosConectados = computed(
    () => this.peer.streamsPorAlumno().size
  );

  readonly alumnosActivos = computed(
    () => this.sesiones.alumnosEnSesion()
      .filter((a) => a.estado === 'en_progreso').length
  );

  conteoEstado(estado: 'activo' | 'idle' | 'flagged' | 'offline'): number {
    return this.sesiones.alumnosEnSesion().filter((a) => {
      const tieneStream = this.peer.streamsPorAlumno().has(a.alumno_id);
      switch (estado) {
        case 'activo':  return tieneStream && a.estado === 'en_progreso';
        case 'offline': return !tieneStream && a.estado !== 'enviado';
        case 'idle':    return false;
        case 'flagged': return false;
        default:        return false;
      }
    }).length;
  }

  // ── Ciclo de vida ─────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const sesionId = this.route.snapshot.paramMap.get('sesionId');
    if (!sesionId) {
      this.router.navigate(['/docente/examenes']);
      return;
    }

    const ok = await this.sesiones.cargarSesion(sesionId);
    if (!ok) {
      this.router.navigate(['/docente/examenes']);
      return;
    }

    await this.peer.inicializarComoReceptor(sesionId);
    await this.sesiones.iniciarMonitoreo(sesionId);

    // Bug 7 + Bug 6: Si la sesión ya estaba 'activa' (profesor recarga la página),
    // restaurar el estado de iniciado calculando el tiempo restante real.
    if (this.sesiones.sesionActiva()?.estado === 'activa') {
      this.examenIniciado.set(true);
      this._configurarTemporizador();  // Bug 6: usa iniciada_en para calcular restante
      this.iniciarTemporizador();
    }
  }

  ngOnDestroy(): void {
    this._detenerTemporizador();
    this.peer.destruir();
    this.sesiones.destruir();
  }

  // ── Temporizador ──────────────────────────────────────────────

  /**
   * Bug 6: Calcula los segundos restantes a partir de iniciada_en.
   * Si no hay iniciada_en, usa la duración completa.
   */
  private _configurarTemporizador(): void {
    const sesion = this.sesiones.sesionActiva();
    if (!sesion) return;
    const duracionSeg = sesion.duracion_min * 60;
    if (sesion.iniciada_en) {
      const ahora = Date.now();
      const iniciadaMs = new Date(sesion.iniciada_en).getTime();
      const transcurridos = Math.floor((ahora - iniciadaMs) / 1000);
      this.segundosRestantes.set(Math.max(0, duracionSeg - transcurridos));
    } else {
      this.segundosRestantes.set(duracionSeg);
    }
  }

  /**
   * Bug 3: cuando el contador llega a 0, finaliza la sesión automáticamente.
   */
  private iniciarTemporizador(): void {
    this._detenerTemporizador();
    this.intervaloTimer = setInterval(() => {
      this.segundosRestantes.update((s) => {
        if (s <= 1) {
          this._detenerTemporizador();
          void this._finalizarSesionPorTiempo();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  private _detenerTemporizador(): void {
    if (this.intervaloTimer) {
      clearInterval(this.intervaloTimer);
      this.intervaloTimer = null;
    }
  }

  /**
   * Bug 3: Auto-finaliza la sesión cuando el tiempo se agota.
   */
  private async _finalizarSesionPorTiempo(): Promise<void> {
    if (this.finalizando()) return;
    const sesionId = this.sesiones.sesionActiva()?.id;
    if (!sesionId) return;
    this.finalizando.set(true);
    const ok = await this.sesiones.finalizarSesion(sesionId);
    this.finalizando.set(false);
    this.mostrarConfirmacion.set(false);
    if (ok) this.router.navigate(['/docente/resultados', sesionId]);
  }

  // ── Handlers ─────────────────────────────────────────────────────

  /** Bug 7: el profesor inicia el examen manualmente */
  async onIniciarExamen(): Promise<void> {
    const sesionId = this.sesiones.sesionActiva()?.id;
    if (!sesionId || this.examenIniciado()) return;

    const ok = await this.sesiones.iniciarExamenActivo(sesionId);
    if (ok) {
      this.examenIniciado.set(true);
      // Bug 6: iniciada_en ya fue seteado en el signal por iniciarExamenActivo()
      this._configurarTemporizador();
      this.iniciarTemporizador();
    }
  }

  streamDeAlumno(alumnoId: string): MediaStream | null {
    return this.peer.streamsPorAlumno().get(alumnoId)?.stream ?? null;
  }

  confirmarFinalizacion(): void {
    this.mostrarConfirmacion.set(true);
  }

  async finalizarSesion(): Promise<void> {
    const sesionId = this.sesiones.sesionActiva()?.id;
    if (!sesionId || this.finalizando()) return;

    this.finalizando.set(true);

    const ok = await this.sesiones.finalizarSesion(sesionId);

    this.finalizando.set(false);
    this.mostrarConfirmacion.set(false);

    if (ok) {
      this._detenerTemporizador();
      this.router.navigate(['/docente/resultados', sesionId]);
    }
  }

  abrirPantallaCompleta(alumno: SesionAlumnoConDatos): void {
    this.alumnoExpandido.set(alumno);
  }

  cerrarPantallaCompleta(): void {
    this.alumnoExpandido.set(null);
  }

  sincronizarManual(): void {
    const sesionId = this.sesiones.sesionActiva()?.id;
    if (sesionId) this.sesiones.iniciarMonitoreo(sesionId);
  }

  enviarRecordatorio(alumno: SesionAlumnoConDatos): void {
    console.log('[Monitor] Enviar recordatorio a:', alumno.alumno_nombre);
  }
}
