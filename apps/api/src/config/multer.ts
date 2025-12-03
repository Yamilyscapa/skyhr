import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Get upload directory path
export const getUploadDir = () => path.join(process.cwd(), 'upload');

// Ensure upload directory exists
export const ensureUploadDir = () => {
  const uploadDir = getUploadDir();
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// Generate unique filename
export const generateFileName = (originalName: string) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName);
  return `${timestamp}_${randomString}${ext}`;
};

// Validate file type
export const isValidFileType = (mimetype: string) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'
  ];
  return allowedTypes.includes(mimetype);
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileName = generateFileName(file.originalname);
    cb(null, fileName);
  }
});

// File filter for images and videos only
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (isValidFileType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed'));
  }
};

// Simple multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

export default upload;
