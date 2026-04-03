import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly router = inject(Router);

  // Estado reactivo del usuario actual
  readonly currentUser = signal<User | null>(null);
  readonly session = signal<Session | null>(null);
  readonly loading = signal(false);

  /** Promesa que resuelve cuando se completa la inicialización async de la sesión */
  private readonly _inicializacionPromise: Promise<void>;

  constructor() {
    // Inicializar sesión desde Supabase al arrancar la app
    this._inicializacionPromise = this.supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.currentUser.set(data.session?.user ?? null);
    });

    // Escuchar cambios de sesión en tiempo real
    this.supabase.auth.onAuthStateChange((_, session) => {
      this.session.set(session);
      this.currentUser.set(session?.user ?? null);
    });
  }

  /**
   * Espera a que la sesión de Supabase se haya inicializado.
   * Usar en guards para evitar la condición de carrera al refrescar la página.
   */
  aguardarInicializacion(): Promise<void> {
    return this._inicializacionPromise;
  }

  /**
   * Registro de nuevo docente con email + contraseña institucional.
   * El trigger de Supabase auto-crea el registro en la tabla `maestros`.
   *
   * Con confirm email desactivado en Supabase, el signup devuelve sesión
   * inmediatamente. En ese caso navegamos directo al dashboard docente.
   */
  async registrarDocente(nombreCompleto: string, email: string, password: string) {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: nombreCompleto }
        }
      });
      if (error) throw error;

      // Actualizar estado local si Supabase devuelve sesión (depende de configuración de confirmación de email)
      if (data.session) {
        this.session.set(data.session);
        this.currentUser.set(data.session.user);
        await this.router.navigate(['/docente/grupos']);
      }

      return { data, error: null };
    } catch (error: unknown) {
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Login de docente con email + contraseña.
   */
  async iniciarSesion(email: string, password: string) {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // CRITICAL: Actualizar signals ANTES de navegar para que el Guard los vea
      if (data.session) {
        this.session.set(data.session);
        this.currentUser.set(data.session.user);
      }

      await this.router.navigate(['/docente/grupos']);
      return { data, error: null };
    } catch (error: unknown) {
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Cerrar sesión del docente.
   */
  async cerrarSesion() {
    await this.supabase.auth.signOut();
    this.router.navigate(['/']);
  }

  /**
   * Verificar si hay sesión activa.
   */
  isAuthenticated(): boolean {
    return !!this.currentUser();
  }
}
