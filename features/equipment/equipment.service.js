const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { paginate } = require('#shared/pagination/pagination');
const { notifySafely } = require('#shared/notify/notify.user');
const wsUtils = require('#core/socket/socket.io');

const equipmentModel = require('./equipment.model');
const mobilizationModel = require('./mobilization/mobilization.model');
const mobilizationService = require('./mobilization/mobilization.service');
const dashboardServices = require('#features/dashboard/dashboard.service');
const { safeUpdateOperator } = require('./equipment.utils');
const { NOTIFICATION_PRIORITY, STAFF_MAIN, DEFAULT_FETCH_LIMIT, EQUIPMENT_ANSARI_STAFF_SITE_KEYWORD } = require('./equipment.constant');
const {
  buildHiredQuery,
  buildStatusQuery,
  buildSiteQuery,
  buildSearchQuery,
  extractEquipmentChanges,
  getCurrentDateTime,
} = require('./equipment.helper');

const resolveNextId = async () => {
  const existingIds = await equipmentModel.distinct('id');
  const existingSet = new Set(existingIds.filter(Number.isFinite));

  let nextId = 1;
  while (existingSet.has(nextId)) nextId += 1;
  return nextId;
};

const insertEquipment = async (data) => {
  try {
    const existing = await equipmentModel.findOne({ regNo: data.regNo });
    if (existing) {
      return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: 'Equipment already exists' };
    }
    if (data.company === 'HIRED' && !data.hiredFrom) {
      return { status: HTTP.BAD_REQUEST, ok: false, message: 'hiredFrom is required when company is HIRED' };
    }

    data.id = await resolveNextId();
    const equipment = await equipmentModel.create(data);
    const isHired = data.company === 'HIRED';

    await notifySafely(STAFF_MAIN, {
      title: isHired ? 'New Equipment Hired' : 'New Asset Launched',
      description: isHired
        ? `We have hired a new ${equipment.machine} (${equipment.brand}) from ${equipment.hiredFrom} today`
        : `Alhamdulillah, We are happy to inform you! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`,
      priority: NOTIFICATION_PRIORITY.HIGH,
      sourceId: equipment._id,
    });

    dashboardServices.clearDashboardCache()
    wsUtils.dispatchDashboardUpdate('equipment');

    return { status: HTTP.OK, ok: true, message: 'Equipment added successfully', data: equipment };
  } catch (err) {
    logger.error('[equipment.service] insertEquipment:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: 'Missing data or an error occurred', error: err.message };
  }
};

const fetchEquipments = async (
  pagination = { page: 1, limit: DEFAULT_FETCH_LIMIT, skip: 0 },
  hiredFilter = null,
  statusFilter = null,
  siteFilter = null,
  excludeStatusFilter = null
) => {
  try {
    const statusQuery = Array.isArray(statusFilter) && statusFilter.length
      ? { status: { $in: statusFilter } }
      : Array.isArray(excludeStatusFilter) && excludeStatusFilter.length
        ? { status: { $nin: excludeStatusFilter } }
        : {};

    const query = {
      ...buildHiredQuery(hiredFilter),
      ...statusQuery,
      ...(siteFilter ? buildSiteQuery(siteFilter) : {}),
    };

    const { page = 1, limit = DEFAULT_FETCH_LIMIT, skip = 0 } = pagination || {};

    const [data, totalCount] = await Promise.all([
      equipmentModel
        .find(query)
        .collation({ locale: 'en', numericOrdering: true })
        .sort({ machine: 1 })
        .skip(skip)
        .limit(limit),
      equipmentModel.countDocuments(query),
    ]);

    const hasMore = skip + data.length < totalCount;

    return {
      status: HTTP.OK,
      ok: true,
      data,
      pagination: { currentPage: page, hasMore, totalCount, limit },
    };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipments:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipments' };
  }
};

const fetchEquipmentsByStatus = async (status, pagination = { page: 1, limit: DEFAULT_FETCH_LIMIT, skip: 0 }, hiredFilter = null) => {
  try {
    const query = { ...buildHiredQuery(hiredFilter), ...(status && status !== 'all' ? buildStatusQuery(status) : {}) };
    const result = await paginate(equipmentModel, query, pagination, { sort: { year: -1, createdAt: -1 } });

    return { status: HTTP.OK, ok: true, data: result.data, pagination: result.pagination };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentsByStatus:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipments by status' };
  }
};

