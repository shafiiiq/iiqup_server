const { getDevModels } = require('../models/portfolio.model');
let Profile, Experience, Project, Skill, Education, Certificate, Service, Stats, Contact;
const crypto = require('crypto');

// Initialize models lazily on first access
const initModels = () => {
  if (!Profile) {
    const models = getDevModels();
    Profile = models.Profile;
    Experience = models.Experience;
    Project = models.Project;
    Skill = models.Skill;
    Education = models.Education;
    Certificate = models.Certificate;
    Service = models.Service;
    Stats = models.Stats;
    Contact = models.Contact;
  }
};

// Call initModels before class definition
// This will be executed when any method is called
setTimeout(() => initModels(), 0);

class DevServices {
  // dev portfolio s3 services - BEGIN
  static getSchemaModel(schemaName) {
    console.log('schemaName', schemaName);

    const models = getDevModels();

    const schemaMap = {
      'profile': models.Profile,
      'experiences': models.Experience,
      'projects': models.Project,
      'skills': models.Skill,
      'educations': models.Education,
      'certificates': models.Certificate,
      'services': models.Service,
      'stats': models.Stats,
      'contact': models.Contact
    };

    return schemaMap[schemaName.toLowerCase()];
  }

  static async prepareDevData(devData) {
    try {
      const { id, schema, mediaFiles } = devData;

      const Model = this.getSchemaModel(schema);

      if (!Model) {
        throw new Error(`Invalid schema: ${schema}`);
      }

      const document = await Model.findByIdAndUpdate(
        id,
        {
          $push: {
            mediaFiles: { $each: mediaFiles }
          }
        },
        { new: true, runValidators: true }
      );

      if (!document) {
        throw new Error(`Document not found with id: ${id}`);
      }

      return document;
    } catch (error) {
      console.error('Error updating portfolio:', error);
      throw error;
    }
  }

