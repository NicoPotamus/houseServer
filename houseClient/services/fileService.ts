import { Platform } from 'react-native';
import { getApiUrl } from '../config/api';

const DEFAULT_API_BASE_URL = getApiUrl();

export type FileType = 'image' | 'video' | 'audio' | 'document' | 'folder' | 'other';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedDate?: string;
  preview?: string;
}

export class FileService {
  private static instance: FileService;
  private apiBaseUrl: string = DEFAULT_API_BASE_URL;

  constructor() {
    if (FileService.instance) {
      return FileService.instance;
    }
    FileService.instance = this;
  }

  static getFileType(fileName: string): FileType {
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

  setBaseUrl(baseUrl: string) {
    // Remove any trailing slashes from the base URL and ensure proper protocol
    let url = baseUrl.replace(/\/+$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    this.apiBaseUrl = url;
  }

  getBaseUrl(): string {
    return this.apiBaseUrl;
  }

  private constructUrl(path: string): string {
    // Remove leading slashes from path and ensure proper URL construction
    const cleanPath = path.replace(/^\/+/, '');
    return `${this.apiBaseUrl}/${cleanPath}`;
  }

  async listFiles(folderPath: string = ''): Promise<FileItem[]> {
    try {
      const url = this.constructUrl(`files/?folderPath=${encodeURIComponent(folderPath)}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to list files');
      }
      
      const data = await response.json();
      
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data && typeof data === 'object') {
        // Check if response has a data property containing the files
        if (Array.isArray(data.data)) {
          return data.data;
        } else if (Array.isArray(data.files)) {
          return data.files;
        }
      }
      
      // If we can't find a valid array in the response, return empty array
      console.warn('Unexpected response format from files API:', data);
      return [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async deleteItem(filePath: string): Promise<void> {
    const url = this.constructUrl(`files/delete/${encodeURIComponent(filePath)}`);
    const response = await fetch(url, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete item');
  }

  async uploadFile(folderPath: string, fileUri: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'application/octet-stream',
      name: fileUri.split('/').pop(),
    } as any);

    const url = this.constructUrl(`files/${encodeURIComponent(folderPath)}`);
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (!response.ok) throw new Error('Failed to upload file');
  }

  async viewFile(filePath: string): Promise<Response> {
    try {
      const url = this.getFileViewUrl(filePath);  // getFileViewUrl already uses constructUrl
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',  // Accept any content type
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error('Error viewing file:', error);
      throw error;
    }
  }

  getImagePreviewUrl(filePath: string): string {
    return this.constructUrl(`files/${encodeURIComponent(filePath)}/image-preview`);
  }

  getVideoPreviewUrl(filePath: string): string {
    return this.constructUrl(`files/${encodeURIComponent(filePath)}/video-preview`);
  }

  getFileViewUrl(filePath: string): string {
    return this.constructUrl(`files/view/${encodeURIComponent(filePath)}`);
  }

  getFileDownloadUrl(filePath: string): string {
    return this.constructUrl(`files/download/${encodeURIComponent(filePath)}`);
  }
}

export const fileService = new FileService();