/**
 * This file is a backwards-compatible wrapper around the new file service structure.
 * It re-exports everything from the new file module structure to maintain compatibility
 * with existing code that imports from this file.
 */

import { fileService as fileSvc, FileType, FileItem } from './file';

// Re-export the singleton instance and types
export { FileType, FileItem };
export const fileService = fileSvc;

// Re-export the FileService class to maintain backward compatibility
export class FileService {
  private static instance: FileService;
  private baseUrl: string = '';

  constructor() {
    if (FileService.instance) {
      return FileService.instance;
    }
    FileService.instance = this;
  }

  // Forward static methods
  static getFileType(fileName: string): FileType {
    return fileSvc.constructor.prototype.getFileType(fileName);
  }
  
  // Re-export instance methods by forwarding to the singleton
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    console.log(`Base URL set to: ${url}`);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  isConnected(): boolean {
    return fileSvc.isConnected();
  }

  async listFiles(folderPath: string = ''): Promise<FileItem[]> {
    return fileSvc.listFiles(folderPath);
  }

  async deleteItem(filePath: string): Promise<void> {
    return fileSvc.deleteItem(filePath);
  }

  async uploadFile(folderPath: string, fileUri: string): Promise<void> {
    return fileSvc.uploadFile(folderPath, fileUri);
  }

  async viewFile(filePath: string): Promise<any> {
    return fileSvc.viewFile(filePath);
  }

  getImagePreviewUrl(filePath: string): string {
    return fileSvc.getImagePreviewUrl(filePath);
  }

  getVideoPreviewUrl(filePath: string): string {
    return fileSvc.getVideoPreviewUrl(filePath);
  }

  getFileViewUrl(filePath: string): string {
    return fileSvc.getFileViewUrl(filePath);
  }

  getFileDownloadUrl(filePath: string): string {
    return fileSvc.getFileDownloadUrl(filePath);
  }

  async getFilePreview(filePath: string, type: 'image' | 'video' = 'image'): Promise<any> {
    return fileSvc.getFilePreview(filePath, type);
  }

  async downloadFile(filePath: string): Promise<any> {
    return fileSvc.downloadFile(filePath);
  }
}