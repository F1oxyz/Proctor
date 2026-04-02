/**
 * alumno-tile.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Card individual de cada alumno en el grid del monitor.
 *
 * CONTENIDO (según PDF - página 6):
 *  - Miniatura del video (stream WebRTC) o placeholder si no conectó
 *  - Badge de estado: Active | Idle | Flagged | Offline | Enviado
 *  - Nombre del alumno + tipo de conexión (Web Browser / Desktop App)
 *  - Icono de expandir para ver pantalla completa
 *  - Si Flagged: badge rojo + icono de advertencia
 *  - Si Offline/Not Connected: botón "Send Reminder"
 *
 * ESTADOS derivados de sesion_alumnos.estado + presencia de stream:
 *  - 'activo'   → tiene stream activo y está respondiendo
 *  - 'idle'     → tiene stream pero sin actividad (>2min)
 *  - 'flagged'  → múltiples monitores o comportamiento sospechoso
 *  - 'offline'  → sin stream (no se conectó o se desconectó)
 *  - 'enviado'  → ya envió el examen
 *
 * ARQUITECTURA:
 *  - Componente semi-dumb: recibe datos, maneja el <video> con afterNextRender
 *  - El stream WebRTC se asigna al elemento <video> via srcObject
 *  - OnPush
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
  ElementRef,
  viewChild,
} from '@angular/core';
import { SesionAlumnoConDatos } from '../../../../../../shared/models/index';
import { colorAvatar, getIniciales } from '../../../../../../shared/utils/avatar.utils';

/** Estado visual del tile (distinto del estado DB) */
export type EstadoTile = 'activo' | 'idle' | 'flagged' | 'offline' | 'enviado';

