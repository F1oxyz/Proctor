// =============================================================
// shared/components/navbar/navbar.component.ts
// Barra de navegación principal con 3 modos de visualización:
//
//  'default'  → Navbar del docente autenticado.
//               Muestra logo, links de navegación y avatar.
//
//  'monitor'  → Navbar de la sala de monitoreo en vivo.
//               Muestra nombre del grupo/examen, estado de sesión,
//               tiempo restante y botón "Terminar Sesión".
//               Emite (terminarSesion) al hacer clic en el botón.
//
//  'student'  → Navbar minimalista del alumno durante el examen.
//               Solo muestra el nombre del alumno y el temporizador.
//               Sin links de navegación para evitar distracciones.
//
// Uso:
//   <app-navbar modo="default" />
//   <app-navbar modo="monitor"
//     [grupoNombre]="'Dibujo Industrial A'"
//     [examenNombre]="'Examen Final'"
//     [estadoSesion]="'activa'"
//     (terminarSesion)="onTerminar()" />
//   <app-navbar modo="student" [alumnoNombre]="'Juan Pérez'" />
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EstadoSesion } from '../../models/sesion.model';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav
      class="w-full bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between"
      [attr.aria-label]="'Barra de navegación'"
    >
      <!-- ── LOGO (siempre visible) ─────────────────────── -->
      <div class="flex items-center gap-2 shrink-0">
        <div class="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span class="text-slate-800 font-semibold text-sm tracking-tight">Proctor</span>
      </div>

      <!-- ══════════════════════════════════════════════════
           MODO DEFAULT — Docente autenticado
      ══════════════════════════════════════════════════ -->
      @if (modo() === 'default') {
        <!-- Links de navegación -->
        <div class="flex items-center gap-1" role="navigation" aria-label="Navegación del docente">
          <a
            routerLink="/docente/grupos"
            routerLinkActive="text-blue-600 bg-blue-50"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                   text-slate-600 hover:text-slate-800 hover:bg-gray-50 transition-colors"
            ariaCurrentWhenActive="page"
          >
            <!-- Ícono grupo -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            Mis Grupos
          </a>

          <a
            routerLink="/docente/examenes"
            routerLinkActive="text-blue-600 bg-blue-50"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                   text-slate-600 hover:text-slate-800 hover:bg-gray-50 transition-colors"
            ariaCurrentWhenActive="page"
          >
            <!-- Ícono exámenes -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            Mis Exámenes
          </a>
        </div>

        <!-- Avatar + cerrar sesión -->
        <button
          (click)="cerrarSesion()"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-600
                 hover:text-slate-800 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <!-- Avatar con iniciales -->
          <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
            {{ inicialesUsuario() }}
          </div>
          <!-- Ícono logout -->
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
          </svg>
        </button>
      }

      <!-- ══════════════════════════════════════════════════
           MODO MONITOR — Sala de monitoreo en vivo
      ══════════════════════════════════════════════════ -->
      @if (modo() === 'monitor') {
        <!-- Info del examen activo -->
        <div class="flex items-center gap-3 text-sm">
          <!-- Indicador de sesión en vivo -->
          <span class="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
            En vivo
          </span>

          <!-- Nombre del examen y grupo -->
          @if (examenNombre()) {
            <span class="text-slate-700 font-medium">{{ examenNombre() }}</span>
          }
          @if (grupoNombre()) {
            <span class="text-slate-400 text-xs">{{ grupoNombre() }}</span>
          }
        </div>

        <!-- Botón terminar sesión -->
        <button
          (click)="terminarSesion.emit()"
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium
                 bg-red-50 text-red-600 border border-red-200
                 hover:bg-red-100 transition-colors cursor-pointer"
          aria-label="Terminar sesión de examen"
        >
          <!-- Ícono stop -->
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
          Terminar Sesión
        </button>
      }

      <!-- ══════════════════════════════════════════════════
           MODO STUDENT — Alumno durante el examen
      ══════════════════════════════════════════════════ -->
      @if (modo() === 'student') {
        <!-- Nombre del alumno -->
        <div class="flex items-center gap-2 text-sm">
          <div class="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
            {{ inicialesAlumno() }}
          </div>
          @if (alumnoNombre()) {
            <span class="text-slate-700 font-medium text-sm">{{ alumnoNombre() }}</span>
          }
        </div>

        <!-- Espacio vacío a la derecha (limpieza visual durante el examen) -->
        <div aria-hidden="true"></div>
      }

    </nav>
  `,
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ── Inputs ─────────────────────────────────────────────

  /** Modo de visualización del navbar. Default: 'default' */
  modo = input<'default' | 'monitor' | 'student'>('default');

  /** [Modo monitor] Nombre del grupo en curso */
  grupoNombre = input<string>('');

  /** [Modo monitor] Nombre del examen en curso */
  examenNombre = input<string>('');

  /** [Modo monitor] Estado actual de la sesión */
  estadoSesion = input<EstadoSesion>('activa');

  /** [Modo student] Nombre completo del alumno */
  alumnoNombre = input<string>('');

  // ── Outputs ────────────────────────────────────────────

  /**
   * [Modo monitor] Emitido cuando el maestro hace clic en "Terminar Sesión".
   * El componente padre (MonitorComponent) es responsable de hacer la llamada
   * a sesiones.service para cerrar la sesión en Supabase.
   */
  terminarSesion = output<void>();

  // ── Computed ───────────────────────────────────────────

  /**
   * Iniciales del docente autenticado para el avatar.
   * Usa el nombre guardado en Supabase Auth metadata.
   */
  inicialesUsuario = computed(() => {
    const nombre = this.auth.currentUser()?.user_metadata?.['full_name'] ?? '';
    if (!nombre) return '?';
    const palabras = nombre.trim().split(/\s+/);
    return palabras.length >= 2
      ? (palabras[0][0] + palabras[1][0]).toUpperCase()
      : palabras[0][0].toUpperCase();
  });

  /**
   * Iniciales del alumno para el avatar en modo student.
   */
  inicialesAlumno = computed(() => {
    const nombre = this.alumnoNombre();
    if (!nombre) return '?';
    const palabras = nombre.trim().split(/\s+/);
    return palabras.length >= 2
      ? (palabras[0][0] + palabras[1][0]).toUpperCase()
      : palabras[0][0].toUpperCase();
  });

  // ── Métodos ────────────────────────────────────────────

  /** Llama al AuthService para cerrar sesión y redirigir al login */
  cerrarSesion() {
    this.auth.cerrarSesion();
  }
}