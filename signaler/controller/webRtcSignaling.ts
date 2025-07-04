// WebRTC signaling controller for the signaler service
// Handles client registration, signalerId assignment, and relaying signaling messages
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

// Map of signalerId to WebSocket connection
const clients: Map<string, WebSocket> = new Map();

export function handleWebRTCSignaling(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    // Assign a unique signalerId to the new client
    const signalerId = uuidv4();
    clients.set(signalerId, ws);
    ws.send(JSON.stringify({ type: 'signaler-id', signalerId }));
    console.log(`Client connected: ${signalerId}`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Expect messages to have a 'target' field for the recipient's signalerId
        const { type, target, payload } = msg;
        if (target && clients.has(target)) {
          // Relay the message to the intended recipient
          clients.get(target)?.send(
            JSON.stringify({ type, from: signalerId, payload })
          );
          console.log(`Relayed ${type} from ${signalerId} to ${target}`);
        } else {
          // Optionally handle broadcast or error
          ws.send(JSON.stringify({ type: 'error', message: 'Target not found' }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      clients.delete(signalerId);
      console.log(`Client disconnected: ${signalerId}`);
    });
  });
}