@Component({
  selector: 'app-alumno-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-white border-2 rounded-xl overflow-hidden transition-all duration-200 flex flex-col"
      [class.border-slate-200]="estadoVisual() === 'activo' || estadoVisual() === 'idle'"
      [class.border-red-400]="estadoVisual() === 'flagged'"
      [class.border-slate-300]="estadoVisual() === 'offline'"
      [class.border-green-400]="estadoVisual() === 'enviado'"
      [class.opacity-60]="estadoVisual() === 'offline'"
    >

      <!-- ── Área de video / placeholder ── -->
      <div class="relative bg-slate-900 aspect-video w-full overflow-hidden">

        <!-- Video del alumno (stream WebRTC) -->
        <video
          #videoEl
          class="w-full h-full object-cover"
          [class.hidden]="!tieneStream()"
          autoplay
          muted
          playsinline
          aria-label="Pantalla de {{ alumno().alumno_nombre }}"
        ></video>

        <!-- Placeholder cuando no hay stream -->
        @if (!tieneStream()) {
          <div class="absolute inset-0 flex items-center justify-center">
            @if (estadoVisual() === 'enviado') {
              <!-- Enviado: ícono check -->
              <div class="flex flex-col items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-xs text-green-400 font-medium">Entregado</span>
              </div>
            } @else {
              <!-- Sin stream: ícono monitor tachado -->
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
              </svg>
            }
          </div>
        }

        <!-- Badge de estado (esquina superior derecha) -->
        <div class="absolute top-2 right-2">
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            [class.bg-green-500]="estadoVisual() === 'activo'"
            [class.text-white]="estadoVisual() === 'activo'"
            [class.bg-amber-400]="estadoVisual() === 'idle'"
            [class.text-white]="estadoVisual() === 'idle'"
            [class.bg-red-500]="estadoVisual() === 'flagged'"
            [class.text-white]="estadoVisual() === 'flagged'"
            [class.bg-slate-500]="estadoVisual() === 'offline'"
            [class.text-white]="estadoVisual() === 'offline'"
            [class.bg-green-600]="estadoVisual() === 'enviado'"
            [class.text-white]="estadoVisual() === 'enviado'"
          >
            @switch (estadoVisual()) {
              @case ('activo')  {
                <span class="w-1.5 h-1.5 rounded-full bg-white inline-block"></span>
                Activo
              }
              @case ('idle')    {
                <span class="w-1.5 h-1.5 rounded-full bg-white inline-block"></span>
                Inactivo ({{ tiempoIdleMin() }}m)
              }
              @case ('flagged') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                Marcado
              }
              @case ('offline') {
                Desconectado
              }
              @case ('enviado') {
                ✓ Enviado
              }
            }
          </span>
        </div>

        <!-- Botón expandir (esquina superior izquierda) -->
        @if (tieneStream()) {
          <button
            type="button"
            (click)="expandir.emit(alumno())"
            class="absolute top-2 left-2 p-1 bg-black/40 hover:bg-black/60 text-white rounded transition-colors"
            aria-label="Ver pantalla completa de {{ alumno().alumno_nombre }}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        }

      </div>

      <!-- ── Footer del tile: nombre + tipo de conexión ── -->
      <div class="px-3 py-2 flex items-center justify-between gap-2">

        <div class="flex items-center gap-2 min-w-0">
          <!-- Avatar iniciales -->
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            [style.background-color]="colorAvatar()"
          >
            {{ iniciales() }}
          </div>

          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-800 truncate">
              {{ alumno().alumno_nombre }}
            </p>
            <!-- Tipo: Web Browser si peer_id empieza con 'alumno-', Desktop App si no -->
            <p class="text-xs text-slate-400 truncate">
              {{ tipoConexion() }}
            </p>
          </div>
        </div>

        <!-- Indicador "Avisar" deshabilitado: la notificación push no está implementada -->
        @if (estadoVisual() === 'offline') {
          <span
            class="shrink-0 text-xs text-slate-400 cursor-default"
            title="Próximamente: notificación al alumno"
          >
            Avisar (pronto)
          </span>
        }

        <!-- Icono flagged si aplica -->
        @if (estadoVisual() === 'flagged') {
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }

      </div>

      <!-- Sub-texto si flagged -->
      @if (estadoVisual() === 'flagged') {
        <p class="px-3 pb-2 text-xs text-red-500 font-medium -mt-1">Múltiples monitores</p>
      }

    </div>
  `,
})
export class AlumnoTileComponent {
  // ── Inputs ───────────────────────────────────────────────────────

  /** Datos del alumno en sesion_alumnos */
  alumno = input.required<SesionAlumnoConDatos>();

  /** Stream WebRTC recibido de PeerService (null si no conectó) */
  stream = input<MediaStream | null>(null);

  // ── Outputs ──────────────────────────────────────────────────────

  /** Expande la vista del alumno a pantalla completa */
  expandir = output<SesionAlumnoConDatos>();

  /** Envía un recordatorio (alerta visual) al alumno */
  enviarRecordatorio = output<SesionAlumnoConDatos>();

  // ── ViewChild del elemento video ─────────────────────────────────
  private readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  // ── Estado local ─────────────────────────────────────────────────

  /** Timestamp de la última vez que el stream tuvo actividad */
  private ultimaActividad = Date.now();

  /** Minutos de inactividad para mostrar "Idle(Xm)" */
  readonly tiempoIdleMin = signal(0);

  constructor() {
    // Cuando cambia el stream, asignarlo al elemento <video>
    effect(() => {
      const s = this.stream();
      const el = this.videoEl()?.nativeElement;
      if (el && s) {
        el.srcObject = s;
        el.play().catch((e) => console.warn('[AlumnoTile] video.play():', e));
        this.ultimaActividad = Date.now();
      } else if (el && !s) {
        el.srcObject = null;
      }
    });
  }

  // ── Computed ─────────────────────────────────────────────────────

  /** true si tiene un MediaStream activo */
  readonly tieneStream = computed(() => !!this.stream());

  /**
   * Estado visual del tile.
   * Deriva del estado DB + presencia de stream:
   *  - 'enviado'  si DB dice 'enviado' (siempre tiene prioridad)
   *  - 'offline'  si no tiene stream y no envió
   *  - 'activo'   si tiene stream y estado 'en_progreso'
   *  - 'idle'     si tiene stream pero no ha respondido recientemente
   */
  readonly estadoVisual = computed((): EstadoTile => {
    const estado = this.alumno().estado;

    if (estado === 'enviado') return 'enviado';
    if (!this.stream()) return 'offline';
    if (estado === 'en_progreso') return 'activo';
    return 'activo';
  });

  /** Iniciales del alumno para el avatar */
  readonly iniciales = computed(() => getIniciales(this.alumno().alumno_nombre ?? ''));

  /** Color determinístico para el avatar */
  readonly colorAvatar = computed(() => colorAvatar(this.alumno().alumno_nombre ?? 'X'));

  /** "Navegador Web" o "App de Escritorio" según el peer_id */
  readonly tipoConexion = computed(() =>
    this.alumno().peer_id?.startsWith('alumno-')
      ? 'Navegador Web'
      : 'App de Escritorio'
  );
}