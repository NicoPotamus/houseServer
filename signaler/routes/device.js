// Device management routes
import express from 'express';
import { pool } from '../db/postgres.js';
import { upsertUserServer, verifyUserCredentials } from '../controller/userController.js';
import { asyncHandler } from '../utils/routeHelpers.js';
const router = express.Router();
// Pair device endpoint
router.post('/pairDevice', asyncHandler(async (req, res) => {
    const { username, password, deviceId } = req.body;
    if (!username || !password || !deviceId) {
        return res.status(400).json({ message: 'username, password, and deviceId required' });
    }
    try {
        const user = await verifyUserCredentials(pool, username, password);
        if (!user)
            return res.status(401).json({ message: 'Invalid credentials' });
        await upsertUserServer(pool, user.id, deviceId, 'online');
        res.json({ message: 'Device paired successfully' });
    }
    catch (e) {
        console.error('Pair device error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Pair device by user ID endpoint
router.post('/pairDeviceById', asyncHandler(async (req, res) => {
    const { userId, deviceId } = req.body;
    if (!userId || !deviceId) {
        return res.status(400).json({ message: 'userId and deviceId required' });
    }
    try {
        await upsertUserServer(pool, userId, deviceId, 'online');
        res.json({ message: 'Device paired successfully by userId' });
    }
    catch (e) {
        console.error('Pair device by userId error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Get all device connections for a user
router.get('/userDevices', asyncHandler(async (req, res) => {
    const userId = parseInt(req.query.userId, 10);
    if (!userId)
        return res.status(400).json({ message: 'userId required' });
    try {
        const result = await pool.query('SELECT * FROM user_servers WHERE user_id = $1', [userId]);
        res.json(result.rows);
    }
    catch (e) {
        console.error('Fetch user devices error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Initiate WebRTC connection from client to device
router.post('/connectToDevice', asyncHandler(async (req, res) => {
    const { userId, deviceId } = req.body;
    if (!userId || !deviceId) {
        return res.status(400).json({ message: 'userId and deviceId required' });
    }
    try {
        // This endpoint only records the connection request in the database
        // The actual signaling happens through the WebRTC signaling WebSocket
        await upsertUserServer(pool, userId, deviceId, 'connecting');
        res.json({ message: 'Connection request recorded, use WebSocket for signaling' });
    }
    catch (e) {
        console.error('Connect to device error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
export const deviceRoutes = router;
