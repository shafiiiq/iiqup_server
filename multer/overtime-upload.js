const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Utility function to ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure multer for overtime file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = './public/uploads/overtime';
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate a temporary filename first, then rename after we have the request ID
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`);
  }
});

// File filter to validate file types
const fileFilter = function (req, file, cb) {
  const allowedImageTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp'
  ];
  
  const allowedVideoTypes = [
    'video/mp4', 
    'video/avi', 
    'video/mov', 
    'video/wmv', 
    'video/flv', 
    'video/webm',
    'video/quicktime' // for .mov files
  ];

  const allowedAudioTypes = [
    'audio/mpeg',     // .mp3
    'audio/wav',      // .wav
    'audio/mp4',      // .m4a
    'audio/aac',      // .aac
    'audio/ogg',      // .ogg
    'audio/webm',     // .webm audio
    'audio/flac',     // .flac
    'audio/x-ms-wma'  // .wma
  ];
  
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes, ...allowedAudioTypes];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only images, videos, and audio files are allowed.`), false);
  }
};

// Create multer instance with configuration
const overtimeUpload = multer({
  storage: storage,
  limits: {
    fileSize: 1000 * 1024 * 1024, // 1GB limit per file
    files: 10 // Maximum 10 files
  },
  fileFilter: fileFilter
});

// Utility function to rename files with proper naming convention
const renameFilesWithRequestId = async (files, mechanicId, requestId) => {
  if (!files || files.length === 0) return [];

  const renamedFiles = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = path.extname(file.filename);
    
    // Determine file type and suffix
    let suffix = '';
    if (file.mimetype.startsWith('image/')) {
      suffix = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      suffix = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      suffix = 'audio';
    }
    
    // Create new filename: mechanicId-requestId-suffix-index
    // Added index to handle multiple files of same type
    const fileIndex = i + 1;
    const newFilename = `${mechanicId}-${requestId}-${suffix}-${fileIndex}${ext}`;
    const oldPath = file.path;
    const newPath = path.join(path.dirname(oldPath), newFilename);
    
    try {
      // Check if file already exists and handle collision
      if (fs.existsSync(newPath)) {
        console.warn(`File ${newFilename} already exists, skipping rename`);
        renamedFiles.push(file);
        continue;
      }
      
      // Rename the file
      fs.renameSync(oldPath, newPath);
      
      // Update file object with new information
      const updatedFile = {
        ...file,
        filename: newFilename,
        path: newPath,
        url: `/uploads/overtime/${newFilename}`
      };
      
      renamedFiles.push(updatedFile);
    } catch (error) {
      console.error(`Error renaming file ${file.filename}:`, error);
      // Keep original file if renaming fails
      renamedFiles.push({
        ...file,
        url: `/uploads/overtime/${file.filename}`
      });
    }
  }
  
  return renamedFiles;
};

// Export the multer instance as default, with utility functions as properties
module.exports = overtimeUpload;
module.exports.renameFilesWithRequestId = renameFilesWithRequestId;
module.exports.ensureDirectoryExists = ensureDirectoryExists;