// =============================================================
// shared/components/badge/badge.component.ts
// Indicador visual de estado para alumnos en el panel de monitoreo.
//
// Estados disponibles:
//   'activo'    → Verde  - Alumno respondiendo activamente
//   'offline'   → Gris   - No conectado / sin pantalla compartida
//   'enviado'   → Verde oscuro - Examen enviado (terminó)
//
// TODO: 'idle' y 'flagged' se agregarán cuando se implementen
//       detección de inactividad y análisis de comportamiento.
//
// Uso:
//   <app-badge estado="activo" />
//   <app-badge estado="offline" />
//   <app-badge estado="enviado" />
// =============================================================

import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

export type EstadoBadge = 'activo' | 'offline' | 'enviado';

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
      offline: 'Sin conexión',
      enviado: 'Enviado',
    };
    return textos[this.estado()];
  });

  /** Clases del contenedor del badge según el estado */
  clases = computed(() => {
    const estilos: Record<EstadoBadge, string> = {
      activo:  'bg-emerald-50 text-emerald-700',
      offline: 'bg-gray-100 text-gray-500',
      enviado: 'bg-brand/10 text-brand',
    };
    return estilos[this.estado()];
  });

  /** Clases del punto indicador según el estado */
  puntoCl = computed(() => {
    const puntos: Record<EstadoBadge, string> = {
      activo:  'bg-emerald-500',
      offline: 'bg-gray-400',
      enviado: 'bg-brand',
    };
    return puntos[this.estado()];
  });
}