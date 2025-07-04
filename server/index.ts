import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { listFiles, uploadFile, deleteItem, viewFile } from './controller/diskController.js';
import { getImageThumbnail, getVideoPreview } from './controller/thumbnailGenerator.js';
import multer from 'multer';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';
import fs from 'fs';
import wrtc from 'wrtc';
import { startWebRTCSignaling } from './controller/webrtcController.js';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
// Set up multer for file uploads
const upload = multer({ dest: path.join(process.cwd(), 'server', 'disk', 'temp') });

// Remove conflicting manual CORS header
app.use((req, res, next) => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Configure CORS
const corsOptions = {
    origin: 'http://localhost:8081', // Explicitly allow React app's origin
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Enable pre-flight for all routes
app.options('*', cors(corsOptions));

// User routes

// File routes
app.get('/files/view/:filePath(*)', viewFile);
app.delete('/files/delete/:filePath(*)', deleteItem);   // Allow any path character including slashes
app.post('/files/:folderPath?', upload.single('file'), uploadFile);
app.get('/files/:filePath/image-preview', getImageThumbnail);
app.get('/files/:filePath/video-preview', getVideoPreview);
app.get('/files/:folderPath?', listFiles);


// --- WebSocket client to connect to signaler and get signalerId ---
const SIGNALER_WS_URL = process.env.SIGNALER_WS_URL || 'ws://signaler:8080';
let signalerId: string | null = null;
let peerConnection: wrtc.RTCPeerConnection | null = null;
let ws: WebSocket | null = null;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  // Add TURN servers here if needed
];

function connectToSignalerAndSaveId() {
  ws = new WebSocket(SIGNALER_WS_URL);

  ws.on('open', () => {
    console.log('Connected to signaler for device registration');
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'signaler-id' && msg.signalerId) {
        signalerId = msg.signalerId;
        if (signalerId) {
          saveDeviceJson(signalerId);
        }
        if (signalerId) {
          fs.writeFileSync('/usr/src/app/signalId.txt', signalerId); // Save to file (legacy)
        } else {
          console.error('signalerId is null, cannot save to file');
        }
        console.log('Received and saved signalerId:', signalerId);
        // TODO: Broadcast over Bluetooth here
      } else if (msg.type === 'get-ice-config') {
        // Respond to signaler with ICE config
        ws?.send(JSON.stringify({
          type: 'ice-config',
          target: msg.from,
          payload: { iceServers: ICE_SERVERS },
        }));
      } else if (msg.type === 'offer') {
        // Received offer from client, create peer connection and respond
        await handleOffer(msg);
      } else if (msg.type === 'answer') {
        // Received answer from client
        await handleAnswer(msg);
      } else if (msg.type === 'ice-candidate') {
        // Received ICE candidate from client
        await handleRemoteIceCandidate(msg);
      }
    } catch (e) {
      console.error('Error parsing message from signaler:', e);
    }
  });

  ws.on('close', () => {
    console.log('Signaler connection closed, retrying in 5s...');
    setTimeout(connectToSignalerAndSaveId, 5000);
  });

  ws.on('error', (err) => {
    console.error('Signaler connection error:', err);
  });
}

async function handleOffer(msg: any) {
  if (peerConnection) {
    peerConnection.close();
  }
  peerConnection = new wrtc.RTCPeerConnection({ iceServers: ICE_SERVERS });

  peerConnection.onicecandidate = (event: any) => {
    if (event.candidate && ws && msg.from) {
      ws.send(
        JSON.stringify({
          type: 'ice-candidate',
          target: msg.from,
          payload: { candidate: event.candidate },
        })
      );
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Peer connection state:', peerConnection?.connectionState);
  };

  await peerConnection.setRemoteDescription(msg.payload.offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // Send answer back to client
  ws?.send(
    JSON.stringify({
      type: 'answer',
      target: msg.from,
      payload: { answer },
    })
  );
}

async function handleAnswer(msg: any) {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(msg.payload.answer);
  }
}

async function handleRemoteIceCandidate(msg: any) {
  if (peerConnection && msg.payload && msg.payload.candidate) {
    try {
      await peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(msg.payload.candidate));
    } catch (e) {
      console.error('Error adding remote ICE candidate:', e);
    }
  }
}

connectToSignalerAndSaveId();

// --- Save signalerId and device info to device.json ---
function saveDeviceJson(id: string) {
  const deviceInfo = {
    signalerId: id,
    createdAt: new Date().toISOString(),
    // Add more device metadata here if needed
  };
  fs.writeFileSync('/usr/src/app/device.json', JSON.stringify(deviceInfo, null, 2));
  console.log('Saved device.json:', deviceInfo);
}

// --- Local web server to serve signalerId for onboarding ---
const onboardingPort = 4000;

app.get('/device-id', (req, res) => {
  try {
    console.log('[DEBUG] /device-id endpoint called');
    const id = signalerId || (fs.existsSync('/usr/src/app/signalId.txt') ? fs.readFileSync('/usr/src/app/signalId.txt', 'utf8') : null);
    console.log('[DEBUG] signalerId:', signalerId);
    if (id) {
      res.json({ signalerId: id });
    } else {
      console.error('[DEBUG] signalerId not available yet');
      res.status(404).json({ error: 'signalerId not available yet' });
    }
  } catch (e) {
    console.error('[DEBUG] Failed to read signalerId:', e);
    res.status(500).json({ error: 'Failed to read signalerId' });
  }
});

// Start onboarding server on all interfaces
app.listen(onboardingPort, '0.0.0.0', () => {
  console.log(`Onboarding server running at http://0.0.0.0:${onboardingPort}/device-id`);
});

// Initialize tunnel before starting server
async function initializeServer() {
    try {
        // Setup tunnel configuration
        console.log('Tunnel configuration completed');

        const host = getLocalIPAddress();
        app.listen(port, host, () => {
            console.log(`Server running and accessible at http://${host}:${port}`);
        });
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}

function getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address; // Return the first non-internal IPv4 address
            }
        }
    }
    throw new Error('Unable to detect local IP address');
}

startWebRTCSignaling();
initializeServer();