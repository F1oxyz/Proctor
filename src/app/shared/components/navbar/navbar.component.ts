/**
 * Navbar con 3 modos:
 *  'default'  → docente autenticado (links + avatar)
 *  'monitor'  → sala en vivo (nombre examen/grupo + "Terminar Sesión")
 *  'student'  → alumno durante el examen (minimalista, sin links)
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { getIniciales } from '../../utils/avatar.utils';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav
      class="w-full bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between"
      [attr.aria-label]="'Barra de navegación'"
    >
      <div class="flex items-center gap-2 shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-md flex items-center justify-center">
            <svg  xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--color-brand)"><path d="M240-40H120q-33 0-56.5-23.5T40-120v-120h80v120h120v80Zm480 0v-80h120v-120h80v120q0 33-23.5 56.5T840-40H720ZM480-220q-120 0-217.5-71T120-480q45-118 142.5-189T480-740q120 0 217.5 71T840-480q-45 118-142.5 189T480-220Zm0-80q88 0 161-48t112-132q-39-84-112-132t-161-48q-88 0-161 48T207-480q39 84 112 132t161 48Zm0-40q58 0 99-41t41-99q0-58-41-99t-99-41q-58 0-99 41t-41 99q0 58 41 99t99 41Zm0-80q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420ZM40-720v-120q0-33 23.5-56.5T120-920h120v80H120v120H40Zm800 0v-120H720v-80h120q33 0 56.5 23.5T920-840v120h-80ZM480-480Z"/></svg>
          </div>
          <span class="text-slate-800 font-semibold text-lg tracking-tight">Proctor</span>
        </div>
      </div>

      @if (modo() === 'default') {
        <div class="flex items-center gap-1" role="navigation" aria-label="Navegación del docente">
          <a
            routerLink="/docente/grupos"
            routerLinkActive="text-brand bg-brand/10"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                   text-slate-600 hover:text-slate-800 hover:bg-gray-50 transition-colors"
            ariaCurrentWhenActive="page"
          >
            Mis Grupos
          </a>

          <a
            routerLink="/docente/examenes"
            routerLinkActive="text-brand bg-brand/10"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                   text-slate-600 hover:text-slate-800 hover:bg-gray-50 transition-colors"
            ariaCurrentWhenActive="page"
          >
            Mis Exámenes
          </a>
        </div>

        <button
          (click)="cerrarSesion()"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-600
                 hover:text-slate-800 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
            {{ inicialesUsuario() }}
          </div>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
          </svg>
        </button>
      }

      @if (modo() === 'monitor') {
        <div class="flex items-center gap-3 text-sm">
          <span class="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
            En vivo
          </span>

          @if (examenNombre()) {
            <span class="text-slate-700 font-medium">{{ examenNombre() }}</span>
          }
          @if (grupoNombre()) {
            <span class="text-slate-400 text-xs">{{ grupoNombre() }}</span>
          }
        </div>

        <button
          (click)="terminarSesion.emit()"
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium
                 bg-red-50 text-red-600 border border-red-200
                 hover:bg-red-100 transition-colors cursor-pointer"
          aria-label="Terminar sesión de examen"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
          Terminar Sesión
        </button>
      }

      @if (modo() === 'student') {
        <div class="flex items-center gap-2 text-sm">
          <div class="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center text-xs font-semibold text-brand">
            {{ inicialesAlumno() }}
          </div>
          @if (alumnoNombre()) {
            <span class="text-slate-700 font-medium text-sm">{{ alumnoNombre() }}</span>
          }
        </div>

        <div aria-hidden="true"></div>
      }

    </nav>
  `,
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);

  modo         = input<'default' | 'monitor' | 'student'>('default');
  grupoNombre  = input<string>('');
  examenNombre = input<string>('');
  alumnoNombre = input<string>('');

  /** [Monitor] El padre (MonitorComponent) maneja el cierre real en Supabase. */
  terminarSesion = output<void>();

  inicialesUsuario = computed(() =>
    getIniciales(this.auth.currentUser()?.user_metadata?.['full_name'] ?? '')
  );
  inicialesAlumno = computed(() => getIniciales(this.alumnoNombre() ?? ''));

  cerrarSesion() {
    this.auth.cerrarSesion();
  }
}