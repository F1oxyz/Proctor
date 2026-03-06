/**
 * resultado-alumno.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Pantalla final del flujo del alumno. RF-09.
 * Ruta: /examen/:codigo/resultado
 *
 * MUESTRA (idéntico a ThatQuiz según PDF - página 8):
 *  - Fecha del examen + badge Passed/Failed
 *  - Tabla de métricas: Nota, Cumplido, Sin cumplir,
 *    Acertado, Equivocado, Tiempo, Segundos (promedio)
 *  - Botón "Download PDF Report" (placeholder visual)
 *  - Link "← Volver al inicio"
 *
 * DATOS:
 *  Lee el ResultadoFinal del ExamenActivoService (signal store).
 *  Si el alumno llega aquí directamente sin datos, intenta
 *  recuperarlos de Supabase por sesion_alumno_id.
 *
 * ARQUITECTURA:
 *  - OnPush
 *  - No provee servicios propios; usa ExamenActivoService del árbol
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ExamenActivoService } from '../../services/examen-activo.service';

@Component({
  selector: 'app-resultado-alumno',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  template: `
    <!-- Fondo gris, centrado -->
    <div class="min-h-screen bg-gray-50 flex flex-col">

      <!-- ── Mini navbar ── -->
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-md flex items-center justify-center">
            <svg  xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#0065e0"><path d="M240-40H120q-33 0-56.5-23.5T40-120v-120h80v120h120v80Zm480 0v-80h120v-120h80v120q0 33-23.5 56.5T840-40H720ZM480-220q-120 0-217.5-71T120-480q45-118 142.5-189T480-740q120 0 217.5 71T840-480q-45 118-142.5 189T480-220Zm0-80q88 0 161-48t112-132q-39-84-112-132t-161-48q-88 0-161 48T207-480q39 84 112 132t161 48Zm0-40q58 0 99-41t41-99q0-58-41-99t-99-41q-58 0-99 41t-41 99q0 58 41 99t99 41Zm0-80q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420ZM40-720v-120q0-33 23.5-56.5T120-920h120v80H120v120H40Zm800 0v-120H720v-80h120q33 0 56.5 23.5T920-840v120h-80ZM480-480Z"/></svg>
          </div>
          <span class="text-slate-800 font-semibold text-lg tracking-tight">Proctor</span>
        </div>

        <!-- Badge de estado del alumno -->
        @if (servicio.alumno()) {
          <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <span class="text-xs font-bold text-white">{{ iniciales() }}</span>
          </div>
        }
      </header>

      <!-- ── Contenido ── -->
      <main class="flex-1 flex items-start justify-center px-4 py-10">
        <div class="w-full max-w-lg">

          @if (!resultado()) {
            <!-- Sin datos: spinner mientras carga o mensaje de error -->
            <div class="flex items-center justify-center py-20">
              <p class="text-sm text-slate-500">Cargando resultados...</p>
            </div>
          }

          @else {
            <!-- ── Card de resultados ── -->
            <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

              <!-- Encabezado del reporte -->
              <div class="text-center px-6 pt-8 pb-5 border-b border-slate-100">
                <h1 class="text-xl font-bold text-slate-900">Reporte de Resultados</h1>
                <p class="text-sm text-slate-500 mt-1">
                  {{ servicio.sesion()?.examen_titulo ?? 'Examen' }}
                </p>
              </div>

              <!-- Fecha + badge Aprobado/Reprobado -->
              <div class="flex items-center justify-between px-6 py-3 border-b border-slate-100">
                <div class="flex items-center gap-2 text-sm text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {{ fechaHoy | date: 'MMMM d, y' : '' : 'es-MX' }}
                </div>

                <!-- Badge: Passed >= 60%, Failed < 60% -->
                <span
                  class="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  [class.bg-green-100]="aprobado()"
                  [class.text-green-700]="aprobado()"
                  [class.bg-red-100]="!aprobado()"
                  [class.text-red-700]="!aprobado()"
                >
                  {{ aprobado() ? 'Aprobado' : 'Reprobado' }}
                </span>
              </div>

              <!-- Cabecera de columnas -->
              <div class="grid grid-cols-2 px-6 py-2 bg-slate-50">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Métrica</span>
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Valor</span>
              </div>

              <!-- Tabla de métricas (estilo ThatQuiz) -->
              <div class="divide-y divide-slate-100">

                <!-- Nota (porcentaje) -->
                <div class="grid grid-cols-2 items-center px-6 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span class="text-sm font-medium text-slate-700">Nota</span>
                  </div>
                  <span class="text-right text-base font-bold text-slate-900">
                    {{ resultado()!.porcentaje }}%
                  </span>
                </div>

                <!-- Cumplido (preguntas respondidas) -->
                <div class="grid grid-cols-2 items-center px-6 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-sm text-slate-600">Cumplido</span>
                  </div>
                  <span class="text-right text-sm font-semibold text-slate-800">
                    {{ cumplido() }}
                  </span>
                </div>

                <!-- Sin cumplir -->
                <div class="grid grid-cols-2 items-center px-6 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-sm text-slate-600">Sin cumplir</span>
                  </div>
                  <span class="text-right text-sm font-semibold text-slate-800">
                    {{ resultado()!.total_sin_contestar }}
                  </span>
                </div>

                <!-- Acertado -->
                <div class="grid grid-cols-2 items-center px-6 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    <span class="text-sm text-slate-600">Acertado</span>
                  </div>
                  <span class="text-right text-sm font-semibold text-slate-800">
                    {{ resultado()!.total_correctas }}
                  </span>
                </div>

                <!-- Equivocado -->
                <div class="grid grid-cols-2 items-center px-6 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <g transform="rotate(180 12 12)">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </g>
                    </svg>
                    <span class="text-sm text-slate-600">Equivocado</span>
                  </div>
                  <span class="text-right text-sm font-semibold text-slate-800">
                    {{ resultado()!.total_incorrectas }}
                  </span>
                </div>

                <!-- Tiempo usado -->
                <div class="grid grid-cols-2 items-center px-6 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 6v6l4 2"/>
                    </svg>
                    <span class="text-sm text-slate-600">Tiempo</span>
                  </div>
                  <span class="text-right text-sm font-semibold text-slate-800">
                    {{ tiempoFormateado() }}
                  </span>
                </div>

                <!-- Segundos promedio por pregunta -->
                <div class="grid grid-cols-2 items-center px-6 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span class="text-sm text-slate-600">Segundos (promedio)</span>
                  </div>
                  <span class="text-right text-sm font-semibold text-slate-800">
                    {{ resultado()!.segundos_promedio }}
                  </span>
                </div>

              </div>

              <!-- ── Acciones ── -->
              <div class="px-6 py-5 border-t border-slate-100">
                <div class="text-center">
                  <a
                    routerLink="/"
                    class="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver al inicio
                  </a>
                </div>
              </div>
            </div>
          }

        </div>
      </main>
    </div>
  `,
})
export class ResultadoAlumnoComponent implements OnInit {
  // ── Dependencias ────────────────────────────────────────────────
  readonly servicio = inject(ExamenActivoService);
  private readonly route = inject(ActivatedRoute);

  // ── Estado ───────────────────────────────────────────────────────

  /** Fecha de hoy para el reporte */
  readonly fechaHoy = new Date();

  // ── Computed ─────────────────────────────────────────────────────

  /** Resultado final del servicio */
  readonly resultado = computed(() => this.servicio.resultadoFinal());

  /** true si el porcentaje supera el mínimo aprobatorio del examen */
  readonly aprobado = computed(() =>
    (this.resultado()?.porcentaje ?? 0) >= (this.servicio.sesion()?.minimo_aprobatorio ?? 60)
  );

  /** Iniciales del alumno para el avatar */
  readonly iniciales = computed(() => {
    const nombre = this.servicio.alumno()?.nombre_completo ?? '';
    return nombre.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');
  });

  /**
   * Cantidad de preguntas "cumplidas" = correctas + incorrectas respondidas
   * (excluye las sin contestar, igual que ThatQuiz)
   */
  readonly cumplido = computed(() => {
    const r = this.resultado();
    if (!r) return 0;
    return r.total_correctas + r.total_incorrectas;
  });

  /** Tiempo usado formateado como mm:ss */
  readonly tiempoFormateado = computed(() => {
    const s = this.resultado()?.tiempo_usado_seg ?? 0;
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  });

  // ── Ciclo de vida ─────────────────────────────────────────────

  ngOnInit(): void {
    if (this.servicio.resultadoFinal()) return;

    // Intenta recuperar si sesionAlumnoId todavía está en el servicio
    const saId = this.servicio.sesionAlumnoId();
    if (saId) {
      this.servicio.recuperarResultado(saId);
      return;
    }

    // Fallback: recuperar usando código de sesión + alumnoId del sessionStorage
    const codigo = this.route.parent?.snapshot.paramMap.get('codigo') ?? '';
    const alumnoId = sessionStorage.getItem(`proctor_alumno_${codigo}`) ?? '';
    if (codigo && alumnoId) {
      this.servicio.recuperarResultadoPorCodigo(codigo, alumnoId);
    }
  }
}