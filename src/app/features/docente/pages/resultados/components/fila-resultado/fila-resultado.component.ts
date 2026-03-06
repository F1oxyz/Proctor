/**
 * fila-resultado.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Renderiza una fila de la tabla de resultados del docente.
 * Una fila = un alumno con todas sus métricas.
 *
 * MÉTRICAS :
 *  Nombre | Nota% | Cumplido | Sin cumplir | Acertado | Equivocado | Tiempo | Seg/preg
 *
 * ARQUITECTURA:
 *  - Componente dumb: solo recibe `sesionAlumno` como input
 *  - OnPush
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { SesionAlumnoConDatos } from '../../../../../../shared/models/index';

@Component({
  selector: '[app-fila-resultado]', // selector de atributo para usar en <tr>
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Nombre del alumno -->
    <td class="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
      <div class="flex items-center gap-2">
        <!-- Avatar circular con iniciales -->
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          [style.background-color]="colorAvatar()"
        >
          {{ iniciales() }}
        </div>
        {{ fila().alumno_nombre ?? '—' }}
      </div>
    </td>

    <!-- Nota % -->
    <td class="px-4 py-3 text-center">
      <span
        class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold"
        [class.bg-green-100]="(fila().porcentaje ?? 0) >= 60"
        [class.text-green-800]="(fila().porcentaje ?? 0) >= 60"
        [class.bg-red-100]="(fila().porcentaje ?? 0) < 60"
        [class.text-red-800]="(fila().porcentaje ?? 0) < 60"
      >
        {{ fila().porcentaje != null ? fila().porcentaje + '%' : '—' }}
      </span>
    </td>

    <!-- Cumplido (correctas + incorrectas) -->
    <td class="px-4 py-3 text-center text-sm text-slate-700">
      {{ cumplido() }}
    </td>

    <!-- Sin cumplir -->
    <td class="px-4 py-3 text-center text-sm text-slate-500">
      {{ sinCumplir() }}
    </td>

    <!-- Acertado -->
    <td class="px-4 py-3 text-center text-sm text-green-600 font-medium">
      {{ fila().total_correctas ?? '—' }}
    </td>

    <!-- Equivocado -->
    <td class="px-4 py-3 text-center text-sm text-red-500 font-medium">
      {{ fila().total_incorrectas ?? '—' }}
    </td>

    <!-- Tiempo (mm:ss) -->
    <td class="px-4 py-3 text-center text-sm text-slate-600 font-mono">
      {{ tiempoFormateado() }}
    </td>

    <!-- Estado -->
    <td class="px-4 py-3 text-center">
      <span
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        [class.bg-green-100]="fila().estado === 'enviado'"
        [class.text-green-700]="fila().estado === 'enviado'"
        [class.bg-blue-100]="fila().estado === 'en_progreso'"
        [class.text-blue-700]="fila().estado === 'en_progreso'"
        [class.bg-slate-100]="fila().estado === 'unido'"
        [class.text-slate-600]="fila().estado === 'unido'"
      >
        @switch (fila().estado) {
          @case ('enviado')     { ✓ Enviado }
          @case ('en_progreso') { En progreso }
          @default              { Pendiente }
        }
      </span>
    </td>
  `,
})
export class FilaResultadoComponent {
  // ── Inputs ───────────────────────────────────────────────────────

  /** Datos del registro sesion_alumnos enriquecido con el nombre */
  fila = input.required<SesionAlumnoConDatos>();

  // ── Computed ─────────────────────────────────────────────────────

  /** Iniciales del nombre para el avatar */
  readonly iniciales = computed(() => {
    const nombre = this.fila().alumno_nombre ?? '';
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('');
  });

  /**
   * Color determinístico basado en el nombre del alumno.
   * Misma lógica que en TablaAlumnos del Paso 3 para consistencia visual.
   */
  readonly colorAvatar = computed(() => {
    const nombre = this.fila().alumno_nombre ?? 'X';
    const colores = [
      '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
      '#f59e0b', '#ef4444', '#6366f1', '#84cc16',
    ];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colores[Math.abs(hash) % colores.length];
  });

  /**
   * Preguntas "cumplidas" = correctas + incorrectas.
   * Las sin contestar no cuentan como cumplidas.
   */
  readonly cumplido = computed(() => {
    const f = this.fila();
    if (f.total_correctas == null) return '—';
    return (f.total_correctas ?? 0) + (f.total_incorrectas ?? 0);
  });

  /**
   * Sin cumplir = preguntas que quedaron sin responder.
   * Se calcula a partir de tiempo_usado_min si no hay datos directos.
   */
  readonly sinCumplir = computed(() => {
    const f = this.fila();
    if (f.total_correctas == null && f.total_incorrectas == null) return '—';
    const respondidas = (f.total_correctas ?? 0) + (f.total_incorrectas ?? 0);
    // total_preguntas viene del join extendido en resultados.service
    const total = (f as any).total_preguntas ?? respondidas;
    return Math.max(0, total - respondidas);
  });

  /**
   * Tiempo formateado mm:ss.
   * Prioriza el cálculo exacto desde los timestamps iniciado_en / enviado_en.
   * Fallback a tiempo_usado_min si los timestamps no están disponibles.
   */
  readonly tiempoFormateado = computed(() => {
    const ini = this.fila().iniciado_en;
    const fin = this.fila().enviado_en;

    if (ini && fin) {
      const segs = Math.max(
        0,
        Math.round((new Date(fin).getTime() - new Date(ini).getTime()) / 1000)
      );
      const min = Math.floor(segs / 60).toString().padStart(2, '0');
      const sec = (segs % 60).toString().padStart(2, '0');
      return `${min}:${sec}`;
    }

    // Fallback: minutos redondeados guardados en BD
    const min = this.fila().tiempo_usado_min;
    if (min == null) return '—';
    return `${min.toString().padStart(2, '0')}:00`;
  });
}