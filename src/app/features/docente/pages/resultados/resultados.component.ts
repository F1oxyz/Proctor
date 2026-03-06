/**
 * resultados.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Pantalla de resultados del docente estilo ThatQuiz. RF-05.
 * Ruta: /docente/resultados/:sesionId
 *
 * MUESTRA:
 *  - Nombre del examen + grupo + fecha
 *  - Resumen estadístico: total alumnos, promedio grupal, aprobados
 *  - Tabla con una fila por alumno (FilaResultadoComponent)
 *  - Columnas: Nombre | Nota% | Cumplido | Sin cumplir |
 *              Acertado | Equivocado | Tiempo | Estado
 *
 * DATOS:
 *  Carga de Supabase: sesion → examenes → sesion_alumnos + alumnos
 *
 * CAMBIOS:
 *  - Bug 5: clic en fila abre panel lateral con respuestas del alumno.
 *           Las preguntas abiertas (texto_abierto) permiten que el docente
 *           marque manualmente Correcto / Incorrecto. Al calificar se
 *           recalculan porcentaje, total_correctas e total_incorrectas
 *           en sesion_alumnos y se refleja en la tabla.
 *
 * ARQUITECTURA:
 *  - No provee ExamenesService (datos propios de sesión/resultados)
 *  - Carga directa a Supabase via SupabaseService
 *  - NavbarComponent en modo 'default'
 *  - OnPush
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { SupabaseService } from '../../../../core/services/supabase.service';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FilaResultadoComponent } from './components/fila-resultado/fila-resultado.component';
import { SesionAlumnoConDatos } from '../../../../shared/models/index';

/** Datos de la sesión para mostrar en el encabezado */
interface SesionInfo {
  examen_titulo: string;
  grupo_nombre: string;
  iniciada_en: string | null;
  duracion_min: number;
  codigo_acceso: string;
  /** Porcentaje mínimo (0-100) para aprobar el examen */
  minimo_aprobatorio: number;
}

/** Bug 5: Respuesta del alumno enriquecida con datos de la pregunta */
interface RespuestaConDatos {
  id: string;
  es_correcta: boolean | null;
  respuesta_abierta: string | null;
  opcion_id: string | null;
  pregunta_texto: string;
  tipo: 'opcion_multiple' | 'texto_abierto';
  opcion_texto: string | null;  // texto de la opción seleccionada
}

