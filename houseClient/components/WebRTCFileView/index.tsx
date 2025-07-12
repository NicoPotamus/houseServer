import React, { useState, useEffect } from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
import { fileService } from '@/services/fileService';
import { ThemedText } from '@/components/ThemedText';
import { parseWebRTCUrl } from './parser';
import { styles } from './styles';

export interface WebRTCFileViewProps {
  url: string;
  style?: any;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  fallback?: React.ReactNode;
}

/**
 * A component for viewing files via WebRTC
 */
const WebRTCFileView: React.FC<WebRTCFileViewProps> = ({ url, style, onLoad, onError, fallback }) => {
  // State
  const [fileData, setFileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load file data when URL changes
  useEffect(() => {
    // Keep track of mounted state
    let isMounted = true;
    let abortController: AbortController | null = null;
    
    try {
      // Reset states when URL changes
      setLoading(true);
      setErrorMsg(null);
      setFileData(null);
      
      // Skip if no URL or not a WebRTC URL
      if (!url || !url.startsWith('webrtc://')) {
        setLoading(false);
        if (url && !url.startsWith('webrtc://')) {
          setErrorMsg('Not a WebRTC URL');
        }
        return;
      }
      
      // Parse the URL to get file info
      const urlInfo = parseWebRTCUrl(url);
      if (!urlInfo) {
        setLoading(false);
        setErrorMsg('Invalid WebRTC URL format');
        return;
      }
      
      // Extract path components
      const { type, operation, path } = urlInfo;
      console.log(`Loading ${type}/${operation} for path: ${path}`);
      
      // Create an abort controller for cleanup
      abortController = new AbortController();
      
      // Function to load the file data
      const loadFile = async () => {
        try {
          if (!isMounted) return;
          
          // Handle different file types and operations
          let data;
          
          if (type === 'file' && operation === 'view') {
            data = await fileService.viewFile(path);
          } 
          else if (type === 'file' && operation === 'download') {
            data = await fileService.downloadFile(path);
          }
          else if (type === 'preview' && operation === 'image') {
            data = await fileService.getFilePreview(path, 'image');
          }
          else if (type === 'preview' && operation === 'video') {
            data = await fileService.getFilePreview(path, 'video');
          }
          else {
            throw new Error(`Unsupported operation: ${type}/${operation}`);
          }
          
          // Update state if component is still mounted
          if (isMounted) {
            setFileData(data);
            setLoading(false);
            if (onLoad) onLoad();
          }
        } catch (err) {
          // Handle errors
          if (!isMounted) return;
          
          const errorMessage = err instanceof Error ? err.message : String(err);
          setErrorMsg(errorMessage);
          setLoading(false);
          
          if (onError) {
            onError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      };
      
      // Start loading the file
      loadFile();
    } catch (setupError) {
      // Catch any errors that might occur during setup
      console.error('Error setting up file loading:', setupError);
      if (isMounted) {
        setErrorMsg('Error preparing file view');
        setLoading(false);
      }
    }
    
    // Cleanup function
    return () => {
      console.log('Cleaning up WebRTCFileView effect for URL:', url);
      isMounted = false;
      
      // Abort any in-flight requests
      if (abortController) {
        try {
          abortController.abort();
          console.log('Successfully aborted in-flight requests');
        } catch (abortError) {
          console.error('Error aborting requests:', abortError);
        }
      }
      
      // Force cleanup of file data to help garbage collection
      setFileData(null);
    };
  }, [url, onLoad, onError]);
  
  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <ThemedText>Loading file...</ThemedText>
      </View>
    );
  }
  
  // Show error state
  if (errorMsg || !fileData) {
    return fallback || (
      <View style={[styles.container, style]}>
        <ThemedText style={styles.errorText}>
          {errorMsg || 'Failed to load file'}
        </ThemedText>
      </View>
    );
  }
  
  // Show image preview if it's an image with data
  if (fileData && fileData.mimeType?.startsWith('image/') && fileData.data) {
    return (
      <Image
        source={{ uri: `data:${fileData.mimeType};base64,${fileData.data}` }}
        style={style || styles.image}
        resizeMode="contain"
      />
    );
  }
  
  // For other file types, show metadata
  return (
    <View style={[styles.container, style]}>
      <ThemedText style={styles.fileInfo}>
        {fileData?.fileName || 'Unnamed file'}
        {fileData?.fileSize !== undefined && (
          <ThemedText style={styles.fileSize}>
            {` (${Math.round(fileData.fileSize / 1024)} KB)`}
          </ThemedText>
        )}
      </ThemedText>
      <ThemedText style={styles.mimeType}>{fileData?.mimeType || 'Unknown type'}</ThemedText>
    </View>
  );
};

export default WebRTCFileView;
