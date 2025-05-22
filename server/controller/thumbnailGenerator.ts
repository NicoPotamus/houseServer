import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';

declare module 'fluent-ffmpeg';

const BASE_DIR = path.resolve('server/disk');
const THUMBNAIL_DIR = path.resolve('server/disk/thumbnails');

// Ensure the thumbnail directory exists
if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

console.log('thumbnailGenerator functions loaded');

// Generate a thumbnail for an image
export const generateImageThumbnail = async (filePath: string): Promise<string> => {
    const thumbnailPath = path.join(THUMBNAIL_DIR, `${path.basename(filePath)}_thumbnail.jpg`);
    await sharp(filePath)
        .resize(200, 200, { fit: 'inside' })
        .toFile(thumbnailPath);
    return thumbnailPath;
};

// Generate a preview for a video
export const generateVideoPreview = async (filePath: string): Promise<string> => {
    const previewPath = path.join(THUMBNAIL_DIR, `${path.basename(filePath)}_preview.jpg`);
    return new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .screenshots({
                timestamps: ['50%'],
                filename: path.basename(previewPath),
                folder: path.dirname(previewPath),
                size: '200x200',
            })
            .on('end', () => resolve(previewPath))
            .on('error', (err: Error) => reject(err));
    });
};

// Public endpoint to get a thumbnail for an image
export const getImageThumbnail = async (req: Request, res: Response): Promise<void> => {
    const filePath = path.join(BASE_DIR, req.params.filePath);

    if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: 'Image not found' });
        return;
    }

    try {
        const thumbnailPath = await generateImageThumbnail(filePath);
        res.sendFile(thumbnailPath);
    } catch (error) {
        console.error('Error generating image thumbnail:', error);
        res.status(500).json({ message: 'Error generating image thumbnail', error: (error as Error).message });
    }
};

// Public endpoint to get a preview for a video
export const getVideoPreview = async (req: Request, res: Response): Promise<void> => {
    const filePath = path.join(BASE_DIR, req.params.filePath);

    if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }

    try {
        const previewPath = await generateVideoPreview(filePath);
        res.sendFile(previewPath);
    } catch (error) {
        console.error('Error generating video preview:', error);
        res.status(500).json({ message: 'Error generating video preview', error: (error as Error).message });
    }
};