@Component({
  selector: 'app-resultados',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    NavbarComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    FilaResultadoComponent,
  ],
  template: `
    <!-- Navbar modo default -->
    <app-navbar modo="default" />

    <main class="max-w-6xl mx-auto px-4 py-8">

      <!-- ── Breadcrumb ── -->
      <nav class="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <a routerLink="/docente/examenes" class="hover:text-slate-700 transition-colors">
          Exámenes
        </a>
        <span>›</span>
        <span class="text-slate-700 font-medium">Resultados</span>
      </nav>

      <!-- ── Loading ── -->
      @if (cargando()) {
        <div class="flex items-center justify-center py-20">
          <app-loading-spinner />
        </div>
      }

      <!-- ── Error ── -->
      @else if (error()) {
        <div class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {{ error() }}
        </div>
      }

      @else {

        <!-- ── Encabezado de resultados ── -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">
            {{ sesionInfo()?.examen_titulo ?? 'Resultados del Examen' }}
          </h1>
          <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">

            <!-- Grupo -->
            <span class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#62748e"><path d="M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z"/></svg>
              {{ sesionInfo()?.grupo_nombre }}
            </span>

            <!-- Fecha -->
            @if (sesionInfo()?.iniciada_en) {
              <span class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ sesionInfo()!.iniciada_en | date: 'dd/MM/yyyy HH:mm' }}
              </span>
            }

            <!-- Código -->
            <span class="flex items-center gap-1 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
              {{ sesionInfo()?.codigo_acceso }}
            </span>

          </div>
        </div>

        <!-- ── Tarjetas de resumen estadístico ── -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

          <!-- Total alumnos -->
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Total Alumnos
            </p>
            <p class="text-2xl font-bold text-slate-900">{{ filas().length }}</p>
          </div>

          <!-- Enviaron -->
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Enviaron
            </p>
            <p class="text-2xl font-bold text-slate-900">{{ totalEnviaron() }}</p>
          </div>

          <!-- Promedio grupal -->
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Promedio Grupal
            </p>
            <p class="text-2xl font-bold"
              [class.text-green-600]="promedioGrupal() >= (sesionInfo()?.minimo_aprobatorio ?? 60)"
              [class.text-red-600]="promedioGrupal() < (sesionInfo()?.minimo_aprobatorio ?? 60)"
            >
              {{ promedioGrupal() }}%
            </p>
          </div>

          <!-- Aprobados -->
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Aprobados (≥{{ sesionInfo()?.minimo_aprobatorio ?? 60 }}%)
            </p>
            <p class="text-2xl font-bold text-green-600">{{ totalAprobados() }}</p>
          </div>

        </div>

        <!-- ── Tabla de resultados ── -->
        @if (filas().length === 0) {
          <app-empty-state
            icono="default"
            titulo="Sin resultados aún"
            descripcion="Ningún alumno ha enviado el examen todavía."
          />
        } @else {
          <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">

            <!-- Bug 5: hint de que las filas son clicables -->
            <p class="text-xs text-slate-400 px-4 pt-3 pb-1">
              Haz clic en una fila para ver las respuestas del alumno.
            </p>

            <div class="overflow-x-auto">
              <table
                class="w-full text-sm"
                role="table"
                aria-label="Resultados de alumnos"
              >
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50">
                    <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Nota
                    </th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Cumplido
                    </th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Sin cumplir
                    </th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Acertado
                    </th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Equivocado
                    </th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Tiempo
                    </th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-100">
                  @for (fila of filas(); track fila.id) {
                    <!-- Bug 5: clic en la fila abre el panel de respuestas -->
                    <tr
                      app-fila-resultado
                      [fila]="fila"
                      [minimoAprobatorio]="sesionInfo()?.minimo_aprobatorio ?? 60"
                      class="hover:bg-blue-50 transition-colors cursor-pointer"
                      [class.bg-blue-50]="alumnoSeleccionado()?.id === fila.id"
                      (click)="abrirRespuestasAlumno(fila)"
                    ></tr>
                  }
                </tbody>

              </table>
            </div>

          </div>
        }

      }

    </main>

    <!-- ── Bug 5: Panel lateral de respuestas del alumno ── -->
    @if (panelAbierto()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/30 z-40"
        (click)="cerrarPanel()"
      ></div>

      <!-- Panel -->
      <aside
        class="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-titulo"
      >
        <!-- Cabecera del panel -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 id="panel-titulo" class="text-base font-bold text-slate-800">
              {{ alumnoSeleccionado()?.alumno_nombre ?? 'Respuestas' }}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Revisión de respuestas individuales
            </p>
          </div>
          <button
            type="button"
            (click)="cerrarPanel()"
            class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Cerrar panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Indicador de preguntas abiertas sin calificar -->
        @if (pendientesDeCalificar() > 0) {
          <div class="mx-5 mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              <strong>{{ pendientesDeCalificar() }}</strong> pregunta(s) abierta(s) pendiente(s) de calificar.
            </span>
          </div>
        }

        <!-- Cuerpo: lista de respuestas -->
        <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          @if (cargandoRespuestas()) {
            <div class="flex justify-center py-10">
              <app-loading-spinner />
            </div>
          } @else if (respuestasAlumno().length === 0) {
            <div class="text-center py-10 text-sm text-slate-500">
              Este alumno no tiene respuestas registradas.
            </div>
          } @else {
            @for (resp of respuestasAlumno(); track resp.id; let i = $index) {
              <div
                class="border rounded-xl overflow-hidden"
                [class.border-green-200]="resp.es_correcta === true"
                [class.border-red-200]="resp.es_correcta === false"
                [class.border-slate-200]="resp.es_correcta === null"
              >
                <!-- Cabecera de la pregunta -->
                <div
                  class="flex items-start justify-between px-4 py-3 text-xs font-semibold"
                  [class.bg-green-50]="resp.es_correcta === true"
                  [class.bg-red-50]="resp.es_correcta === false"
                  [class.bg-slate-50]="resp.es_correcta === null"
                >
                  <span class="text-slate-600 uppercase tracking-wider">
                    Pregunta {{ i + 1 }}
                    @if (resp.tipo === 'texto_abierto') {
                      <span class="ml-1 text-slate-400">(Abierta)</span>
                    }
                  </span>
                  <!-- Indicador de estado -->
                  @if (resp.es_correcta === true) {
                    <span class="flex items-center gap-1 text-green-700">
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                      </svg>
                      Correcta
                    </span>
                  } @else if (resp.es_correcta === false) {
                    <span class="flex items-center gap-1 text-red-600">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Incorrecta
                    </span>
                  } @else {
                    <span class="text-amber-600">Sin calificar</span>
                  }
                </div>

                <!-- Cuerpo de la pregunta -->
                <div class="px-4 py-3 flex flex-col gap-2">
                  <!-- Texto de la pregunta -->
                  <p class="text-sm font-medium text-slate-800">{{ resp.pregunta_texto }}</p>

                  <!-- Respuesta del alumno -->
                  @if (resp.tipo === 'opcion_multiple') {
                    <p class="text-sm text-slate-600">
                      <span class="text-xs font-medium text-slate-400 uppercase tracking-wider mr-1">Respondió:</span>
                      {{ resp.opcion_texto ?? '(Sin respuesta)' }}
                    </p>
                  } @else {
                    <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <p class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Respuesta:</p>
                      <p class="text-sm text-slate-700 whitespace-pre-wrap">
                        {{ resp.respuesta_abierta?.trim() || '(Sin respuesta)' }}
                      </p>
                    </div>

                    <!-- Bug 5: Botones de calificación para preguntas abiertas -->
                    <div class="flex gap-2 mt-1">
                      <button
                        type="button"
                        (click)="calificarRespuesta(resp.id, true)"
                        [disabled]="calificando()"
                        class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50"
                        [class.bg-green-600]="resp.es_correcta === true"
                        [class.text-white]="resp.es_correcta === true"
                        [class.border-green-600]="resp.es_correcta === true"
                        [class.bg-white]="resp.es_correcta !== true"
                        [class.text-green-700]="resp.es_correcta !== true"
                        [class.border-green-300]="resp.es_correcta !== true"
                        [class.hover:bg-green-50]="resp.es_correcta !== true"
                      >
                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Correcta
                      </button>
                      <button
                        type="button"
                        (click)="calificarRespuesta(resp.id, false)"
                        [disabled]="calificando()"
                        class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50"
                        [class.bg-red-500]="resp.es_correcta === false"
                        [class.text-white]="resp.es_correcta === false"
                        [class.border-red-500]="resp.es_correcta === false"
                        [class.bg-white]="resp.es_correcta !== false"
                        [class.text-red-600]="resp.es_correcta !== false"
                        [class.border-red-300]="resp.es_correcta !== false"
                        [class.hover:bg-red-50]="resp.es_correcta !== false"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Incorrecta
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          }

        </div>

        <!-- Pie del panel: métricas recalculadas -->
        @if (alumnoSeleccionado() && !cargandoRespuestas()) {
          <div class="border-t border-slate-200 px-5 py-3 bg-slate-50 shrink-0">
            <div class="flex items-center justify-between text-xs text-slate-600">
              <span>
                Correctas: <strong class="text-green-600">{{ alumnoSeleccionado()!.total_correctas ?? 0 }}</strong>
              </span>
              <span>
                Incorrectas: <strong class="text-red-500">{{ alumnoSeleccionado()!.total_incorrectas ?? 0 }}</strong>
              </span>
              <span>
                Nota: <strong
                  [class.text-green-600]="(alumnoSeleccionado()!.porcentaje ?? 0) >= (sesionInfo()?.minimo_aprobatorio ?? 60)"
                  [class.text-red-500]="(alumnoSeleccionado()!.porcentaje ?? 0) < (sesionInfo()?.minimo_aprobatorio ?? 60)"
                >{{ alumnoSeleccionado()!.porcentaje ?? 0 }}%</strong>
              </span>
            </div>
          </div>
        }

      </aside>
    }
  `,
})
export class ResultadosComponent implements OnInit {
  // ── Dependencias ────────────────────────────────────────────────
  private readonly supabase = inject(SupabaseService);
  private readonly route    = inject(ActivatedRoute);

