const equipmentModel = require('./equipment.model');

const SUGGESTION_LIMIT = 8;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchEquipmentSuggestions = async (term) => {
  const trimmedTerm = String(term || '').trim();
  if (!trimmedTerm) return [];

  const equipments = await equipmentModel
    .find({ regNo: { $regex: escapeRegex(trimmedTerm), $options: 'i' }, status: { $ne: 'sold' } })
    .select('regNo machine')
    .sort({ regNo: 1 })
    .limit(SUGGESTION_LIMIT)
    .lean();

  return equipments.map((equipment) => ({
    value: equipment.regNo,
    label: `${equipment.regNo} · ${equipment.machine}`,
    fills: { equipment: equipment.machine },
  }));
};

module.exports = { searchEquipmentSuggestions };