  static async getPortfolioById(id) {
    try {
      const models = getDevModels();
      const modelList = [
        models.Profile,
        models.Experience,
        models.Project,
        models.Skill,
        models.Education,
        models.Certificate,
        models.Service,
        models.Stats,
        models.Contact
      ];

      for (const Model of modelList) {
        const doc = await Model.findById(id);
        if (doc) return doc;
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  static async getFullPortfolio() {
    try {
      const models = getDevModels();

      const [profiles, experiences, projects, skills, educations, certificates, services, stats, contacts] = await Promise.all([
        models.Profile.find({}),
        models.Experience.find({}).sort({ order: 1 }),
        models.Project.find({}).sort({ order: 1 }),
        models.Skill.find({}).sort({ order: 1 }),
        models.Education.find({}).sort({ startYear: -1 }),
        models.Certificate.find({}).sort({ year: -1 }),
        models.Service.find({}).sort({ order: 1 }),
        models.Stats.find({}),
        models.Contact.find({})
      ]);

      return {
        profiles,
        experiences,
        projects,
        skills,
        educations,
        certificates,
        services,
        stats,
        contacts
      };
    } catch (error) {
      throw error;
    }
  }
  // dev portfolio s3 services - END 

  // dev porfolio mongo db services - BEGIN
  // Profile methods
  static async getProfile() {
    try {
      let profile = await Profile.findOne();
      if (!profile) {
        profile = await Profile.create({});
      }
      return profile;
    } catch (error) {
      throw new Error('Error fetching profile: ' + error.message);
    }
  }

  static async updateProfile(profileData) {
    try {
      let profile = await Profile.findOne();
      if (!profile) {
        profile = await Profile.create(profileData);
      } else {
        profile = await Profile.findOneAndUpdate({}, profileData, { new: true, runValidators: true });
      }
      return profile;
    } catch (error) {
      throw new Error('Error updating profile: ' + error.message);
    }
  }

  // Experience methods
  static async getExperience() {
    try {
      return await Experience.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching experience: ' + error.message);
    }
  }

  static async addExperience(experienceData) {
    try {
      const experience = new Experience(experienceData);
      return await experience.save();
    } catch (error) {
      throw new Error('Error adding experience: ' + error.message);
    }
  }

  static async updateExperience(id, experienceData) {
    try {
      return await Experience.findByIdAndUpdate(id, experienceData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating experience: ' + error.message);
    }
  }

  static async deleteExperience(id) {
    try {
      return await Experience.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting experience: ' + error.message);
    }
  }

  // Projects methods
  static async getProjects() {
    try {
      return await Project.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching projects: ' + error.message);
    }
  }

  static async addProject(projectData) {
    try {
      const project = new Project(projectData);
      return await project.save();
    } catch (error) {
      throw new Error('Error adding project: ' + error.message);
    }
  }

  static async updateProject(id, projectData) {
    try {
      return await Project.findByIdAndUpdate(id, projectData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating project: ' + error.message);
    }
  }

  static async deleteProject(id) {
    try {
      return await Project.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting project: ' + error.message);
    }
  }

  // Skills methods
  static async getSkills() {
    try {
      return await Skill.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching skills: ' + error.message);
    }
  }

  static async addSkill(skillData) {
    try {
      const skill = new Skill(skillData);
      return await skill.save();
    } catch (error) {
      throw new Error('Error adding skill: ' + error.message);
    }
  }

  static async updateSkill(id, skillData) {
    try {
      return await Skill.findByIdAndUpdate(id, skillData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating skill: ' + error.message);
    }
  }

  static async deleteSkill(id) {
    try {
      return await Skill.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting skill: ' + error.message);
    }
  }

  // Education methods
  static async getEducation() {
    try {
      return await Education.find().sort({ order: 1, endYear: -1 });
    } catch (error) {
      throw new Error('Error fetching education: ' + error.message);
    }
  }

  static async addEducation(educationData) {
    try {
      const education = new Education(educationData);
      return await education.save();
    } catch (error) {
      throw new Error('Error adding education: ' + error.message);
    }
  }

  static async updateEducation(id, educationData) {
    try {
      return await Education.findByIdAndUpdate(id, educationData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating education: ' + error.message);
    }
  }

  static async deleteEducation(id) {
    try {
      return await Education.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting education: ' + error.message);
    }
  }

  // Certificates methods
  static async getCertificates() {
    try {
      return await Certificate.find().sort({ order: 1, year: -1 });
    } catch (error) {
      throw new Error('Error fetching certificates: ' + error.message);
    }
  }

  static async addCertificate(certificateData) {
    try {
      const certificate = new Certificate(certificateData);
      return await certificate.save();
    } catch (error) {
      throw new Error('Error adding certificate: ' + error.message);
    }
  }

  static async updateCertificate(id, certificateData) {
    try {
      return await Certificate.findByIdAndUpdate(id, certificateData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating certificate: ' + error.message);
    }
  }

  static async deleteCertificate(id) {
    try {
      return await Certificate.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting certificate: ' + error.message);
    }
  }

  // Services methods
  static async getServices() {
    try {
      return await Service.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching services: ' + error.message);
    }
  }

  static async addService(serviceData) {
    try {
      const service = new Service(serviceData);
      return await service.save();
    } catch (error) {
      throw new Error('Error adding service: ' + error.message);
    }
  }

  static async updateService(id, serviceData) {
    try {
      return await Service.findByIdAndUpdate(id, serviceData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating service: ' + error.message);
    }
  }

  static async deleteService(id) {
    try {
      return await Service.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting service: ' + error.message);
    }
  }

  // Stats methods
  static async getStats() {
    try {
      let stats = await Stats.findOne();
      if (!stats) {
        stats = await Stats.create({});
      }
      return stats;
    } catch (error) {
      throw new Error('Error fetching stats: ' + error.message);
    }
  }

  static async updateStats(statsData) {
    try {
      let stats = await Stats.findOne();
      if (!stats) {
        stats = await Stats.create(statsData);
      } else {
        stats = await Stats.findOneAndUpdate({}, statsData, { new: true, runValidators: true });
      }
      return stats;
    } catch (error) {
      throw new Error('Error updating stats: ' + error.message);
    }
  }

  // Contact methods
  static async getContact() {
    try {
      let contact = await Contact.findOne();
      if (!contact) {
        contact = await Contact.create({});
      }
      return contact;
    } catch (error) {
      throw new Error('Error fetching contact: ' + error.message);
    }
  }

  static async updateContact(contactData) {
    try {
      let contact = await Contact.findOne();
      if (!contact) {
        contact = await Contact.create(contactData);
      } else {
        contact = await Contact.findOneAndUpdate({}, contactData, { new: true, runValidators: true });
      }
      return contact;
    } catch (error) {
      throw new Error('Error updating contact: ' + error.message);
    }
  }

  // Utility methods
  static async initializeDefaultData() {
    try {
      // Initialize profile if not exists
      await this.getProfile();

      // Initialize stats if not exists
      await this.getStats();

      // Initialize contact if not exists
      await this.getContact();

      console.log('Default portfolio data initialized successfully');
    } catch (error) {
      throw new Error('Error initializing default data: ' + error.message);
    }
  }

  static async getPortfolioSummary() {
    try {
      const [
        experienceCount,
        projectsCount,
        skillsCount,
        educationCount,
        certificatesCount,
        servicesCount
      ] = await Promise.all([
        Experience.countDocuments(),
        Project.countDocuments(),
        Skill.countDocuments(),
        Education.countDocuments(),
        Certificate.countDocuments(),
        Service.countDocuments()
      ]);

      return {
        experienceCount,
        projectsCount,
        skillsCount,
        educationCount,
        certificatesCount,
        servicesCount,
        lastUpdated: new Date()
      };
    } catch (error) {
      throw new Error('Error fetching portfolio summary: ' + error.message);
    }
  }
  // dev portfolio mongo db services - END 


  // dev creads access 
  // Verify if request is from your real app
  static async verifyAppRequest({ attestationToken, deviceId, timestamp }) {
    try {
      console.log('=== VERIFICATION START ===');
      const now = Date.now();
      const requestTime = parseInt(timestamp);

      // CHECK 1: Timestamp
      if (now - requestTime > 30000) {
        console.log('❌ Timestamp expired');
        return false;
      }
      console.log('✓ Timestamp valid');

      // CHECK 2: Detect token type
      let isPlayIntegrityToken = false;
      let deviceData;

      try {
        deviceData = JSON.parse(attestationToken);
      } catch (parseError) {
        console.log('❌ Not JSON, treating as Play Integrity token');
        isPlayIntegrityToken = true;
      }

      // If Play Integrity token (Production Android)
      if (isPlayIntegrityToken) {
        console.log('Using Play Integrity verification...');
        const isValid = await this.verifyPlayIntegrity(attestationToken);
        console.log('Play Integrity result:', isValid);
        return isValid;
      }

      // If Device fingerprint (Expo Go / iOS)
      console.log('Validating device fingerprint...');

      if (!deviceData.brand || !deviceData.manufacturer || !deviceData.modelName) {
        console.log('❌ Invalid device fingerprint - missing fields');
        return false;
      }
      console.log('✓ Device data complete');

      console.log('Comparing IDs:');

      if (deviceData.installationId !== deviceId) {
        console.log('❌ Device ID mismatch');
        return false;
      }
      console.log('✓ Device ID matches');

      if (deviceData.brand === 'generic' ||
        (deviceData.manufacturer === 'Google' && deviceData.modelName?.includes('sdk'))) {
        console.log('❌ Emulator detected');
        return false;
      }
      console.log('✓ Not an emulator');

      console.log('✅ Device fingerprint verified successfully');
      return true;

    } catch (error) {
      console.error('❌ Verification error:', error.message);
      console.error('Stack:', error.stack);
      return false;
    }
  }

  // Verify attestation token with Google Play Integrity (Android)
  static async verifyPlayIntegrity(token) {
    try {
      const { google } = require('googleapis');

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/playintegrity'],
      });

      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      const response = await fetch(
        `https://playintegrity.googleapis.com/v1/${process.env.ANDROID_PACKAGE_NAME}:decodeIntegrityToken`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ integrity_token: token })
        }
      );

      const data = await response.json();

      const appVerdict = data?.tokenPayloadExternal?.appIntegrity?.appRecognitionVerdict;
      if (appVerdict !== 'PLAY_RECOGNIZED') {
        return false;
      }

      return true;

    } catch (error) {
      console.error('Play Integrity error:', error);
      return false;
    }
  }

  // Get credentials (only called after verification)
  static async getCredentials() {
    const credentials = {
      RAPID_API_KEY: process.env.RAPID_API_KEY,
      TMDB_API_KEY: process.env.TMDB_API_KEY,
      TMDB_BASE_URL: process.env.TMDB_BASE_URL,
      TMDB_IMAGE_BASE_URL: process.env.TMDB_IMAGE_BASE_URL,
      YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
      YOUTUBE_API_URL: process.env.YOUTUBE_API_URL,
      ITUNES_API_URL: process.env.ITUNES_API_URL,
      ITUNES_PODCAST_API: process.env.ITUNES_PODCAST_API,
    };

    // Debug log
    console.log('Environment variables loaded:', {
      RAPID_API_KEY: !!process.env.RAPID_API_KEY,
      TMDB_API_KEY: !!process.env.TMDB_API_KEY,
      YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
    });

    // Check for missing variables
    const missingVars = [];
    Object.entries(credentials).forEach(([key, value]) => {
      if (!value) missingVars.push(key);
    });

    if (missingVars.length > 0) {
      console.error('Missing env variables:', missingVars);
      throw new Error(`Missing: ${missingVars.join(', ')}`);
    }

    return credentials;
  }
}

module.exports = DevServices;