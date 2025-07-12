// WebRTC signaling and peer connection logic for the server
import WebSocket from 'ws';
import wrtc from 'wrtc';
import fs from 'fs';

const SIGNALER_WS_URL = process.env.SIGNALER_WS_URL || 'ws://localhost:8080';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  // Add TURN servers here if needed
];

// Export signalerId so it can be used by index.ts
export let signalerId: string | null = null;
let peerConnection: wrtc.RTCPeerConnection | null = null;
let ws: WebSocket | null = null;
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;

// Connection attempt counter and max retries
let connectionAttempts = 0;
const maxConnectionAttempts = 10;
const initialBackoffDelay = 2000; // 2 seconds

export function startWebRTCSignaling() {
  console.log('Starting WebRTC signaling with initial delay to ensure signaler is ready');
  // Wait 5 seconds before first connection attempt to give signaler time to initialize
  setTimeout(() => {
    if (!isConnecting) {
      connectToSignalerWithBackoff();
    }
  }, 5000);
}

function connectToSignalerWithBackoff() {
  connectionAttempts++;
  console.log(`Connection attempt ${connectionAttempts}/${maxConnectionAttempts}`);
  
  if (connectionAttempts > maxConnectionAttempts) {
    console.error('Max connection attempts reached, giving up');
    return;
  }
  
  // Exponential backoff with 2s initial delay
  const backoffDelay = initialBackoffDelay * Math.pow(1.5, connectionAttempts - 1);
  console.log(`Attempting to connect to signaler in ${backoffDelay}ms`);
  
  reconnectTimer = setTimeout(() => {
    connectToSignalerAndSaveId();
  }, backoffDelay);
}

function connectToSignalerAndSaveId() {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    console.log('Already attempting to connect to signaler, skipping redundant attempt');
    return;
  }
  
  isConnecting = true;
  
  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Close existing connection if any
  if (ws) {
    try {
      ws.removeAllListeners();
      ws.close();
    } catch (e) {
      // Ignore errors on close
    }
    ws = null;
  }

  // Check for existing signalerId from various possible locations
  // This is critical as it links to user accounts
  let existingId: string | null = null;
  
  // Check locations in priority order:
  // 1. disk/device.json (newest format)
  // 2. device.json (older format)
  // 3. disk/signalId.txt (legacy format)
  // 4. signalId.txt (very old format)
  
  const deviceJsonPath = './disk/device.json';
  const legacyDeviceJsonPath = './device.json';
  const signalIdPath = './disk/signalId.txt';
  const legacySignalIdPath = './signalId.txt';
  
  try {
    // Try disk/device.json first (newest)
    if (fs.existsSync(deviceJsonPath)) {
      const deviceData = JSON.parse(fs.readFileSync(deviceJsonPath, 'utf-8'));
      if (deviceData && deviceData.signalerId) {
        existingId = deviceData.signalerId;
        console.log('Loaded signalerId from disk/device.json:', existingId);
      }
    }
    
    // Try legacy device.json next
    if (!existingId && fs.existsSync(legacyDeviceJsonPath)) {
      const deviceData = JSON.parse(fs.readFileSync(legacyDeviceJsonPath, 'utf-8'));
      if (deviceData && deviceData.signalerId) {
        existingId = deviceData.signalerId;
        console.log('Loaded signalerId from legacy device.json:', existingId);
      }
    }
    
    // Try disk/signalId.txt (older format)
    if (!existingId && fs.existsSync(signalIdPath)) {
      existingId = fs.readFileSync(signalIdPath, 'utf-8').trim();
      if (existingId) {
        console.log('Loaded signalerId from disk/signalId.txt:', existingId);
      }
    }
    
    // Try root signalId.txt (very old format)
    if (!existingId && fs.existsSync(legacySignalIdPath)) {
      existingId = fs.readFileSync(legacySignalIdPath, 'utf-8').trim();
      if (existingId) {
        console.log('Loaded signalerId from legacy signalId.txt:', existingId);
      }
    }
    
    // Set the signalerId if we found one
    if (existingId) {
      signalerId = existingId;
      console.log('Using existing signalerId:', signalerId);
      
      // Save to all formats to ensure consistency
      saveDeviceJson(signalerId);
      
      try {
        fs.writeFileSync(signalIdPath, signalerId);
      } catch (e) {
        console.warn('Could not write to disk/signalId.txt (legacy format)');
      }
    }
  } catch (e) {
    console.error('Error loading existing signalerId:', e);
  }

  // Create new connection
  ws = new WebSocket(SIGNALER_WS_URL);

  ws.on('message', async (data) => {
    try {
      console.log('Received message from signaler:', data.toString());
      const msg = JSON.parse(data.toString());
      if (msg.type === 'signaler-id' && msg.signalerId) {
        // If reused flag is true, the signaler is confirming our existing ID
        // so we don't update our ID (the signalerId should match our existing one)
        if (msg.reused) {
          if (msg.signalerId !== signalerId) {
            console.warn(`Signaler sent reused=true but with different ID. Expected=${signalerId}, Got=${msg.signalerId}`);
            // Trust our local ID in this case
          } else {
            console.log('Signaler confirmed reuse of our existing signalerId:', signalerId);
          }
        } 
        // Only update if we don't have an ID yet
        else if (!signalerId) {
          signalerId = msg.signalerId;
          if (signalerId) {
            saveDeviceJson(signalerId);
            fs.writeFileSync(signalIdPath, signalerId); // Save to persistent volume
            console.log('Received and saved new signalerId:', signalerId);
          } else {
            console.error('signalerId is null, cannot save to file');
          }
        }
        // If we have an ID and the signaler is trying to give us a new one,
        // log this but stick with our existing ID
        else {
          console.log(`Ignoring new signalerId from signaler. Keeping our existing ID: ${signalerId}`);
        }
        // TODO: Broadcast over Bluetooth here
      } else if (msg.type === 'get-ice-config') {
        ws?.send(JSON.stringify({
          type: 'ice-config',
          target: msg.from,
          payload: { iceServers: ICE_SERVERS },
        }));
      } else if (msg.type === 'incoming-connection') {
        // Prepare to receive offer from client
        await createPeerConnection(msg.deviceId);
        // Wait for offer from client
      } else if (msg.type === 'offer') {
        await handleOffer(msg);
      } else if (msg.type === 'answer') {
        await handleAnswer(msg);
      } else if (msg.type === 'ice') {
        await handleRemoteIceCandidate(msg);
      }
    } catch (e) {
      console.error('Error parsing message from signaler:', e);
    }
  });

  ws.on('close', () => {
    console.log('Signaler connection closed, reconnecting with backoff...');
    isConnecting = false;
    // Reset connection attempts for reconnect
    connectionAttempts = 0;
    connectToSignalerWithBackoff();
  });

  ws.on('error', (err) => {
    console.error('Signaler connection error:', err);
    // Don't attempt reconnection here - let the close handler do it
  });
  
  ws.on('open', () => {
    console.log('Connected to signaler for device registration');
    isConnecting = false;
    // Reset connection attempts on successful connection
    connectionAttempts = 0;
    
    // If we have an existing ID, send it to the signaler for reuse
    if (signalerId) {
      ws!.send(JSON.stringify({ type: 'register', deviceId: signalerId }));
      console.log('Sent existing deviceId to signaler:', signalerId);
    }
  });
}

