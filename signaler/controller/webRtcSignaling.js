import { v4 as uuidv4 } from 'uuid';
// Map of signalerId to WebSocket connection
const clients = new Map();
// Map deviceId to signalerId
const deviceIdToSignalerId = new Map();
export function handleWebRTCSignaling(wss) {
    wss.on('connection', (ws) => {
        // Assign a unique signalerId to the new client
        const signalerId = uuidv4();
        clients.set(signalerId, ws);
        ws.send(JSON.stringify({ type: 'signaler-id', signalerId }));
        console.log(`Client connected: ${signalerId}`);
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                console.log(`Received message: ${JSON.stringify(msg).substring(0, 200)}`);
                // Handle registration messages
                if (msg.type === 'register' && msg.deviceId) {
                    console.log(`Registering device ID ${msg.deviceId} for signaler ID ${signalerId}`);
                    deviceIdToSignalerId.set(msg.deviceId, signalerId);
                    ws.send(JSON.stringify({
                        type: 'register-success',
                        deviceId: msg.deviceId,
                        signalerId
                    }));
                    return;
                }
                // Handle WebRTC signaling messages with targetDeviceId (from client code)
                if (msg.targetDeviceId) {
                    const targetSignalerId = deviceIdToSignalerId.get(msg.targetDeviceId);
                    if (targetSignalerId && clients.has(targetSignalerId)) {
                        // Add source deviceId for the response if needed
                        if (msg.deviceId) {
                            // Message already has a source deviceId
                        }
                        else {
                            // Find deviceId for this signalerId if possible
                            for (const [deviceId, sigId] of deviceIdToSignalerId.entries()) {
                                if (sigId === signalerId) {
                                    msg.deviceId = deviceId;
                                    break;
                                }
                            }
                        }
                        // Relay the message to the intended recipient
                        console.log(`Relaying ${msg.type} message from ${signalerId} to ${targetSignalerId} (device ${msg.targetDeviceId})`);
                        clients.get(targetSignalerId)?.send(JSON.stringify(msg));
                    }
                    else {
                        console.log(`Target device ${msg.targetDeviceId} not found or not connected`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Target device not connected',
                            targetDeviceId: msg.targetDeviceId
                        }));
                    }
                    return;
                }
                // Legacy format with target field (from original code)
                const { type, target, payload } = msg;
                if (target && clients.has(target)) {
                    // Relay the message to the intended recipient
                    clients.get(target)?.send(JSON.stringify({ type, from: signalerId, payload }));
                    console.log(`Relayed ${type} from ${signalerId} to ${target}`);
                }
                else if (target) {
                    // Target specified but not found
                    console.log(`Target ${target} not found`);
                    ws.send(JSON.stringify({ type: 'error', message: 'Target not found' }));
                }
            }
            catch (e) {
                console.error('Failed to process message:', e);
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            }
        });
        ws.on('close', () => {
            // Find and remove any deviceIds associated with this signalerId
            for (const [deviceId, sigId] of deviceIdToSignalerId.entries()) {
                if (sigId === signalerId) {
                    console.log(`Removing device mapping for ${deviceId}`);
                    deviceIdToSignalerId.delete(deviceId);
                }
            }
            // Remove from clients map
            clients.delete(signalerId);
            console.log(`Client disconnected: ${signalerId}`);
        });
    });
}
