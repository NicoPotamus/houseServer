// Status routes for signaler monitoring
import { Router } from 'express';

const router = Router();

// Export the data maps so they can be accessed from routes
export let getSignalerStatus: () => {
  clients: number;
  devices: Record<string, string>;
  handshakes: Record<string, any>;
} = () => ({ clients: 0, devices: {}, handshakes: {} });

// This will be set by the signaling controller
export function setStatusProvider(provider: typeof getSignalerStatus) {
  getSignalerStatus = provider;
}

// GET /status - Get current signaler status
router.get('/status', (req, res) => {
  try {
    const status = getSignalerStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      ...status,
      summary: {
        totalClients: status.clients,
        registeredDevices: Object.keys(status.devices).length,
        activeHandshakes: Object.keys(status.handshakes).length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /connections - Get detailed connection information
router.get('/connections', (req, res) => {
  try {
    const status = getSignalerStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      devices: status.devices,
      handshakes: status.handshakes,
      connections: Object.entries(status.devices).map(([deviceId, signalerId]) => ({
        deviceId,
        signalerId,
        connected: true // If it's in the map, it's connected
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get connections',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as statusRoutes };
