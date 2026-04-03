import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../../../../core/services/auth.service';

type Vista = 'login' | 'registro';

@Component({
  selector: 'app-card-docente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="bg-white rounded-xl border border-gray-200 p-8 flex flex-col gap-6 shadow-sm h-full">

      <!-- Ícono + Título -->
      <div class="flex flex-col items-center text-center gap-3">
        <div class="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--color-brand)"><path d="M160-120q-33 0-56.5-23.5T80-200v-440q0-33 23.5-56.5T160-720h160v-80q0-33 23.5-56.5T400-880h160q33 0 56.5 23.5T640-800v80h160q33 0 56.5 23.5T880-640v440q0 33-23.5 56.5T800-120H160Zm0-80h640v-440H160v440Zm240-520h160v-80H400v80ZM160-200v-440 440Z"/></svg>
        </div>
        <div>
          <h2 class="text-lg font-semibold text-slate-800">Docentes</h2>
          <p class="text-sm text-slate-500 mt-0.5">
            {{ vista() === 'login' ? 'Usa tu correo institucional para ingresar' : 'Crea tu cuenta institucional' }}
          </p>
        </div>
      </div>

      <!-- ── VISTA LOGIN ── -->
      @if (vista() === 'login') {
        <form [formGroup]="loginForm" (ngSubmit)="iniciarSesion()" class="flex flex-col gap-4 flex-1">

          <!-- Email -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-700">Correo Institucional</label>
            <input
              type="email"
              formControlName="email"
              placeholder="nombre@universidad.edu.mx"
              class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800 placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
              [class.border-red-400]="campoInvalido(loginForm.get('email')!)"
              [class.border-gray-200]="!campoInvalido(loginForm.get('email')!)"
            />
            @if (campoInvalido(loginForm.get('email')!)) {
              <p class="text-xs text-red-500">Ingresa un correo válido.</p>
            }
          </div>

          <!-- Contraseña -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-700">Contraseña</label>
            <div class="relative">
              <input
                [type]="mostrarPass() ? 'text' : 'password'"
                formControlName="password"
                class="w-full px-3 py-2.5 pr-10 text-sm border rounded-lg text-slate-800 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
                [class.border-red-400]="campoInvalido(loginForm.get('password')!)"
                [class.border-gray-200]="!campoInvalido(loginForm.get('password')!)"
              />
              <button
                type="button"
                (click)="mostrarPass.update(v => !v)"
                class="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                [attr.aria-label]="mostrarPass() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                @if (mostrarPass()) {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              </button>
            </div>
            @if (campoInvalido(loginForm.get('password')!)) {
              <p class="text-xs text-red-500">La contraseña es requerida.</p>
            }
          </div>

          <!-- Error de Supabase -->
          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <!-- Botón -->
          <button
            type="submit"
            [disabled]="auth.loading()"
            class="w-full bg-brand hover:bg-brand/90 active:bg-brand/80 disabled:bg-brand/30
                   text-white text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer
                   disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
          >
            @if (auth.loading()) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Iniciando sesión...
            } @else {
              Iniciar Sesión
            }
          </button>

        </form>

        <!-- Cambiar a registro -->
        <p class="text-xs text-slate-500 text-center">
          ¿No tienes cuenta?
          <button (click)="cambiarVista('registro')"
            class="text-brand font-medium hover:underline cursor-pointer ml-0.5">
            Regístrate aquí
          </button>
        </p>
      }

      <!-- ── VISTA REGISTRO ── -->
      @if (vista() === 'registro') {
        <form [formGroup]="registroForm" (ngSubmit)="registrar()" class="flex flex-col gap-4 flex-1">

          <!-- Nombre -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-700">Nombre Completo</label>
            <input
              type="text"
              formControlName="nombre"
              placeholder="Ej: Juan Pérez"
              class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800 placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
              [class.border-red-400]="campoInvalido(registroForm.get('nombre')!)"
              [class.border-gray-200]="!campoInvalido(registroForm.get('nombre')!)"
            />
            @if (campoInvalido(registroForm.get('nombre')!)) {
              <p class="text-xs text-red-500">El nombre es requerido.</p>
            }
          </div>

          <!-- Email -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-700">Correo Institucional</label>
            <input
              type="email"
              formControlName="email"
              placeholder="nombre@universidad.edu"
              class="w-full px-3 py-2.5 text-sm border rounded-lg text-slate-800 placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
              [class.border-red-400]="campoInvalido(registroForm.get('email')!)"
              [class.border-gray-200]="!campoInvalido(registroForm.get('email')!)"
            />
            @if (campoInvalido(registroForm.get('email')!)) {
              <p class="text-xs text-red-500">Ingresa un correo válido.</p>
            }
          </div>

          <!-- Contraseña -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-700">Crear Contraseña</label>
            <div class="relative">
              <input
                [type]="mostrarPassReg() ? 'text' : 'password'"
                formControlName="password"
                placeholder="Mínimo 8 caracteres"
                class="w-full px-3 py-2.5 pr-10 text-sm border rounded-lg text-slate-800 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
                [class.border-red-400]="campoInvalido(registroForm.get('password')!)"
                [class.border-gray-200]="!campoInvalido(registroForm.get('password')!)"
              />
              <button
                type="button"
                (click)="mostrarPassReg.update(v => !v)"
                class="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                [attr.aria-label]="mostrarPassReg() ? 'Ocultar' : 'Mostrar'"
              >
                @if (mostrarPassReg()) {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              </button>
            </div>
            <p class="text-xs text-slate-400">La contraseña debe incluir al menos un número y un símbolo.</p>
            @if (campoInvalido(registroForm.get('password')!)) {
              <p class="text-xs text-red-500">Mínimo 8 caracteres.</p>
            }
          </div>

          <!-- Error de Supabase -->
          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <!-- Éxito -->
          @if (exitoMsg()) {
            <div class="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-700">
              {{ exitoMsg() }}
            </div>
          }

          <!-- Botón -->
          <button
            type="submit"
            [disabled]="auth.loading()"
            class="w-full bg-brand hover:bg-brand/90 active:bg-brand/80 disabled:bg-brand/30
                   text-white text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer
                   disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
          >
            @if (auth.loading()) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Creando cuenta...
            } @else {
              Crear Cuenta
            }
          </button>

        </form>

        <!-- Cambiar a login -->
        <p class="text-xs text-slate-500 text-center">
          ¿Ya tienes cuenta?
          <button (click)="cambiarVista('login')"
            class="text-brand font-medium hover:underline cursor-pointer ml-0.5">
            Inicia sesión aquí
          </button>
        </p>
      }

    </div>
  `
})
export class CardDocenteComponent {
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  vista = signal<Vista>('login');
  mostrarPass = signal(false);
  mostrarPassReg = signal(false);
  errorMsg = signal('');
  exitoMsg = signal('');

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  registroForm = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  cambiarVista(v: Vista) {
    this.vista.set(v);
    this.errorMsg.set('');
    this.exitoMsg.set('');
    this.loginForm.reset();
    this.registroForm.reset();
  }

  campoInvalido(control: AbstractControl): boolean {
    return control.invalid && (control.dirty || control.touched);
  }

  async iniciarSesion() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.errorMsg.set('');
    const { email, password } = this.loginForm.value;
    const { error } = await this.auth.iniciarSesion(email!, password!);
    if (error) {
      const mensaje = error instanceof Error ? error.message : 'Ocurrió un error. Intenta nuevamente.';
      this.errorMsg.set(this.traducirError(mensaje));
    }
  }

  async registrar() {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }
    this.errorMsg.set('');
    this.exitoMsg.set('');
    const { nombre, email, password } = this.registroForm.value;
    const { error } = await this.auth.registrarDocente(nombre!, email!, password!);
    if (error) {
      const mensaje = error instanceof Error ? error.message : 'Ocurrió un error. Intenta nuevamente.';
      this.errorMsg.set(this.traducirError(mensaje));
    }
  }

  private traducirError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (msg.includes('Email already registered') || msg.includes('already registered')) return 'Este correo ya está registrado.';
    if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (msg.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.';
    return 'Ocurrió un error. Intenta nuevamente.';
  }
}
