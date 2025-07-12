/**
 * Helper to parse WebRTC URLs
 */
export function parseWebRTCUrl(url: string): { type: string, operation: string, path: string } | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  if (!url.startsWith('webrtc://')) {
    return null;
  }
  
  try {
    // Remove the webrtc:// prefix
    const withoutProtocol = url.substring(9);
    
    // Split into segments
    const segments = withoutProtocol.split('/');
    
    if (segments.length < 2) {
      return null;
    }
    
    // Filter out empty segments that might come from double slashes
    const filteredSegments = segments.filter(segment => segment.length > 0);
    
    if (filteredSegments.length < 2) {
      return null;
    }
    
    const type = filteredSegments[0]; // 'file', 'preview', etc.
    const operation = filteredSegments[1]; // 'view', 'download', 'image', 'video', etc.
    
    // Combine the rest of the path
    const path = filteredSegments.slice(2).join('/');
    
    // Validate the path is not empty
    if (!path) {
      return null;
    }
    
    return { type, operation, path };
  } catch (e) {
    return null;
  }
}