async function createPeerConnection(targetDeviceId: string, isCallee = true) {
  if (peerConnection) peerConnection.close();
  peerConnection = new wrtc.RTCPeerConnection({ iceServers: ICE_SERVERS });

  peerConnection.onicecandidate = (event: any) => {
    if (event.candidate && ws) {
      ws.send(
        JSON.stringify({
          type: 'ice',
          targetDeviceId,
          ice: event.candidate,
        })
      );
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Peer connection state:', peerConnection?.connectionState);
  };

  // Server is always the callee - it receives data channels from clients
  // @ts-ignore: ondatachannel exists at runtime
  peerConnection.ondatachannel = (event: any) => {
    const dataChannel = event.channel;
      dataChannel.onopen = () => {
        console.log('Data channel open for WebRTC API');
        // Send a test message on the data channel to verify it's working
        try {
          console.log('Checking if data channel is operational');
          dataChannel.send(JSON.stringify({ 
            type: 'system', 
            message: 'Server data channel ready',
            timestamp: new Date().toISOString()
          }));
        } catch (err) {
          console.error('Error sending test message on data channel:', err);
        }
      };
      dataChannel.onmessage = (e: any) => {
        try {
          const message = JSON.parse(e.data);
          // Use direct import for the WebRTC API handler
          import('./webrtcAPI.js').then(api => {
            api.handleDataChannelMessage(message, dataChannel);
          }).catch(err => {
            console.error('Error importing webrtcAPI:', err, 'Make sure webrtcAPI.js exists in the build output.');
            // Try a fallback to handle basic request/response if the module fails to load
            try {
              if (message.type === 'request' && message.id) {
                console.log('Fallback handling for API request:', message);
                dataChannel.send(JSON.stringify({
                  type: 'response',
                  id: message.id,
                  error: { 
                    message: 'API module not available. Server may need rebuilding.',
                    code: 500
                  }
                }));
              }
            } catch (fallbackErr) {
              console.error('Error in fallback handler:', fallbackErr);
            }
          });
        } catch (err) {
          console.error('Error parsing message from data channel:', err);
          console.log('Original message:', e.data);
        }
      };
    };
}

async function handleOffer(msg: any) {
  await createPeerConnection(msg.deviceId);
  if (!peerConnection) return;
  await peerConnection.setRemoteDescription({ type: 'offer', sdp: msg.offer.sdp });
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  ws?.send(
    JSON.stringify({
      type: 'answer',
      targetDeviceId: msg.deviceId,
      answer,
    })
  );
}

async function handleAnswer(msg: any) {
  if (peerConnection) {
    await peerConnection.setRemoteDescription({ type: 'answer', sdp: msg.answer.sdp });
  }
}

async function handleRemoteIceCandidate(msg: any) {
  if (peerConnection && msg.ice) {
    try {
      await peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(msg.ice));
    } catch (e) {
      console.error('Error adding remote ICE candidate:', e);
    }
  }
}

// Track last saved ID to avoid redundant writes
let lastSavedId: string | null = null;

// Export saveDeviceJson so it can be used by index.ts
export function saveDeviceJson(id: string) {
  // Skip if we've already saved this ID
  if (lastSavedId === id) {
    return;
  }
  
  lastSavedId = id;
  
  const deviceInfo = {
    signalerId: id,
    createdAt: new Date().toISOString(),
    // Add more device metadata here if needed
  };
  
  try {
    fs.writeFileSync('./disk/device.json', JSON.stringify(deviceInfo, null, 2));
    console.log('Saved device.json:', deviceInfo);
  } catch (e) {
    console.error('Error saving device.json:', e);
  }
}
