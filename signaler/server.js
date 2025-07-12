// Main server configuration
import http from 'http';
import express from 'express';
import { setupMiddleware } from './middleware/index.js';
import { setupWebSocketServer } from './websocket/server.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { deviceRoutes } from './routes/device.js';
export function createServer() {
    // Express app for HTTP endpoints
    const app = express();
    // Apply middleware
    setupMiddleware(app);
    // Register routes
    app.use(healthRoutes);
    app.use(authRoutes);
    app.use(deviceRoutes);
    // HTTP server for both Express and WebSocket
    const server = http.createServer(app);
    // Setup WebSocket server
    const wss = setupWebSocketServer(server);
    return { app, server, wss };
}
