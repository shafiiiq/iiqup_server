const { getDevModels } = require('../models/portfolio.model');

class DevServices {
  static getSchemaModel(schemaName) {
    console.log('schemaName',schemaName);
    
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
}

module.exports = DevServices;