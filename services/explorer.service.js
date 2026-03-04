// services/explorer.service.js
const Explorer = require('../models/explorer.model');

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all active releases sorted by release date descending.
 * @returns {Promise<Array>}
 */
const getAllReleases = async () => {
  try {
    return await Explorer.find({ isActive: true })
      .sort({ releaseDate: -1, createdAt: -1 })
      .select('-__v');
  } catch (error) {
    console.error('[ExplorerService] getAllReleases:', error);
    throw error;
  }
};

/**
 * Returns the most recent active release.
 * @returns {Promise<object>}
 */
const getLatestRelease = async () => {
  try {
    return await Explorer.findOne({ isActive: true })
      .sort({ releaseDate: -1 })
      .select('-__v');
  } catch (error) {
    console.error('[ExplorerService] getLatestRelease:', error);
    throw error;
  }
};

/**
 * Returns a release by its ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const getReleaseById = async (id) => {
  try {
    return await Explorer.findById(id).select('-__v');
  } catch (error) {
    console.error('[ExplorerService] getReleaseById:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new release. Starts as inactive until all videos are uploaded.
 * @param {object} releaseData
 * @returns {Promise<object>}
 */
const createRelease = async (releaseData) => {
  try {
    const release = new Explorer({ ...releaseData, isActive: false });
    await release.save();
    return release;
  } catch (error) {
    console.error('[ExplorerService] createRelease:', error);
    throw error;
  }
};

/**
 * Appends a new feature to an existing release.
 * @param {string} releaseId
 * @param {object} featureData
 * @returns {Promise<object>}
 */
const addFeatureToRelease = async (releaseId, featureData) => {
  try {
    const release = await Explorer.findById(releaseId);
    if (!release) throw new Error('Release not found');

    const maxOrder       = release.features.reduce((max, f) => f.order > max ? f.order : max, 0);
    featureData.order        = maxOrder + 1;
    featureData.uploadStatus = 'uploading';

    release.features.push(featureData);
    release.updatedAt = new Date();
    await release.save();

    return release;
  } catch (error) {
    console.error('[ExplorerService] addFeatureToRelease:', error);
    throw error;
  }
};

/**
 * Updates a feature's data within a release.
 * @param {string} releaseId
 * @param {string} featureId
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateFeature = async (releaseId, featureId, updateData) => {
  try {
    const release = await Explorer.findById(releaseId);
    if (!release) throw new Error('Release not found');

    const feature = release.features.id(featureId);
    if (!feature) throw new Error('Feature not found');

    Object.assign(feature, updateData);
    release.updatedAt = new Date();
    await release.save();

    return release;
  } catch (error) {
    console.error('[ExplorerService] updateFeature:', error);
    throw error;
  }
};

/**
 * Updates the upload status of a feature. Activates the release when all features are active.
 * @param {string} releaseId
 * @param {string} featureId
 * @param {string} status
 * @returns {Promise<object>}
 */
const updateFeatureStatus = async (releaseId, featureId, status) => {
  try {
    const release = await Explorer.findById(releaseId);
    if (!release) throw new Error('Release not found');

    const feature = release.features.id(featureId);
    if (!feature) throw new Error('Feature not found');

    feature.uploadStatus = status;

    const allActive = release.features.every(f => f.uploadStatus === 'active');
    if (allActive) release.isActive = true;

    release.updatedAt = new Date();
    await release.save();

    return release;
  } catch (error) {
    console.error('[ExplorerService] updateFeatureStatus:', error);
    throw error;
  }
};

/**
 * Reorders features within a release by assigning order based on array position.
 * @param {string} releaseId
 * @param {Array<string>} featureIds - ordered list of feature IDs
 * @returns {Promise<object>}
 */
const reorderFeatures = async (releaseId, featureIds) => {
  try {
    const release = await Explorer.findById(releaseId);
    if (!release) throw new Error('Release not found');

    featureIds.forEach((featureId, index) => {
      const feature = release.features.id(featureId);
      if (feature) feature.order = index + 1;
    });

    release.updatedAt = new Date();
    await release.save();

    return release;
  } catch (error) {
    console.error('[ExplorerService] reorderFeatures:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Removes a feature from a release.
 * @param {string} releaseId
 * @param {string} featureId
 * @returns {Promise<object>}
 */
const deleteFeature = async (releaseId, featureId) => {
  try {
    const release = await Explorer.findById(releaseId);
    if (!release) throw new Error('Release not found');

    release.features.pull(featureId);
    release.updatedAt = new Date();
    await release.save();

    return release;
  } catch (error) {
    console.error('[ExplorerService] deleteFeature:', error);
    throw error;
  }
};

/**
 * Deletes an entire release by ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const deleteRelease = async (id) => {
  try {
    const release = await Explorer.findByIdAndDelete(id);
    if (!release) throw new Error('Release not found');
    return release;
  } catch (error) {
    console.error('[ExplorerService] deleteRelease:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getAllReleases,
  getLatestRelease,
  getReleaseById,
  createRelease,
  addFeatureToRelease,
  updateFeature,
  updateFeatureStatus,
  reorderFeatures,
  deleteFeature,
  deleteRelease,
};