const Explorer = require('../models/explorer.model');

class ExplorerServices {
  // Get all releases
  static async getAllReleases() {
    try {
      const releases = await Explorer.find({ isActive: true })
        .sort({ releaseDate: -1, createdAt: -1 })
        .select('-__v');
      
      return releases;
    } catch (error) {
      console.error('Error getting all releases:', error);
      throw error;
    }
  }

  // Get latest release
  static async getLatestRelease() {
    try {
      const release = await Explorer.findOne({ isActive: true })
        .sort({ releaseDate: -1 })
        .select('-__v');
      
      return release;
    } catch (error) {
      console.error('Error getting latest release:', error);
      throw error;
    }
  }

  // Get release by ID
  static async getReleaseById(id) {
    try {
      const release = await Explorer.findById(id).select('-__v');
      return release;
    } catch (error) {
      console.error('Error getting release by ID:', error);
      throw error;
    }
  }

  // Create new release with features
  static async createRelease(releaseData) {
    try {
      const release = new Explorer({
        ...releaseData,
        isActive: false // Will be activated after all videos upload
      });

      await release.save();
      return release;
    } catch (error) {
      console.error('Error creating release:', error);
      throw error;
    }
  }

  // Add feature to existing release
  static async addFeatureToRelease(releaseId, featureData) {
    try {
      const release = await Explorer.findById(releaseId);
      
      if (!release) {
        throw new Error('Release not found');
      }

      // Get next order number
      const maxOrder = release.features.reduce((max, f) => 
        f.order > max ? f.order : max, 0);
      
      featureData.order = maxOrder + 1;
      featureData.uploadStatus = 'uploading';

      release.features.push(featureData);
      release.updatedAt = new Date();
      
      await release.save();
      return release;
    } catch (error) {
      console.error('Error adding feature to release:', error);
      throw error;
    }
  }

  // Update feature in release
  static async updateFeature(releaseId, featureId, updateData) {
    try {
      const release = await Explorer.findById(releaseId);
      
      if (!release) {
        throw new Error('Release not found');
      }

      const feature = release.features.id(featureId);
      
      if (!feature) {
        throw new Error('Feature not found');
      }

      Object.assign(feature, updateData);
      release.updatedAt = new Date();
      
      await release.save();
      return release;
    } catch (error) {
      console.error('Error updating feature:', error);
      throw error;
    }
  }

  // Update feature upload status
  static async updateFeatureStatus(releaseId, featureId, status) {
    try {
      const release = await Explorer.findById(releaseId);
      
      if (!release) {
        throw new Error('Release not found');
      }

      const feature = release.features.id(featureId);
      
      if (!feature) {
        throw new Error('Feature not found');
      }

      feature.uploadStatus = status;
      
      // Check if all features are active
      const allActive = release.features.every(f => f.uploadStatus === 'active');
      if (allActive) {
        release.isActive = true;
      }
      
      release.updatedAt = new Date();
      await release.save();
      
      return release;
    } catch (error) {
      console.error('Error updating feature status:', error);
      throw error;
    }
  }

  // Delete feature from release
  static async deleteFeature(releaseId, featureId) {
    try {
      const release = await Explorer.findById(releaseId);
      
      if (!release) {
        throw new Error('Release not found');
      }

      release.features.pull(featureId);
      release.updatedAt = new Date();
      
      await release.save();
      return release;
    } catch (error) {
      console.error('Error deleting feature:', error);
      throw error;
    }
  }

  // Delete entire release
  static async deleteRelease(id) {
    try {
      const release = await Explorer.findByIdAndDelete(id);
      
      if (!release) {
        throw new Error('Release not found');
      }

      return release;
    } catch (error) {
      console.error('Error deleting release:', error);
      throw error;
    }
  }

  // Reorder features within a release
  static async reorderFeatures(releaseId, featureIds) {
    try {
      const release = await Explorer.findById(releaseId);
      
      if (!release) {
        throw new Error('Release not found');
      }

      featureIds.forEach((featureId, index) => {
        const feature = release.features.id(featureId);
        if (feature) {
          feature.order = index + 1;
        }
      });

      release.updatedAt = new Date();
      await release.save();
      
      return release;
    } catch (error) {
      console.error('Error reordering features:', error);
      throw error;
    }
  }
}

module.exports = ExplorerServices;