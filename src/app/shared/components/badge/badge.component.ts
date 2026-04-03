/**
 * Badge de estado para el monitor. Estados: activo | offline | enviado.
 * TODO: 'idle' y 'flagged' cuando se implementen detección de inactividad/comportamiento.
 */

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
  estado   = input.required<EstadoBadge>();
  etiqueta = input<string>('');

  etiquetaMostrar = computed(() => {
    if (this.etiqueta()) return this.etiqueta();
    const textos: Record<EstadoBadge, string> = {
      activo:  'Activo',
      offline: 'Sin conexión',
      enviado: 'Enviado',
    };
    return textos[this.estado()];
  });

  clases = computed(() => {
    const estilos: Record<EstadoBadge, string> = {
      activo:  'bg-emerald-50 text-emerald-700',
      offline: 'bg-gray-100 text-gray-500',
      enviado: 'bg-brand/10 text-brand',
    };
    return estilos[this.estado()];
  });

  puntoCl = computed(() => {
    const puntos: Record<EstadoBadge, string> = {
      activo:  'bg-emerald-500',
      offline: 'bg-gray-400',
      enviado: 'bg-brand',
    };
    return puntos[this.estado()];
  });
}