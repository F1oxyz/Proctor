/**
 * screen-share-prompt.component.ts
 * ─────────────────────────────────────────────────────────────────
 * Componente que solicita el permiso de pantalla compartida
 * mediante la API nativa del navegador (getDisplayMedia).
 *
 * FLUJO:
 *  1. El alumno presiona "Compartir Pantalla para Iniciar"
 *  2. El navegador muestra el diálogo nativo de selección de pantalla
 *  3. Si acepta → emite `pantallaCompartida` con el MediaStream
 *  4. Si rechaza / error → muestra mensaje de error inline
 *
 * INTEGRACIÓN CON PEERJS (Paso 5):
 *  - Este componente solo captura el stream local.
 *  - PeerService (Paso 5) recibirá ese stream para transmitirlo
 *    al monitor del docente via WebRTC.
 *  - Por ahora, el stream se pasa al padre (SalaEsperaComponent)
 *    que lo almacena hasta que PeerService esté disponible.
 *
 * ARQUITECTURA:
 *  - Componente dumb: no inyecta servicios de negocio
 *  - Recibe `nombreAlumno` y `compartiendo` como inputs
 *  - Emite `pantallaCompartida` con el MediaStream obtenido
 *  - Emite `pantallaCancelada` si el usuario rechaza el permiso
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-screen-share-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">

      <!-- Mensaje de error si el usuario rechazó el permiso -->
      @if (errorMensaje()) {
        <div
          class="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
        >
          <!-- Icono advertencia -->
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p class="text-sm font-medium text-red-700">Permiso requerido</p>
            <p class="text-xs text-red-600 mt-0.5">{{ errorMensaje() }}</p>
          </div>
        </div>
      }

      <!-- Estado: pantalla ya compartida -->
      @if (compartiendo()) {
        <div class="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <!-- Punto verde parpadeante -->
          <span class="relative flex h-3 w-3 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <p class="text-sm font-medium text-green-700">
            Pantalla compartida activa. Puedes iniciar el examen.
          </p>
        </div>
      }

      <!-- Botón principal de compartir pantalla -->
      <button
        type="button"
        (click)="solicitarPantalla()"
        [disabled]="solicitando() || compartiendo()"
        class="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-semibold text-white rounded-xl transition-colors"
        [class.bg-slate-800]="!compartiendo()"
        [class.hover:bg-slate-700]="!compartiendo()"
        [class.bg-brand]="compartiendo()"
        [class.cursor-not-allowed]="compartiendo()"
        [class.opacity-80]="compartiendo()"
        [attr.aria-busy]="solicitando()"
        aria-label="Compartir pantalla para iniciar el examen"
      >
        @if (solicitando()) {
          <!-- Spinner mientras espera respuesta del navegador -->
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Esperando permiso...
        } @else if (compartiendo()) {
          <!-- Icono check -->
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Pantalla Compartida
        } @else {
          <!-- Icono monitor -->
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Compartir Pantalla para Iniciar
        }
      </button>

      <!-- Nota de privacidad -->
      <p class="text-center text-xs text-slate-400">
        Este paso es obligatorio para verificar la integridad del examen.
      </p>

    </div>
  `,
})
export class ScreenSharePromptComponent {
  // ── Inputs ───────────────────────────────────────────────────────

  /** true si ya está compartiendo pantalla */
  compartiendo = input(false);

  // ── Outputs ──────────────────────────────────────────────────────

  /** Emite el MediaStream cuando el alumno acepta compartir pantalla */
  pantallaCompartida = output<MediaStream>();

  /** Emite void cuando el alumno cancela o rechaza el permiso */
  pantallaCancelada = output<void>();

  // ── Estado local ─────────────────────────────────────────────────

  /** true mientras se espera respuesta del diálogo nativo del navegador */
  readonly solicitando = signal(false);

  /** Mensaje de error si el permiso fue denegado */
  readonly errorMensaje = signal<string | null>(null);

  // ── Métodos ───────────────────────────────────────────────────────

  /**
   * Llama a la API nativa getDisplayMedia para solicitar el permiso
   * de compartir pantalla. Si el usuario acepta, emite el stream.
   * Si rechaza o el navegador no lo soporta, muestra un error.
   */
  async solicitarPantalla(): Promise<void> {
    this.solicitando.set(true);
    this.errorMensaje.set(null);

    // Verificar soporte del navegador con detección específica de plataforma
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const esSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      if (esIOS) {
        this.errorMensaje.set(
          'iOS no soporta compartir pantalla desde el navegador. ' +
          'Usá Safari en una Mac o Chrome/Edge en una computadora.'
        );
      } else if (esSafari) {
        this.errorMensaje.set(
          'Safari no soporta compartir pantalla en esta versión. ' +
          'Actualizá a Safari 13+ o usá Chrome/Edge.'
        );
      } else {
        this.errorMensaje.set(
          'Tu navegador no soporta compartir pantalla. Usá Chrome, Edge o Firefox.'
        );
      }
      this.solicitando.set(false);
      this.pantallaCancelada.emit();
      return;
    }

    try {
      // Solicitar pantalla completa con calidad reducida (RNF-01)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 5, max: 10 },   // bajo FPS para no saturar red
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // no necesitamos audio
      });

      // Registrar 'ended' en TODOS los video tracks, no solo el primero
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          this.pantallaCancelada.emit();
        }, { once: true });
      });

      this.pantallaCompartida.emit(stream);

    } catch (error: unknown) {
      const err = error as DOMException;
      console.error('[ScreenSharePrompt] getDisplayMedia error:', err);

      switch (err?.name) {
        case 'NotAllowedError':
          // Usuario canceló el diálogo o denegó el permiso explícitamente
          this.errorMensaje.set(
            'Debés aceptar compartir tu pantalla para continuar con el examen.'
          );
          break;

        case 'NotFoundError':
          // No hay pantallas disponibles para compartir
          this.errorMensaje.set(
            'No se encontró ninguna pantalla disponible para compartir. ' +
            'Verificá que tengas al menos un monitor conectado.'
          );
          break;

        case 'NotSupportedError':
          // Contexto inseguro (no-HTTPS) o funcionalidad no soportada
          this.errorMensaje.set(
            'Tu navegador o contexto de red no permite compartir pantalla. ' +
            'Asegurate de estar en una conexión segura (HTTPS).'
          );
          break;

        case 'InvalidStateError':
          // El stream ya fue cerrado o el estado interno es inválido
          this.errorMensaje.set(
            'Hubo un problema interno con la compartición de pantalla. ' +
            'Recargá la página e intentá de nuevo.'
          );
          break;

        default:
          this.errorMensaje.set(
            'No se pudo iniciar la compartición de pantalla. Intentá de nuevo.'
          );
      }

      this.pantallaCancelada.emit();
    }

    this.solicitando.set(false);
  }
}