const { getDevModels } = require('../models/portfolio.model');

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
  async getProfile() {
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

  async updateProfile(profileData) {
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
  async getExperience() {
    try {
      return await Experience.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching experience: ' + error.message);
    }
  }

  async addExperience(experienceData) {
    try {
      const experience = new Experience(experienceData);
      return await experience.save();
    } catch (error) {
      throw new Error('Error adding experience: ' + error.message);
    }
  }

  async updateExperience(id, experienceData) {
    try {
      return await Experience.findByIdAndUpdate(id, experienceData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating experience: ' + error.message);
    }
  }

  async deleteExperience(id) {
    try {
      return await Experience.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting experience: ' + error.message);
    }
  }

  // Projects methods
  async getProjects() {
    try {
      return await Project.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching projects: ' + error.message);
    }
  }

  async addProject(projectData) {
    try {
      const project = new Project(projectData);
      return await project.save();
    } catch (error) {
      throw new Error('Error adding project: ' + error.message);
    }
  }

  async updateProject(id, projectData) {
    try {
      return await Project.findByIdAndUpdate(id, projectData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating project: ' + error.message);
    }
  }

  async deleteProject(id) {
    try {
      return await Project.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting project: ' + error.message);
    }
  }

  // Skills methods
  async getSkills() {
    try {
      return await Skill.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching skills: ' + error.message);
    }
  }

  async addSkill(skillData) {
    try {
      const skill = new Skill(skillData);
      return await skill.save();
    } catch (error) {
      throw new Error('Error adding skill: ' + error.message);
    }
  }

  async updateSkill(id, skillData) {
    try {
      return await Skill.findByIdAndUpdate(id, skillData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating skill: ' + error.message);
    }
  }

  async deleteSkill(id) {
    try {
      return await Skill.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting skill: ' + error.message);
    }
  }

  // Education methods
  async getEducation() {
    try {
      return await Education.find().sort({ order: 1, endYear: -1 });
    } catch (error) {
      throw new Error('Error fetching education: ' + error.message);
    }
  }

  async addEducation(educationData) {
    try {
      const education = new Education(educationData);
      return await education.save();
    } catch (error) {
      throw new Error('Error adding education: ' + error.message);
    }
  }

  async updateEducation(id, educationData) {
    try {
      return await Education.findByIdAndUpdate(id, educationData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating education: ' + error.message);
    }
  }

  async deleteEducation(id) {
    try {
      return await Education.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting education: ' + error.message);
    }
  }

  // Certificates methods
  async getCertificates() {
    try {
      return await Certificate.find().sort({ order: 1, year: -1 });
    } catch (error) {
      throw new Error('Error fetching certificates: ' + error.message);
    }
  }

  async addCertificate(certificateData) {
    try {
      const certificate = new Certificate(certificateData);
      return await certificate.save();
    } catch (error) {
      throw new Error('Error adding certificate: ' + error.message);
    }
  }

  async updateCertificate(id, certificateData) {
    try {
      return await Certificate.findByIdAndUpdate(id, certificateData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating certificate: ' + error.message);
    }
  }

  async deleteCertificate(id) {
    try {
      return await Certificate.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting certificate: ' + error.message);
    }
  }

  // Services methods
  async getServices() {
    try {
      return await Service.find().sort({ order: 1, createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching services: ' + error.message);
    }
  }

  async addService(serviceData) {
    try {
      const service = new Service(serviceData);
      return await service.save();
    } catch (error) {
      throw new Error('Error adding service: ' + error.message);
    }
  }

  async updateService(id, serviceData) {
    try {
      return await Service.findByIdAndUpdate(id, serviceData, { new: true, runValidators: true });
    } catch (error) {
      throw new Error('Error updating service: ' + error.message);
    }
  }

  async deleteService(id) {
    try {
      return await Service.findByIdAndDelete(id);
    } catch (error) {
      throw new Error('Error deleting service: ' + error.message);
    }
  }

  // Stats methods
  async getStats() {
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

  async updateStats(statsData) {
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
  async getContact() {
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

  async updateContact(contactData) {
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
  async initializeDefaultData() {
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

  async getPortfolioSummary() {
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
}

module.exports = DevServices;