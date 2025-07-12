import { webrtcService } from '../webrtcService';

/**
 * Delete a file or directory
 */
export async function deleteItem(filePath: string): Promise<void> {
  try {
    await webrtcService.sendRequest(`/files/${filePath}`, 'DELETE');
  } catch (error) {
    console.error('Error deleting item via WebRTC:', error);
    throw new Error('Failed to delete item');
  }
}

/**
 * Upload a file
 */
export async function uploadFile(folderPath: string, fileUri: string): Promise<void> {
  try {
    // For WebRTC, we need to handle file uploads differently
    // First, get the file content as base64 or binary data
    const fileInfo = {
      uri: fileUri,
      name: fileUri.split('/').pop(),
      folderPath
    };
    
    await webrtcService.sendRequest(`/files/upload`, 'POST', { 
      fileInfo,
      // Note: In a real implementation, you would need to 
      // read the file and convert it to a format that can be sent over WebRTC
      // This might involve chunking for large files
    });
  } catch (error) {
    console.error('Error uploading file via WebRTC:', error);
    throw new Error('Failed to upload file');
  }
}
