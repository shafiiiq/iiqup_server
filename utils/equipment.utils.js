// ─────────────────────────────────────────────────────────────────────────────
// Equipment Utils
// Utilities that touch the DB or external services, but are shared across
// multiple service functions. Keep side-effectful logic here, pure logic in helpers.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose          = require('mongoose');
const equipmentModel    = require('../models/equipment.model');
const EquipmentImageModel = require('../models/images.model');
const OperatorModel     = require('../models/operator.model');
const OperatorService   = require('../services/operator.service');
const { normaliseImages } = require('../helpers/equipment.helper');

// ─────────────────────────────────────────────────────────────────────────────
// Operator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely updates an operator document. Skips silently for invalid IDs.
 * @param {string} operatorId
 * @param {object} updateData
 * @returns {Promise<object|null>}
 */
const safeUpdateOperator = async (operatorId, updateData) => {
  if (!operatorId || !mongoose.Types.ObjectId.isValid(operatorId)) {
    console.log('Skipping operator update — invalid operatorId:', operatorId);
    return null;
  }

  try {
    return await OperatorModel.findByIdAndUpdate(
      operatorId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
  } catch (err) {
    console.error('safeUpdateOperator failed:', err.message);
    return null;
  }
};

/**
 * Fetches operators by their MongoDB ObjectId array.
 * @param {string[]} operatorIds
 * @returns {Promise<object[]>}
 */
const getOperatorsByIds = async (operatorIds) => {
  try {
    return await OperatorModel.find({ _id: { $in: operatorIds } }).lean();
  } catch (err) {
    console.error('getOperatorsByIds failed:', err.message);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Fetchers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches equipment documents matching an array of registration numbers.
 * Returns a map keyed by regNo for O(1) lookups.
 * @param {string[]} regNos
 * @returns {Promise<Record<string, object>>}
 */
const fetchEquipmentMapByRegNo = async (regNos) => {
  const equipments = await equipmentModel.find({ regNo: { $in: regNos } }).lean();
  return Object.fromEntries(equipments.map(eq => [eq.regNo, eq]));
};

/**
 * Fetches equipment documents matching an array of MongoDB _ids.
 * Returns a map keyed by _id.toString() for O(1) lookups.
 * @param {string[]} equipmentIds
 * @returns {Promise<Record<string, object>>}
 */
const fetchEquipmentMapById = async (equipmentIds) => {
  const equipments = await equipmentModel.find({ _id: { $in: equipmentIds } }).lean();
  return Object.fromEntries(equipments.map(eq => [eq._id.toString(), eq]));
};

/**
 * Fetches equipment image documents and returns a normalised map keyed by equipmentNo.
 * @param {string[]} regNos
 * @returns {Promise<Record<string, object[]>>}
 */
const fetchImageMap = async (regNos) => {
  const equipmentImages = await EquipmentImageModel.find({ equipmentNo: { $in: regNos } }).lean();

  return Object.fromEntries(
    equipmentImages.map(img => [img.equipmentNo, normaliseImages(img.images || [])])
  );
};

/**
 * Fetches operators by name (legacy — prefer fetchOperatorMapById).
 * Returns a map keyed by operator name.
 * @param {string[]} names
 * @returns {Promise<Record<string, object>>}
 */
const fetchOperatorMapByName = async (names) => {
  if (!names.length) return {};
  const operators = await OperatorService.getOperatorsByNames(names);
  return Object.fromEntries(operators.map(op => [op.name, op]));
};

/**
 * Fetches operators by ID.
 * Returns a map keyed by _id.toString().
 * @param {string[]} ids
 * @returns {Promise<Record<string, object>>}
 */
const fetchOperatorMapById = async (ids) => {
  if (!ids.length) return {};
  const operators = await getOperatorsByIds(ids);
  return Object.fromEntries(operators.map(op => [op._id.toString(), op]));
};

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shapes a minimal operator detail object from a full operator document.
 * @param {object|null} op
 * @returns {object|null}
 */
const shapeOperatorDetails = (op) => {
  if (!op) return null;
  return {
    id:         op._id || op.id,
    name:       op.name,
    qatarId:    op.qatarId,
    contactNo:  op.contactNo,
    profilePic: op.profilePic
  };
};

/**
 * Shapes a minimal equipment detail object from a full equipment document.
 * Falls back to mobilization/replacement record fields when equipment is missing.
 * @param {object} eq       - equipment document (may be empty {})
 * @param {object} fallback - record with regNo / machine as fallback
 * @param {object[]} images
 * @returns {object}
 */
const shapeEquipmentDetails = (eq, fallback = {}, images = []) => ({
  id:      eq._id,
  machine: eq.machine  || fallback.machine,
  regNo:   eq.regNo    || fallback.regNo,
  brand:   eq.brand,
  year:    eq.year,
  company: eq.company,
  status:  eq.status,
  site:    eq.site?.[0] ?? eq.site,
  images
});

/**
 * Enriches mobilization records with equipment details, images, and operator info.
 * @param {object[]}                mobilizations
 * @param {Record<string, object>}  equipmentMap    - keyed by regNo
 * @param {Record<string, object[]>} imageMap       - keyed by regNo
 * @param {Record<string, object>}  operatorMap     - keyed by operator name
 * @returns {object[]}
 */
const enrichMobilizations = (mobilizations, equipmentMap, imageMap, operatorMap) =>
  mobilizations.map(mob => {
    const equipment = equipmentMap[mob.regNo] || {};
    const images    = imageMap[mob.regNo]     || [];
    const operator  = mob.operator ? operatorMap[mob.operator] : null;

    return {
      ...mob,
      equipmentDetails: {
        id:      equipment.id,
        machine: equipment.machine || mob.machine,
        regNo:   equipment.regNo   || mob.regNo,
        brand:   equipment.brand,
        year:    equipment.year,
        company: equipment.company,
        status:  equipment.status,
        site:    equipment.site?.[0] ?? equipment.site
      },
      equipmentImages:  images,
      operatorDetails:  shapeOperatorDetails(operator)
    };
  });

/**
 * Enriches replacement records with equipment and operator details.
 * @param {object[]}                replacements
 * @param {Record<string, object>}  equipmentMapById  - keyed by _id string
 * @param {Record<string, object[]>} imageMap         - keyed by regNo
 * @param {Record<string, object>}  operatorMap       - keyed by _id string
 * @returns {object[]}
 */
const enrichReplacements = (replacements, equipmentMapById, imageMap, operatorMap) =>
  replacements.map(rep => {
    const currentEquipment = equipmentMapById[rep.equipmentId.toString()] || {};
    const currentImages    = imageMap[currentEquipment.regNo] || [];

    let replacedEquipmentDetails = null;

    if (rep.type === 'equipment' && rep.replacedEquipmentId) {
      const replacedEq     = equipmentMapById[rep.replacedEquipmentId.toString()] || {};
      const replacedImages = imageMap[replacedEq.regNo] || [];

      replacedEquipmentDetails = {
        ...shapeEquipmentDetails(replacedEq, rep, replacedImages),
        images: replacedImages
      };
    }

    return {
      ...rep,
      currentEquipmentDetails:  shapeEquipmentDetails(currentEquipment, rep, currentImages),
      replacedEquipmentDetails,
      currentOperatorDetails:   shapeOperatorDetails(rep.currentOperatorId  ? operatorMap[rep.currentOperatorId]  : null),
      replacedOperatorDetails:  shapeOperatorDetails(rep.replacedOperatorId ? operatorMap[rep.replacedOperatorId] : null)
    };
  });

module.exports = {
  safeUpdateOperator,
  getOperatorsByIds,
  fetchEquipmentMapByRegNo,
  fetchEquipmentMapById,
  fetchImageMap,
  fetchOperatorMapByName,
  fetchOperatorMapById,
  shapeOperatorDetails,
  shapeEquipmentDetails,
  enrichMobilizations,
  enrichReplacements
};