const { shapeOperatorDetails } = require('../equipment.utils');

const enrichMobilizations = (mobilizations, equipmentMap, imageMap, operatorMap) =>
  mobilizations.map((mob) => {
    const equipment = equipmentMap[mob.regNo] || {};
    const operator = mob.operator ? operatorMap[mob.operator] : null;

    return {
      ...mob,
      equipmentDetails: {
        id: equipment.id,
        machine: equipment.machine || mob.machine,
        regNo: equipment.regNo || mob.regNo,
        brand: equipment.brand,
        year: equipment.year,
        company: equipment.company,
        status: equipment.status,
        site: equipment.site?.[0] ?? equipment.site,
      },
      equipmentImages: imageMap[mob.regNo] || [],
      operatorDetails: shapeOperatorDetails(operator),
    };
  });

module.exports = { enrichMobilizations };
