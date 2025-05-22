import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../data/db.js';
import fs from 'fs';
const JWT_SECRET = 'your_jwt_secret'; // Replace with a secure secret in production
export const createUser = async (req, res) => {
    console.log('createUser called with body:', req.body);
    const { name, email, storage_quota = 1073741824 } = req.body;
    try {
        const result = await pool.query('INSERT INTO users (name, email, storage_quota) VALUES ($1, $2, $3) RETURNING *', [name, email, storage_quota]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const getUser = async (req, res) => {
    console.log('getUser called with id:', req.params.id);
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const updateUser = async (req, res) => {
    console.log('updateUser called with id:', req.params.id, 'and body:', req.body);
    const { name, email, storage_quota } = req.body;
    try {
        const result = await pool.query('UPDATE users SET name = $1, email = $2, storage_quota = $3 WHERE id = $4 RETURNING *', [name, email, storage_quota, req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const deleteUser = async (req, res) => {
    console.log('deleteUser called with id:', req.params.id);
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
// Login function
export const loginUser = async (req, res) => {
    console.log('loginUser called with username:', req.body.username);
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }
        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token });
    }
    catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Error logging in user', error: error.message });
    }
};
// Ensure default user path exists
export const ensureUserPath = async (username) => {
    const userPath = `server/disk/users/${username}`;
    if (!fs.existsSync(userPath)) {
        fs.mkdirSync(userPath, { recursive: true });
        console.log(`Default path created for user: ${userPath}`);
    }
};
