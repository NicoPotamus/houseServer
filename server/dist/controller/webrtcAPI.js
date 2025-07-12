/**
 * WebRTC API Router for handling API requests via WebRTC data channel
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Get the __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Base directory for the mounted Docker volume (should match diskController.ts)
const BASE_DIR = "/usr/src/app/disk";
// Handle API requests received via WebRTC data channel
export async function handleDataChannelMessage(message, dataChannel) {
    console.log('Received request via WebRTC:', message);
    // Only handle request messages
    if (message.type !== 'request') {
        console.log('Ignoring non-request message type:', message.type);
        return;
    }
    const { id, endpoint, method, params } = message;
    try {
        // Route to the appropriate handler based on endpoint
        if (endpoint.startsWith('/files')) {
            await handleFileEndpoint(endpoint, method, params, id, dataChannel);
        }
        else if (endpoint === '/device-info') {
            await handleDeviceInfoEndpoint(id, dataChannel);
        }
        else {
            // Unsupported endpoint
            sendErrorResponse(dataChannel, id, `Endpoint not supported: ${endpoint}`, 404);
        }
    }
    catch (error) {
        console.error('Error handling WebRTC API request:', error);
        sendErrorResponse(dataChannel, id, `Server error: ${error?.message || 'Unknown error'}`, 500);
    }
}
// Helper function to send a success response
function sendSuccessResponse(dataChannel, id, result) {
    const response = {
        type: 'response',
        id,
        result
    };
    dataChannel.send(JSON.stringify(response));
}
// Helper function to send an error response
function sendErrorResponse(dataChannel, id, message, code = 500) {
    const response = {
        type: 'response',
        id,
        error: { message, code }
    };
    dataChannel.send(JSON.stringify(response));
}
// Handle file-related endpoints
async function handleFileEndpoint(endpoint, method, params, id, dataChannel) {
    try {
        // List files in a directory
        if (endpoint === '/files' && method === 'GET') {
            const folderPath = params?.folderPath || '/';
            // Use our own implementation for file listing that doesn't depend on Express
            const files = await listFilesForWebRTC(folderPath);
            sendSuccessResponse(dataChannel, id, files);
        }
        // Get file content or binary data
        else if (endpoint.startsWith('/files/view/') && method === 'GET') {
            const filePath = endpoint.replace('/files/view/', '');
            const fullPath = path.join('/usr/src/app/disk', filePath);
            // Check if the file exists
            if (!fs.existsSync(fullPath)) {
                return sendErrorResponse(dataChannel, id, `File not found: ${filePath}`, 404);
            }
            // Get file stats for size and type info
            const stats = fs.statSync(fullPath);
            // For WebRTC, we can include a small amount of binary data directly for small files
            const mimeType = getMimeType(filePath);
            let fileData = null;
            // Only include base64 data for small images that would be directly displayed
            if (mimeType.startsWith('image/') && stats.size < 2 * 1024 * 1024) { // < 2MB
                // Read file data as base64
                try {
                    const buffer = fs.readFileSync(fullPath);
                    fileData = buffer.toString('base64');
                }
                catch (err) {
                    console.error('Error reading file data:', err);
                }
            }
            sendSuccessResponse(dataChannel, id, {
                url: `file://${filePath}`,
                fileName: path.basename(filePath),
                fileSize: stats.size,
                mimeType,
                lastModified: stats.mtime.toISOString(),
                data: fileData, // May be null for large files
                isBase64: fileData !== null
            });
        }
        // Delete a file or directory
        else if (endpoint.match(/^\/files\/[^/]+$/) && method === 'DELETE') {
            const filePath = endpoint.replace('/files/', '');
            const fullPath = path.join('/usr/src/app/disk', filePath);
            if (!fs.existsSync(fullPath)) {
                return sendErrorResponse(dataChannel, id, `File not found: ${filePath}`, 404);
            }
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                fs.rmdirSync(fullPath, { recursive: true });
            }
            else {
                fs.unlinkSync(fullPath);
            }
            sendSuccessResponse(dataChannel, id, { deleted: true, path: filePath });
        }
        // Upload a file
        else if (endpoint === '/files/upload' && method === 'POST') {
            if (!params || !params.fileInfo) {
                return sendErrorResponse(dataChannel, id, 'Missing file information', 400);
            }
            const { fileInfo } = params;
            const folderPath = fileInfo.folderPath || '/';
            // Ensure the target directory exists
            const targetDir = path.join('/usr/src/app/disk', folderPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            // For WebRTC uploads, we'd normally receive file data in chunks or as base64
            // We'd need to implement the actual file write logic based on how the client sends data
            // This is a placeholder for the file upload implementation
            // In a real implementation, we'd handle the file data from params.fileData
            if (!fileInfo.name) {
                return sendErrorResponse(dataChannel, id, 'Missing file name', 400);
            }
            const targetPath = path.join(targetDir, fileInfo.name);
            // Placeholder: Write empty file or decode base64 data if provided
            if (params.fileData && params.isBase64) {
                // Write base64 decoded data
                const buffer = Buffer.from(params.fileData, 'base64');
                fs.writeFileSync(targetPath, buffer);
            }
            else {
                // Just create an empty file as a placeholder
                fs.writeFileSync(targetPath, '');
            }
            sendSuccessResponse(dataChannel, id, {
                uploaded: true,
                path: path.join(folderPath, fileInfo.name).replace(/\\/g, '/')
            });
        }
        // Get file preview (image thumbnail or video thumbnail)
        else if (endpoint.match(/^\/files\/preview\/(image|video)\//) && method === 'GET') {
            const match = endpoint.match(/^\/files\/preview\/(image|video)\/(.+)$/);
            if (!match) {
                return sendErrorResponse(dataChannel, id, 'Invalid preview path', 400);
            }
            const previewType = match[1]; // 'image' or 'video'
            const filePath = match[2];
            // In a real implementation, we'd generate thumbnails
            // For now, just return metadata about what would be generated
            sendSuccessResponse(dataChannel, id, {
                previewType,
                filePath,
                previewAvailable: false, // Set to true when you implement actual preview generation
                message: 'Preview generation not implemented yet'
            });
        }
        // Download a file
        else if (endpoint.match(/^\/files\/download\//) && method === 'GET') {
            const filePath = endpoint.replace('/files/download/', '');
            const fullPath = path.join('/usr/src/app/disk', filePath);
            if (!fs.existsSync(fullPath)) {
                return sendErrorResponse(dataChannel, id, `File not found: ${filePath}`, 404);
            }
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                return sendErrorResponse(dataChannel, id, `Cannot download a directory: ${filePath}`, 400);
            }
            // For WebRTC, large files should be chunked
            // This is a simplified implementation for small files
            if (stats.size > 10 * 1024 * 1024) { // > 10MB
                return sendSuccessResponse(dataChannel, id, {
                    fileName: path.basename(filePath),
                    fileSize: stats.size,
                    mimeType: getMimeType(filePath),
                    tooLarge: true,
                    message: 'File too large for direct WebRTC download, implement chunking'
                });
            }
            try {
                const buffer = fs.readFileSync(fullPath);
                const base64Data = buffer.toString('base64');
                sendSuccessResponse(dataChannel, id, {
                    fileName: path.basename(filePath),
                    fileSize: stats.size,
                    mimeType: getMimeType(filePath),
                    data: base64Data,
                    isBase64: true
                });
            }
            catch (err) {
                console.error('Error reading file for download:', err);
                sendErrorResponse(dataChannel, id, `Error reading file: ${err?.message || 'Unknown error'}`, 500);
            }
        }
        else {
            // Unsupported file operation
            sendErrorResponse(dataChannel, id, `Unsupported file operation: ${method} ${endpoint}`, 400);
        }
    }
    catch (error) {
        console.error('Error handling file operation:', error);
        sendErrorResponse(dataChannel, id, `File operation error: ${error?.message || 'Unknown error'}`, 500);
    }
}
// Handle device info endpoint
async function handleDeviceInfoEndpoint(id, dataChannel) {
    try {
        const os = require('os');
        // Get basic device info
        const deviceInfo = {
            hostname: os.hostname(),
            platform: process.platform,
            arch: process.arch,
            cpus: os.cpus().length,
            freemem: os.freemem(),
            totalmem: os.totalmem(),
            uptime: os.uptime()
        };
        // Get server-specific device info from JSON if available
        try {
            const deviceJsonPath = '/usr/src/app/disk/device.json';
            if (fs.existsSync(deviceJsonPath)) {
                const deviceData = JSON.parse(fs.readFileSync(deviceJsonPath, 'utf-8'));
                Object.assign(deviceInfo, deviceData);
            }
        }
        catch (e) {
            console.warn('Failed to load device.json', e);
        }
        sendSuccessResponse(dataChannel, id, deviceInfo);
    }
    catch (error) {
        console.error('Error handling device info endpoint:', error);
        sendErrorResponse(dataChannel, id, `Failed to get device info: ${error?.message || 'Unknown error'}`, 500);
    }
}
// Helper function to determine MIME type based on file extension
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
/**
 * List files in a directory for WebRTC API
 * This is a simplified version of the diskController.listFiles function
 * that works without Express request/response
 */
async function listFilesForWebRTC(folderPath) {
    console.log("listFilesForWebRTC called with folderPath:", folderPath);
    const fullPath = path.join(BASE_DIR, folderPath);
    try {
        if (!fs.existsSync(fullPath)) {
            throw new Error("Folder does not exist");
        }
        const files = fs.readdirSync(fullPath);
        const fileList = [];
        for (const file of files) {
            const filePath = path.join(fullPath, file);
            const stats = fs.statSync(filePath);
            const relativePath = path.join(folderPath, file).replace(/\\/g, '/');
            const fileInfo = {
                name: file,
                path: relativePath,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modifiedDate: stats.mtime.toISOString()
            };
            // If it's an image, add a preview path
            if (!stats.isDirectory()) {
                const ext = path.extname(file).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                    fileInfo.preview = `/thumbnails/${relativePath}`;
                }
            }
            fileList.push(fileInfo);
        }
        return fileList;
    }
    catch (error) {
        console.error("Error listing files:", error);
        throw error;
    }
}
