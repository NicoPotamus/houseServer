import { webrtcService } from '../webrtcService';

export type FileType = 'image' | 'video' | 'audio' | 'document' | 'folder' | 'other';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedDate?: string;
  preview?: string;
}

/**
 * Helper function to determine the type of file based on its extension
 */
export function getFileType(fileName: string): FileType {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
  const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'md'];

  if (imageExtensions.includes(extension)) return 'image';
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (documentExtensions.includes(extension)) return 'document';
  
  return 'other';
}

/**
 * Check if the WebRTC connection is established and ready
 * @returns boolean indicating if the connection is ready for file operations
 */
export function isConnected(): boolean {
  // Check if webrtcService is initialized
  if (!webrtcService) {
    console.warn('WebRTC service not initialized');
    return false;
  }
  
  // Check if data channel exists
  if (!webrtcService.dataChannel) {
    console.warn('WebRTC data channel not created');
    return false;
  }
  
  // Check data channel state
  if (webrtcService.dataChannel.readyState !== 'open') {
    console.warn(`WebRTC data channel state: ${webrtcService.dataChannel.readyState}`);
    return false;
  }
  
  // Check if the connection status API exists and is usable
  if (typeof webrtcService.getConnectionStatus === 'function') {
    const status = webrtcService.getConnectionStatus();
    if (!status.isConnected) {
      console.warn(`WebRTC not fully connected: ${JSON.stringify(status)}`);
      return false;
    }
    return true;
  }
  
  // If we got here, the data channel is open
  return true;
}
