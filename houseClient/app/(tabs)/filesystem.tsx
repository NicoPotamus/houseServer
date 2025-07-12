import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, Linking, Modal, Image, TouchableOpacity } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { FileIcon } from '@/components/FileIcon';
import { fileService, FileItem, FileService } from '@/services/fileService';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Video from 'react-native-video';
import WebRTCFileView from '@/components/WebRTCFileView';
import { webrtcService } from '@/services/webrtcService';
import { useDevice } from '@/context/DeviceContext';

export default function FilesystemScreen() {
  const [files, setFiles] = useState<FileItem[]>([]); // Initialize with empty array
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [error, setError] = useState<string | null>(null); // Add error state
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { connectionStatus, isConnecting, connectionError, diagnosticReport, refreshConnectionStatus } = useDevice();
  const colorScheme = useColorScheme();
  const iconColor = Colors[colorScheme ?? 'light'].text;

  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  useEffect(() => {
    // Clear error message when connection status changes to Connected
    if (connectionStatus === 'Connected' && error) {
      setError(null);
    }
  }, [connectionStatus]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First check if we're connected
      if (connectionStatus !== 'Connected') {
        console.warn(`Attempted to load files when connection status is: ${connectionStatus}`);
        throw new Error('Not connected to device. Please check your WebRTC connection.');
      }
      
      // Double check the actual connection state using the file service
      const isActuallyConnected = fileService.isConnected();
      if (!isActuallyConnected) {
        console.error('Connection status shows connected but file service reports not connected');
        refreshConnectionStatus(); // Update UI connection status
        throw new Error('WebRTC connection issue detected. Data channel may not be ready.');
      }
      
      console.log(`Loading files from path: "${currentPath}"`);
      const items = await fileService.listFiles(currentPath);
      console.log(`Successfully loaded ${items.length} files/directories`);
      setFiles(Array.isArray(items) ? items : []); // Ensure we always set an array
    } catch (error) {
      console.error('Error loading files:', error);
      
      // Provide more specific error messages based on the error
      let errorMessage = 'Failed to load files';
      
      if (connectionStatus !== 'Connected') {
        errorMessage = 'Not connected to device. Please check your WebRTC connection.';
      } else if (error instanceof Error) {
        if (error.message.includes('data channel')) {
          errorMessage = 'WebRTC data channel error. Try reconnecting to the device.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setError(errorMessage);
      setFiles([]); // Reset to empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemPress = async (item: FileItem) => {
    console.log('Item pressed:', item, "Current path:", currentPath);
    
    // If it's a directory, navigate into it; if it's a file, open it
    if (item.type === 'directory') {
      setCurrentPath(currentPath ? `${currentPath}/${item.name}` : item.name);
    } else {
      try {
        // Get full path to the file
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        console.log(`Opening file: ${itemPath}`);
        
        // For image files, directly try to get the data via WebRTC
        if (item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          // Show loading state
          setSelectedFile(item);
          setFileUrl(null);
          
          // Generate WebRTC URL for the file
          const webrtcUrl = fileService.getFileViewUrl(itemPath);
          console.log(`Generated WebRTC URL for image: ${webrtcUrl}`);
          
          // Set WebRTC URL to trigger loading
          setFileUrl(webrtcUrl);
        } 
        // For other file types, show a simple metadata view
        else {
          // Show loading state
          setSelectedFile(item);
          setFileUrl(null);
          
          // Generate WebRTC URL for the file
          const webrtcUrl = fileService.getFileViewUrl(itemPath);
          console.log(`Generated WebRTC URL for non-image: ${webrtcUrl}`);
          
          // Set WebRTC URL to trigger loading
          setFileUrl(webrtcUrl);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', `Could not load this file: ${errorMessage}`);
        console.error('Error preparing file view:', error);
        
        // Clear selected file on error
        setSelectedFile(null);
      }
    }
  };

  const handleLongPress = (item: FileItem) => {
    if (item.type === 'file') {
      Alert.alert(
        'Download File',
        `Do you want to download "${item.name}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Download',
            onPress: async () => {
              try {
                // Use WebRTC for downloading
                const fileData = await fileService.downloadFile(item.path);
                
                if (fileData && fileData.data) {
                  // Here we would save the file to device storage
                  // For now just show a success message
                  Alert.alert('Success', `File downloaded: ${item.name}`);
                } else {
                  Alert.alert('Error', 'Could not download this file');
                }
              } catch (err) {
                Alert.alert('Error', 'Could not download this file');
                console.error('Error downloading file:', err);
              }
            }
          }
        ]
      );
    }
  };

  // Handle back button press
  const handleBackPress = () => {
    // If we're at root, there's nowhere to go back to
    if (!currentPath) return;
    
    // Extract the parent path by removing the last segment
    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop(); // Remove the last part
    const newPath = pathParts.length ? `/${pathParts.join('/')}` : '';
    setCurrentPath(newPath);
  };
  
  const handleRefreshConnection = () => {
    console.log('Refreshing connection status...');
    refreshConnectionStatus();
  };

  const downloadFile = async (item: FileItem) => {
    try {
      setIsLoading(true);
      // Construct the full path to the file
      const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      const url = await fileService.getFileDownloadUrl(fullPath);
      console.log(`Download URL: ${url}`);
      setFileUrl(url);
      setSelectedFile(item);
    } catch (error) {
      console.error('Error getting download URL:', error);
      Alert.alert('Error', 'Failed to download file');
    } finally {
      setIsLoading(false);
    }
  };

  const closeFileViewer = () => {
    setSelectedFile(null);
    setFileUrl(null);
  };

  // Show diagnostics to help users debug connection issues
  const runConnectionDiagnostics = async () => {
    console.log('Running connection diagnostics...');
    
    try {
      // Refresh connection status first
      refreshConnectionStatus();
      
      // Show modal with detailed diagnostics
      setShowDiagnostics(true);
      
    } catch (e) {
      console.error('Failed to generate full diagnostic report:', e);
      Alert.alert(
        'Diagnostics Error',
        'Failed to generate connection diagnostics.'
      );
    }
  };
  
  return (
    <ThemedView style={styles.container}>
      {/* Connection status indicator */}
      <View style={[styles.connectionStatus, 
        connectionStatus === 'Connected' ? styles.connectedStatus : 
        connectionStatus === 'Connecting...' ? styles.connectingStatus :
        styles.disconnectedStatus
      ]}>
        <ThemedText style={styles.connectionText}>
          {`Status: ${connectionStatus}`}
        </ThemedText>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={handleRefreshConnection}
            style={styles.refreshButton}
          >
            <ThemedText style={styles.refreshButtonText}>Refresh</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={runConnectionDiagnostics}
            style={[styles.refreshButton, styles.diagnosticsButton]}
          >
            <ThemedText style={styles.refreshButtonText}>Diagnose</ThemedText>
          </TouchableOpacity>
        </View>
        {connectionError && (
          <ThemedText style={styles.errorText}>{connectionError}</ThemedText>
        )}
      </View>
      
      {/* Header with back button and current path */}
      <View style={styles.header}>
        {currentPath && (
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={iconColor} />
            <ThemedText>Back</ThemedText>
          </Pressable>
        )}
        <ThemedText style={styles.pathText}>
          {currentPath ? currentPath : 'Files'}
        </ThemedText>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={styles.loadingText}>Loading...</ThemedText>
        </View>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <View style={styles.centerContainer}>
          <IconSymbol name="exclamationmark.triangle" size={48} color={Colors[colorScheme ?? 'light'].error} />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable style={styles.retryButton} onPress={loadFiles}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!isLoading && !error && files.length === 0 && (
        <View style={styles.centerContainer}>
          <IconSymbol name="folder" size={48} color={Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={styles.emptyText}>No files found</ThemedText>
        </View>
      )}

      {/* File list */}
      {!isLoading && !error && files.length > 0 && (
        <ScrollView style={styles.scrollView}>
          {files.map((item, index) => (
            <Pressable
              key={`${item.name}-${index}`}
              style={({ pressed }) => [
                styles.fileItem,
                pressed && styles.fileItemPressed,
              ]}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.fileItemContent}>
                {/* Use the correct file type for icons */}
                <FileIcon 
                  type={item.type === 'directory' ? 'folder' : FileService.getFileType(item.name)} 
                  size={30} 
                />
                <View style={styles.fileDetails}>
                  <ThemedText style={styles.fileName}>{`${item.name}`}</ThemedText>
                  {item.size !== undefined && (
                    <ThemedText style={styles.fileInfo}>
                      {`${formatFileSize(item.size)}`}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Diagnostics Modal */}
      <Modal 
        visible={showDiagnostics}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDiagnostics(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>WebRTC Connection Diagnostics</ThemedText>
            
            <ScrollView style={styles.diagnosticsScroll}>
              {diagnosticReport ? (
                <ThemedText style={styles.diagnosticsText}>
                  {diagnosticReport}
                </ThemedText>
              ) : (
                <ThemedText style={styles.errorText}>
                  No diagnostic information available
                </ThemedText>
              )}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowDiagnostics(false)}
            >
              <ThemedText style={styles.closeButtonText}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* File viewer modal */}
      {selectedFile && fileUrl && (
        <Modal
          visible={!!selectedFile}
          animationType="slide"
          onRequestClose={closeFileViewer}
        >
          <View style={{ flex: 1 }}>
            <WebRTCFileView
              url={fileUrl}
              onError={(error) => {
                console.error('File view error:', error);
                Alert.alert('Error', `Failed to view file: ${error.message}`);
                closeFileViewer();
              }}
              fallback={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ThemedText>Unable to display file</ThemedText>
                  <TouchableOpacity style={styles.closeButton} onPress={closeFileViewer}>
                    <ThemedText style={styles.closeButtonText}>Close</ThemedText>
                  </TouchableOpacity>
                </View>
              }
            />
            <TouchableOpacity 
              style={{ 
                position: 'absolute', 
                top: 40, 
                right: 20,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
                padding: 10
              }}
              onPress={closeFileViewer}
            >
              <ThemedText style={{ color: 'white' }}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </ThemedView>
  );
}

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // Use round instead of parseFloat to avoid decimal points
  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  pathText: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  fileItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fileItemPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  fileItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIcon: {
    marginRight: 12,
    width: 40,
    height: 40,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    marginBottom: 4,
  },
  fileInfo: {
    fontSize: 12,
    opacity: 0.7,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginTop: 8,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
  },
  connectionStatus: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  connectedStatus: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)', // Green
  },
  connectingStatus: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)', // Orange
  },
  disconnectedStatus: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)', // Red
  },
  connectionText: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  refreshButtonText: {
    color: 'white',
  },
  diagnosticsButton: {
    backgroundColor: '#673AB7',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  diagnosticsScroll: {
    width: '100%',
    maxHeight: '80%',
  },
  diagnosticsText: {
    fontFamily: 'monospace',
    fontSize: 14,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
});