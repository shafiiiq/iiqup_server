const mongoose = require('mongoose');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { paginate } = require('#shared/pagination/pagination');
const { notifySafely } = require('#shared/notify/notify.user');
const { resolveDateRange, buildDateRangeQuery } = require('#shared/date/date.range');
const wsUtils = require('#core/socket/socket.io');

const equipmentModel = require('../equipment.model');
const dashboardServices = require('#features/dashboard/dashboard.service');
const { NOTIFICATION_PRIORITY, STAFF_MAIN } = require('../equipment.constant');
const {
  safeUpdateOperator,
  fetchEquipmentMapByRegNo,
  fetchOperatorMapByName,
} = require('../equipment.utils');
const { fetchImageMap } = require('../images/images.service');
const operatorMobilizationService = require('#features/user/operator/mobilization/operator.mobilization.service');
const chainService = require('../chain/chain.service');

const mobilizationModel = require('./mobilization.model');
const { alertMobilizationViaEmail } = require('./mobilization.email');
const {
  RECENT_LIMIT,
  FILTERED_LIMIT,
  MOBILIZATION_ACTIONS,
} = require('./mobilization.constant');
const { enrichMobilizations } = require('./mobilization.helper');

const combineDateAndTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (!Number.isNaN(hours)) date.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
  }
  return date;
};

const resolveLocation = (location) =>
  Array.isArray(location) ? location.join(', ') : location || '';

const safeFetchChainInfo = async (chainId) => {
  if (!chainId) return null;
  try {
    const result = await chainService.fetchChainByChainId(chainId.toString());
    return result.ok ? result.data : null;
  } catch (err) {
    logger.warn('[mobilization.service] safeFetchChainInfo failed (non-fatal):', err.message);
    return null;
  }
};