  // ── Estado ───────────────────────────────────────────────────────

  /** Info de la sesión para el encabezado */
  readonly sesionInfo = signal<SesionInfo | null>(null);

  /** Filas de la tabla (un registro por alumno) */
  readonly filas = signal<SesionAlumnoConDatos[]>([]);

  /** Total de preguntas del examen (para calcular sin_cumplir) */
  readonly totalPreguntas = signal(0);

  readonly cargando = signal(false);
  readonly error    = signal<string | null>(null);

  // ── Bug 5: Estado del panel de respuestas ────────────────────────

  /** Alumno cuyas respuestas se están revisando */
  readonly alumnoSeleccionado = signal<SesionAlumnoConDatos | null>(null);

  /** Respuestas del alumno seleccionado */
  readonly respuestasAlumno = signal<RespuestaConDatos[]>([]);

  readonly panelAbierto         = signal(false);
  readonly cargandoRespuestas   = signal(false);
  readonly calificando          = signal(false);

  // ── Computed ─────────────────────────────────────────────────────

  /** Cantidad de alumnos que enviaron el examen */
  readonly totalEnviaron = computed(
    () => this.filas().filter((f) => f.estado === 'enviado').length
  );

  /** Promedio de porcentaje de los alumnos que enviaron */
  readonly promedioGrupal = computed(() => {
    const enviados = this.filas().filter(
      (f) => f.estado === 'enviado' && f.porcentaje != null
    );
    if (enviados.length === 0) return 0;
    const suma = enviados.reduce((acc, f) => acc + (f.porcentaje ?? 0), 0);
    return Math.round(suma / enviados.length);
  });

