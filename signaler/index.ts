// server.ts
import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import cors from 'cors';
import { upsertUserServer, verifyUserCredentials, createAccount, login, updateAccount, deleteAccount } from './controller/userController.js';
import { handleWebRTCSignaling } from './controller/webRtcSignaling.js';

const SESSIONS: Record<string, string> = {};

// Define SIGNALER_WS_PORT as a constant
const SIGNALER_WS_PORT = 8080;

// Setup PostgreSQL connection using environment variables for Docker compatibility
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'house_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Add type for err parameter
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
});

// Express app for auth endpoints
const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:8081',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type']
}));

// Register endpoint
app.post('/register', async (req: any, res: any) => {
  const { name, email, password, storage_quota, files } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const user = await createAccount(pool, { name, email, password, storage_quota, files });
    res.status(201).json({ message: 'User registered', user });
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ message: 'Email already registered' });
    console.error('Register error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login endpoint
app.post('/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const user = await login(pool, email, password);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const session = uuidv4();
    SESSIONS[session] = email;
    res.cookie('session', session, { httpOnly: true, sameSite: 'lax' });
    res.json({ message: 'Logged in', user });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update account endpoint
app.put('/account/:id', async (req: any, res: any) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ message: 'User id required' });
  // Only allow valid user fields
  const allowedFields = ['name', 'email', 'password', 'storage_quota'];
  const updates: any = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  try {
    const updated = await updateAccount(pool, id, updates);
    if (!updated) return res.status(404).json({ message: 'User not found or no changes' });
    res.json({ message: 'Account updated', user: updated });
  } catch (e) {
    console.error('Update account error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete account endpoint
app.delete('/account/:id', async (req: any, res: any) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ message: 'User id required' });
  try {
    const deleted = await deleteAccount(pool, id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Account deleted' });
  } catch (e) {
    console.error('Delete account error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout endpoint
app.post('/logout', (req: { cookies: { session: any; }; }, res: { clearCookie: (arg0: string) => void; json: (arg0: { message: string; }) => void; }) => {
  const session = req.cookies.session;
  if (session) delete SESSIONS[session];
  res.clearCookie('session');
  res.json({ message: 'Logged out' });
});

// Pair device endpoint
app.post('/pairDevice', async (req: any, res: any) => {
  const { username, password, deviceId } = req.body;
  if (!username || !password || !deviceId) {
    return res.status(400).json({ message: 'username, password, and deviceId required' });
  }
  try {
    const user = await verifyUserCredentials(pool, username, password);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    await upsertUserServer(pool, user.id, deviceId, 'online');
    res.json({ message: 'Device paired successfully' });
  } catch (e) {
    console.error('Pair device error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Pair device by user ID endpoint
app.post('/pairDeviceById', async (req: any, res: any) => {
  const { userId, deviceId } = req.body;
  if (!userId || !deviceId) {
    return res.status(400).json({ message: 'userId and deviceId required' });
  }
  try {
    await upsertUserServer(pool, userId, deviceId, 'online');
    res.json({ message: 'Device paired successfully by userId' });
  } catch (e) {
    console.error('Pair device by userId error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all device connections for a user
app.get('/userDevices', async (req: any, res: any) => {
  const userId = parseInt(req.query.userId as string, 10);
  if (!userId) return res.status(400).json({ message: 'userId required' });
  try {
    const result = await pool.query('SELECT * FROM user_servers WHERE user_id = $1', [userId]);
    res.json(result.rows);
  } catch (e) {
    console.error('Fetch user devices error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Initiate WebRTC connection from client to device
app.post('/connectToDevice', async (req: any, res: any) => {
  const { userId, deviceId } = req.body;
  if (!userId || !deviceId) {
    return res.status(400).json({ message: 'userId and deviceId required' });
  }
  try {
    // Find the WebSocket for the target device
    const targetWs = deviceIdToPeer.get(deviceId);
    if (!targetWs) {
      return res.status(404).json({ message: 'Device not connected' });
    }
    // Notify the device of the incoming connection
    targetWs.send(JSON.stringify({ type: 'incoming-connection', fromUserId: userId }));
    res.json({ message: 'Connection request sent to device' });
  } catch (e) {
    console.error('Connect to device error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// HTTP server for both Express and WebSocket
const server = http.createServer(app);

// --- WebSocket Signaler Server (for WebRTC signaling) ---
// Only start if this process is the signaler (not the main server)
if (process.env.ENABLE_SIGNALER === 'true') {
  (async () => {
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ port: SIGNALER_WS_PORT });
    handleWebRTCSignaling(wss);
    console.log(`WebRTC Signaler running on ws://0.0.0.0:${SIGNALER_WS_PORT}`);
  })();
}

// WebSocket server, now using the same HTTP server
const wss = new WebSocketServer({ server });
// In-memory map for fast signaling
const peers = new Map<string, { ws: WebSocket, signalerId: string, deviceId?: string }>();

// --- Map deviceId to WebSocket for routing ---
const deviceIdToPeer = new Map<string, WebSocket>();

wss.on('connection', (ws, req) => {
  // Generate a unique signalerId for this connection
  const signalerId = uuidv4();
  // Store the mapping
  peers.set(signalerId, { ws, signalerId });
  ws.send(JSON.stringify({ type: 'signaler-id', signalerId })); // Send the id to the pi

  ws.on('message', async (data: WebSocket.RawData) => {
    try {
      const message: any = JSON.parse(data.toString());
      const { type, deviceId, userId, targetDeviceId, offer, answer, ice, attachToUser } = message;

      // Register deviceId to this WebSocket
      if (type === 'register' && deviceId) {
        // If a previous connection exists for this deviceId, close it and replace
        const oldWs = deviceIdToPeer.get(deviceId);
        if (oldWs && oldWs !== ws) {
          try { oldWs.close(); } catch {}
        }
        deviceIdToPeer.set(deviceId, ws);
        peers.set(signalerId, { ws, signalerId, deviceId });
        console.log(`Registered deviceId ${deviceId} for signalerId ${signalerId}`);
        return;
      }

      // Attach user to device
      if (type === 'attach-user' && attachToUser && userId) {
        await upsertUserServer(pool, userId, signalerId, 'online');
        ws.send(JSON.stringify({ type: 'user-attached', userId, signalerId }));
        return;
      }

      // Route signaling messages by deviceId
      if (targetDeviceId) {
        const target = deviceIdToPeer.get(targetDeviceId);
        if (target) {
          target.send(JSON.stringify({ type, deviceId, offer, answer, ice }));
        }
      }
    } catch (err) {
      console.error('Failed to handle message:', err);
    }
  });

  ws.on('close', async () => {
    // Remove from deviceIdToPeer and peers
    for (const [id, peer] of deviceIdToPeer.entries()) {
      if (peer === ws) {
        deviceIdToPeer.delete(id);
        break;
      }
    }
    peers.delete(signalerId);
    await pool.query('UPDATE user_servers SET status = $1, last_seen = NOW() WHERE device_id = $2', ['offline', signalerId]);
    console.log(`Disconnected ${signalerId}`);
  });
});

server.listen(8080, () => {
  console.log('WebSocket signaling server running on ws://localhost:8080');
  console.log('Auth endpoints: POST /register, /login, /logout');
});
