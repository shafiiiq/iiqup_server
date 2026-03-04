const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// Get duration of video files
const getFileDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error getting video duration:', err);
        resolve(0); // Default to 0 if can't get duration
      } else {
        resolve(Math.floor(metadata.format.duration));
      }
    });
  });
};

// Ensure public/uploads directory exists
const ensureUploadsDirectory = () => {
  const uploadsPath = path.join(process.cwd(), 'public', 'uploads', 'complaints');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
};

module.exports = {
  getFileDuration,
  ensureUploadsDirectory
};