// Auth routes
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/postgres.js';
import { createAccount, login, updateAccount, deleteAccount } from '../controller/userController.js';
import { asyncHandler } from '../utils/routeHelpers.js';
const router = express.Router();
// Keep sessions in memory
// In a production app, this would be stored in Redis or similar
const SESSIONS = {};
// Register endpoint
router.post('/register', asyncHandler(async (req, res) => {
    const { name, email, password, storage_quota, files } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password required' });
    try {
        const user = await createAccount(pool, { name, email, password, storage_quota, files });
        res.status(201).json({ message: 'User registered', user });
    }
    catch (e) {
        if (e.code === '23505')
            return res.status(409).json({ message: 'Email already registered' });
        console.error('Register error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Login endpoint
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password required' });
    try {
        const user = await login(pool, email, password);
        if (!user)
            return res.status(401).json({ message: 'Invalid credentials' });
        const session = uuidv4();
        SESSIONS[session] = email;
        res.cookie('session', session, { httpOnly: true, sameSite: 'lax' });
        res.json({ message: 'Logged in', user });
    }
    catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Update account endpoint
router.put('/account/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id)
        return res.status(400).json({ message: 'User id required' });
    // Only allow valid user fields
    const allowedFields = ['name', 'email', 'password', 'storage_quota'];
    const updates = {};
    for (const key of allowedFields) {
        if (req.body[key] !== undefined)
            updates[key] = req.body[key];
    }
    try {
        const updated = await updateAccount(pool, id, updates);
        if (!updated)
            return res.status(404).json({ message: 'User not found or no changes' });
        res.json({ message: 'Account updated', user: updated });
    }
    catch (e) {
        console.error('Update account error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Delete account endpoint
router.delete('/account/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id)
        return res.status(400).json({ message: 'User id required' });
    try {
        const deleted = await deleteAccount(pool, id);
        if (!deleted)
            return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'Account deleted' });
    }
    catch (e) {
        console.error('Delete account error:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}));
// Logout endpoint
router.post('/logout', (req, res) => {
    const session = req.cookies?.session;
    if (session)
        delete SESSIONS[session];
    res.clearCookie('session');
    res.json({ message: 'Logged out' });
});
export const authRoutes = router;
export { SESSIONS };