const mobilizeEquipment = async (data) => {
  const {
    equipmentId,
    regNo,
    machine,
    site,
    operators,
    withOperator,
    deployType,
    clientCompany,
    month,
    year,
    time,
    selectedDate,
    remarks,
    isOneDayMob,
    demobDate,
    demobTime,
    demobRemarks,
    location,
    rentRate,
  } = data;

  const isCompanyDeploy = deployType === 'company';
  const deployLocation = isCompanyDeploy ? clientCompany : site;
  const newStatus = isCompanyDeploy ? 'leased' : 'active';
  const mobilizationDate = selectedDate ? new Date(selectedDate) : new Date();
  const willAutoDemobilize = Boolean(isOneDayMob && demobDate);

  const currentEquipment = await equipmentModel.findById(equipmentId);
  const chainId = new mongoose.Types.ObjectId();

  const resolvedRentRate =
    rentRate?.basis || rentRate?.rate
      ? {
        basis: rentRate.basis || 'daily',
        rate: Number(rentRate.rate) || 0,
        currency: rentRate.currency || 'QAR',
      }
      : currentEquipment?.rentRate || null;

  const mobilization = await mobilizationModel.create({
    equipmentId,
    regNo,
    machine,
    action: MOBILIZATION_ACTIONS.MOBILIZED,
    deployType: deployType || 'site',
    clientCompany: clientCompany || '',
    site: resolveLocation(deployLocation),
    operators: withOperator ? operators : [],
    withOperator,
    month,
    year,
    date: mobilizationDate,
    time,
    remarks,
    status: newStatus,
    isOneDayMob: isOneDayMob || false,
    demobDate: willAutoDemobilize ? new Date(demobDate) : null,
    demobTime: isOneDayMob ? demobTime : '',
    demobRemarks: isOneDayMob ? demobRemarks : '',
    hired: currentEquipment?.hired || false,
    hiredFrom: currentEquipment?.hiredFrom || '',
    rentRate: resolvedRentRate,
    location: resolveLocation(location || currentEquipment?.location),
    chainId,
  });

  const setFields = {
    status: newStatus,
    site: deployLocation,
    updatedAt: new Date(),
    mobDate: new Date(),
    activeChainId: chainId,
    hasScheduledDemob: willAutoDemobilize,
    scheduledDemobAt: willAutoDemobilize ? combineDateAndTime(demobDate, demobTime) : null,
    scheduledDemobTime: willAutoDemobilize ? (demobTime || '') : '',
    scheduledDemobRemarks: willAutoDemobilize ? (demobRemarks || '') : '',
  };

  const pushFields = {};

  if (currentEquipment?.site) {
    pushFields.lastSite = currentEquipment.site;
  }

  if (currentEquipment?.mobDate) {
    pushFields.lastMobDate = currentEquipment.mobDate;
  }

  if (location) {
    if (currentEquipment?.location) {
      pushFields.lastLocation = currentEquipment.location;
    }

    setFields.location = resolveLocation(location);
  }

  if (rentRate?.basis || rentRate?.rate) {
    if (currentEquipment?.rentRate?.rate || currentEquipment?.rentRate?.basis) {
      pushFields.lastRentRate = {
        ...currentEquipment.rentRate.toObject(),
        changedAt: new Date(),
      };
    }

    setFields.rentRate = resolvedRentRate;
  }

  if (withOperator && operators?.length) {
    if (currentEquipment?.certificationBody?.length) {
      pushFields.lastCertificationBody = {
        $each: currentEquipment.certificationBody,
      };
    }

    setFields.certificationBody = operators.map((op) => ({
      operatorName: op.operatorName,
      operatorId: op.operatorId,
      shiftName: op.shiftName || '',
      shiftStart: op.shiftStart || '',
      shiftEnd: op.shiftEnd || '',
      assignedAt: new Date(),
    }));
  }

  const incFields = {
    'mobilizationsRecord.mobilization': 1,
  };

  const updateOp = {
    $set: setFields,
    $inc: incFields,
  };

  if (Object.keys(pushFields).length) {
    updateOp.$push = pushFields;
  }

  const updatedEquipment = await equipmentModel.findOneAndUpdate(
    { _id: equipmentId },
    updateOp,
    { new: true }
  );

  if (!updatedEquipment) {
    return {
      status: HTTP.NOT_FOUND,
      ok: false,
      message: 'Equipment not found',
    };
  }

  if (withOperator && operators?.length) {
    await Promise.all(
      operators.map((op) =>
        op.operatorId
          ? safeUpdateOperator(op.operatorId, {
            equipmentNumber: regNo,
          })
          : null
      )
    );

    await Promise.all(
      operators
        .filter((op) => op.operatorId)
        .map((op) =>
          operatorMobilizationService.syncOperatorMobilizedFromEquipment({
            operatorId: op.operatorId,
            operatorName: op.operatorName,
            regNo,
            machine,
            site: isCompanyDeploy
              ? ''
              : Array.isArray(deployLocation)
                ? deployLocation.at(-1)
                : deployLocation,
            deployType: deployType || 'site',
            clientCompany: clientCompany || '',
            shiftName: op.shiftName || '',
            shiftStart: op.shiftStart || '',
            shiftEnd: op.shiftEnd || '',
            hired: updatedEquipment.hired || false,
            hiredFrom: updatedEquipment.hiredFrom || '',
            remarks,
            date: mobilizationDate,
            sendEmail: false,
          })
        )
    );
  }

  const emailBase = {
    regNo,
    machine,
    site: Array.isArray(deployLocation)
      ? deployLocation.at(-1) || ''
      : deployLocation || '',
    deployType: deployType || 'site',
    clientCompany: clientCompany || '',
    operators: withOperator ? operators : [],
    withOperator,
    month,
    year,
    time,
    date: mobilizationDate,
    remarks,
    hired: updatedEquipment.hired || false,
    hiredFrom: updatedEquipment.hiredFrom || '',
    rentRate: updatedEquipment.rentRate || null,
    location: updatedEquipment.location || '',
  };

  if (willAutoDemobilize) {
    const demobDateTime = combineDateAndTime(demobDate, demobTime) || new Date(demobDate);

    await notifySafely(STAFF_MAIN, {
      title: `${machine} (${regNo}) Mobilization`,
      description: isCompanyDeploy
        ? `${machine} (${regNo}) leased to ${clientCompany} and will be automatically demobilized on ${demobDateTime.toLocaleDateString('en-GB')}`
        : `${machine} (${regNo}) mobilized to site: ${deployLocation} and will be automatically demobilized on ${demobDateTime.toLocaleDateString('en-GB')}`,
      priority: NOTIFICATION_PRIORITY.HIGH,
      sourceId: updatedEquipment._id,
    });

    await alertMobilizationViaEmail({
      ...emailBase,
      action: 'one_day_mob',
      demobDate: demobDateTime,
      demobMonth: demobDateTime.getMonth() + 1,
      demobYear: demobDateTime.getFullYear(),
      demobTime: demobTime || time,
      demobRemarks: demobRemarks || '',
    }).catch((err) =>
      logger.error(
        '[mobilization.service] mobilizeEquipment: one-day mob email failed:',
        err
      )
    );
  } else {
    await notifySafely(STAFF_MAIN, {
      title: `${machine} (${regNo}) Mobilized`,
      description: isCompanyDeploy
        ? `${machine} (${regNo}) has been leased to company: ${clientCompany}`
        : `${machine} (${regNo}) has been mobilized to site: ${deployLocation}`,
      priority: NOTIFICATION_PRIORITY.HIGH,
      sourceId: updatedEquipment._id,
    });

    await alertMobilizationViaEmail({
      ...emailBase,
      action: MOBILIZATION_ACTIONS.MOBILIZED,
    }).catch((err) =>
      logger.error(
        '[mobilization.service] mobilizeEquipment: mobilization email failed:',
        err
      )
    );
  }

  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('mobilization');

  return {
    status: HTTP.CREATED,
    ok: true,
    message: 'Equipment mobilized successfully',
    data: {
      mobilization,
      updatedEquipment,
    },
  };
};

