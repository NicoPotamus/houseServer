/**
 * WebRTC Test Endpoint
 * Provides REST endpoints for testing WebRTC functionality
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { signalerId } from '../controller/webrtcController.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const testRouter = express.Router();
// Serve the HTML test page
testRouter.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'webrtc-test.html'));
});
// Get server status
testRouter.get('/test/status', (req, res) => {
    const status = {
        timestamp: new Date().toISOString(),
        server: 'running',
        signalerId: signalerId || null,
        webrtc: {
            supported: true,
            nodeVersion: process.version,
            platform: process.platform
        },
        endpoints: {
            files: '/files',
            health: '/health',
            test: '/test'
        },
        environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            signalerUrl: process.env.SIGNALER_WS_URL || 'ws://house-signaler:8080',
            port: process.env.PORT || '3000'
        }
    };
    res.json(status);
});
// Test WebRTC data channel simulation
testRouter.post('/test/simulate-webrtc', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({
            error: 'Message is required',
            example: {
                type: 'request',
                id: 1,
                endpoint: '/files',
                method: 'GET'
            }
        });
    }
    try {
        // Simulate WebRTC API handling
        const mockDataChannel = {
            send: (data) => {
                console.log(`Mock data channel send: ${data.substring(0, 200)}...`);
                return JSON.parse(data);
            }
        };
        // Import and use the WebRTC API handler
        import('../controller/webrtcAPI.js').then(api => {
            api.handleDataChannelMessage(message, mockDataChannel)
                .then(() => {
                res.json({
                    success: true,
                    message: 'WebRTC message processed successfully',
                    originalMessage: message
                });
            })
                .catch((error) => {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    originalMessage: message
                });
            });
        }).catch((error) => {
            res.status(500).json({
                success: false,
                error: `Failed to load WebRTC API: ${error.message}`
            });
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            originalMessage: message
        });
    }
});
// Test signaler connectivity
testRouter.get('/test/signaler', async (req, res) => {
    const signalerUrl = process.env.SIGNALER_WS_URL || 'ws://localhost:8080';
    try {
        // Try to connect to signaler for testing
        const WebSocket = (await import('ws')).default;
        const ws = new WebSocket(signalerUrl);
        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, 5000);
            ws.onopen = () => {
                clearTimeout(timeout);
                ws.close();
                resolve({
                    success: true,
                    url: signalerUrl,
                    status: 'Connected successfully'
                });
            };
            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
            ws.onclose = (event) => {
                if (event.code !== 1000) {
                    clearTimeout(timeout);
                    reject(new Error(`Connection closed with code ${event.code}: ${event.reason}`));
                }
            };
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            url: signalerUrl,
            error: error instanceof Error ? error.message : 'Unknown error',
            suggestion: 'Check if the signaler service is running and accessible'
        });
    }
});
// Health check for test endpoints
testRouter.get('/test/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        tests: {
            webrtcTest: '/test',
            statusCheck: '/test/status',
            signalerTest: '/test/signaler',
            webrtcSimulation: '/test/simulate-webrtc'
        }
    });
});
// Performance test endpoint
testRouter.get('/test/performance', (req, res) => {
    const start = process.hrtime.bigint();
    // Simulate some work
    let counter = 0;
    for (let i = 0; i < 100000; i++) {
        counter += i;
    }
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    res.json({
        performance: {
            duration: `${duration.toFixed(3)}ms`,
            operations: 100000,
            result: counter,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        }
    });
});
