// ExamenActivoService lo provee SalaEsperaComponent — ambos comparten la misma
// jerarquía de rutas /examen/:codigo/*, no se debe declarar providers aquí.

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
import { getIniciales } from '../../../../shared/utils/avatar.utils';
import { calcularSegundosRestantes, tiempoAgotado } from '../../../../shared/utils/timer.utils';
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

          <app-temporizador
            [segundosRestantes]="segundosRestantes()"
            (tiempoAgotado)="onTiempoAgotado()"
          />

        </div>
      </header>


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

      <main class="flex-1 flex items-start justify-center px-4 py-8">
        <div class="w-full max-w-2xl space-y-6">

          <app-barra-progreso
            [preguntaActual]="servicio.numeroPreguntaVisible()"
            [totalPreguntas]="servicio.totalPreguntas()"
          />

          <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

            @if (servicio.cargando()) {
              <div class="flex items-center justify-center py-12">
                <svg class="w-7 h-7 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            }

            @else if (servicio.preguntaActual()) {

              @if (servicio.preguntaActual()!.tipo === 'opcion_multiple') {
                <app-pregunta-opcion-multiple
                  [pregunta]="servicio.preguntaActual()!"
                  [opcionSeleccionadaId]="opcionIdActual()"
                  (opcionElegida)="onOpcionElegida($event)"
                />
              }

              @else {
                <app-pregunta-abierta
                  [pregunta]="servicio.preguntaActual()!"
                  [valorActual]="textoAbiertoActual()"
                  (respuestaChange)="onTextoAbiertoCambiado($event)"
                />
              }

            }

          </div>

          <div class="flex items-center justify-between">
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
  readonly servicio = inject(ExamenActivoService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly peerService = inject(PeerService);

  readonly segundosRestantes   = signal(0);
  private intervaloTimer: ReturnType<typeof setInterval> | null = null;

  readonly enviando            = signal(false);
  readonly mostrarConfirmacion = signal(false);

  readonly iniciales = computed(() =>
    getIniciales(this.servicio.alumno()?.nombre_completo ?? '')
  );

  readonly esUltimaPregunta = computed(
    () => this.servicio.indicePreguntaActual() === this.servicio.totalPreguntas() - 1
  );

  readonly opcionIdActual = computed(() => this.servicio.respuestaActual()?.opcion_id ?? null);

  readonly textoAbiertoActual = computed(
    () => this.servicio.respuestaActual()?.respuesta_abierta ?? null
  );

  ngOnInit(): void {
    const sesion = this.servicio.sesion();

    if (!sesion || !this.servicio.sesionAlumnoId()) {
      const codigo = this.route.snapshot.paramMap.get('codigo');
      this.router.navigate(['/examen', codigo]);
      return;
    }

    this.segundosRestantes.set(
      calcularSegundosRestantes(sesion.duracion_min, sesion.iniciada_en),
    );

    this.iniciarTemporizador();
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
    this.peerService.detenerStreamAlumno();
  }

  private iniciarTemporizador(): void {
    this.intervaloTimer = setInterval(() => {
      this.segundosRestantes.update((s) => {
        const siguiente = s - 1;
        if (tiempoAgotado(siguiente)) {
          this.detenerTemporizador();
          return 0;
        }
        return siguiente;
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

  /**
   * Timer agotado → envío automático.
   * Si falla, el timer queda en 00:00 y el alumno puede reintentar.
   */
  onTiempoAgotado(): void {
    this.detenerTemporizador();
    void this.enviarExamen();
  }

  async onOpcionElegida(opcion: OpcionActiva): Promise<void> {
    await this.servicio.guardarRespuesta(opcion.id, null);
  }

  async onTextoAbiertoCambiado(texto: string): Promise<void> {
    await this.servicio.guardarRespuesta(null, texto);
  }

  confirmarEnvio(): void {
    this.mostrarConfirmacion.set(true);
  }

  /**
   * Envía el examen y navega a resultados.
   * Si el servicio retorna null (error de red), NO navega — el error
   * queda visible en servicio.error() y el alumno puede reintentar.
   */
  async enviarExamen(): Promise<void> {
    if (this.enviando()) return;

    this.mostrarConfirmacion.set(false);
    this.enviando.set(true);
    this.servicio.error.set(null);

    const resultado = await this.servicio.enviarExamen(this.segundosRestantes());

    this.enviando.set(false);

    if (!resultado) return; // error seteado en servicio.error(), alumno puede reintentar

    this.detenerTemporizador();

    // :codigo está en el PARENT route (/examen/:codigo/evaluacion)
    const codigo =
      this.servicio.sesion()?.codigo_acceso
      ?? this.route.parent?.snapshot.paramMap.get('codigo');

    this.router.navigate(['/examen', codigo, 'resultado']);
  }
}