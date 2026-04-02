/**
 * examen.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Shell principal de la vista del examen para el alumno.
 * Ruta: /examen/:codigo/evaluacion (protegida por sessionGuard)
 *
 * RESPONSABILIDADES:
 *  - Arrancar el intervalo del temporizador (setInterval)
 *  - Mostrar la pregunta actual (delegando a los sub-componentes)
 *  - Gestionar navegación: Anterior / Siguiente
 *  - Detectar fin de tiempo o envío manual → llamar enviarExamen()
 *  - Navegar a /examen/:codigo/resultado con los datos del resultado
 *
 * DISEÑO (según PDF - página 8):
 *  - Header: nombre del alumno + temporizador (esquina superior derecha)
 *  - Barra de progreso "QUESTION X OF N"
 *  - Card central con la pregunta
 *  - Footer: botones ← Previous y Siguiente →
 *
 * ARQUITECTURA:
 *  - Reutiliza ExamenActivoService del proveedor de SalaEsperaComponent
 *    (ambos están en la misma jerarquía de rutas /examen/:codigo/*)
 *  - Maneja el intervalo con cleanup en ngOnDestroy
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
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ExamenActivoService } from '../../services/examen-activo.service';
import { PeerService } from '../../../../core/services/peer.service';
import { TemporizadorComponent } from './components/temporizador/temporizador.component';
import { BarraProgresoComponent } from './components/barra-progreso/barra-progreso.component';
import { PreguntaOpcionMultipleComponent } from './components/pregunta-opcion-multiple/pregunta-opcion-multiple.component';
import { PreguntaAbiertaComponent } from './components/pregunta-abierta/pregunta-abierta.component';
import { OpcionActiva } from '../../services/examen-activo.service';

@Component({
  selector: 'app-examen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TemporizadorComponent,
    BarraProgresoComponent,
    PreguntaOpcionMultipleComponent,
    PreguntaAbiertaComponent,
  ],
  // NO declara providers: ExamenActivoService viene del padre (SalaEsperaComponent)
  // Si se accede directamente a esta ruta, el sessionGuard valida que exista sesión.
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">

      <!-- ── Header del examen ── -->
      <header class="bg-white border-b border-slate-200 px-4 py-3">
        <div class="max-w-2xl mx-auto flex items-center justify-between">

          <!-- Info del alumno -->
          <div class="flex items-center gap-3">
            <!-- Avatar iniciales -->
            <div class="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
              <span class="text-xs font-bold text-white">
                {{ iniciales() }}
              </span>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-800">
                {{ servicio.alumno()?.nombre_completo ?? 'Alumno' }}
              </p>
              <p class="text-xs text-slate-400">
                ID de sesión: {{ servicio.sesion()?.codigo_acceso }}
              </p>
            </div>
          </div>

          <!-- Temporizador -->
          <app-temporizador
            [segundosRestantes]="segundosRestantes()"
            (tiempoAgotado)="onTiempoAgotado()"
          />

        </div>
      </header>

      <!-- ── Banner de error al guardar respuesta (transitorio, amber) ── -->
      @if (servicio.errorGuardado()) {
        <div class="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div class="max-w-2xl mx-auto flex items-center gap-2 text-sm text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ servicio.errorGuardado() }}
          </div>
        </div>
      }

      <!-- ── Banner de error crítico (ej: fallo al enviar examen, rojo) ── -->
      @if (servicio.error()) {
        <div class="bg-red-50 border-b border-red-300 px-4 py-2">
          <div class="max-w-2xl mx-auto flex items-center gap-2 text-sm text-red-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {{ servicio.error() }}
          </div>
        </div>
      }

      <!-- ── Cuerpo del examen ── -->
      <main class="flex-1 flex items-start justify-center px-4 py-8">
        <div class="w-full max-w-2xl space-y-6">

          <!-- Barra de progreso -->
          <app-barra-progreso
            [preguntaActual]="servicio.numeroPreguntaVisible()"
            [totalPreguntas]="servicio.totalPreguntas()"
          />

          <!-- Card de la pregunta -->
          <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

            @if (servicio.cargando()) {
              <!-- Loading de preguntas -->
              <div class="flex items-center justify-center py-12">
                <svg class="w-7 h-7 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            }

            @else if (servicio.preguntaActual()) {

              <!-- Pregunta de opción múltiple -->
              @if (servicio.preguntaActual()!.tipo === 'opcion_multiple') {
                <app-pregunta-opcion-multiple
                  [pregunta]="servicio.preguntaActual()!"
                  [opcionSeleccionadaId]="opcionIdActual()"
                  (opcionElegida)="onOpcionElegida($event)"
                />
              }

              <!-- Pregunta de texto abierto -->
              @else {
                <app-pregunta-abierta
                  [pregunta]="servicio.preguntaActual()!"
                  [valorActual]="textoAbiertoActual()"
                  (respuestaChange)="onTextoAbiertoCambiado($event)"
                />
              }

            }

          </div>

          <!-- ── Navegación: Anterior / Siguiente ── -->
          <div class="flex items-center justify-between">

            <!-- Botón Anterior -->
            <button
              type="button"
              (click)="servicio.preguntaAnterior()"
              [disabled]="servicio.indicePreguntaActual() === 0"
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Anterior
            </button>

            <!-- Botón Enviar: en la última pregunta, O si hay error de envío pendiente (reintento) -->
            @if (esUltimaPregunta() || servicio.error()) {
              <button
                type="button"
                (click)="servicio.error() ? enviarExamen() : confirmarEnvio()"
                [disabled]="enviando()"
                class="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors"
                [class.bg-red-600]="!!servicio.error()"
                [class.hover:bg-red-700]="!!servicio.error()"
                [class.bg-green-600]="!servicio.error()"
                [class.hover:bg-green-700]="!servicio.error()"
              >
                @if (enviando()) {
                  <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Enviando...
                } @else if (servicio.error()) {
                  Reintentar envío
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                } @else {
                  Enviar Examen
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                }
              </button>
            } @else {
              <!-- Botón Siguiente -->
              <button
                type="button"
                (click)="servicio.siguientePregunta()"
                class="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-secondary rounded-xl transition-colors"
              >
                Siguiente
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            }

          </div>

        </div>
      </main>

      <!-- ── Modal de confirmación de envío ── -->
      @if (mostrarConfirmacion()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-base font-bold text-slate-800 mb-2">
              ¿Enviar examen?
            </h3>
            <p class="text-sm text-slate-600 mb-2">
              Respondiste
              <strong>{{ servicio.cantidadRespondidas() }} de {{ servicio.totalPreguntas() }}</strong>
              preguntas.
            </p>
            @if (!servicio.todasRespondidas()) {
              <p class="text-sm text-amber-600 mb-4">
                Aún tienes preguntas sin responder. Una vez enviado, no podrás editar.
              </p>
            } @else {
              <p class="text-sm text-green-600 mb-4">
                ¡Completaste todas las preguntas!
              </p>
            }
            <div class="flex justify-end gap-3">
              <button
                type="button"
                (click)="mostrarConfirmacion.set(false)"
                class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Continuar respondiendo
              </button>
              <button
                type="button"
                (click)="enviarExamen()"
                class="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Sí, enviar
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class ExamenComponent implements OnInit, OnDestroy {
  // ── Dependencias ────────────────────────────────────────────────
  readonly servicio = inject(ExamenActivoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly peerService = inject(PeerService);

  // ── Estado del temporizador ───────────────────────────────────────

  /** Segundos restantes (se decrementa cada segundo) */
  readonly segundosRestantes = signal(0);

  /** Referencia al intervalo para poder limpiarlo */
  private intervaloTimer: ReturnType<typeof setInterval> | null = null;

  // ── Estado de UI ──────────────────────────────────────────────

  /** true mientras se procesa el envío */
  readonly enviando = signal(false);

  /** Muestra el modal de confirmación de envío */
  readonly mostrarConfirmacion = signal(false);

  // ── Computed ─────────────────────────────────────────────────────

  /** Iniciales del alumno para el avatar */
  readonly iniciales = computed(() => {
    const nombre = this.servicio.alumno()?.nombre_completo ?? '';
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('');
  });

  /** true si está en la última pregunta */
  readonly esUltimaPregunta = computed(
    () =>
      this.servicio.indicePreguntaActual() ===
      this.servicio.totalPreguntas() - 1
  );

  /** ID de la opción seleccionada para la pregunta actual */
  readonly opcionIdActual = computed(() => {
    const r = this.servicio.respuestaActual();
    return r?.opcion_id ?? null;
  });

  /** Texto abierto guardado para la pregunta actual */
  readonly textoAbiertoActual = computed(() => {
    const r = this.servicio.respuestaActual();
    return r?.respuesta_abierta ?? null;
  });

  // ── Ciclo de vida ─────────────────────────────────────────────

  ngOnInit(): void {
    const sesion = this.servicio.sesion();

    if (!sesion || !this.servicio.sesionAlumnoId()) {
      const codigo = this.route.snapshot.paramMap.get('codigo');
      this.router.navigate(['/examen', codigo]);
      return;
    }

    // Bug 4: calcular segundos restantes descontando el tiempo ya transcurrido
    const totalSeg = sesion.duracion_min * 60;
    if (sesion.iniciada_en) {
      const ahora = Date.now();
      const iniciadaMs = new Date(sesion.iniciada_en).getTime();
      const transcurridos = Math.floor((ahora - iniciadaMs) / 1000);
      this.segundosRestantes.set(Math.max(0, totalSeg - transcurridos));
    } else {
      this.segundosRestantes.set(totalSeg);
    }

    this.iniciarTemporizador();
  }

  ngOnDestroy(): void {
    // Limpiar el intervalo al salir de la página
    this.detenerTemporizador();
    // Detener el stream de pantalla y cerrar la conexión PeerJS al finalizar el examen
    this.peerService.detenerStreamAlumno();
  }

  // ── Temporizador ──────────────────────────────────────────────

  /** Inicia el setInterval que decrementa el contador cada segundo */
  private iniciarTemporizador(): void {
    this.intervaloTimer = setInterval(() => {
      this.segundosRestantes.update((s) => {
        if (s <= 0) {
          this.detenerTemporizador();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  /** Detiene el intervalo */
  private detenerTemporizador(): void {
    if (this.intervaloTimer) {
      clearInterval(this.intervaloTimer);
      this.intervaloTimer = null;
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────

  /**
   * Se dispara cuando TemporizadorComponent emite tiempoAgotado.
   * Detiene el timer e intenta enviar el examen automáticamente.
   * Si el envío falla (sin conexión), el timer permanece detenido pero
   * el alumno ve el error y puede reintentar manualmente.
   */
  onTiempoAgotado(): void {
    this.detenerTemporizador();
    void this.enviarExamen();
  }

  /**
   * El alumno seleccionó una opción de múltiple.
   * Guarda la respuesta en ExamenActivoService (y en Supabase).
   */
  async onOpcionElegida(opcion: OpcionActiva): Promise<void> {
    await this.servicio.guardarRespuesta(opcion.id, null);
  }

  /**
   * El alumno escribió en la pregunta abierta.
   * Guarda el texto (con debounce ya aplicado en el componente hijo).
   */
  async onTextoAbiertoCambiado(texto: string): Promise<void> {
    await this.servicio.guardarRespuesta(null, texto);
  }

  /** Muestra el modal de confirmación antes de enviar */
  confirmarEnvio(): void {
    this.mostrarConfirmacion.set(true);
  }

  /**
   * Envía el examen, calcula el resultado y navega a la pantalla
   * de resultado del alumno.
   * Si el servicio retorna null (error de red), NO navega y deja al alumno
   * en la pantalla actual — el error queda visible en `servicio.error()`.
   */
  async enviarExamen(): Promise<void> {
    if (this.enviando()) return;

    this.mostrarConfirmacion.set(false);
    this.enviando.set(true);
    // Limpiar error previo antes del reintento
    this.servicio.error.set(null);

    const resultado = await this.servicio.enviarExamen(this.segundosRestantes());

    this.enviando.set(false);

    if (!resultado) {
      // El servicio ya seteó servicio.error() con un mensaje visible.
      // NO restauramos el timer: si el tiempo se agotó, queda en 00:00.
      // Si todavía hay tiempo, el alumno puede reintentar con "Enviar Examen".
      return;
    }

    // Éxito: detener el timer y navegar a resultados
    this.detenerTemporizador();

    // `:codigo` está en el PARENT route (/examen/:codigo), no en la ruta actual
    // (/examen/:codigo/evaluacion). Usamos el código del servicio como fuente
    // principal y el paramMap del padre como fallback.
    const codigo =
      this.servicio.sesion()?.codigo_acceso
      ?? this.route.parent?.snapshot.paramMap.get('codigo');

    this.router.navigate(['/examen', codigo, 'resultado']);
  }
}