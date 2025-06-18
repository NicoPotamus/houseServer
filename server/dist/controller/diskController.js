/**
 * this is  the controller for the disk, read write,
 * server/disk is the mounintg point for the disk
 */
import fs from "fs";
import path from "path";
import { generateImageThumbnail, generateVideoPreview, } from "./thumbnailGenerator.js";
import { viewPDF, viewImage, streamFile, forceDownloadPDF, forceDownloadImage, forceDownloadStream } from "./streamer.js";
// Base directory for the mounted Docker volume
const BASE_DIR = "/usr/src/app/server/disk";
// List files in a directory
export const listFiles = async (req, res) => {
    console.log("listFiles called with folderPath:", req.query.folderPath);
    const folderPath = req.query.folderPath || "";
    const fullPath = path.join(BASE_DIR, folderPath);
    try {
        if (!fs.existsSync(fullPath)) {
            res.status(404).json({ message: "Folder does not exist" });
            return;
        }
        const files = fs.readdirSync(fullPath);
        const fileDetails = await Promise.all(files.map(async (file) => {
            const filePath = path.join(fullPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                const extension = path.extname(file).toLowerCase();
                let preview = null;
                if ([".jpg", ".jpeg", ".png", ".gif"].includes(extension)) {
                    preview = await generateImageThumbnail(filePath);
                }
                else if ([".mp4", ".mkv", ".avi"].includes(extension)) {
                    preview = await generateVideoPreview(filePath);
                }
                return {
                    name: file,
                    type: "file",
                    size: stats.size,
                    preview,
                };
            }
            else {
                return {
                    name: file,
                    type: "folder",
                };
            }
        }));
        res.status(200).json({ files: fileDetails });
    }
    catch (error) {
        console.error("Error listing files:", error);
        res
            .status(500)
            .json({
            message: "Error listing files",
            error: error.message,
        });
    }
};
// Create a folder
export const createFolder = async (req, res) => {
    console.log("createFolder called with folderPath:", req.params.folderPath);
    const folderPath = req.params.folderPath || "";
    const fullPath = path.join(BASE_DIR, folderPath);
    try {
        if (fs.existsSync(fullPath)) {
            res.status(400).json({ message: "Folder already exists" });
            return;
        }
        fs.mkdirSync(fullPath, { recursive: true });
        res.status(201).json({ message: "Folder created successfully" });
    }
    catch (error) {
        console.error("Error creating folder:", error);
        res
            .status(500)
            .json({
            message: "Error creating folder",
            error: error.message,
        });
    }
};
// Upload a file
export const uploadFile = async (req, res) => {
    console.log("uploadFile called with folderPath:", req.params.folderPath, "and file:", req.file);
    const folderPath = req.params.folderPath || "";
    const file = req.file; // Assuming you're using multer for file handling
    if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
    }
    const fullPath = path.join(BASE_DIR, folderPath, file.originalname);
    try {
        fs.renameSync(file.path, fullPath);
        res
            .status(200)
            .json({ message: "File uploaded successfully", filePath: fullPath });
    }
    catch (error) {
        console.error("Error uploading file:", error);
        res
            .status(500)
            .json({
            message: "Error uploading file",
            error: error.message,
        });
    }
};
// Delete a file or folder
export const deleteItem = async (req, res) => {
    console.log("deleteItem called with itemPath:", req.params.filePath);
    const itemPath = req.params.filePath || "";
    const fullPath = path.join(BASE_DIR, itemPath);
    console.log("Deleting item at path:", fullPath);
    try {
        if (!fs.existsSync(fullPath)) {
            res.status(404).json({ message: "Item not found" });
            return;
        }
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
        else {
            fs.unlinkSync(fullPath);
        }
        res.status(200).json({ message: "Item deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting item:", error);
        res
            .status(500)
            .json({
            message: "Error deleting item",
            error: error.message,
        });
    }
};
// View a file
export const viewFile = (req, res) => {
    console.log("viewFile called with filePath:", req.params.filePath);
    try {
        const filePath = req.params.filePath || "";
        const fullPath = path.join(BASE_DIR, filePath);
        const forceDownload = req.query.download === 'true';
        if (!fs.existsSync(fullPath)) {
            res.status(404).json({ message: "File not found" });
            return;
        }
        console.log("File extension:", path.extname(fullPath).toLowerCase(), "Download:", forceDownload);
        switch (path.extname(fullPath).toLowerCase()) {
            case ".pdf":
                forceDownload ? forceDownloadPDF(fullPath, res) : viewPDF(fullPath, res);
                break;
            case ".jpg":
            case ".jpeg":
            case ".png":
                forceDownload ? forceDownloadImage(fullPath, res) : viewImage(fullPath, res);
                break;
            case ".mp4":
            case ".webm":
            case ".mkv":
                forceDownload ? forceDownloadStream(fullPath, res, 'video/mp4') : streamFile(fullPath, res, 'video/mp4');
                break;
            default:
                forceDownloadStream(fullPath, res, 'application/octet-stream');
                break;
        }
    }
    catch (error) {
        console.error("Error viewing file:", error);
        res.status(500).end();
    }
};
