import fs from 'fs';
import path from 'path';
const BASE_DIR = path.resolve('server/disk');
console.log('streamer functions loaded');
// Stream a file (e.g., video)
export const streamFile = async (req, res) => {
    const filePath = req.params.filePath || '';
    const fullPath = path.join(BASE_DIR, filePath);
    if (!fs.existsSync(fullPath)) {
        res.status(404).json({ message: 'File not found' });
        return;
    }
    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (start >= fileSize || end >= fileSize) {
            res.status(416).json({ message: 'Requested range not satisfiable' });
            return;
        }
        const chunkSize = end - start + 1;
        const file = fs.createReadStream(fullPath, { start, end });
        const headers = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, headers);
        file.pipe(res);
    }
    else {
        const headers = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, headers);
        fs.createReadStream(fullPath).pipe(res);
    }
};
