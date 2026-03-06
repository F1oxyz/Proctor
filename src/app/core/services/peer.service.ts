import { Injectable, signal } from '@angular/core';

type PeerInstance    = import('peerjs').Peer;
type MediaConnection = import('peerjs').MediaConnection;

/** Stream recibido de un alumno (lado docente) */
export interface StreamAlumno {
  peerId:   string;
  alumnoId: string;
  stream:   MediaStream;
  conexion: MediaConnection;
}

@Injectable({ providedIn: 'root' })
export class PeerService {

  // ── Instancia PeerJS ─────────────────────────────────────────────
  private peer: PeerInstance | null = null;

  // ── Signals públicos ─────────────────────────────────────────────

  /** Mapa alumnoId → stream (actualizado por Realtime de PeerJS) */
  readonly streamsPorAlumno = signal<Map<string, StreamAlumno>>(new Map());
  readonly miPeerId         = signal<string | null>(null);
  readonly inicializando    = signal(false);
  readonly listo            = signal(false);
  readonly error            = signal<string | null>(null);

  // ── Estado privado ───────────────────────────────────────────────

  /** Stream del alumno, guardado para detenerlo al finalizar el examen */
  private _streamAlumno: MediaStream | null = null;

  /** Reintentos cuando el ID del receptor (docente) ya está ocupado */
  private _retryCount   = 0;
  private _retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly _MAX_RETRIES = 4;

  /** Reintentos cuando el peer del docente aún no está disponible */
  private _reconexionTimer:   ReturnType<typeof setTimeout> | null = null;
  private _reconexionIntento  = 0;
  private readonly _MAX_RECONEXION = 5;

  // ── MODO DOCENTE: receptor ───────────────────────────────────────

