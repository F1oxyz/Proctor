// =============================================================
// core/services/peer.service.ts
//
// Servicio singleton de WebRTC usando PeerJS.
// Gestiona la conexión P2P para la transmisión de pantalla.
//
// Flujo DOCENTE (MonitorComponent):
//   1. inicializarComoReceptor() → crea Peer con ID basado en sesionId
//   2. escucharLlamadas() → cuando un alumno llama, acepta y agrega
//      el MediaStream al mapa streamsAlumnos
//   3. El MonitorComponent muestra cada stream en un <video> element
//
// Flujo ALUMNO (SalaEsperaComponent):
//   1. inicializarComoEmisor() → crea Peer con ID aleatorio
//   2. compartirPantalla() → solicita getDisplayMedia al navegador
//   3. llamarADocente(peerId) → envía el stream al Peer del docente
//   4. Guarda su peer_id en la tabla sesion_alumnos para que el docente
//      sepa a qué Peer conectarse
//
// IMPORTANTE:
//   - PeerJS usa un servidor público de señalización (peerjs.com).
//     Para producción se recomienda un servidor propio, pero para
//     este proyecto el público es suficiente.
//   - Los streams NO se graban ni almacenan (RNF-02).
//   - Se instala con: npm install peerjs
// =============================================================

import { Injectable, signal } from '@angular/core';

// Tipos de PeerJS (instalados con: npm install peerjs)
// Si TypeScript no resuelve el tipo, agregar: /// <reference types="peerjs" />
type PeerInstance = any;
type MediaConnection = any;

/** Mapa de peer_id del alumno → MediaStream de su pantalla */
export type StreamMap = Map<string, MediaStream>;

@Injectable({ providedIn: 'root' })
export class PeerService {
  // ── Estado reactivo ────────────────────────────────────

  /** Mapa reactivo de streams recibidos: alumnoId → MediaStream */
  readonly streams = signal<StreamMap>(new Map());

  /** El MediaStream local del alumno (su pantalla compartida) */
  readonly streamLocal = signal<MediaStream | null>(null);

  /** Peer ID asignado al cliente actual */
  readonly peerId = signal<string>('');

  /** Indica si PeerJS está inicializado y conectado al servidor */
  readonly conectado = signal(false);

  /** Error de PeerJS (null si no hay error) */
  readonly errorPeer = signal<string | null>(null);

  /** Instancia de Peer de PeerJS */
  private _peer: PeerInstance = null;

  // ── Métodos del DOCENTE ────────────────────────────────

