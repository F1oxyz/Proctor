import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-card-estudiante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded-xl border border-gray-200 p-8 flex flex-col gap-6 shadow-sm h-full">

      <!-- Ícono + Título -->
      <div class="flex flex-col items-center text-center gap-3">
        <div class="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--color-brand)"><path d="M480-120 200-272v-240L40-600l440-240 440 240v320h-80v-276l-80 44v240L480-120Zm0-332 274-148-274-148-274 148 274 148Zm0 241 200-108v-151L480-360 280-470v151l200 108Zm0-241Zm0 90Zm0 0Z"/></svg>
        </div>
        <div>
          <h2 class="text-lg font-semibold text-slate-800">Estudiantes</h2>
          <p class="text-sm text-slate-500 mt-0.5">Ingresa a tu evaluación académica.</p>
        </div>
      </div>

      <!-- Formulario -->
      <div class="flex flex-col gap-4 flex-1">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-slate-700 tracking-wide">
            Código de Examen
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
            <input
              type="text"
              [(ngModel)]="codigoInput"
              (keyup.enter)="entrar()"
              placeholder="EJ: XYZ763"
              class="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg
                     text-slate-800 placeholder-slate-400 bg-white
                     focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand
                     transition-colors uppercase tracking-widest"
              [class.border-red-400]="mostrarError()"
              autocomplete="off"
            />
          </div>
          @if (mostrarError()) {
            <p class="text-xs text-red-500 flex items-center gap-1">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              Ingresa un código de examen válido.
            </p>
          }
        </div>

        <button
          (click)="entrar()"
          class="w-full bg-brand hover:bg-brand/90 active:bg-brand/80
                 text-white text-sm font-medium py-2.5 rounded-lg
                 transition-colors cursor-pointer"
        >
          Entrar al Examen
        </button>
      </div>

    </div>
  `
})
export class CardEstudianteComponent {
  private readonly router = inject(Router);

  codigoInput = '';
  mostrarError = signal(false);

  entrar() {
    const codigo = this.codigoInput.trim().toUpperCase();
    if (!codigo) {
      this.mostrarError.set(true);
      return;
    }
    this.mostrarError.set(false);
    this.router.navigate(['/examen', codigo]);
  }
}