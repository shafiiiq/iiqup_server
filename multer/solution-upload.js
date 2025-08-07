const multer = require('multer');
const { format } = require('date-fns');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { regNo } = req.body;
    const dir = `public/uploads/solutions/${regNo || 'no-reg'}`;
    
    // Create directory if it doesn't exist
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const { regNo } = req.body;
    const now = new Date();
    const timestamp = format(now, 'yyyyMMdd-HHmmss');
    const ext = file.originalname.split('.').pop();
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
    
    cb(null, `solution-${regNo || 'no-reg'}-${timestamp}-${type}.${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 1000 } // 1GB
});

module.exports = {
  // FIXED: Changed from 'solutionFiles' to 'file' to match frontend
  uploadSolutionFiles: upload.array('file', 10)
};