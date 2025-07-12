// Re-export all file service functionality
import { listFiles } from './list';
import { deleteItem, uploadFile } from './operations';
import { FileItem, FileType, getFileType, isConnected } from './types';
import { getFileDownloadUrl, getFileViewUrl, getImagePreviewUrl, getVideoPreviewUrl } from './urls';
import { downloadFile, getFilePreview, viewFile } from './viewer';

// Create a singleton class that wraps all the functionality
class FileService {
  private static instance: FileService;
  private baseUrl: string = '';

  constructor() {
    if (FileService.instance) {
      return FileService.instance;
    }
    FileService.instance = this;
  }

  // Base URL methods (legacy - not used for WebRTC operations)
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    console.log(`Legacy base URL set to: ${url} (Note: File operations use WebRTC, not HTTP)`);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // Static utility methods
  static getFileType = getFileType;

  // Connection methods
  isConnected = isConnected;

  // File listing methods
  listFiles = listFiles;

  // File operations
  deleteItem = deleteItem;
  uploadFile = uploadFile;

  // File viewing methods
  viewFile = viewFile;
  getFilePreview = getFilePreview;
  downloadFile = downloadFile;

  // URL generation methods
  getImagePreviewUrl = getImagePreviewUrl;
  getVideoPreviewUrl = getVideoPreviewUrl;
  getFileViewUrl = getFileViewUrl;
  getFileDownloadUrl = getFileDownloadUrl;
}

// Export a singleton instance
export const fileService = new FileService();

// Export types for use elsewhere
export { FileItem, FileType };

