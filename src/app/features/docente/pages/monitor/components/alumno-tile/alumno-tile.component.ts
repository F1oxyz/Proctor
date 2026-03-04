// =============================================================
// features/docente/pages/monitor/components/alumno-tile/
// alumno-tile.component.ts
//
// Tarjeta individual que representa a un alumno en el grid
// de monitoreo en vivo. Muestra:
//   - Miniatura de la pantalla (elemento <video> con el MediaStream)
//   - Badge de estado: Activo | Idle | Flagged | Offline
//   - Nombre del alumno + avatar con iniciales
//   - Plataforma (Desktop App / Web Browser)
//   - Botón para expandir la pantalla a pantalla completa
//
// Cuando el stream es null (alumno sin conexión WebRTC),
// muestra un placeholder gris con ícono de pantalla apagada.
//
// Recibe el stream via input() desde MonitorComponent.
// No llama a Supabase directamente.
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  ElementRef,
  viewChild,
  effect,
} from '@angular/core';
import { SesionAlumnoConDatos } from '../../../../../../shared/models';
import { BadgeComponent } from '../../../../../../shared/components/badge/badge.component';
import { InicialesPipe } from '../../../../../../shared/pipes/iniciales.pipe';

@Component({
  selector: 'app-alumno-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, InicialesPipe],
  template: `
    <div
      class="bg-white rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer
             hover:shadow-md hover:border-gray-200 select-none"
      [class.border-red-300]="alumno().estado === 'unido' && tieneFlag()"
      [class.border-gray-100]="!tieneFlag()"
      (click)="expandir.emit(alumno())"
      [attr.aria-label]="'Ver pantalla de ' + nombre()"
      role="button"
      tabindex="0"
      (keydown.enter)="expandir.emit(alumno())"
    >
      <!-- ── Área de video ─────────────────────────────── -->
      <div class="relative aspect-video bg-gray-100 overflow-hidden">

        <!-- Video del stream (visible si hay stream) -->
        @if (stream()) {
          <video
            #videoEl
            autoplay
            muted
            playsinline
            class="w-full h-full object-cover"
            [attr.aria-label]="'Pantalla de ' + nombre()"
          ></video>
        } @else {
          <!-- Placeholder cuando no hay stream -->
          <div class="w-full h-full flex items-center justify-center bg-gray-50">
            @if (alumno().estado === 'unido' || alumno().estado === 'en_progreso') {
              <!-- Alumno conectado pero sin stream WebRTC aún -->
              <div class="flex flex-col items-center gap-2 text-slate-300">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span class="text-xs">Conectando...</span>
              </div>
            } @else {
              <!-- Alumno no conectado -->
              <div class="flex flex-col items-center gap-2 text-slate-300">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                </svg>
                <span class="text-xs">Sin conexión</span>
              </div>
            }
          </div>
        }

        <!-- Badge de estado (esquina superior derecha del video) -->
        <div class="absolute top-2 right-2">
          <app-badge [estado]="estadoBadge()" />
        </div>

        <!-- Overlay de flag (borde rojo + ícono warning) -->
        @if (tieneFlag()) {
          <div class="absolute inset-0 border-2 border-red-400 rounded-none pointer-events-none">
            <div class="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
            </div>
          </div>
        }

        <!-- Botón expandir (hover) -->
        <button
          class="absolute bottom-2 right-2 p-1.5 bg-black/50 rounded-md text-white
                 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70
                 cursor-pointer"
          (click.stop)="expandir.emit(alumno())"
          [attr.aria-label]="'Expandir pantalla de ' + nombre()"
          title="Ver en pantalla completa"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
          </svg>
        </button>

      </div>

      <!-- ── Info del alumno ───────────────────────────── -->
      <div class="px-3 py-2.5 flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <!-- Avatar con iniciales -->
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center text-white
                   text-xs font-semibold shrink-0"
            [style.background-color]="colorAvatar()"
            aria-hidden="true"
          >
            {{ nombre() | iniciales }}
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-700 truncate">{{ nombre() }}</p>
            <p class="text-xs text-slate-400">{{ plataforma() }}</p>
          </div>
        </div>

        <!-- Botón expandir ícono -->
        <button
          class="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-gray-50
                 transition-colors cursor-pointer shrink-0"
          (click.stop)="expandir.emit(alumno())"
          [attr.aria-label]="'Expandir ' + nombre()"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
        </button>
      </div>

      <!-- Mensaje de flag -->
      @if (tieneFlag()) {
        <div class="px-3 pb-2.5">
          <span class="text-xs text-red-500 font-medium">Multiple Monitors</span>
        </div>
      }

    </div>
  `,
  host: { class: 'group block' },
})
export class AlumnoTileComponent {
  // ── Inputs ─────────────────────────────────────────────

  /** Datos del alumno y su estado en la sesión */
  alumno = input.required<SesionAlumnoConDatos>();

  /** MediaStream de la pantalla del alumno (null si no hay WebRTC aún) */
  stream = input<MediaStream | null>(null);

  // ── Outputs ────────────────────────────────────────────

  /** Emitido al hacer clic en la tile para expandir la pantalla */
  expandir = output<SesionAlumnoConDatos>();

  // ── Referencia al elemento <video> ────────────────────

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  // ── Effect para asignar stream al video ───────────────

  constructor() {
    // Cada vez que cambie el stream, asignarlo al elemento <video>
    effect(() => {
      const streamActual = this.stream();
      const videoElement = this.videoRef()?.nativeElement;
      if (videoElement && streamActual) {
        videoElement.srcObject = streamActual;
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────

  /** Nombre completo del alumno, con fallback */
  nombre(): string {
    return this.alumno().alumno?.nombre_completo ?? 'Alumno desconocido';
  }

  /**
   * Determina el estado del badge según el estado en sesion_alumnos
   * y si tiene flags (Multiple Monitors detectado).
   */
  estadoBadge(): 'activo' | 'idle' | 'flagged' | 'offline' | 'enviado' {
    if (this.tieneFlag()) return 'flagged';
    switch (this.alumno().estado) {
      case 'en_progreso':
        return this.stream() ? 'activo' : 'idle';
      case 'enviado':
        return 'enviado';
      case 'unido':
      default:
        return this.stream() ? 'activo' : 'offline';
    }
  }

  /** True si el alumno tiene flags de comportamiento sospechoso */
  tieneFlag(): boolean {
    // Por ahora usamos peer_id como indicador de "multiple monitors"
    // cuando el peer_id contiene el sufijo "-flag" (lógica futura)
    // En esta versión, el flag se marca manualmente desde el monitor
    return false; // Implementación futura
  }

  /** Plataforma detectada (Desktop App = Electron, Web Browser = navegador) */
  plataforma(): string {
    // Se detectará en una versión futura vía user agent del alumno
    return 'Web Browser';
  }

  /** Color del avatar basado en el nombre (consistente) */
  colorAvatar(): string {
    const colores = [
      '#3b82f6', '#8b5cf6', '#10b981',
      '#f59e0b', '#ef4444', '#06b6d4',
      '#ec4899', '#84cc16',
    ];
    const nombre = this.nombre();
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colores[Math.abs(hash) % colores.length];
  }
}