const fetchEquipmentById = async (id) => {
  try {
    const data = await equipmentModel.findById(id);
    return { status: HTTP.OK, ok: true, data };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentById:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipment' };
  }
};

const fetchEquipmentByRegNo = async (regNo) => {
  try {
    const data = await equipmentModel.findOne({ regNo });
    if (!data) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };
    return { status: HTTP.OK, ok: true, data };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentByRegNo:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipment' };
  }
};

const fetchEquipmentsForExport = async (hiredFilter = null, statusFilter = null, siteFilter = null, excludeStatusFilter = null) => {
  try {
    const statusQuery = Array.isArray(statusFilter) && statusFilter.length
      ? { status: { $in: statusFilter } }
      : Array.isArray(excludeStatusFilter) && excludeStatusFilter.length
        ? { status: { $nin: excludeStatusFilter } }
        : {};

    const query = {
      ...buildHiredQuery(hiredFilter),
      ...statusQuery,
      ...(siteFilter ? buildSiteQuery(siteFilter) : {}),
    };

    const data = await equipmentModel
      .find(query)
      .collation({ locale: 'en', numericOrdering: true })
      .sort({ machine: 1 });

    return { status: HTTP.OK, ok: true, data };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentsForExport:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipments for export' };
  }
};

const updateRemarks = async (regNo, remarks) => {
  try {
    const equipment = await equipmentModel.findOneAndUpdate(
      { regNo },
      { $set: { remarks: remarks || '', updatedAt: new Date() } },
      { new: true }
    );
    if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };
    return { status: HTTP.OK, ok: true, message: 'Remarks updated successfully', data: equipment };
  } catch (err) {
    logger.error('[equipment.service] updateRemarks:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Unable to update remarks' };
  }
};

const fetchEquipmentCount = async (searchTerm, searchField = 'all', hiredFilter = null) => {
  try {
    const query = { ...buildHiredQuery(hiredFilter), ...(searchTerm?.trim() ? buildSearchQuery(searchTerm.trim(), searchField) : {}) };
    const count = await equipmentModel.countDocuments(query);
    return { status: HTTP.OK, ok: true, count };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentCount:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error counting equipments' };
  }
};

