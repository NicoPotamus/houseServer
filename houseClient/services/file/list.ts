import { webrtcService } from '../webrtcService';
import { FileItem, isConnected } from './types';

/**
 * Lists files in the specified folder path via WebRTC
 */
export async function listFiles(folderPath: string = ''): Promise<FileItem[]> {
  try {
    console.log(`📂 FILE SERVICE: Attempting to list files in folder: "${folderPath}"`);
    
    // First check connection status
    if (!isConnected()) {
      const errorMsg = 'WebRTC connection not established. Please connect to a device first.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Log WebRTC connection and data channel state
    if (webrtcService.dataChannel) {
      console.log(`📡 WebRTC data channel state: ${webrtcService.dataChannel.readyState}`);
    } else {
      console.error('WebRTC data channel not initialized');
      throw new Error('WebRTC data channel not initialized. Please reconnect to the device.');
    }
    
    // Use WebRTC data channel to request file listing
    console.log(`📤 Sending WebRTC request to list files in: ${folderPath}`);
    const response = await webrtcService.sendRequest('/files', 'GET', { folderPath });
    
    console.log(`📥 Received response for file listing:`, response);
    console.log(`📊 Response summary: ${JSON.stringify(response).substring(0, 200)}...`);
    
    // Handle different response formats
    if (Array.isArray(response)) {
      console.log(`✅ Received ${response.length} files directly as array`);
      console.log(`📄 Files:`, response.map((f: any) => f.name || f));
      return response;
    } else if (response && typeof response === 'object') {
      // Check if response has a data property containing the files
      if (Array.isArray(response.data)) {
        console.log(`✅ Received ${response.data.length} files in response.data`);
        console.log(`📄 Files:`, response.data.map((f: any) => f.name || f));
        return response.data;
      } else if (Array.isArray(response.files)) {
        console.log(`✅ Received ${response.files.length} files in response.files`);
        console.log(`📄 Files:`, response.files.map((f: any) => f.name || f));
        return response.files;
      }
    }
    
    // If we can't find a valid array in the response, return empty array
    console.warn('Unexpected response format from WebRTC files API:', response);
    return [];
  } catch (error) {
    console.error('Error listing files via WebRTC:', error);
    
    // Add diagnostic info to the error message
    let errorMessage = '';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    
    // Check WebRTC specific errors
    if (webrtcService.dataChannel && webrtcService.dataChannel.readyState !== 'open') {
      errorMessage += ` (Data channel state: ${webrtcService.dataChannel.readyState})`;
    }
    
    const enhancedError = new Error(`Failed to list files: ${errorMessage}`);
    throw enhancedError;
  }
}
