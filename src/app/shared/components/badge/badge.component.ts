// =============================================================
// shared/components/badge/badge.component.ts
// Indicador visual de estado para alumnos en el panel de monitoreo.
//
// Estados disponibles:
//   'activo'    → Verde  - Alumno respondiendo activamente
//   'idle'      → Naranja/Amarillo - Sin actividad por >2 min
//   'flagged'   → Rojo   - Marcado por el maestro (sospechoso)
//   'offline'   → Gris   - No conectado / sin pantalla compartida
//   'enviado'   → Azul   - Examen enviado (terminó)
//
// Uso:
//   <app-badge estado="activo" />
//   <app-badge estado="idle" [etiqueta]="'Idle (2m)'" />
//   <app-badge estado="flagged" />
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

export type EstadoBadge = 'activo' | 'idle' | 'flagged' | 'offline' | 'enviado';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'inline-flex',
  },
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      [class]="clases()"
      [attr.aria-label]="'Estado: ' + etiquetaMostrar()"
    >
      <!-- Punto indicador -->
      <span
        class="w-1.5 h-1.5 rounded-full"
        [class]="puntoCl()"
        [class.animate-pulse]="estado() === 'activo'"
        aria-hidden="true"
      ></span>
      {{ etiquetaMostrar() }}
    </span>
  `,
})
export class BadgeComponent {
  // ── Inputs ─────────────────────────────────────────────

  /** Estado que determina el color y texto del badge */
  estado = input.required<EstadoBadge>();

  /**
   * Etiqueta personalizada. Si no se provee, se usa el texto
   * predeterminado según el estado.
   */
  etiqueta = input<string>('');

  // ── Computed ───────────────────────────────────────────

  /** Texto mostrado: etiqueta personalizada o texto por defecto */
  etiquetaMostrar = computed(() => {
    if (this.etiqueta()) return this.etiqueta();
    const textos: Record<EstadoBadge, string> = {
      activo:  'Activo',
      idle:    'Inactivo',
      flagged: 'Marcado',
      offline: 'Sin conexión',
      enviado: 'Enviado',
    };
    return textos[this.estado()];
  });

  /** Clases del contenedor del badge según el estado */
  clases = computed(() => {
    const estilos: Record<EstadoBadge, string> = {
      activo:  'bg-emerald-50 text-emerald-700',
      idle:    'bg-amber-50 text-amber-700',
      flagged: 'bg-red-50 text-red-700',
      offline: 'bg-gray-100 text-gray-500',
      enviado: 'bg-blue-50 text-blue-700',
    };
    return estilos[this.estado()];
  });

  /** Clases del punto indicador según el estado */
  puntoCl = computed(() => {
    const puntos: Record<EstadoBadge, string> = {
      activo:  'bg-emerald-500',
      idle:    'bg-amber-500',
      flagged: 'bg-red-500',
      offline: 'bg-gray-400',
      enviado: 'bg-blue-500',
    };
    return puntos[this.estado()];
  });
}