const { shapeOperatorDetails, shapeEquipmentDetails } = require('../equipment.utils');

const enrichReplacements = (replacements, equipmentMapById, imageMap, operatorMap) =>
  replacements.map((replacement) => {
    const currentEquipment = equipmentMapById[replacement.equipmentId.toString()] || {};
    const currentImages = imageMap[currentEquipment.regNo] || [];

    let replacedEquipmentDetails = null;
    if (replacement.type === 'equipment' && replacement.replacedEquipmentId) {
      const replacedEquipment = equipmentMapById[replacement.replacedEquipmentId.toString()] || {};
      const replacedImages = imageMap[replacedEquipment.regNo] || [];
      replacedEquipmentDetails = shapeEquipmentDetails(replacedEquipment, replacement, replacedImages);
    }

    return {
      ...replacement,
      currentEquipmentDetails: shapeEquipmentDetails(currentEquipment, replacement, currentImages),
      replacedEquipmentDetails,
      currentOperatorDetails: shapeOperatorDetails(
        replacement.currentOperatorId ? operatorMap[replacement.currentOperatorId] : null
      ),
      replacedOperatorDetails: shapeOperatorDetails(
        replacement.replacedOperatorId ? operatorMap[replacement.replacedOperatorId] : null
      ),
    };
  });

module.exports = { enrichReplacements };
