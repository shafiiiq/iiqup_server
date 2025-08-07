const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the toolkit schema (unchanged)
const ToolkitSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Equipment name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Equipment type is required'],
    enum: [
      'Head Protection', 
      'Eye Protection', 
      'Hand Protection', 
      'Foot Protection', 
      'Body Protection',
      'Fall Protection',
      'Respiratory Protection'
    ],
    trim: true
  },
  size: {
    type: String,
    required: [true, 'Size is required'],
    trim: true
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true
  },
  stockCount: {
    type: Number,
    required: [true, 'Stock count is required'],
    min: 0,
    default: 0
  },
  minStockLevel: {
    type: Number,
    required: [true, 'Minimum stock level is required'],
    min: 1,
    default: 5
  },
  status: {
    type: String,
    enum: ['available', 'low', 'out'],
    default: 'available'
  },
  inuse: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware for toolkit (unchanged)
ToolkitSchema.pre('save', function(next) {
  // Calculate status based on stock count and minimum stock level
  if (this.stockCount <= 0) {
    this.status = 'out';
  } else if (this.stockCount < this.minStockLevel) {
    this.status = 'low';
  } else {
    this.status = 'available';
  }
  
  // Update the updatedAt field
  this.updatedAt = Date.now();
  
  next();
});

// Define the attendance schema (unchanged)
const AttendanceSchema = new Schema({
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  in: {
    type: Date,
    required: [true, 'Clock-in time is required']
  },
  out: {
    type: Date
  },
  breakOut: {
    type: Date
  },
  breakIn: {
    type: Date
  },
  totalTime: {
    type: Number, // Store total time in minutes
    default: 0
  }
});

// Calculate total time when clocking out (unchanged)
AttendanceSchema.pre('save', function(next) {
  if (this.in && this.out) {
    let totalMinutes = Math.floor((this.out - this.in) / (1000 * 60));
    
    // Subtract break time if both breakOut and breakIn exist
    if (this.breakOut && this.breakIn) {
      const breakMinutes = Math.floor((this.breakIn - this.breakOut) / (1000 * 60));
      totalMinutes -= breakMinutes;
    }
    
    this.totalTime = totalMinutes > 0 ? totalMinutes : 0;
  }
  next();
});

// Define the individual overtime entry schema
const OvertimeEntrySchema = new Schema({
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  formattedDate: {
    type: String,  // Store date in "dd-mm-yyyy" format
    required: true
  },
  regNo: [{
    type: Number
  }],
  times: [{
    in: {
      type: Date,
      required: true
    },
    out: {
      type: Date
    },
    _id: false
  }],
  workDetails: [{
    type: String
  }],
  totalTime: {
    type: Number, // Store total overtime in minutes
    default: 0
  },
  formattedTime: {
    type: String,
    default: ''
  }
});

// Calculate total overtime and formatted time for each entry
OvertimeEntrySchema.pre('save', function(next) {
  let totalMinutes = 0;
  
  if (this.times && this.times.length > 0) {
    this.times.forEach(timeEntry => {
      if (timeEntry.in && timeEntry.out) {
        // Calculate minutes only if out time is after in time
        if (timeEntry.out > timeEntry.in) {
          const minutes = Math.floor((timeEntry.out - timeEntry.in) / (1000 * 60));
          totalMinutes += minutes > 0 ? minutes : 0;
        }
      }
    });
  }
  
  this.totalTime = totalMinutes;
  
  // Format the time as hours and minutes
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  this.formattedTime = `${hours}h ${minutes}m`;

  // Format the date as "dd-mm-yyyy"
  const date = new Date(this.date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  this.formattedDate = `${day}-${month}-${year}`;
  
  next();
});

// Define the monthly overtime schema
const MonthlyOvertimeSchema = new Schema({
  month: {
    type: String,  // Store month in "Month Year" format (e.g., "May 2025")
    required: true
  },
  entries: [OvertimeEntrySchema],
  totalMonthTime: {
    type: Number, // Store total monthly overtime in minutes
    default: 0
  },
  formattedMonthTime: {
    type: String,
    default: '0h 0m'
  }
});

// Calculate total monthly overtime
MonthlyOvertimeSchema.pre('save', function(next) {
  let totalMonthMinutes = 0;
  
  if (this.entries && this.entries.length > 0) {
    totalMonthMinutes = this.entries.reduce((total, entry) => total + entry.totalTime, 0);
  }
  
  this.totalMonthTime = totalMonthMinutes;
  
  // Format the time as hours and minutes
  const hours = Math.floor(totalMonthMinutes / 60);
  const minutes = totalMonthMinutes % 60;
  this.formattedMonthTime = `${hours}h ${minutes}m`;
  
  next();
});

// Define the main Mechanic schema
const MechanicSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Mechanic name is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    // Removed unique: true from here
  },
  password: {
    type: String,
    minlength: [6, 'Password should be at least 6 characters long']
  },
  authMail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    default: ''
  },
  userId: {
    type: Number,
    required: [true, 'User ID is required'],
    ref: 'User' // Assuming you have a User model
  },
  uniqueCode: {
    type: String,
  },
  tag: {
    type: String,
    default: process.env.TAG_CODE
  },
  isActive: {
    type: Boolean,
    default: false
  },
  userType: {
    type: String,
    default: 'mechanic'
  },
  toolkits: [ToolkitSchema],
  attendance: [AttendanceSchema],
  // Only use the monthly overtime structure
  monthlyOvertime: [MonthlyOvertimeSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
MechanicSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create and export the Mechanic model
const Mechanic = mongoose.model('Mechanic', MechanicSchema);
module.exports = Mechanic;