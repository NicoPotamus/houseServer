import fs from 'fs';
import path from 'path';
const BASE_DIR = path.resolve('server/disk');
console.log('streamer functions loaded');
// View functions
export function viewPDF(fullPath, res) {
    streamWithHeaders(fullPath, res, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline'
    });
}
export function viewImage(fullPath, res) {
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    streamWithHeaders(fullPath, res, {
        'Content-Type': contentType,
        'Content-Disposition': 'inline'
    });
}
export function streamFile(fullPath, res, mimeType = 'video/mp4') {
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
        '.mkv': 'video/webm',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo'
    };
    const actualMimeType = mimeTypes[ext] || mimeType;
    streamWithHeaders(fullPath, res, {
        'Content-Type': actualMimeType,
        'Content-Disposition': 'inline'
    });
}
// Download functions
export function forceDownloadPDF(fullPath, res) {
    streamWithHeaders(fullPath, res, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${path.basename(fullPath)}"`
    });
}
export function forceDownloadImage(fullPath, res) {
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    streamWithHeaders(fullPath, res, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${path.basename(fullPath)}"`
    });
}
export function forceDownloadStream(fullPath, res, mimeType = 'application/octet-stream') {
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
        '.mkv': 'video/webm',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo'
    };
    const actualMimeType = mimeTypes[ext] || mimeType;
    streamWithHeaders(fullPath, res, {
        'Content-Type': actualMimeType,
        'Content-Disposition': `attachment; filename="${path.basename(fullPath)}"`
    });
}
// Helper function to handle streaming with headers
function streamWithHeaders(fullPath, res, headers) {
    try {
        const stat = fs.statSync(fullPath);
        const range = res.req.headers.range;
        // Add common headers for better mobile compatibility
        const commonHeaders = {
            ...headers,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type'
        };
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            if (start >= stat.size || end >= stat.size) {
                res.status(416).json({ message: 'Requested range not satisfiable' });
                return;
            }
            const chunkSize = end - start + 1;
            const stream = fs.createReadStream(fullPath, { start, end });
            res.writeHead(206, {
                ...commonHeaders,
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Content-Length': chunkSize,
            });
            stream.pipe(res);
        }
        else {
            res.writeHead(200, {
                ...commonHeaders,
                'Content-Length': stat.size,
            });
            fs.createReadStream(fullPath)
                .on('error', (error) => {
                console.error("Error streaming file:", error);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            })
                .pipe(res);
        }
    }
    catch (error) {
        console.error("Error handling stream:", error);
        if (!res.headersSent) {
            res.status(500).end();
        }
    }
}
