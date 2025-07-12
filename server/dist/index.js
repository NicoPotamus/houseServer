import express from 'express';
import cors from 'cors';
import { listFiles, uploadFile, deleteItem, viewFile } from './controller/diskController.js';
import { getImageThumbnail, getVideoPreview } from './controller/thumbnailGenerator.js';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { startWebRTCSignaling } from './controller/webrtcController.js';
import { testRouter } from './test/testRoutes.js';
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
app.delete('/files/delete/:filePath(*)', deleteItem); // Allow any path character including slashes
app.post('/files/:folderPath?', upload.single('file'), uploadFile);
app.get('/files/:filePath/image-preview', getImageThumbnail);
app.get('/files/:filePath/video-preview', getVideoPreview);
app.get('/files/:folderPath?', listFiles);
// Test routes for WebRTC testing
app.use(testRouter);
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});
// --- Import needed controllers ---
// WebRTC signaling is now handled entirely by webrtcController.js
// No duplicate connection code here
// Import signalerId and saveDeviceJson from the webrtcController
import { signalerId } from './controller/webrtcController.js';
// --- Save signalerId and device info to device.json ---
// We're now using the saveDeviceJson from webrtcController.js
// --- Local web server to serve signalerId for onboarding ---
const onboardingPort = 4000;
app.get('/device-id', (req, res) => {
    try {
        console.log('[DEBUG] /device-id endpoint called');
        const id = signalerId || (fs.existsSync('/usr/src/app/signalId.txt') ? fs.readFileSync('/usr/src/app/signalId.txt', 'utf8') : null);
        console.log('[DEBUG] signalerId:', signalerId);
        if (id) {
            res.json({ signalerId: id });
        }
        else {
            console.error('[DEBUG] signalerId not available yet');
            res.status(404).json({ error: 'signalerId not available yet' });
        }
    }
    catch (e) {
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
        const host = getLocalIPAddress();
        // Listen on both localhost and the detected IP
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server running on all interfaces:`);
            console.log(`  - Local: http://localhost:${port}`);
            console.log(`  - Network: http://${host}:${port}`);
        });
    }
    catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}
function getLocalIPAddress() {
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
/**
 * Handle messages received on the data channel.
 * This function allows accessing server API endpoints over WebRTC.
 */
async function handleDataChannelMessage(dataChannel, data, clientId) {
    console.log(`Received data channel message from client ${clientId}`);
    // Parse the message
    try {
        const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
        // Check if this is an API request
        if (message.type === 'request') {
            await handleApiRequest(dataChannel, message, clientId);
        }
        else {
            console.log('Received unknown message type:', message);
        }
    }
    catch (error) {
        console.error('Error handling data channel message:', error);
        // If we have a request ID, send an error response
        if (typeof data === 'string' && data.includes('"id":')) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.id) {
                    sendWebRTCResponse(dataChannel, parsed.id, null, {
                        message: 'Error processing request',
                        error: error.message
                    });
                }
            }
            catch (e) {
                // Ignore parsing errors for error handling
            }
        }
    }
}
/**
 * Handle API requests from clients by routing them to Express endpoints
 */
async function handleApiRequest(dataChannel, request, clientId) {
    const { id, endpoint, method, params } = request;
    console.log(`API Request #${id}: ${method} ${endpoint}`);
    try {
        let result;
        // Route the request based on endpoint
        if (endpoint.startsWith('/files')) {
            // Handle file-related endpoints
            if (endpoint === '/files' || endpoint.match(/^\/files\/[^\/]+$/)) {
                // List files in a directory
                const folderPath = params?.folderPath || '';
                // Create a fake request/response to reuse the existing controller
                const req = {
                    query: { folderPath },
                    params: {},
                    headers: {},
                    get: () => null
                };
                let responseData = null;
                const res = {
                    json: (data) => { responseData = data; },
                    status: (code) => ({
                        json: (data) => { responseData = { ...data, statusCode: code }; }
                    }),
                    send: (data) => { responseData = data; },
                    sendStatus: () => { },
                    setHeader: () => { }
                };
                // Call the listFiles controller directly
                await new Promise(resolve => {
                    // @ts-ignore: We know listFiles exists
                    listFiles(req, res, resolve);
                });
                result = responseData;
            }
            else if (endpoint.startsWith('/files/view/')) {
                // File viewing endpoint
                const filePath = endpoint.replace('/files/view/', '');
                result = {
                    url: `http://${getLocalIPAddress()}:${port}/files/view/${filePath}`,
                    message: 'Access file directly through URL'
                };
            }
        }
        else if (endpoint === '/device-info') {
            // Return device information
            result = {
                signalerId,
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                uptime: os.uptime()
            };
        }
        else {
            // For unsupported endpoints, provide an error
            throw new Error(`Unsupported endpoint: ${endpoint}`);
        }
        // Send the response back to the client
        sendWebRTCResponse(dataChannel, id, result);
    }
    catch (error) {
        console.error(`Error handling API request to ${endpoint}:`, error);
        sendWebRTCResponse(dataChannel, id, null, {
            message: 'Error processing request',
            error: error.message
        });
    }
}
/**
 * Send a response back to the client over WebRTC
 */
function sendWebRTCResponse(dataChannel, id, result = null, error = null) {
    const response = {
        type: 'response',
        id,
        result,
        error
    };
    dataChannel.send(JSON.stringify(response));
}
startWebRTCSignaling();
initializeServer();
