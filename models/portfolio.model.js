const mongoose = require('mongoose');
const { getDevDB } = require('../config/dev.connection');

const mediaFileSchema = new mongoose.Schema({
  fileName: { type: String, },
  originalName: { type: String, },
  filePath: { type: String, },
  fileSize: { type: Number, },
  mimeType: { type: String, },
  fieldName: { type: String, },
  uploadDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['photo', 'video'], },
  url: { type: String, },
  duration: { type: Number },
});

// Profile Schema
const profileSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Muhammed Shafeek'
  },
  title: {
    type: String,
    default: 'Software Engineer'
  },
  subtitle: {
    type: String,
    default: 'I am a'
  },
  welcomeText: {
    type: String,
    default: 'Welcome to my, deV world'
  },
  bio: {
    type: String,
    default: 'Passionate software engineer with expertise in full-stack development'
  },
  avatar: {
    type: String,
    default: '/images/profile/avatar.jpg'
  },
  backgroundImage: {
    type: String,
    default: '/images/background/1.jpg'
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Experience Schema
const experienceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  period: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '/images/icons/experience-default.png'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Project Schema
const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'branding'
  },
  description: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: '/images/gallery/default.jpg'
  },
  link: {
    type: String,
    default: '/single-work'
  },
  technologies: [{
    type: String
  }],
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Skill Schema
const skillSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '/images/icons/skill-default.png'
  },
  proficiency: {
    type: Number,
    min: 0,
    max: 100,
    default: 80
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Education Schema
const educationSchema = new mongoose.Schema({
  degree: {
    type: String,
    required: true
  },
  institution: {
    type: String,
    required: true
  },
  period: {
    type: String,
    required: true
  },
  startYear: {
    type: Number,
    required: true
  },
  endYear: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '/images/icons/education-default.png'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Certificate Schema
const certificateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  issuer: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  link: {
    type: String,
    default: '#'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Service Schema
const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '/images/icons/service-default.png'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Stats Schema
const statsSchema = new mongoose.Schema({
  finishedProjects: {
    type: Number,
    default: 235
  },
  teamMembers: {
    type: Number,
    default: 25
  },
  happyCustomers: {
    type: Number,
    default: 138
  },
  loyalPartners: {
    type: Number,
    default: 42
  },
  coffeeDrinked: {
    type: Number,
    default: 15628
  },
  yearsExperience: {
    type: Number,
    default: 5
  },
  mediaFiles: [mediaFileSchema],
}, {
  timestamps: true
});

// Contact Schema
const contactSchema = new mongoose.Schema({
  email: {
    type: String,
    default: 'dev.shafiiq@gmail.com'
  },
  phone: {
    type: String,
    default: '+91 977 859 3415'
  },
  linkedin: {
    type: String,
    default: 'https://www.linkedin.com/in/shafiiq04'
  },
  github: {
    type: String,
    default: 'https://github.com/shafiiiq'
  },
  location: {
    type: String,
    default: 'Available for remote work worldwide'
  },
  footerText: {
    type: String,
    default: "Let's grab some coffee. We're nestled in the heart of a bustling metropolis but occasionally venture to the tranquil countryside"
  },
  socials: [{
    platform: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    mediaFiles: [mediaFileSchema],
  }]
}, {
  timestamps: true
});

// Create models using Dev DB connection
const getDevModels = () => {
  const devDB = getDevDB();
  
  return {
    Profile: devDB.model('Profile', profileSchema),
    Experience: devDB.model('Experience', experienceSchema),
    Project: devDB.model('Project', projectSchema),
    Skill: devDB.model('Skill', skillSchema),
    Education: devDB.model('Education', educationSchema),
    Certificate: devDB.model('Certificate', certificateSchema),
    Service: devDB.model('Service', serviceSchema),
    Stats: devDB.model('Stats', statsSchema),
    Contact: devDB.model('Contact', contactSchema)
  };
};

module.exports = { getDevModels };