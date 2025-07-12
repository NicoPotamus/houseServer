import { WebSocketServer } from 'ws';
import { handleWebRTCSignaling } from '../controller/webRtcSignaling.js';
export function setupWebSocketServer(server) {
    // WebSocket server using the HTTP server
    const wss = new WebSocketServer({ server });
    // Use the webRtcSignaling controller for all WebRTC signaling
    handleWebRTCSignaling(wss);
    return wss;
}