  /**
   * Inicializa el Peer del docente como receptor de pantallas.
   * Usa un ID predecible basado en el sesionId para que los alumnos
   * puedan llamar directamente a este Peer.
   *
   * @param sesionId - UUID de la sesión activa (se usa para generar el Peer ID)
   */
  async inicializarComoReceptor(sesionId: string): Promise<void> {
    // Importar PeerJS dinámicamente (es una librería de browser)
    const { Peer } = await import('peerjs');

    // El ID del docente es "proctor-" + primeros 8 caracteres del sesionId
    // Esto permite que los alumnos conozcan el Peer ID sin coordinación extra
    const peerId = `proctor-${sesionId.substring(0, 8)}`;

    return new Promise((resolve, reject) => {
      this._peer = new Peer(peerId, {
        // Usar el servidor público de PeerJS para señalización
        // Para producción: reemplazar con servidor propio
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this._peer.on('open', (id: string) => {
        this.peerId.set(id);
        this.conectado.set(true);
        console.log('[PeerService] Receptor inicializado con ID:', id);
        resolve();
      });

      this._peer.on('error', (err: any) => {
        this.errorPeer.set(`Error de conexión P2P: ${err.type}`);
        console.error('[PeerService] Error:', err);
        reject(err);
      });
    });
  }

  /**
   * Escucha llamadas entrantes de alumnos.
   * Cuando un alumno llama, acepta la conexión y agrega su stream
   * al mapa streams con su peer_id como clave.
   *
   * Debe llamarse después de inicializarComoReceptor().
   */
  escucharLlamadas(): void {
    if (!this._peer) {
      console.warn('[PeerService] Peer no inicializado. Llama inicializarComoReceptor primero.');
      return;
    }

    this._peer.on('call', (llamada: MediaConnection) => {
      console.log('[PeerService] Llamada entrante de:', llamada.peer);

      // Aceptar la llamada sin enviar stream (el docente solo recibe)
      llamada.answer();

      llamada.on('stream', (remoteStream: MediaStream) => {
        // Agregar stream al mapa reactivo
        this.streams.update((mapa) => {
          const nuevo = new Map(mapa);
          nuevo.set(llamada.peer, remoteStream);
          return nuevo;
        });
        console.log('[PeerService] Stream recibido de:', llamada.peer);
      });

      llamada.on('close', () => {
        // Remover stream cuando el alumno corta la conexión
        this.streams.update((mapa) => {
          const nuevo = new Map(mapa);
          nuevo.delete(llamada.peer);
          return nuevo;
        });
        console.log('[PeerService] Conexión cerrada de:', llamada.peer);
      });

      llamada.on('error', (err: any) => {
        console.error('[PeerService] Error en llamada de', llamada.peer, err);
      });
    });
  }

  // ── Métodos del ALUMNO ─────────────────────────────────

  /**
   * Inicializa el Peer del alumno con un ID aleatorio.
   * PeerJS genera el ID si no se especifica.
   * El ID se guardará en sesion_alumnos.peer_id para que el docente
   * pueda identificar de quién es cada stream.
   */
  async inicializarComoEmisor(): Promise<string> {
    const { Peer } = await import('peerjs');

    return new Promise((resolve, reject) => {
      this._peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this._peer.on('open', (id: string) => {
        this.peerId.set(id);
        this.conectado.set(true);
        console.log('[PeerService] Emisor inicializado con ID:', id);
        resolve(id);
      });

      this._peer.on('error', (err: any) => {
        this.errorPeer.set(`Error de conexión P2P: ${err.type}`);
        reject(err);
      });
    });
  }

  /**
   * Solicita al navegador acceso a la pantalla del usuario.
   * Si el usuario acepta, guarda el stream y lo retorna.
   * Si rechaza, lanza un error.
   *
   * Requiere que el navegador soporte getDisplayMedia (Chrome, Firefox, Edge).
   */
  async compartirPantalla(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // Calidad estándar para no saturar la red del docente (RNF-01)
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 15, max: 30 },
        },
        audio: false, // No se comparte audio
      });

      this.streamLocal.set(stream);

      // Escuchar cuando el usuario detiene el compartir desde el browser
      stream.getVideoTracks()[0].onended = () => {
        this.streamLocal.set(null);
        console.log('[PeerService] El alumno detuvo el compartir de pantalla.');
      };

      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Debes permitir el acceso a tu pantalla para continuar.');
      }
      throw new Error('No se pudo iniciar el compartir de pantalla.');
    }
  }

  /**
   * Llama al Peer del docente enviando el stream de la pantalla.
   * Debe llamarse después de compartirPantalla() e inicializarComoEmisor().
   *
   * @param peerIdDocente - Peer ID del docente receptor
   * @param stream - MediaStream de la pantalla a compartir
   */
  llamarADocente(peerIdDocente: string, stream: MediaStream): void {
    if (!this._peer) {
      console.warn('[PeerService] Peer no inicializado.');
      return;
    }

    const llamada = this._peer.call(peerIdDocente, stream);

    llamada.on('error', (err: any) => {
      console.error('[PeerService] Error al llamar al docente:', err);
      this.errorPeer.set('No se pudo conectar con el monitor del docente.');
    });

    console.log('[PeerService] Llamada iniciada a docente:', peerIdDocente);
  }

  // ── Limpieza ───────────────────────────────────────────

  /**
   * Destruye el Peer, cierra todas las conexiones y limpia el estado.
   * Debe llamarse al navegar fuera de las rutas de examen/monitor.
   */
  destruir(): void {
    // Detener stream local si existe
    const stream = this.streamLocal();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.streamLocal.set(null);
    }

    // Destruir Peer
    if (this._peer) {
      this._peer.destroy();
      this._peer = null;
    }

    // Limpiar estado
    this.streams.set(new Map());
    this.peerId.set('');
    this.conectado.set(false);
    this.errorPeer.set(null);

    console.log('[PeerService] Peer destruido y estado limpiado.');
  }
}