import { Platform } from 'react-native';

// Get the API base URL from environment or use development fallbacks
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 
  (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' ? 
    `${window.location.protocol}//${window.location.hostname}:8080` : 
    'http://localhost:8080');

// Define your local development machine's IP address here
// This is needed for mobile devices to connect to your development machine
export const DEV_MACHINE_IP = process.env.EXPO_PUBLIC_DEV_MACHINE_IP || '192.168.1.X'; // Replace with your actual IP address

export const getApiUrl = () => {
  // Use development machine IP when running on a physical device or emulator
  if (process.env.NODE_ENV === 'development' && !process.env.EXPO_PUBLIC_API_BASE_URL) {
    // On mobile devices, we need to use the dev machine's IP instead of localhost
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      return `http://${DEV_MACHINE_IP}:8080`;
    }
  }
  return API_BASE_URL;
};

// Get WebSocket URL for signaler
export const getSignalerUrl = () => {
  const baseUrl = getApiUrl().replace(/^http/, 'ws');
  return baseUrl;
};