  /** Alumnos con porcentaje >= minimo_aprobatorio del examen */
  readonly totalAprobados = computed(() => {
    const minimo = this.sesionInfo()?.minimo_aprobatorio ?? 60;
    return this.filas().filter((f) => (f.porcentaje ?? 0) >= minimo).length;
  });

  /** Bug 5: preguntas abiertas del alumno seleccionado sin calificar */
  readonly pendientesDeCalificar = computed(
    () => this.respuestasAlumno().filter(
      (r) => r.tipo === 'texto_abierto' && r.es_correcta === null
    ).length
  );

  // ── Ciclo de vida ─────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const sesionId = this.route.snapshot.paramMap.get('sesionId');
    if (!sesionId) {
      this.error.set('No se especificó una sesión.');
      return;
    }
    await this.cargarResultados(sesionId);
  }

  // ── Carga de datos ────────────────────────────────────────────

  /**
   * Carga todos los datos necesarios para la tabla:
   * 1. Info de la sesión (examen, grupo, fechas)
   * 2. Registros de sesion_alumnos con el nombre del alumno
   *
   * @param sesionId UUID de la sesión
   */
  private async cargarResultados(sesionId: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    // ── Cargar info de la sesión ────────────────────────────────
    const { data: sesionData, error: sesionError } = await this.supabase.client
      .from('sesiones')
      .select(`
        id,
        codigo_acceso,
        iniciada_en,
        examenes (
          titulo,
          duracion_min,
          minimo_aprobatorio,
          grupos ( nombre ),
          preguntas ( id )
        )
      `)
      .eq('id', sesionId)
      .single();

    if (sesionError || !sesionData) {
      this.error.set('No se encontró la sesión especificada.');
      this.cargando.set(false);
      return;
    }

    const examen = (sesionData as any).examenes;

    this.sesionInfo.set({
      examen_titulo:      examen?.titulo ?? '—',
      grupo_nombre:       examen?.grupos?.nombre ?? '—',
      iniciada_en:        sesionData.iniciada_en,
      duracion_min:       examen?.duracion_min ?? 0,
      codigo_acceso:      sesionData.codigo_acceso,
      minimo_aprobatorio: examen?.minimo_aprobatorio ?? 60,
    });

    // Guardar total de preguntas para calcular "sin cumplir" en la fila
    this.totalPreguntas.set((examen?.preguntas ?? []).length);

    // ── Cargar registros de sesion_alumnos + nombre del alumno ──
    const { data: alumnosData, error: alumnosError } = await this.supabase.client
      .from('sesion_alumnos')
      .select(`
        id,
        alumno_id,
        estado,
        iniciado_en,
        enviado_en,
        tiempo_usado_min,
        porcentaje,
        total_correctas,
        total_incorrectas,
        alumnos ( nombre_completo )
      `)
      .eq('sesion_id', sesionId)
      .order('alumnos(nombre_completo)', { ascending: true });

    if (alumnosError) {
      this.error.set('No se pudieron cargar los resultados de los alumnos.');
      this.cargando.set(false);
      return;
    }

    // Aplanar el join para exponer alumno_nombre directamente
    const filasEnriquecidas: SesionAlumnoConDatos[] = (alumnosData ?? []).map(
      (sa: any) => ({
        ...sa,
        alumno_nombre:   sa.alumnos?.nombre_completo ?? '—',
        total_preguntas: this.totalPreguntas(), // para calcular sin_cumplir en fila
      })
    );

    this.filas.set(filasEnriquecidas);
    this.cargando.set(false);
  }

  // ── Bug 5: Panel de respuestas ────────────────────────────────

  /**
   * Abre el panel lateral con las respuestas del alumno seleccionado.
   * @param fila Fila del alumno que se seleccionó
   */
  async abrirRespuestasAlumno(fila: SesionAlumnoConDatos): Promise<void> {
    this.alumnoSeleccionado.set(fila);
    this.panelAbierto.set(true);
    await this.cargarRespuestasDeAlumno(fila.id);
  }

  /** Cierra el panel lateral y limpia el estado */
  cerrarPanel(): void {
    this.panelAbierto.set(false);
    this.alumnoSeleccionado.set(null);
    this.respuestasAlumno.set([]);
  }

  /**
   * Bug 5: Carga las respuestas de un alumno con datos de pregunta y opción.
   * @param sesionAlumnoId UUID del registro sesion_alumnos
   */
  private async cargarRespuestasDeAlumno(sesionAlumnoId: string): Promise<void> {
    this.cargandoRespuestas.set(true);

    const { data, error } = await this.supabase.client
      .from('respuestas')
      .select(`
        id,
        es_correcta,
        respuesta_abierta,
        opcion_id,
        preguntas ( texto, tipo ),
        opciones ( texto )
      `)
      .eq('sesion_alumno_id', sesionAlumnoId);

    if (error) {
      console.error('[ResultadosComponent] cargarRespuestasDeAlumno:', error);
      this.cargandoRespuestas.set(false);
      return;
    }

    const enriquecidas: RespuestaConDatos[] = (data ?? []).map((r: any) => ({
      id:                r.id,
      es_correcta:       r.es_correcta,
      respuesta_abierta: r.respuesta_abierta,
      opcion_id:         r.opcion_id,
      pregunta_texto:    r.preguntas?.texto ?? '—',
      tipo:              r.preguntas?.tipo ?? 'opcion_multiple',
      opcion_texto:      r.opciones?.texto ?? null,
    }));

    this.respuestasAlumno.set(enriquecidas);
    this.cargandoRespuestas.set(false);
  }

  /**
   * Bug 5: Califica una respuesta abierta y recalcula las métricas del alumno.
   * @param respuestaId UUID de la respuesta en la tabla `respuestas`
   * @param esCorrecta  true = correcta, false = incorrecta
   */
  async calificarRespuesta(respuestaId: string, esCorrecta: boolean): Promise<void> {
    if (this.calificando()) return;
    this.calificando.set(true);

    // 1. Actualizar es_correcta en la tabla respuestas
    const { error } = await this.supabase.client
      .from('respuestas')
      .update({ es_correcta: esCorrecta })
      .eq('id', respuestaId);

    if (error) {
      console.error('[ResultadosComponent] calificarRespuesta:', error);
      this.calificando.set(false);
      return;
    }

    // 2. Actualizar el signal local de respuestas
    this.respuestasAlumno.update((lista) =>
      lista.map((r) => r.id === respuestaId ? { ...r, es_correcta: esCorrecta } : r)
    );

    // 3. Recalcular métricas en sesion_alumnos
    await this._recalcularMetricas();

    this.calificando.set(false);
  }

  /**
   * Bug 5: Recalcula porcentaje, total_correctas y total_incorrectas
   * del alumno seleccionado basándose en sus respuestas actuales,
   * y actualiza tanto la BD como el signal local.
   */
  private async _recalcularMetricas(): Promise<void> {
    const alumno = this.alumnoSeleccionado();
    if (!alumno) return;

    const respuestas = this.respuestasAlumno();
    const totalPreguntas = this.totalPreguntas();

    const totalCorrectas   = respuestas.filter((r) => r.es_correcta === true).length;
    const totalIncorrectas = respuestas.filter((r) => r.es_correcta === false).length;
    const porcentaje = totalPreguntas > 0
      ? Math.round((totalCorrectas / totalPreguntas) * 100)
      : 0;

    // Actualizar en Supabase
    await this.supabase.client
      .from('sesion_alumnos')
      .update({
        total_correctas:   totalCorrectas,
        total_incorrectas: totalIncorrectas,
        porcentaje,
      })
      .eq('id', alumno.id);

    // Actualizar en el signal alumnoSeleccionado
    const alumnoActualizado: SesionAlumnoConDatos = {
      ...alumno,
      total_correctas:   totalCorrectas,
      total_incorrectas: totalIncorrectas,
      porcentaje,
    };
    this.alumnoSeleccionado.set(alumnoActualizado);

    // Actualizar en el signal filas (para que la tabla refleje el cambio)
    this.filas.update((lista) =>
      lista.map((f) =>
        f.id === alumno.id
          ? { ...f, total_correctas: totalCorrectas, total_incorrectas: totalIncorrectas, porcentaje }
          : f
      )
    );
  }
}
