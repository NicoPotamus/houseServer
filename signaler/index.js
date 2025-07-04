"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const ws_1 = require("ws");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const pg_1 = require("pg");
const cors_1 = __importDefault(require("cors"));
const SESSIONS = {};
// Setup PostgreSQL connection (adjust config as needed)
const pool = new pg_1.Pool({
    user: 'postgres',
    password: 'postgres',
    host: 'localhost', // or your DB host
    port: 5432,
    database: 'house_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
// Add type for err parameter
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
// Express app for auth endpoints
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: 'http://localhost:8081',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type']
}));
// Register endpoint
app.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password required' });
    try {
        const existing = yield pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0)
            return res.status(409).json({ message: 'Email already registered' });
        const hash = yield bcryptjs_1.default.hash(password, 10);
        yield pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hash]);
        res.status(201).json({ message: 'User registered' });
    }
    catch (e) {
        console.error('Register error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Login endpoint
app.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password required' });
    try {
        const users = yield pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = users.rows[0];
        if (!user)
            return res.status(401).json({ message: 'Invalid credentials' });
        const valid = yield bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ message: 'Invalid credentials' });
        const session = (0, uuid_1.v4)();
        SESSIONS[session] = email;
        res.cookie('session', session, { httpOnly: true, sameSite: 'lax' });
        res.json({ message: 'Logged in' });
    }
    catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Logout endpoint
app.post('/logout', (req, res) => {
    const session = req.cookies.session;
    if (session)
        delete SESSIONS[session];
    res.clearCookie('session');
    res.json({ message: 'Logged out' });
});
// HTTP server for both Express and WebSocket
const server = http_1.default.createServer(app);
// WebSocket server, now using the same HTTP server
const wss = new ws_1.WebSocketServer({ server });
// In-memory map for fast signaling
const peers = new Map();
// Helper: update user_servers table
function upsertUserServer(userId_1, deviceId_1) {
    return __awaiter(this, arguments, void 0, function* (userId, deviceId, status = 'online') {
        yield pool.query(`
    INSERT INTO user_servers (user_id, device_id, last_seen, status)
    VALUES ($1, $2, NOW(), $3)
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET last_seen = NOW(), status = $3
  `, [userId, deviceId, status]);
    });
}
wss.on('connection', (ws, req) => {
    var _a;
    // Check session cookie
    const cookies = req.headers.cookie || '';
    const session = (_a = cookies.split(';').map(s => s.trim()).find(s => s.startsWith('session='))) === null || _a === void 0 ? void 0 : _a.split('=')[1];
    if (!session || !SESSIONS[session]) {
        ws.close(4001, 'Not authenticated');
        return;
    }
    ws.on('message', (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const message = JSON.parse(data.toString());
            const { type, deviceId, userId, targetDeviceId, offer, answer, ice } = message;
            if (type === 'register') {
                peers.set(deviceId, ws);
                if (userId) {
                    yield upsertUserServer(userId, deviceId, 'online');
                }
                console.log(`Registered device ${deviceId} for user ${userId}`);
                return;
            }
            const targetSocket = peers.get(targetDeviceId);
            if (!targetSocket) {
                console.warn(`Target ${targetDeviceId} not found`);
                return;
            }
            targetSocket.send(JSON.stringify({ type, deviceId, offer, answer, ice }));
        }
        catch (err) {
            console.error('Failed to handle message:', err);
        }
    }));
    ws.on('close', () => __awaiter(void 0, void 0, void 0, function* () {
        for (const [id, peer] of peers.entries()) {
            if (peer === ws) {
                peers.delete(id);
                // Optionally update DB status to offline
                yield pool.query('UPDATE user_servers SET status = $1, last_seen = NOW() WHERE device_id = $2', ['offline', id]);
                console.log(`Disconnected ${id}`);
                break;
            }
        }
    }));
});
server.listen(8080, () => {
    console.log('WebSocket signaling server running on ws://localhost:8080');
    console.log('Auth endpoints: POST /register, /login, /logout');
});
