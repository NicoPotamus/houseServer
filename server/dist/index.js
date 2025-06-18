import express from 'express';
import cors from 'cors';
import { createUser, getUser, updateUser, deleteUser, loginUser } from './controller/userController.js';
import { listFiles, uploadFile, deleteItem, viewFile } from './controller/diskController.js';
import { getImageThumbnail, getVideoPreview } from './controller/thumbnailGenerator.js';
import { setupTunnel } from './controller/tunnelSetup.js';
import multer from 'multer';
import path from 'path';
import os from 'os';
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
// Security configurations
const corsOptions = {
    origin: '*', // In production, you should limit this to specific domains
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
    credentials: true
};
// Set up multer for file uploads
const upload = multer({ dest: path.join(process.cwd(), 'server', 'disk', 'temp') });
// Enhanced security middleware
app.use((req, res, next) => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});
// Configure CORS
app.use(cors(corsOptions));
app.use(express.json());
// Enable pre-flight for all routes
app.options('*', cors(corsOptions));
// User routes
app.post('/users', createUser);
app.get('/users/:id', getUser);
app.put('/users/:id', updateUser);
app.delete('/users/:id', deleteUser);
app.post('/login', loginUser);
// File routes
app.get('/files/view/:filePath(*)', viewFile);
app.delete('/files/delete/:filePath(*)', deleteItem); // Allow any path character including slashes
app.post('/files/:folderPath?', upload.single('file'), uploadFile);
app.get('/files/:filePath/image-preview', getImageThumbnail);
app.get('/files/:filePath/video-preview', getVideoPreview);
app.get('/files/:folderPath?', listFiles);
// Initialize tunnel before starting server
async function initializeServer() {
    try {
        // Setup tunnel configuration
        await setupTunnel();
        console.log('Tunnel configuration completed');
        const host = getLocalIPAddress();
        app.listen(port, host, () => {
            console.log(`Server running and accessible at http://${host}:${port}`);
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
initializeServer();
