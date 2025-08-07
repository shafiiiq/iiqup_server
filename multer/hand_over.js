const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create storage directory if it doesn't exist
const uploadDir = 'public/stocks/equipement/hand_over';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Get equipment number and label
    const equipmentNo = req.body.equipmentNo || '';
    const safeEquipmentNo = equipmentNo.replace(/[^a-zA-Z0-9]/g, '-');
    const label = req.body.label || 'unlabeled';
    const safeLabel = label.replace(/[^a-zA-Z0-9]/g, '-');
    
    
    // Format date as dd-mm-yy
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    
    // Format time with AM/PM
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    const timeStr = `${hours}-${minutes}-${ampm}`;
    
    // Create formatted date-time string
    const dateTimeStr = `${day}-${month}-${year}-${timeStr}`;
    
    // Generate filename with the required format
    const ext = path.extname(file.originalname);
    const filename = `equipment-image-${safeEquipmentNo}-${safeLabel}-${dateTimeStr}${ext}`;
      
    cb(null, filename);
  }
});

// Filter for image files only
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 4 * 1024 * 1024, // 2MB max file size to match frontend limit
    files: 10 // maximum 10 files at once
  }
});

// Middleware for handling equipment data only (no file uploads)
const processEquipmentData = (req, res, next) => {
  // Parse JSON data if needed
  try {
    if (typeof req.body === 'string') {
      req.body = JSON.parse(req.body);
    }
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: `Error parsing request data: ${err.message}`
    });
  }
};

// Middleware for handling image uploads
const uploadEquipmentImages = upload.single('image');

module.exports = {
  processEquipmentData,
  uploadEquipmentImages
};