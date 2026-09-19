const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { paginate } = require('#shared/pagination/pagination');

const IdleRosterModel = require('./idle-roster.model');
const EquipmentModel = require('../equipment.model');
const { IDLE_ROSTER_STATUSES } = require('./idle-roster.constant');

const shapeEquipmentAsRosterItem = (equipment) => ({
  equipmentId: equipment._id,
  regNo: equipment.regNo,
  machine: equipment.machine,
  brand: equipment.brand,
  year: equipment.year,
  status: equipment.status,
  site: Array.isArray(equipment.site) ? equipment.site.at(-1) || '' : equipment.site || '',
  idleAt: equipment.idleAt || '',
  idleSite: equipment.idleSite || '',
  operatorName: equipment.certificationBody?.at(-1)?.operatorName || '',
  remarks: equipment.remarks || '',
  mobDate: equipment.mobDate || null,
  demobDate: equipment.demobDate || null,
});

const buildLiveEntriesFromEquipment = async () => {
  const equipments = await EquipmentModel.find({ status: { $in: IDLE_ROSTER_STATUSES } })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ status: 1, machine: 1 })
    .lean();

  return equipments.map(shapeEquipmentAsRosterItem);
};

const fetchLatestRoster = async () => {
  try {
    const existing = await IdleRosterModel.findOne({ isLatest: true }).lean();

    if (existing) {
      return { status: HTTP.OK, ok: true, data: { ...existing, source: 'saved' } };
    }

    const entries = await buildLiveEntriesFromEquipment();
    return {
      status: HTTP.OK,
      ok: true,
      data: { entries, isLatest: true, savedAt: null, source: 'live' },
    };
  } catch (err) {
    logger.error('[idle-roster.service] fetchLatestRoster:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching idle roster' };
  }
};

const fetchRosterHistory = async (pagination) => {
  try {
    const result = await paginate(IdleRosterModel, { isLatest: false }, pagination, { sort: { savedAt: -1 } });
    return { status: HTTP.OK, ok: true, data: result.data, pagination: result.pagination };
  } catch (err) {
    logger.error('[idle-roster.service] fetchRosterHistory:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching idle roster history' };
  }
};

const fetchRosterById = async (id) => {
  try {
    const roster = await IdleRosterModel.findById(id).lean();
    if (!roster) return { status: HTTP.NOT_FOUND, ok: false, message: 'Idle roster not found' };
    return { status: HTTP.OK, ok: true, data: roster };
  } catch (err) {
    logger.error('[idle-roster.service] fetchRosterById:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching idle roster' };
  }
};

const saveRosterUpdate = async (entries) => {
  try {
    if (!Array.isArray(entries) || !entries.length) {
      return { status: HTTP.BAD_REQUEST, ok: false, message: 'entries array is required and must not be empty' };
    }

    const cleanEntries = entries.map((entry) => ({
      equipmentId: entry.equipmentId || null,
      regNo: entry.regNo,
      machine: entry.machine || '',
      brand: entry.brand || '',
      year: entry.year || null,
      status: IDLE_ROSTER_STATUSES.includes(entry.status) ? entry.status : 'idle',
      site: entry.site || '',
      idleAt: entry.idleAt || '',
      idleSite: entry.idleSite || '',
      operatorName: entry.operatorName || '',
      remarks: entry.remarks || '',
      mobDate: entry.mobDate || null,
      demobDate: entry.demobDate || null,
    }));

    await IdleRosterModel.updateMany({ isLatest: true }, { $set: { isLatest: false } });

    const savedRoster = await IdleRosterModel.create({
      entries: cleanEntries,
      isLatest: true,
      savedAt: new Date(),
    });

    return { status: HTTP.OK, ok: true, message: 'Idle roster updated successfully', data: savedRoster };
  } catch (err) {
    logger.error('[idle-roster.service] saveRosterUpdate:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Unable to save idle roster update' };
  }
};

module.exports = {
  fetchLatestRoster,
  fetchRosterHistory,
  fetchRosterById,
  saveRosterUpdate,
};