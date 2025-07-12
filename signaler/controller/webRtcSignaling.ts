// WebRTC signaling controller for the signaler service
// Handles client registration, signalerId assignment, and relaying signaling messages
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { setStatusProvider } from '../routes/status.js';

// Map of signalerId to WebSocket connection
const clients: Map<string, WebSocket> = new Map();
// Map deviceId to signalerId
const deviceIdToSignalerId: Map<string, string> = new Map();
// Track handshake progress between device pairs
const handshakeProgress: Map<string, { offer: boolean; answer: boolean; iceStarted: boolean }> = new Map();

// Provide status information to the status routes
setStatusProvider(() => ({
  clients: clients.size,
  devices: Object.fromEntries(deviceIdToSignalerId),
  handshakes: Object.fromEntries(handshakeProgress)
}));

export function handleWebRTCSignaling(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    // Assign a unique signalerId to the new client
    const signalerId = uuidv4();
    clients.set(signalerId, ws);
    ws.send(JSON.stringify({ type: 'signaler-id', signalerId }));
    console.log(`🔌 NEW CLIENT CONNECTED: Signaler ID ${signalerId}`);
    console.log(`   Total connected clients: ${clients.size}`)

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`Received message: ${JSON.stringify(msg).substring(0, 200)}`);
        
        // Handle registration messages
        if (msg.type === 'register' && msg.deviceId) {
          console.log(`📝 DEVICE REGISTRATION: Device ID "${msg.deviceId}" → Signaler ID "${signalerId}"`);
          deviceIdToSignalerId.set(msg.deviceId, signalerId);
          console.log(`   Registered devices: ${Array.from(deviceIdToSignalerId.keys()).join(', ')}`);
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
            // Find source deviceId for this signalerId
            let sourceDeviceId = msg.deviceId;
            if (!sourceDeviceId) {
              for (const [deviceId, sigId] of deviceIdToSignalerId.entries()) {
                if (sigId === signalerId) {
                  sourceDeviceId = deviceId;
                  msg.deviceId = deviceId;
                  break;
                }
              }
            }
            
            // Enhanced logging for connection tracking
            console.log(`🔄 RELAYING ${msg.type.toUpperCase()}: ${sourceDeviceId || signalerId} → ${msg.targetDeviceId}`);
            console.log(`   Source Device: ${sourceDeviceId || 'unknown'} (signaler: ${signalerId})`);
            console.log(`   Target Device: ${msg.targetDeviceId} (signaler: ${targetSignalerId})`);
            
            // Track handshake progress using a sorted pair key
            const devicePair = [sourceDeviceId, msg.targetDeviceId].sort().join('↔');
            if (!handshakeProgress.has(devicePair)) {
              handshakeProgress.set(devicePair, { offer: false, answer: false, iceStarted: false });
            }
            const progress = handshakeProgress.get(devicePair)!;
            
            // Track handshake progress
            if (msg.type === 'offer') {
              progress.offer = true;
              console.log(`📡 HANDSHAKE INITIATED: Device "${sourceDeviceId}" sending WebRTC offer to device "${msg.targetDeviceId}"`);
              console.log(`   Connection pair: ${devicePair}`);
            } else if (msg.type === 'answer') {
              progress.answer = true;
              console.log(`✅ HANDSHAKE PROGRESSING: Device "${sourceDeviceId}" sending WebRTC answer to device "${msg.targetDeviceId}"`);
              console.log(`   Connection pair: ${devicePair}`);
              
              if (progress.offer) {
                console.log(`🎯 HANDSHAKE PHASE COMPLETE: Offer/Answer exchange finished for ${devicePair}`);
                console.log(`   → Next: ICE candidate exchange (signaler will relay ICE until WebRTC takes over)`);
              }
            } else if (msg.type === 'ice') {
              if (!progress.iceStarted) {
                progress.iceStarted = true;
                console.log(`🧊 ICE EXCHANGE STARTED: Device "${sourceDeviceId}" ↔ Device "${msg.targetDeviceId}"`);
                console.log(`   Connection pair: ${devicePair}`);
              }
              
              if (progress.offer && progress.answer) {
                console.log(`🎯 HANDSHAKE TRANSITIONING: ICE negotiation in progress for ${devicePair}`);
                console.log(`   → Signaler role: Relay only (WebRTC layer taking control)`);
                console.log(`   → Once ICE completes, devices will communicate directly via WebRTC data channel`);
              }
            }
            
            // Relay the message to the intended recipient
            clients.get(targetSignalerId)?.send(JSON.stringify(msg));
          } else {
            console.log(`❌ TARGET NOT FOUND: Device ${msg.targetDeviceId} not found or not connected`);
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
          clients.get(target)?.send(
            JSON.stringify({ type, from: signalerId, payload })
          );
          console.log(`Relayed ${type} from ${signalerId} to ${target}`);
        } else if (target) {
          // Target specified but not found
          console.log(`Target ${target} not found`);
          ws.send(JSON.stringify({ type: 'error', message: 'Target not found' }));
        }
      } catch (e) {
        console.error('Failed to process message:', e);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      // Find and remove any deviceIds associated with this signalerId
      let disconnectedDeviceId = null;
      for (const [deviceId, sigId] of deviceIdToSignalerId.entries()) {
        if (sigId === signalerId) {
          console.log(`🔌 DEVICE DISCONNECTED: Device "${deviceId}" (signaler: ${signalerId})`);
          disconnectedDeviceId = deviceId;
          deviceIdToSignalerId.delete(deviceId);
          
          // Clean up any handshake progress involving this device
          const keysToRemove: string[] = [];
          for (const [pairKey, progress] of handshakeProgress.entries()) {
            if (pairKey.includes(deviceId)) {
              console.log(`🧹 CLEANING UP HANDSHAKE: ${pairKey} (device "${deviceId}" disconnected)`);
              keysToRemove.push(pairKey);
            }
          }
          keysToRemove.forEach(key => handshakeProgress.delete(key));
        }
      }
      
      // Remove from clients map
      clients.delete(signalerId);
      console.log(`❌ CLIENT DISCONNECTED: Signaler ID ${signalerId}`);
      console.log(`   Device: ${disconnectedDeviceId || 'unknown'}`);
      console.log(`   Remaining connected clients: ${clients.size}`);
      console.log(`   Remaining registered devices: ${Array.from(deviceIdToSignalerId.keys()).join(', ') || 'none'}`);
      console.log(`   Active handshakes: ${handshakeProgress.size}`);
    });
  });
}
