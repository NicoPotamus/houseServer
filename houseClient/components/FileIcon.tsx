import React from 'react';
import { IconSymbol } from './ui/IconSymbol';
import { FileType } from '../services/fileService';

interface FileIconProps {
  type: FileType | 'directory';
  color?: string;
  size?: number;
}

export function FileIcon({ type, color = '#000', size = 24 }: FileIconProps) {
  const getIconName = () => {
    switch (type) {
      case 'directory':
      case 'folder':
        return 'folder.fill';
      case 'image':
        return 'photo.fill';
      case 'video':
        return 'play.rectangle.fill';
      case 'audio':
        return 'music.note';
      case 'document':
        return 'doc.fill';
      default:
        return 'doc';
    }
  };

  // Ensure name prop is safe
  const iconName = getIconName();
  
  return <IconSymbol name={iconName} color={color} size={size} />;
}