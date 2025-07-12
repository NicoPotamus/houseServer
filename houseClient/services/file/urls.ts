/**
 * Get URL for image preview
 */
export function getImagePreviewUrl(filePath: string): string {
  // For images, we'll need to request preview data via WebRTC
  // and display it in the UI directly.
  // For now, we'll return a placeholder that the UI code will need to handle
  return `webrtc://preview/image/${filePath}`;
}

/**
 * Get URL for video preview
 */
export function getVideoPreviewUrl(filePath: string): string {
  // Same approach for video previews
  return `webrtc://preview/video/${filePath}`;
}

/**
 * Get URL for file viewing
 */
export function getFileViewUrl(filePath: string): string {
  // Return a special URL scheme that the application will intercept
  // and use WebRTC to fetch the file data
  return `webrtc://file/view/${filePath}`;
}

/**
 * Get URL for file download
 */
export function getFileDownloadUrl(filePath: string): string {
  // Return a special URL scheme for downloads
  return `webrtc://file/download/${filePath}`;
}