  async inicializarComoReceptor(sesionId: string): Promise<void> {
    if (this._retryCount === 0) this.destruir();

    this.inicializando.set(true);
    this.error.set(null);

    try {
      const { Peer } = await import('peerjs');
      const peerId   = `proctor-${sesionId.slice(0, 8)}`;

      this.peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.miPeerId.set(id);
        this.inicializando.set(false);
        this.listo.set(true);
        this._retryCount = 0;
        console.log(`[PeerService] Receptor listo: ${id}`);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          this.peer?.destroy();
          this.peer = null;
          if (this._retryCount < this._MAX_RETRIES) {
            this._retryCount++;
            const delay = this._retryCount * 2000;
            this._retryTimeout = setTimeout(
              () => void this.inicializarComoReceptor(sesionId),
              delay
            );
          } else {
            this.error.set('No se pudo reservar el canal de pantallas. Recarga la página.');
            this.inicializando.set(false);
          }
        } else {
          this.error.set(`Error WebRTC: ${err.message}`);
          this.inicializando.set(false);
          console.error('[PeerService] Error receptor:', err);
        }
      });

      this.peer.on('call', (llamada: MediaConnection) => {
        this._recibirLlamada(llamada);
      });

      this.peer.on('disconnected', () => {
        console.warn('[PeerService] Desconectado. Reconectando...');
        this.peer?.reconnect();
      });

    } catch (err) {
      this.error.set('No se pudo inicializar la transmisión de pantalla.');
      this.inicializando.set(false);
      console.error('[PeerService] inicializarComoReceptor:', err);
    }
  }

  private _recibirLlamada(llamada: MediaConnection): void {
    llamada.answer(); // docente responde sin enviar stream

    llamada.on('stream', (streamRemoto: MediaStream) => {
      const alumnoId = llamada.metadata?.alumnoId ?? llamada.peer;
      this.streamsPorAlumno.update((mapa) => {
        const nuevo = new Map(mapa);
        nuevo.set(alumnoId, { peerId: llamada.peer, alumnoId, stream: streamRemoto, conexion: llamada });
        return nuevo;
      });
      console.log(`[PeerService] Stream recibido de: ${alumnoId}`);
    });

    llamada.on('close', () => {
      const alumnoId = llamada.metadata?.alumnoId ?? llamada.peer;
      this.streamsPorAlumno.update((mapa) => {
        const nuevo = new Map(mapa);
        nuevo.delete(alumnoId);
        return nuevo;
      });
    });

    llamada.on('error', (err) => console.error('[PeerService] Error en llamada:', err));
  }

  // ── MODO ALUMNO: emisor ──────────────────────────────────────────

  async conectarAlDocente(
    stream:    MediaStream,
    alumnoId:  string,
    sesionId:  string,
  ): Promise<string | null> {
    this._streamAlumno      = stream;
    this._reconexionIntento = 0;

    try {
      const { Peer }     = await import('peerjs');
      const peerIdAlumno = `alumno-${alumnoId.slice(0, 8)}-${Date.now()}`;
      const peerIdDocente = `proctor-${sesionId.slice(0, 8)}`;

      this.peer = new Peer(peerIdAlumno, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      return new Promise<string | null>((resolve) => {

        this.peer!.on('open', (idGenerado) => {
          this.miPeerId.set(idGenerado);
          this._llamarAlDocente(peerIdDocente, stream, alumnoId);
          console.log(`[PeerService] Alumno ${idGenerado} → ${peerIdDocente}`);
          resolve(idGenerado);
        });

        // IMPORTANTE: peer-unavailable llega aquí, NO en llamada.on('error').
        // El error de señalización siempre va al objeto Peer, no a la MediaConnection.
        this.peer!.on('error', (err: any) => {
          if (err.type === 'peer-unavailable') {
            // El monitor del docente aún no está abierto → reintentar
            if (this._reconexionIntento < this._MAX_RECONEXION && this.peer) {
              this._reconexionIntento++;
              const delay = this._reconexionIntento * 3000; // 3s, 6s, 9s, 12s, 15s
              console.warn(
                `[PeerService] Docente no disponible. Reintento ${this._reconexionIntento}/${this._MAX_RECONEXION} en ${delay / 1000}s`
              );
              if (this._reconexionTimer) clearTimeout(this._reconexionTimer);
              this._reconexionTimer = setTimeout(() => {
                this._llamarAlDocente(peerIdDocente, stream, alumnoId);
              }, delay);
            }
            // No llamar resolve(null): el peer sigue vivo y puede reintentar
          } else {
            console.error('[PeerService] Error peer alumno:', err);
            resolve(null);
          }
        });

      });

    } catch (err) {
      console.error('[PeerService] conectarAlDocente:', err);
      return null;
    }
  }

  /** Realiza una llamada WebRTC al peer del docente */
  private _llamarAlDocente(
    peerIdDocente: string,
    stream:        MediaStream,
    alumnoId:      string,
  ): void {
    if (!this.peer) return;

    const llamada = this.peer.call(peerIdDocente, stream, { metadata: { alumnoId } });
    if (!llamada) {
      console.error('[PeerService] peer.call() retornó null.');
      return;
    }

    // { once: true } evita acumular listeners en cada reintento
    stream.getVideoTracks()[0]?.addEventListener('ended', () => llamada.close(), { once: true });
    console.log(`[PeerService] Llamando a ${peerIdDocente} (intento ${this._reconexionIntento + 1})`);
  }

  // ── Limpieza ─────────────────────────────────────────────────────

  /** Detiene stream del alumno y cierra su peer. Llamar en ExamenComponent.ngOnDestroy(). */
  detenerStreamAlumno(): void {
    if (this._reconexionTimer) {
      clearTimeout(this._reconexionTimer);
      this._reconexionTimer = null;
    }
    this._reconexionIntento = 0;

    this._streamAlumno?.getTracks().forEach((t) => t.stop());
    this._streamAlumno = null;

    this.peer?.destroy();
    this.peer = null;
    this.miPeerId.set(null);
    this.listo.set(false);
  }

  /** Destruye el peer del docente. Llamar en MonitorComponent.ngOnDestroy(). */
  destruir(): void {
    if (this._retryTimeout != null) {
      clearTimeout(this._retryTimeout);
      this._retryTimeout = null;
    }
    this._retryCount = 0;

    if (this.peer) {
      this.streamsPorAlumno().forEach((e) => {
        e.conexion.close();
        e.stream.getTracks().forEach((t) => t.stop());
      });
      this.peer.destroy();
      this.peer = null;
    }

    this.streamsPorAlumno.set(new Map());
    this.miPeerId.set(null);
    this.listo.set(false);
    this.inicializando.set(false);
    this.error.set(null);
  }
}
