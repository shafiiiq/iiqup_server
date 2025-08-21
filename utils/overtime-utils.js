const fs = require('fs');
const path = require('path');

/**
 * Clean up uploaded files in case of error
 * @param {Array} files - Array of uploaded files from multer
 */
const cleanupUploadedFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  
  files.forEach(file => {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${file.filename}:`, error.message);
    }
  });
};

/**
 * Get file URL for serving static files
 * @param {string} filePath - File path relative to public directory
 * @param {string} baseUrl - Base URL of the server
 */
const getFileUrl = (filePath, baseUrl) => {
  // Convert file path to URL format
  const urlPath = filePath.replace(/\\/g, '/').replace('./public/', '/');
  return `${baseUrl}${urlPath}`;
};

/**
 * Validate file types and sizes before upload
 * @param {Array} files - Array of files to validate
 * @param {number} maxSize - Maximum file size in bytes (default 10MB)
 */
const validateFiles = (files, maxSize = 10 * 1024 * 1024) => {
  if (!files || !Array.isArray(files)) return { valid: true };
  
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
  
  for (let file of files) {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `Invalid file type: ${file.mimetype}. Only images and videos are allowed.`
      };
    }
    
    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File ${file.originalname} is too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`
      };
    }
  }
  
  return { valid: true };
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Directory path to create
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Delete a file from the filesystem
 * @param {string} filePath - Path to the file to delete
 */
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error.message);
    return false;
  }
};

module.exports = {
  cleanupUploadedFiles,
  getFileUrl,
  validateFiles,
  formatFileSize,
  ensureDirectoryExists,
  deleteFile
};