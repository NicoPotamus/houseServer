// Health routes
import express from 'express';
import { checkDatabaseHealth } from '../db/postgres.js';
import { asyncHandler } from '../utils/routeHelpers.js';
const router = express.Router();
// Health check endpoint for Docker
router.get('/health', asyncHandler(async (req, res) => {
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
        res.status(200).send('OK');
    }
    else {
        res.status(500).send('Not healthy: Database connection failed');
    }
}));
export const healthRoutes = router;
