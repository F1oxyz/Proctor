/**
 * temporizador.component.ts
 * ─────────────────────────────────────────────────────────────────
 * BUGS CORREGIDOS:
 *  - Bug 3: El efecto emitía tiempoAgotado al inicializar porque el input
 *           empieza en 0 antes de que ngOnInit del padre lo setee.
 *           Ahora solo emite DESPUÉS de que el contador haya tenido un valor > 0.
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  effect,
} from '@angular/core';

@Component({
  selector: 'app-temporizador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition-colors"
      [class.bg-red-100]="urgente()"
      [class.text-red-600]="urgente()"
      [class.bg-slate-100]="!urgente()"
      [class.text-slate-700]="!urgente()"
      role="timer"
      [attr.aria-label]="'Tiempo restante: ' + tiempoFormateado()"
    >
      <!-- Icono reloj (parpadea cuando es urgente) -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4 shrink-0"
        [class.animate-pulse]="urgente()"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10"/>
        <path stroke-linecap="round" d="M12 6v6l4 2"/>
      </svg>

      {{ tiempoFormateado() }}
    </div>
  `,
})
export class TemporizadorComponent {
  // ── Inputs ───────────────────────────────────────────────────────

  segundosRestantes = input.required<number>();

  // ── Outputs ──────────────────────────────────────────────────────

  tiempoAgotado = output<void>();

  // ── Computed ─────────────────────────────────────────────────────

  readonly tiempoFormateado = computed(() => {
    const s = Math.max(0, this.segundosRestantes());
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  });

  readonly urgente = computed(
    () => this.segundosRestantes() > 0 && this.segundosRestantes() <= 120
  );

  /**
   * Bug 3: solo emite tiempoAgotado después de que el contador haya
   * tenido un valor positivo (evita disparo espurio al inicializar con 0).
   *
   * FIX idempotencia: `yaEmitio` garantiza que la emisión ocurra EXACTAMENTE
   * una vez por ciclo de vida del componente, sin importar cuántas veces
   * el effect se re-ejecute con s=0.
   */
  private haEmpezado = false;
  private yaEmitio   = false;

  constructor() {
    effect(() => {
      const s = this.segundosRestantes();
      if (s > 0) this.haEmpezado = true;
      if (this.haEmpezado && s <= 0 && !this.yaEmitio) {
        this.yaEmitio = true;
        this.tiempoAgotado.emit();
      }
    });
  }
}
