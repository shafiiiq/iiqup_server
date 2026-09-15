const mongoose = require('mongoose');
const HTTP = require('#shared/response/response.status');

const EquipmentModel = require('../equipment.model');
const MobilizationModel = require('../mobilization/mobilization.model');
const ReplacementModel = require('../replacement/replacement.model');

const buildChainTimeline = async (chainId) => {
  const [mobilizations, replacements] = await Promise.all([
    MobilizationModel.find({ chainId }).sort({ date: 1, createdAt: 1 }).lean(),
    ReplacementModel.find({ chainId, type: 'equipment' }).sort({ date: 1, createdAt: 1 }).lean(),
  ]);

  const events = [
    ...mobilizations.map((m) => ({
      type: m.action,
      recordId: m._id,
      regNo: m.regNo,
      machine: m.machine,
      site: m.site,
      deployType: m.deployType,
      clientCompany: m.clientCompany,
      date: m.date,
      time: m.time,
      remarks: m.remarks,
      createdAt: m.createdAt,
    })),
    ...replacements.map((r) => ({
      type: 'replaced',
      recordId: r._id,
      fromRegNo: r.regNo,
      fromMachine: r.machine,
      toRegNo: r.replacedEquipmentRegNo,
      toMachine: r.replacedEquipmentMachine,
      site: r.site,
      newSiteForReplaced: r.newSiteForReplaced,
      date: r.date,
      time: r.time,
      remarks: r.remarks,
      createdAt: r.createdAt,
    })),
  ];

  events.sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt));

  return events;
};

const collectRegNos = (events) => {
  const regNos = new Set();
  events.forEach((event) => {
    if (event.regNo) regNos.add(event.regNo);
    if (event.fromRegNo) regNos.add(event.fromRegNo);
    if (event.toRegNo) regNos.add(event.toRegNo);
  });
  return [...regNos];
};

const fetchChainByChainId = async (chainId) => {
  if (!mongoose.Types.ObjectId.isValid(chainId)) {
    return { status: HTTP.BAD_REQUEST, ok: false, message: 'Invalid chain ID' };
  }

  const events = await buildChainTimeline(chainId);
  if (!events.length) {
    return { status: HTTP.NOT_FOUND, ok: false, message: 'No chain found for the given chain ID' };
  }

  const regNos = collectRegNos(events);
  const equipmentDocs = await EquipmentModel.find({ regNo: { $in: regNos } }).lean();
  const equipmentByRegNo = Object.fromEntries(equipmentDocs.map((eq) => [eq.regNo, eq]));

  const equipmentStatuses = regNos.map((regNo) => {
    const eq = equipmentByRegNo[regNo];
    if (!eq) return { regNo, found: false };

    const isPartOfThisChain = eq.activeChainId && eq.activeChainId.toString() === chainId.toString();

    return {
      regNo: eq.regNo,
      machine: eq.machine,
      status: eq.status,
      isActive: eq.status !== 'idle',
      isPartOfThisChain,
      site: Array.isArray(eq.site) ? eq.site.at(-1) || null : eq.site || null,
      location: eq.location || null,
    };
  });

  const currentHolder = equipmentStatuses.find((eq) => eq.isPartOfThisChain) || null;

  return {
    status: HTTP.OK,
    ok: true,
    data: {
      chainId,
      isChainClosed: !currentHolder,
      currentHolder,
      timeline: events,
      equipmentStatuses,
    },
  };
};

const fetchChainByRegNo = async (regNo) => {
  const equipment = await EquipmentModel.findOne({ regNo }).lean();
  if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };

  if (equipment.activeChainId) return fetchChainByChainId(equipment.activeChainId.toString());

  const [lastMob, lastReplacementAsSource, lastReplacementAsTarget] = await Promise.all([
    MobilizationModel.findOne({ regNo, chainId: { $ne: null } }).sort({ date: -1, createdAt: -1 }).lean(),
    ReplacementModel.findOne({ regNo, type: 'equipment', chainId: { $ne: null } }).sort({ date: -1, createdAt: -1 }).lean(),
    ReplacementModel.findOne({ replacedEquipmentRegNo: regNo, type: 'equipment', chainId: { $ne: null } }).sort({ date: -1, createdAt: -1 }).lean(),
  ]);

  const candidates = [lastMob, lastReplacementAsSource, lastReplacementAsTarget].filter(Boolean);
  if (!candidates.length) {
    return { status: HTTP.NOT_FOUND, ok: false, message: 'No mobilization chain history found for this equipment' };
  }

  const mostRecent = candidates.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  return fetchChainByChainId(mostRecent.chainId.toString());
};

module.exports = {
  fetchChainByChainId,
  fetchChainByRegNo,
};