const demobilizeEquipment = async (data) => {
  const {
    equipmentId,
    regNo,
    machine,
    month,
    year,
    time,
    selectedDate,
    remarks,
    sendEmail = true,
  } = data;

  const currentEquipment = await equipmentModel.findById(equipmentId);

  const currentOperatorIds =
    currentEquipment?.certificationBody
      ?.map((cb) => cb.operatorId)
      .filter(Boolean) || [];

  const currentSite = currentEquipment?.site || null;

  const currentOperatorName =
    currentEquipment?.certificationBody
      ?.map((cb) => cb.operatorName)
      .filter(Boolean)
      .join(', ') || '';

  const chainId = currentEquipment?.activeChainId || null;

  const lastMobilization = await mobilizationModel
    .findOne({
      equipmentId,
      action: MOBILIZATION_ACTIONS.MOBILIZED,
    })
    .sort({ date: -1 })
    .lean();

  const UNKNOWN_RECORD =
    'The record is not existing in system or did manualy before the system implementation';

  const lastMobilizedDate = lastMobilization?.date
    ? lastMobilization.date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    : UNKNOWN_RECORD;

  const lastMobilizedTime =
    lastMobilization?.time || UNKNOWN_RECORD;

  const pushFields = {
    ...(currentSite && {
      lastSite: currentSite,
    }),
    ...(currentEquipment?.demobDate && {
      lastDemobDate: currentEquipment.demobDate,
    }),
    ...(currentEquipment?.certificationBody?.length && {
      lastCertificationBody: {
        $each: currentEquipment.certificationBody,
      },
    }),
  };

  const [demobilization, updatedEquipment] = await Promise.all([
    mobilizationModel.create({
      equipmentId,
      regNo,
      machine,
      action: MOBILIZATION_ACTIONS.DEMOBILIZED,
      withOperator: false,
      operator: currentOperatorName,
      previousOperators:
        currentEquipment?.certificationBody || [],
      hired: currentEquipment?.hired || false,
      hiredFrom: currentEquipment?.hiredFrom || '',
      rentRate: currentEquipment?.rentRate || null,
      location: currentEquipment?.location || '',
      site: Array.isArray(currentSite)
        ? currentSite.at(-1) || ''
        : currentSite || '',
      lastMobilizedDate,
      lastMobilizedTime,
      month,
      year,
      date: selectedDate
        ? new Date(selectedDate)
        : new Date(),
      time,
      remarks,
      status: 'idle',
      chainId,
    }),

    equipmentModel.findOneAndUpdate(
      { _id: equipmentId },
      {
        $set: {
          status: 'idle',
          site: null,
          updatedAt: new Date(),
          demobDate: new Date(),
          certificationBody: [],
          activeChainId: null,
          hasScheduledDemob: false,
          scheduledDemobAt: null,
          scheduledDemobTime: '',
          scheduledDemobRemarks: '',
        },
        $inc: {
          'mobilizationsRecord.demobilization': 1,
        },
        ...(Object.keys(pushFields).length && {
          $push: pushFields,
        }),
      },
      { new: true }
    ),
  ]);

  if (!updatedEquipment) {
    return {
      status: HTTP.NOT_FOUND,
      ok: false,
      message: 'Equipment not found',
    };
  }

  await Promise.all(
    currentOperatorIds.map((id) =>
      safeUpdateOperator(id, {
        equipmentNumber: '',
      })
    )
  );

  await Promise.all(
    (currentEquipment?.certificationBody || [])
      .filter((cb) => cb.operatorId)
      .map((cb) =>
        operatorMobilizationService.syncOperatorDemobilizedFromEquipment({
          operatorId: cb.operatorId,
          operatorName: cb.operatorName,
          regNo,
          machine,
          remarks,
          date: selectedDate,
          sendEmail: false,
        })
      )
  );

  await notifySafely(STAFF_MAIN, {
    title: `${machine} (${regNo}) Demobilized`,
    description: `${machine} (${regNo}) has been demobilized`,
    priority: NOTIFICATION_PRIORITY.HIGH,
    sourceId: updatedEquipment._id,
  });

  const chainInfo = await safeFetchChainInfo(chainId);

  if (sendEmail) await alertMobilizationViaEmail({
    action: MOBILIZATION_ACTIONS.DEMOBILIZED,
    regNo,
    machine,
    month,
    year,
    time,
    date: selectedDate
      ? new Date(selectedDate)
      : new Date(),
    remarks,
    site: Array.isArray(currentSite)
      ? currentSite.at(-1) || ''
      : currentSite || '',
    hired: currentEquipment?.hired || false,
    hiredFrom: currentEquipment?.hiredFrom || '',
    rentRate: currentEquipment?.rentRate || null,
    location: currentEquipment?.location
      ? [currentEquipment.location]
      : [],
    operator: currentOperatorName,
    withOperator: !!currentOperatorName,
    previousOperators:
      currentEquipment?.certificationBody || [],
    lastMobilizedDate,
    lastMobilizedTime,
    chainInfo,
  }).catch((err) =>
    logger.error(
      '[mobilization.service] demobilizeEquipment: demobilization email failed:',
      err
    )
  );

  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('mobilization');

  return {
    status: HTTP.CREATED,
    ok: true,
    message: 'Equipment demobilized successfully',
    data: {
      demobilization,
      updatedEquipment,
      chainInfo,
    },
  };
};

