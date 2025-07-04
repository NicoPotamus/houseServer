// Peer interface for WebSocket connections
export interface Peer {
  socket: WebSocket;
  deviceId: string;
}

// User interface for database users
export interface User {
  id: number;
  name?: string;
  email: string;
  password: string;
  storage_quota?: number;
  files?: any;
  created_at?: string;
  updated_at?: string;
}

// Message format for WebSocket signaling
export interface SignalMessage {
  type: string;
  deviceId?: string;
  userId?: string;
  targetDeviceId?: string;
  offer?: any;
  answer?: any;
  ice?: any;
  attachToUser?: boolean;
}
