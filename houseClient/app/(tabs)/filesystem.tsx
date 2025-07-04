import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, Linking, Modal, Image } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { FileIcon } from '@/components/FileIcon';
import { fileService, FileItem, FileService } from '@/services/fileService';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Video from 'react-native-video';

export default function FilesystemScreen() {
  const [files, setFiles] = useState<FileItem[]>([]); // Initialize with empty array
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [error, setError] = useState<string | null>(null); // Add error state
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const iconColor = Colors[colorScheme ?? 'light'].text;

  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const items = await fileService.listFiles(currentPath);
      setFiles(Array.isArray(items) ? items : []); // Ensure we always set an array
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Failed to load files');
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
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        const response = await fileService.viewFile(itemPath);
        const contentType = response.headers.get('Content-Type');
        const blob = await response.blob();
        const fileUrl = URL.createObjectURL(blob);

        setSelectedFile(item);
        setFileUrl(fileUrl);
      } catch (error) {
        Alert.alert('Error', 'Could not load this file');
        console.error('Error loading file:', error);
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
            onPress: () => {
              const downloadUrl = fileService.getFileDownloadUrl(item.path);
              Linking.openURL(downloadUrl).catch(err => {
                Alert.alert('Error', 'Could not download this file');
                console.error('Error downloading file:', err);
              });
            }
          }
        ]
      );
    }
  };

  const handleBackPress = () => {
    if (!currentPath) return;
    const newPath = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(newPath);
  };

  const getFileIconType = (item: FileItem) => {
    if (item.type === 'directory') return 'directory';
    return FileService.getFileType(item.name);
  };

  const renderFileViewer = () => {
    if (!selectedFile || !fileUrl) return null;

    if (selectedFile.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
      return <Image source={{ uri: fileUrl }} style={styles.fileViewerImage} />;
    } else if (selectedFile.name.match(/\.(mp4|mkv|avi|mov|wmv|flv)$/i)) {
      return (
        <Video
          source={{ uri: fileUrl }}
          style={styles.fileViewerVideo}
          controls
        />
      );
    } else {
      return <ThemedText>Cannot preview this file type.</ThemedText>;
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header with back button and current path */}
      <View style={styles.header}>
        {currentPath && (
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={iconColor} />
            <ThemedText>Back</ThemedText>
          </Pressable>
        )}
        <ThemedText style={styles.pathText}>
          {currentPath || 'Files'}
        </ThemedText>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={iconColor} />
          <ThemedText style={styles.loadingText}>Loading files...</ThemedText>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.centerContainer}>
          <IconSymbol name="xmark.circle.fill" size={48} color={Colors[colorScheme ?? 'light'].error} />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable 
            onPress={loadFiles}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed
            ]}
          >
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </View>
      )}

      {/* File list */}
      {!isLoading && !error && (
        <ScrollView style={styles.fileList}>
          {files.map((item, index) => (
            <Pressable
              key={item.path + index}
              style={({ pressed }) => [
                styles.fileItem,
                pressed && styles.fileItemPressed
              ]}
              onPress={() => handleItemPress(item)}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={500}
            >
              <View style={styles.fileItemContent}>
                <FileIcon 
                  type={getFileIconType(item)} 
                  size={24} 
                  color={iconColor}
                />
                <View style={styles.fileDetails}>
                  <ThemedText>{item.name}</ThemedText>
                  {item.size !== undefined && (
                    <ThemedText style={styles.fileSize}>
                      {formatFileSize(item.size)}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
          
          {/* Empty state */}
          {files.length === 0 && (
            <View style={styles.centerContainer}>
              <IconSymbol name="folder.fill" size={48} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.emptyText}>This folder is empty</ThemedText>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!selectedFile} animationType="slide" onRequestClose={() => setSelectedFile(null)}>
        <ThemedView style={styles.fileViewerContainer}>
          <Pressable onPress={() => setSelectedFile(null)} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={iconColor} />
          </Pressable>
          {renderFileViewer()}
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  pathText: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  fileList: {
    flex: 1,
  },
  fileItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fileItemPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  fileItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.error,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fileViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 100,
  },
  fileViewerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  fileViewerVideo: {
    width: '100%',
    height: 300,
  },
});