const addShifts = async (data) => {
  const {
    equipmentId,
    regNo,
    machine,
    operators,
    month,
    year,
    time,
    selectedDate,
    remarks,
  } = data;

  const currentEquipment = await equipmentModel.findById(
    equipmentId
  );

  if (!currentEquipment) {
    return {
      status: HTTP.NOT_FOUND,
      ok: false,
      message: 'Equipment not found',
    };
  }

  const newShifts = operators.map((op) => ({
    operatorName: op.operatorName,
    operatorId: op.operatorId,
    shiftName: op.shiftName || '',
    shiftStart: op.shiftStart || '',
    shiftEnd: op.shiftEnd || '',
    assignedAt: new Date(),
  }));

  const updatedShifts = [
    ...(currentEquipment.certificationBody || []),
    ...newShifts,
  ];

  const mobilizationRecord = await mobilizationModel
    .findOne({
      equipmentId,
      action: MOBILIZATION_ACTIONS.MOBILIZED,
    })
    .sort({ date: -1 });

  if (mobilizationRecord) {
    await mobilizationModel.findByIdAndUpdate(
      mobilizationRecord._id,
      {
        $push: {
          operators: {
            $each: newShifts,
          },
        },
        $set: {
          withOperator: true,
        },
      }
    );
  }

  const updatedEquipment =
    await equipmentModel.findByIdAndUpdate(
      equipmentId,
      {
        $set: {
          certificationBody: updatedShifts,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

  await Promise.all(
    operators.map((op) =>
      op.operatorId
        ? safeUpdateOperator(op.operatorId, {
          equipmentNumber: regNo,
        })
        : null
    )
  );

  await Promise.all(
    operators
      .filter((op) => op.operatorId)
      .map((op) =>
        operatorMobilizationService.syncOperatorMobilizedFromEquipment({
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          regNo,
          machine,
          site: Array.isArray(currentEquipment.site)
            ? currentEquipment.site.at(-1)
            : currentEquipment.site || '',
          deployType: 'site',
          shiftName: op.shiftName || '',
          shiftStart: op.shiftStart || '',
          shiftEnd: op.shiftEnd || '',
          hired: currentEquipment.hired || false,
          hiredFrom: currentEquipment.hiredFrom || '',
          remarks,
          date: selectedDate,
          sendEmail: false,
        })
      )
  );

  await notifySafely(STAFF_MAIN, {
    title: `Shifts Added — ${machine} (${regNo})`,
    description: `${operators.length} new shift(s) added to ${machine} (${regNo})`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    sourceId: updatedEquipment._id,
  });

  await alertMobilizationViaEmail({
    action: 'add_shifts',
    regNo,
    machine,
    site: Array.isArray(currentEquipment.site)
      ? currentEquipment.site.at(-1) || ''
      : currentEquipment.site || '',
    operators: newShifts,
    allOperators: updatedShifts,
    withOperator: true,
    deployType: 'site',
    month,
    year,
    time,
    date: selectedDate
      ? new Date(selectedDate)
      : new Date(),
    remarks: remarks || '',
    hired: currentEquipment.hired || false,
    hiredFrom: currentEquipment.hiredFrom || '',
    rentRate: currentEquipment.rentRate || null,
    location: currentEquipment.location
      ? [currentEquipment.location]
      : [],
  }).catch((err) =>
    logger.error(
      '[mobilization.service] addShifts: add shifts email failed:',
      err
    )
  );

  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('equipment');

  return {
    status: HTTP.OK,
    ok: true,
    message: 'Shifts added successfully',
    data: updatedEquipment,
  };
};

const changeEquipmentStatus = async (data) => {
  const {
    equipmentId,
    regNo,
    machine,
    previousStatus,
    newStatus,
    month,
    year,
    time,
    remarks,
  } = data;

  const [statusChange, updatedEquipment] =
    await Promise.all([
      mobilizationModel.create({
        equipmentId,
        regNo,
        machine,
        action: MOBILIZATION_ACTIONS.STATUS_CHANGED,
        previousStatus,
        newStatus,
        withOperator: false,
        month,
        year,
        date: new Date(),
        time,
        remarks: remarks || '',
        status: newStatus,
      }),

      equipmentModel.findOneAndUpdate(
        { _id: equipmentId },
        {
          $set: {
            status: newStatus,
            updatedAt: new Date(),
            hasScheduledDemob: false,
            scheduledDemobAt: null,
            scheduledDemobTime: '',
            scheduledDemobRemarks: '',
          },
        },
        { new: true }
      ),
    ]);

  if (!updatedEquipment) {
    return {
      status: HTTP.NOT_FOUND,
      ok: false,
      message: 'Equipment not found',
    };
  }

  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('equipment');

  return {
    status: HTTP.OK,
    ok: true,
    message: 'Equipment status changed successfully',
    data: {
      statusChange,
      updatedEquipment,
    },
  };
};

const getMobilizationHistory = async (
  equipmentId,
  pagination
) => {
  const result = await paginate(
    mobilizationModel,
    { equipmentId },
    pagination,
    {
      sort: {
        date: -1,
        createdAt: -1,
      },
    }
  );

  return {
    status: HTTP.OK,
    ok: true,
    data: result.data,
    pagination: result.pagination,
  };
};

const enrichAndReturn = async (mobilizations) => {
  const regNos = [
    ...new Set(mobilizations.map((m) => m.regNo)),
  ];

  const operatorNames = [
    ...new Set(
      mobilizations
        .filter((m) => m.operator)
        .map((m) => m.operator)
    ),
  ];

  const [
    equipmentMap,
    imageMap,
    operatorMap,
  ] = await Promise.all([
    fetchEquipmentMapByRegNo(regNos),
    fetchImageMap(regNos),
    fetchOperatorMapByName(operatorNames),
  ]);

  return enrichMobilizations(
    mobilizations,
    equipmentMap,
    imageMap,
    operatorMap
  );
};

const fetchAllMobilizations = async () => {
  const mobilizations = await mobilizationModel
    .find({})
    .sort({
      date: -1,
      createdAt: -1,
    })
    .limit(RECENT_LIMIT)
    .lean();

  return enrichAndReturn(mobilizations);
};

const fetchFilteredMobilizations = async (
  filterType,
  startDate = null,
  endDate = null,
  months = null,
  specificTime = null,
  startTime = null,
  endTime = null
) => {
  const {
    startDateTime,
    endDateTime,
  } = resolveDateRange(
    filterType,
    startDate,
    endDate,
    months
  );

  const query = buildDateRangeQuery(
    startDateTime,
    endDateTime
  );

  if (specificTime) {
    query.time = specificTime;
  } else if (startTime && endTime) {
    query.time = {
      $gte: startTime,
      $lte: endTime,
    };
  }

  const mobilizations = await mobilizationModel
    .find(query)
    .sort({
      date: -1,
      createdAt: -1,
    })
    .limit(FILTERED_LIMIT)
    .lean();

  return enrichAndReturn(mobilizations);
};

module.exports = {
  mobilizeEquipment,
  demobilizeEquipment,
  addShifts,
  changeEquipmentStatus,
  getMobilizationHistory,
  fetchAllMobilizations,
  fetchFilteredMobilizations,
};