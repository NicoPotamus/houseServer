import { webrtcService } from '../webrtcService';

/**
 * Get detailed information about a file for viewing
 */
export async function viewFile(filePath: string): Promise<any> {
  if (!filePath) {
    throw new Error('File path is required');
  }
  
  console.log(`👁️ FILE SERVICE: Fetching file via WebRTC: ${filePath}`);
  
  try {
    // Safety check for WebRTC service connection
    if (!webrtcService || typeof webrtcService.sendRequest !== 'function') {
      throw new Error('WebRTC service not initialized or connected');
    }
    
    // Get file view info via WebRTC
    const endpoint = `/files/view/${encodeURIComponent(filePath)}`;
    console.log(`📤 Sending view request to endpoint: ${endpoint}`);
    
    const fileInfo = await webrtcService.sendRequest(endpoint, 'GET');
    
    if (!fileInfo) {
      throw new Error('No file data returned from server');
    }
    
    console.log(`📥 Received file info for ${filePath}:`, fileInfo);
    console.log(`📊 File details:`, 
      fileInfo.fileName ? `(${fileInfo.fileName}, ${fileInfo.fileSize || 'unknown'} bytes)` : 'No file name/size info');
    
    return fileInfo;
  } catch (error) {
    console.error('Error viewing file via WebRTC:', error);
    // Add more context to the error to help debugging
    const enhancedError = new Error(`Failed to view file "${filePath}": ${(error as Error)?.message || 'Unknown error'}`);
    throw enhancedError;
  }
}

/**
 * Get a preview image for a file via WebRTC
 * This method actually fetches the data rather than just returning a URL
 */
export async function getFilePreview(filePath: string, type: 'image' | 'video' = 'image'): Promise<any> {
  try {
    const endpoint = `/files/preview/${type}/${filePath}`;
    return await webrtcService.sendRequest(endpoint, 'GET');
  } catch (error) {
    console.error(`Error getting ${type} preview via WebRTC:`, error);
    throw error;
  }
}

/**
 * Download a file via WebRTC
 */
export async function downloadFile(filePath: string): Promise<any> {
  try {
    return await webrtcService.sendRequest(`/files/download/${filePath}`, 'GET');
  } catch (error) {
    console.error('Error downloading file via WebRTC:', error);
    throw error;
  }
}
