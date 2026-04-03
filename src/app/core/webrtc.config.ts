/**
 * Configuración centralizada de WebRTC / ICE servers para PeerJS.
 *
 * FUENTE DE VERDAD ÚNICA para los ICE servers del proyecto.
 * Cualquier cambio de proveedor STUN o incorporación de TURN se hace
 * exclusivamente aquí — el resto del código no necesita tocarse.
 *
 * Estrategia actual: STUN público de Google (sin TURN).
 * Para agregar TURN en el futuro:
 *
 *   { urls: 'turn:tu-servidor.com:3478', username: '...', credential: '...' }
 */

/** Servidores ICE (STUN + futuro TURN) usados en todas las conexiones WebRTC. */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Configuración RTCPeerConnection lista para pasarle a PeerJS como `config`. */
export const WEBRTC_PEER_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
};
