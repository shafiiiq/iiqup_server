const { fetchImageMap } = require('../images/images.service');
const { fetchOperatorMapById, fetchEquipmentMapByRegNo } = require('../equipment/equipment.utils');
const { ACTIVITY_SOURCES } = require('./activity.constant');

const collectRegNos = (contents) => [
  ...new Set(contents.flatMap((content) => content.regNos).filter(Boolean)),
];

const collectOperatorIds = (entries) => [
  ...new Set(
    entries
      .filter((entry) => entry.source === ACTIVITY_SOURCES.OPERATOR && entry.record.operatorId)
      .map((entry) => String(entry.record.operatorId))
  ),
];

const fetchActivityMaps = async (entries, contents) => {
  const regNos = collectRegNos(contents);

  const [imageMap, operatorMap, equipmentMap] = await Promise.all([
    fetchImageMap(regNos),
    fetchOperatorMapById(collectOperatorIds(entries)),
    fetchEquipmentMapByRegNo(regNos),
  ]);

  return { imageMap, operatorMap, equipmentMap };
};

module.exports = { fetchActivityMaps };