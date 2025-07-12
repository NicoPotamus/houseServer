import React, { createContext, useContext, useState, useEffect } from 'react';
import { webrtcService } from '@/services/webrtcService';
import { useAuth } from './AuthContext';
import { Platform } from 'react-native';
import { getSignalerUrl } from '@/config/api';

interface DeviceContextType {
  device: string | null;
  setDevice: (device: string | null) => void;
  connectionStatus: string;
  isConnecting: boolean;
  connectionError: string | null;
  diagnosticReport: string | null;
  refreshConnectionStatus: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [device, setDevice] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<string | null>(null);
  const { user } = useAuth?.() || { user: null };
  
  // Helper to update connection status
  const refreshConnectionStatus = () => {
    try {
      // Check if we have the enhanced connection status methods
      if (typeof webrtcService.getConnectionStatus === 'function') {
        const status = webrtcService.getConnectionStatus();
        setConnectionStatus(status.isConnected ? 'Connected' : 
          (isConnecting ? 'Connecting...' : 'Disconnected'));
          
        // Update connection error based on status
        if (!status.isConnected && status.peerConnectionState === 'failed') {
          setConnectionError('WebRTC connection failed. This could be due to firewall restrictions, NAT traversal issues, or the target device being unreachable.');
        } else if (!status.wsConnected && connectionError === null) {
          setConnectionError('WebSocket connection to signaler failed. Check your network connection and the signaler server.');
        }
          
        // Generate full diagnostic report
        if (typeof webrtcService.generateConnectionReport === 'function') {
          setDiagnosticReport(webrtcService.generateConnectionReport());
        }
      } else {
        // Fallback for older versions
        setConnectionStatus(
          webrtcService.dataChannel?.readyState === 'open' ? 'Connected' : 
          (isConnecting ? 'Connecting...' : 'Disconnected')
        );
        setDiagnosticReport(null);
      }
    } catch (e) {
      console.error('Error checking connection status:', e);
      setConnectionStatus('Error');
    }
  };
  
  // Establish WebRTC connection when device is selected
  useEffect(() => {
    if (device && user) {
      // Define the signaling URL - use environment-appropriate URL
      let signalingUrl;
      
      if (__DEV__) {
        // Development mode - use the function from api.ts that handles all platforms correctly
        signalingUrl = getSignalerUrl();
        console.log(`Using development signaler URL: ${signalingUrl}`);
      } else {
        // Production mode - use deployed signaler
        signalingUrl = 'wss://a5a5222e-4637-4383-bc7b-2514fc752d11.niconet.tech/signaling';
      }
      
      setIsConnecting(true);
      setConnectionError(null);
      setDiagnosticReport(null);
      
      console.log(`Establishing WebRTC connection to device ${device} for user ${user.id}`);
      console.log(`Using signaling URL: ${signalingUrl}`);
      
      // Set callbacks for connection events
      webrtcService.onConnected = () => {
        console.log('WebRTC connection established successfully');
        setIsConnecting(false);
        setConnectionError(null);
        refreshConnectionStatus();
      };
      
      webrtcService.onDisconnected = () => {
        console.log('WebRTC connection disconnected');
        setConnectionStatus('Disconnected');
        setIsConnecting(false);
        
        // Only set error if we were previously trying to connect
        if (isConnecting) {
          setConnectionError('Connection lost or failed to establish. Check device status and network.');
        }
        
        refreshConnectionStatus();
      };
      
      // Connect to the device via WebRTC
      try {
        // Connect first
        webrtcService.connect(signalingUrl, device, user.id.toString());
        
        // Regularly update connection status
        const statusInterval = setInterval(() => {
          refreshConnectionStatus();
        }, 2000);
        
        // Set a timeout to detect connection failure
        const timeoutId = setTimeout(() => {
          refreshConnectionStatus();
          const status = webrtcService.getConnectionStatus();
          
          if (!status.isConnected) {
            console.error('WebRTC connection timed out');
            
            // Generate a more detailed error message based on state
            let errorMessage;
            
            if (!status.wsConnected) {
              errorMessage = 'Could not connect to signaling server. Please check your network connection and the server status.';
            } else if (status.peerConnectionState === 'new' || status.peerConnectionState === 'connecting') {
              errorMessage = 'Connection to device timed out. The device may be offline or unreachable.';
            } else if (status.peerConnectionState === 'failed') {
              errorMessage = 'WebRTC connection failed. This might be due to network restrictions, NAT/firewall issues, or the device being unreachable.';
            } else {
              errorMessage = 'Connection timed out. Please check your device and network.';
            }
            
            setConnectionError(errorMessage);
            setIsConnecting(false);
            
            // Suggest troubleshooting steps based on detected issues
            console.log('Troubleshooting steps:');
            if (!status.wsConnected) {
              console.log('1. Check if the signaler service is running');
              console.log('2. Verify network connectivity');
              console.log('3. If using localhost, make sure the server is running locally');
            } else {
              console.log('1. Check if the device ID is correct');
              console.log('2. Verify the device is online and connected to the signaler');
              console.log('3. Check for any firewall or security restrictions blocking WebRTC');
            }
          }
        }, 20000); // 20 second timeout
        
        // Clean up on unmount
        return () => {
          clearInterval(statusInterval);
          clearTimeout(timeoutId);
          webrtcService.disconnect();
        };
      } catch (e) {
        console.error('Error initiating WebRTC connection:', e);
        setConnectionError(`Failed to connect: ${e instanceof Error ? e.message : String(e)}`);
        setIsConnecting(false);
      }
    } else {
      // No device selected, update status
      setConnectionStatus('No device selected');
    }
  }, [device, user]);
  
  // Clean up when the component is unmounted
  useEffect(() => {
    return () => {
      console.log('DeviceProvider unmounting, cleaning up WebRTC connections');
      webrtcService.disconnect();
    };
  }, []);
  
  return (
    <DeviceContext.Provider value={{ 
      device, 
      setDevice, 
      connectionStatus, 
      isConnecting, 
      connectionError, 
      diagnosticReport,
      refreshConnectionStatus
    }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
};
