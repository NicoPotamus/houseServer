'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { webrtcService } from '@/services/webrtcService';
import { getSignalerUrl } from '@/config/api';

interface DeviceContextType {
  deviceId: string;
  isConnected: boolean;
  connectionStatus: string;
  connectToDevice: (targetDeviceId: string) => Promise<void>;
  disconnect: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  useEffect(() => {
    // Generate or retrieve device ID
    let storedDeviceId = localStorage.getItem('houseClient_deviceId');
    if (!storedDeviceId) {
      storedDeviceId = uuidv4();
      localStorage.setItem('houseClient_deviceId', storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    // Set up WebRTC service callbacks
    webrtcService.onConnected = () => {
      console.log('WebRTC connection established');
      setIsConnected(true);
      setConnectionStatus('Connected');
    };

    webrtcService.onDisconnected = () => {
      console.log('WebRTC connection disconnected');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
    };

    webrtcService.onData = (data) => {
      console.log('Received WebRTC data:', data);
      // Handle incoming data from the device
    };

    return () => {
      webrtcService.cleanup();
    };
  }, []);

  const connectToDevice = async (targetDeviceId: string) => {
    try {
      setConnectionStatus('Connecting...');
      const signalerUrl = getSignalerUrl();
      const userId = deviceId; // Use our device ID as user ID
      
      console.log(`Connecting to device: ${targetDeviceId}`);
      await webrtcService.connect(signalerUrl, targetDeviceId, userId);
    } catch (error) {
      console.error('Failed to connect to device:', error);
      setConnectionStatus('Connection Failed');
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    webrtcService.cleanup();
    setIsConnected(false);
    setConnectionStatus('Disconnected');
  };

  return (
    <DeviceContext.Provider value={{
      deviceId,
      isConnected,
      connectionStatus,
      connectToDevice,
      disconnect
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}
