/**
 * this is  the controller for the disk, read write,
 * server/disk is the mounintg point for the disk
 */

import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import {
  generateImageThumbnail,
  generateVideoPreview,
} from "./thumbnailGenerator.js";
import { fileTypeFromBuffer } from "file-type";

// Extend the Request interface to include the 'file' property
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Base directory for the mounted Docker volume
const BASE_DIR = "/usr/src/app/server/disk";

// List files in a directory
export const listFiles = async (req: Request, res: Response): Promise<void> => {
  console.log("listFiles called with folderPath:", req.query.folderPath);
  const folderPath = (req.query.folderPath as string) || "";
  const fullPath = path.join(BASE_DIR, folderPath);

  try {
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ message: "Folder does not exist" });
      return;
    }

    const files = fs.readdirSync(fullPath);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          const extension = path.extname(file).toLowerCase();
          let preview: string | null = null;

          if ([".jpg", ".jpeg", ".png", ".gif"].includes(extension)) {
            preview = await generateImageThumbnail(filePath);
          } else if ([".mp4", ".mkv", ".avi"].includes(extension)) {
            preview = await generateVideoPreview(filePath);
          }

          return {
            name: file,
            type: "file",
            size: stats.size,
            preview,
          };
        } else {
          return {
            name: file,
            type: "folder",
          };
        }
      })
    );

    res.status(200).json({ files: fileDetails });
  } catch (error) {
    console.error("Error listing files:", error);
    res
      .status(500)
      .json({
        message: "Error listing files",
        error: (error as Error).message,
      });
  }
};

// Create a folder
export const createFolder = async (
  req: Request,
  res: Response
): Promise<void> => {
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
  } catch (error) {
    console.error("Error creating folder:", error);
    res
      .status(500)
      .json({
        message: "Error creating folder",
        error: (error as Error).message,
      });
  }
};

// Upload a file
export const uploadFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log(
    "uploadFile called with folderPath:",
    req.params.folderPath,
    "and file:",
    req.file
  );
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
  } catch (error) {
    console.error("Error uploading file:", error);
    res
      .status(500)
      .json({
        message: "Error uploading file",
        error: (error as Error).message,
      });
  }
};

// Download a file
export const downloadFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filePath = req.params.filePath || "";
    const fullPath = path.join(BASE_DIR, filePath);

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ message: "File not found" });
      return;
    }

    // Detect file type
    //const mimeType = mime.lookup(fullPath) || 'application/octet-stream';

    // Set appropriate headers
    // res.setHeader('Content-Type', mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(fullPath)}"`
    );

    // Send the actual file content instead of the file path
    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(500).json({ message: "Error downloading file" });
      }
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    res
      .status(500)
      .json({
        message: "Error downloading file",
        error: (error as Error).message,
      });
  }
};

// Delete a file or folder
export const deleteItem = async (
  req: Request,
  res: Response
): Promise<void> => {
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
    } else {
      fs.unlinkSync(fullPath);
    }

    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res
      .status(500)
      .json({
        message: "Error deleting item",
        error: (error as Error).message,
      });
  }
};

// View a file
export const viewFile = async (req: Request, res: Response): Promise<void> => {
    console.log("viewFile called with filePath:", req.params.filePath);
    try {
        const filePath = req.params.filePath || "";
        const fullPath = path.join(BASE_DIR, filePath);

        if (!fs.existsSync(fullPath)) {
            res.status(404).json({ message: "File not found" });
            return;
        }

        // Get file extension and set content type
        const ext = path.extname(fullPath).toLowerCase();
        if (ext === '.pdf') {
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline',
                'Content-Transfer-Encoding': 'binary',
                'Accept-Ranges': 'bytes'
            });
        }

        // Use sendFile with root option
        const options = {
            root: BASE_DIR,
            dotfiles: "deny" as "deny", // Ensure the value matches the expected type
            headers: {
                'x-timestamp': Date.now(),
                'x-sent': true
            }
        };

        res.sendFile(filePath, options, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).end();
            }
        });

    } catch (error) {
        console.error("Error in viewFile:", error);
        res.status(500).end();
    }
};

// Test endpoint for serving specific PDF
export const testPDF = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log("Query parameters received:", req.query);
        const testFilePath = req.query.filepath as string;
        
        if (!testFilePath) {
            console.log("No filepath provided in query");
            res.status(400).json({ message: "No filepath provided" });
            return;
        }

        const fullPath = path.join(BASE_DIR, testFilePath);
        console.log("Full path constructed:", fullPath);
        console.log("File exists:", fs.existsSync(fullPath));
        
        if (!fs.existsSync(fullPath)) {
            res.status(404).json({ message: "Test PDF not found" });
            return;
        }

        res.setHeader('Content-Type', 'application/pdf');
        fs.createReadStream(fullPath).pipe(res);

    } catch (error) {
        console.error("Error serving test PDF:", error);
        res.status(500).end();
    }
};