const fetchEquipmentStats = async (hiredFilter = null) => {
  try {
    const query = buildHiredQuery(hiredFilter);

    const [totalCount, statusCounts, companyStats, siteStats] = await Promise.all([
      equipmentModel.countDocuments(query),
      equipmentModel.aggregate([{ $match: query }, { $group: { _id: { $toLower: '$status' }, count: { $sum: 1 } } }]),
      equipmentModel.aggregate([{ $match: query }, { $group: { _id: '$company', count: { $sum: 1 } } }]),
      equipmentModel.aggregate([
        { $match: query },
        { $match: { site: { $ne: null } } },
        { $group: { _id: '$site', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const statusBreakdown = { total: totalCount, idle: 0, active: 0, maintenance: 0, loading: 0, going: 0, leased: 0, sold: 0, unknown: 0 };
    statusCounts.forEach(({ _id, count }) => {
      if (Object.hasOwn(statusBreakdown, _id)) statusBreakdown[_id] = count;
      else statusBreakdown.unknown += count;
    });

    return {
      status: HTTP.OK,
      ok: true,
      data: {
        stats: {
          statusBreakdown,
          companyBreakdown: Object.fromEntries(companyStats.map(({ _id, count }) => [_id, count])),
          siteBreakdown: Object.fromEntries(siteStats.map(({ _id, count }) => [_id, count])),
          totalEquipment: totalCount,
        },
      },
    };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentStats:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipment statistics' };
  }
};

const fetchEquipmentTabCounts = async () => {
  try {
    const [ownStatusCounts, hiredTotal, leasedTotal, ansariStaffTotal, siteEquipmentCounts] = await Promise.all([
      equipmentModel.aggregate([
        { $match: { hired: false } },
        { $group: { _id: { $toLower: '$status' }, count: { $sum: 1 } } },
      ]),
      equipmentModel.countDocuments({ hired: true }),
      equipmentModel.countDocuments({ status: { $regex: /^leased$/i } }),
      equipmentModel.countDocuments({
        hired: false,
        site: { $regex: EQUIPMENT_ANSARI_STAFF_SITE_KEYWORD, $options: 'i' },
      }),
      equipmentModel.aggregate([
        { $match: { status: { $ne: 'sold' } } },
        {
          $addFields: {
            __currentSite: { $arrayElemAt: ['$site', -1] },
          },
        },
        { $match: { __currentSite: { $nin: [null, ''] } } },
        { $group: { _id: '$__currentSite', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const ownStatusBreakdown = { total: 0, idle: 0, active: 0, maintenance: 0, loading: 0, going: 0, leased: 0, sold: 0, unknown: 0 };
    let ownTotal = 0;
    ownStatusCounts.forEach(({ _id, count }) => {
      if (_id === 'sold') {
        ownStatusBreakdown.sold = count;
        return;
      }
      ownTotal += count;
      if (Object.hasOwn(ownStatusBreakdown, _id)) ownStatusBreakdown[_id] = count;
      else ownStatusBreakdown.unknown += count;
    });

    const siteList = siteEquipmentCounts
      .filter(({ _id }) => typeof _id === 'string' && _id.trim())
      .map(({ _id, count }) => ({ site: _id, count }));

    return {
      status: HTTP.OK,
      ok: true,
      data: {
        own: {
          total: ownTotal,
          active: ownStatusBreakdown.active + ownStatusBreakdown.leased + ownStatusBreakdown.going + ownStatusBreakdown.loading,
          idle: ownStatusBreakdown.idle,
          maintenance: ownStatusBreakdown.maintenance,
          sold: ownStatusBreakdown.sold,
        },
        hired: hiredTotal,
        leased: leasedTotal,
        ansariStaff: ansariStaffTotal,
        sites: siteList.length,
        siteList,
      },
    };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentTabCounts:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipment tab counts' };
  }
};

const fetchEquipmentRecordsSummary = async (hiredFilter = null) => {
  try {
    const matchQuery = buildHiredQuery(hiredFilter);

    const [result] = await equipmentModel.aggregate([
      { $match: matchQuery },
      {
        $addFields: {
          __totalMaintenance: {
            $add: [
              { $ifNull: ['$maintenanceRecord.oil', 0] },
              { $ifNull: ['$maintenanceRecord.normal', 0] },
              { $ifNull: ['$maintenanceRecord.major', 0] },
              { $ifNull: ['$maintenanceRecord.battery', 0] },
              { $ifNull: ['$maintenanceRecord.tyre', 0] },
            ],
          },
          __totalMobilizations: {
            $add: [
              { $ifNull: ['$mobilizationsRecord.mobilization', 0] },
              { $ifNull: ['$mobilizationsRecord.demobilization', 0] },
            ],
          },
          __totalReplacements: { $ifNull: ['$replacementRecord.equipmentReplacement', 0] },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                equipmentCount: { $sum: 1 },
                oil: { $sum: '$maintenanceRecord.oil' },
                normal: { $sum: '$maintenanceRecord.normal' },
                major: { $sum: '$maintenanceRecord.major' },
                battery: { $sum: '$maintenanceRecord.battery' },
                tyre: { $sum: '$maintenanceRecord.tyre' },
                mobilization: { $sum: '$mobilizationsRecord.mobilization' },
                demobilization: { $sum: '$mobilizationsRecord.demobilization' },
                equipmentReplacement: { $sum: '$replacementRecord.equipmentReplacement' },
              },
            },
          ],
          topMaintenance: [
            { $match: { __totalMaintenance: { $gt: 0 } } },
            { $sort: { __totalMaintenance: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, regNo: 1, machine: 1, value: '$__totalMaintenance' } },
          ],
          topMobilizations: [
            { $match: { __totalMobilizations: { $gt: 0 } } },
            { $sort: { __totalMobilizations: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, regNo: 1, machine: 1, value: '$__totalMobilizations' } },
          ],
          topReplacements: [
            { $match: { __totalReplacements: { $gt: 0 } } },
            { $sort: { __totalReplacements: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, regNo: 1, machine: 1, value: '$__totalReplacements' } },
          ],
        },
      },
    ]);

    const totalsDoc = result?.totals?.[0] || {};
    const oil = totalsDoc.oil || 0;
    const normal = totalsDoc.normal || 0;
    const major = totalsDoc.major || 0;
    const battery = totalsDoc.battery || 0;
    const tyre = totalsDoc.tyre || 0;

    return {
      status: HTTP.OK,
      ok: true,
      data: {
        equipmentCount: totalsDoc.equipmentCount || 0,
        maintenance: {
          oil,
          normal,
          major,
          battery,
          tyre,
          total: oil + normal + major + battery + tyre,
        },
        mobilizations: {
          mobilization: totalsDoc.mobilization || 0,
          demobilization: totalsDoc.demobilization || 0,
        },
        replacements: {
          equipmentReplacement: totalsDoc.equipmentReplacement || 0,
        },
        topMaintenance: result?.topMaintenance || [],
        topMobilizations: result?.topMobilizations || [],
        topReplacements: result?.topReplacements || [],
      },
    };
  } catch (err) {
    logger.error('[equipment.service] fetchEquipmentRecordsSummary:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching equipment records summary' };
  }
};

const fetchUniqueSites = async () => {
  const sites = await equipmentModel.distinct('site');
  return sites.filter((site) => site?.trim()).sort();
};

const fetchSiteMachineBreakdown = async (site) => {
  try {
    if (!site) return { status: HTTP.BAD_REQUEST, ok: false, message: 'site is required' };

    const breakdown = await equipmentModel.aggregate([
      { $match: { status: { $ne: 'sold' } } },
      { $addFields: { __currentSite: { $arrayElemAt: ['$site', -1] } } },
      { $match: { __currentSite: site } },
      { $group: { _id: '$machine', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);

    const machineList = breakdown.map(({ _id, count }) => ({ machine: _id, count }));
    const totalEquipment = machineList.reduce((sum, entry) => sum + entry.count, 0);

    return {
      status: HTTP.OK,
      ok: true,
      data: {
        site,
        totalEquipment,
        machineList,
        mostCommon: machineList[0] || null,
      },
    };
  } catch (err) {
    logger.error('[equipment.service] fetchSiteMachineBreakdown:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Error fetching site machine breakdown' };
  }
};

const updateIdleLocation = async (regNo, { idleAt, idleSite }) => {
  try {
    const resolvedIdleAt = idleAt === 'site' ? 'site' : 'garage';

    const equipment = await equipmentModel.findOneAndUpdate(
      { regNo },
      {
        $set: {
          idleAt: resolvedIdleAt,
          idleSite: resolvedIdleAt === 'site' ? (idleSite || null) : null,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };

    return { status: HTTP.OK, ok: true, message: 'Idle location updated successfully', data: equipment };
  } catch (err) {
    logger.error('[equipment.service] updateIdleLocation:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Unable to update idle location' };
  }
};

const markEquipmentSold = async (regNo) => {
  try {
    const equipment = await equipmentModel.findOne({ regNo });
    if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };

    if (equipment.status === 'sold') {
      return { status: HTTP.OK, ok: true, message: 'Equipment is already marked as sold', data: equipment };
    }

    const previousStatus = equipment.status;

    const updated = await equipmentModel.findOneAndUpdate(
      { regNo },
      {
        $set: {
          status: 'sold',
          updatedAt: new Date(),
          hasScheduledDemob: false,
          scheduledDemobAt: null,
          scheduledDemobTime: '',
          scheduledDemobRemarks: '',
        },
      },
      { new: true }
    );

    const { month, year, time } = getCurrentDateTime();
    await mobilizationModel.create({
      equipmentId: equipment._id,
      regNo: equipment.regNo,
      machine: equipment.machine,
      action: 'status_changed',
      previousStatus: previousStatus?.toLowerCase(),
      newStatus: 'sold',
      withOperator: false,
      month,
      year,
      date: new Date(),
      time,
      remarks: 'Equipment marked as sold',
      status: 'sold',
    });

    await notifySafely(STAFF_MAIN, {
      title: 'Equipment Sold',
      description: `${equipment.machine} - ${equipment.regNo} has been marked as sold`,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      sourceId: equipment._id,
    });

    dashboardServices.clearDashboardCache();
    wsUtils.dispatchDashboardUpdate('equipment');

    return { status: HTTP.OK, ok: true, message: 'Equipment marked as sold', data: updated };
  } catch (err) {
    logger.error('[equipment.service] markEquipmentSold:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: err.message || 'Unable to mark equipment as sold' };
  }
};

const autoDemobilizeOverdueEquipment = async () => {
  try {
    const now = new Date();
    const overdueEquipment = await equipmentModel
      .find({ hasScheduledDemob: true, scheduledDemobAt: { $lte: now }, status: { $ne: 'idle' } })
      .lean();

    for (const equipment of overdueEquipment) {
      try {
        const demobDateTime = equipment.scheduledDemobAt;
        await mobilizationService.demobilizeEquipment({
          equipmentId: equipment._id,
          regNo: equipment.regNo,
          machine: equipment.machine,
          month: demobDateTime.getMonth() + 1,
          year: demobDateTime.getFullYear(),
          time: equipment.scheduledDemobTime || 'N/A',
          selectedDate: demobDateTime,
          remarks: equipment.scheduledDemobRemarks || 'Auto demobilized after one-day mobilization period ended',
        });

        await equipmentModel.updateOne(
          { _id: equipment._id },
          { $set: { hasScheduledDemob: false, scheduledDemobAt: null, scheduledDemobTime: '', scheduledDemobRemarks: '' } }
        );
      } catch (innerErr) {
        logger.error('[equipment.service] autoDemobilizeOverdueEquipment item failed:', innerErr);
      }
    }
  } catch (err) {
    logger.error('[equipment.service] autoDemobilizeOverdueEquipment:', err);
  }
};

const updateEquipment = async (regNo, updatedData, equipmentNumber = null, operatorName = null) => {
  try {
    if (equipmentNumber && operatorName) {
      const equipment = await equipmentModel.findOne({ regNo: equipmentNumber });
      if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };

      const result = await equipmentModel.findOneAndUpdate(
        { regNo: equipmentNumber },
        { operator: operatorName },
        { new: true, runValidators: true }
      );

      await notifySafely(null, {
        title: 'Operator Updated',
        description: `${equipment.machine} - ${equipment.regNo}'s new operator is ${operatorName}`,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        sourceId: equipment._id,
      });

      return { status: HTTP.OK, ok: true, message: 'Equipment updated successfully', data: result };
    }

    const equipment = await equipmentModel.findOne({ regNo });
    if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };

    if (updatedData.company === 'HIRED' && !updatedData.hiredFrom && !equipment.hiredFrom) {
      return { status: HTTP.BAD_REQUEST, ok: false, message: 'hiredFrom is required when company is HIRED' };
    }

    const originalEquipment = equipment.toObject();

    const { _id, __v, createdAt, operator, operatorId, lastSite, lastLocation, lastCertificationBody, lastRentRate, ...cleanUpdatedData } =
      updatedData;

    if (cleanUpdatedData.company !== undefined) {
      cleanUpdatedData.hired = cleanUpdatedData.company === 'HIRED';
    }

    const setFields = { ...cleanUpdatedData, updatedAt: new Date() };
    const pushFields = {};
    let newOperatorId = null;

    if (cleanUpdatedData.site !== undefined && cleanUpdatedData.site !== originalEquipment.site) {
      if (originalEquipment.site) pushFields.lastSite = originalEquipment.site;
      setFields.site = cleanUpdatedData.site || null;
    }

    if (cleanUpdatedData.location !== undefined && cleanUpdatedData.location !== originalEquipment.location) {
      if (originalEquipment.location) pushFields.lastLocation = originalEquipment.location;
      setFields.location = cleanUpdatedData.location || null;
    }

    if (cleanUpdatedData.rentRate) {
      const oldRate = originalEquipment.rentRate;
      const newRate = cleanUpdatedData.rentRate;
      const rateChanged = oldRate && (Number(oldRate.rate) !== Number(newRate.rate) || oldRate.basis !== newRate.basis);
      if (rateChanged) {
        pushFields.lastRentRate = { basis: oldRate.basis, rate: oldRate.rate, currency: oldRate.currency || 'QAR', changedAt: new Date() };
      }
    }

    if (operator !== undefined && operator !== originalEquipment.certificationBody?.operatorName) {
      if (originalEquipment.certificationBody) pushFields.lastCertificationBody = originalEquipment.certificationBody;
      newOperatorId = operatorId || null;
      setFields.certificationBody = [
        {
          operatorName: operator,
          operatorId: operatorId || '',
          shiftName: updatedData.operatorShift || '',
          shiftStart: '',
          shiftEnd: '',
          assignedAt: new Date(),
        },
      ];
    }

    const updateOp = { $set: setFields };
    if (Object.keys(pushFields).length) updateOp.$push = pushFields;

    const result = await equipmentModel.findOneAndUpdate({ regNo }, updateOp, { new: true, runValidators: true });

    if (newOperatorId) {
      const prevOperatorId = originalEquipment.certificationBody?.operatorId;
      if (prevOperatorId && prevOperatorId !== newOperatorId) {
        await safeUpdateOperator(prevOperatorId, { equipmentNumber: '' });
      }
      await safeUpdateOperator(newOperatorId, { equipmentNumber: regNo });
    }

    if (updatedData.status && originalEquipment.status !== updatedData.status) {
      const { month, year, time } = getCurrentDateTime();
      await mobilizationModel.create({
        equipmentId: equipment._id,
        regNo: equipment.regNo,
        machine: equipment.machine,
        action: 'status_changed',
        previousStatus: originalEquipment.status?.toLowerCase(),
        newStatus: updatedData.status?.toLowerCase(),
        withOperator: false,
        month,
        year,
        date: new Date(),
        time,
        remarks: 'Status updated via edit modal',
        status: updatedData.status?.toLowerCase(),
      });
    }

    const changes = extractEquipmentChanges(originalEquipment, result, updatedData);
    if (changes.length) {
      await notifySafely(null, {
        title: 'Equipment Updated',
        description: `${equipment.machine} - ${equipment.regNo}'s new ${changes.join(', ')}`,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        sourceId: equipment._id,
      });
    }

    dashboardServices.clearDashboardCache()
    wsUtils.dispatchDashboardUpdate('equipment');

    return { status: HTTP.OK, ok: true, message: 'Equipment updated successfully', data: result };
  } catch (err) {
    logger.error('[equipment.service] updateEquipment:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: 'Unable to update equipment' };
  }
};

const deleteEquipment = async (regNo) => {
  try {
    const equipment = await equipmentModel.findOne({ regNo });
    if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };

    const deleted = await equipmentModel.findOneAndDelete({ regNo: equipment.regNo });

    await notifySafely(null, {
      title: 'Equipment Removed',
      description: `Equipment ${deleted.machine} - ${deleted.regNo} has been removed from the system or sold`,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      sourceId: deleted._id,
    });

    return { status: HTTP.OK, ok: true, message: 'Equipment deleted successfully', data: deleted };
  } catch (err) {
    logger.error('[equipment.service] deleteEquipment:', err);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: 'Unable to delete equipment' };
  }
};

module.exports = {
  insertEquipment,
  fetchEquipments,
  fetchEquipmentsByStatus,
  fetchEquipmentById,
  fetchEquipmentByRegNo,
  fetchEquipmentsForExport,
  fetchEquipmentCount,
  fetchEquipmentStats,
  fetchEquipmentTabCounts,
  fetchEquipmentRecordsSummary,
  fetchUniqueSites,
  fetchSiteMachineBreakdown,
  updateIdleLocation,
  updateRemarks,
  markEquipmentSold,
  autoDemobilizeOverdueEquipment,
  updateEquipment,
  deleteEquipment,
};