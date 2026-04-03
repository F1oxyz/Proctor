/**
 * video.utils.ts
 * ─────────────────────────────────────────────────────────────────
 * Helpers para reproducción de streams WebRTC en elementos <video>.
 *
 * Centraliza la lógica de:
 *  - Asignación de srcObject
 *  - Llamada a play() con manejo de errores cross-browser
 *  - AbortError: esperado cuando el stream se detiene antes de play()
 *  - NotAllowedError: autoplay bloqueado por política del navegador
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Asigna un MediaStream a un elemento <video> y lo reproduce.
 *
 * @param el - El elemento HTMLVideoElement al que asignar el stream
 * @param stream - El MediaStream a reproducir, o null para detener
 * @param context - Etiqueta de contexto para los logs (ej: '[AlumnoTile]')
 */
export function playStream(
  el: HTMLVideoElement,
  stream: MediaStream | null,
  context = '[Video]',
): void {
  el.srcObject = stream;

  if (!stream) return;

  el.play().catch((err: unknown) => {
    const domErr = err as DOMException;

    if (domErr?.name === 'AbortError') {
      // Esperado: el stream se detuvo antes de que play() resolviera
      console.info(`${context} play() abortado (stream detenido antes de iniciar):`, domErr.message);
    } else if (domErr?.name === 'NotAllowedError') {
      // Autoplay bloqueado por política del navegador — no es fatal,
      // el video se reproducirá cuando el usuario interactúe con la página
      console.warn(`${context} Autoplay bloqueado por el navegador (NotAllowedError). El video se reproducirá tras interacción del usuario.`);
    } else {
      console.error(`${context} Error inesperado en video.play():`, domErr?.name ?? err);
    }
  });
}
