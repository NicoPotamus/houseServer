import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { createUser, getUser, updateUser, deleteUser, loginUser } from './controller/userController.js';
import { listFiles, uploadFile, downloadFile, deleteItem, viewFile, testPDF } from './controller/diskController.js';
import { getImageThumbnail, getVideoPreview } from './controller/thumbnailGenerator.js';
import multer from 'multer';

const app = express();
const port = process.env.PORT || 3000;

// Set up multer for file uploads
const upload = multer({ dest: 'server/disk/temp/' });

// Middleware
app.use(cors());
app.use(express.json());

// User routes
app.post('/users', createUser);
app.get('/users/:id', getUser);
app.put('/users/:id', updateUser);
app.delete('/users/:id', deleteUser);
app.post('/login', loginUser as RequestHandler);

// File routes
app.get('/test-pdf/:folderPath?', testPDF);  // Test endpoint that accepts add ?filepath query parameter
app.get('/files/view/:filePath(*)', viewFile);
app.get('/files/download/:filePath(*)', downloadFile);  // Allow any path character including slashes
app.delete('/files/delete/:filePath(*)', deleteItem);   // Allow any path character including slashes
app.post('/files/:folderPath?', upload.single('file'), uploadFile);
app.get('/files/:filePath/image-preview', getImageThumbnail);
app.get('/files/:filePath/video-preview', getVideoPreview);
app.get('/files/:folderPath?', listFiles);


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});