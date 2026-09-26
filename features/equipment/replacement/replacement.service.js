const mongoose = require('mongoose');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { paginate } = require('#shared/pagination/pagination');
const { notifySafely } = require('#shared/notify/notify.user');
const { resolveDateRange, buildDateRangeQuery } = require('#shared/date/date.range');

const equipmentModel = require('../equipment.model');
const dashboardServices = require('#features/dashboard/dashboard.service')
const { NOTIFICATION_PRIORITY, STAFF_MAIN } = require('../equipment.constant');
const { safeUpdateOperator, fetchEquipmentMapById, fetchOperatorMapById } = require('../equipment.utils');
const { fetchImageMap } = require('../images/images.service');
const wsUtils = require('#core/socket/socket.io');
const operatorMobilizationService = require('#features/user/operator/mobilization/operator.mobilization.service');

const replacementModel = require('./replacement.model');
const { alertReplacementViaEmail } = require('./replacement.email');
const { RECENT_LIMIT, FILTERED_LIMIT, REPLACEMENT_TYPES } = require('./replacement.constant');
const { enrichReplacements } = require('./replacement.helper');

const buildReplacedShift = (existingShifts, targetShiftName, replacement) => {
  const targetIndex = targetShiftName ? existingShifts.findIndex((s) => s.shiftName === targetShiftName) : 0;
  const updatedShifts = [...existingShifts];

  if (targetIndex >= 0) {
    updatedShifts[targetIndex] = {
      operatorName: replacement.replacedOperator,
      operatorId: replacement.replacedOperatorId,
      shiftName: replacement.shiftName || existingShifts[targetIndex]?.shiftName || '',
      shiftStart: replacement.shiftStart || existingShifts[targetIndex]?.shiftStart || '',
      shiftEnd: replacement.shiftEnd || existingShifts[targetIndex]?.shiftEnd || '',
      assignedAt: new Date(),
    };
  } else {
    updatedShifts.push({
      operatorName: replacement.replacedOperator,
      operatorId: replacement.replacedOperatorId,
      shiftName: replacement.shiftName || '',
      shiftStart: replacement.shiftStart || '',
      shiftEnd: replacement.shiftEnd || '',
      assignedAt: new Date(),
    });
  }

  return updatedShifts;
};

const replaceOperator = async (data) => {
  const {
    equipmentId,
    regNo,
    machine,
    currentOperator,
    currentOperatorId,
    replacedOperator,
    replacedOperatorId,
    targetShiftName,
    shiftName,
    shiftStart,
    shiftEnd,
    month,
    year,
    time,
    selectedDate,
    remarks,
    replaceAll = false,
  } = data;

  const currentEquipment = await equipmentModel.findById(equipmentId);
  const existingShifts = currentEquipment?.certificationBody || [];

  const updatedShifts = replaceAll
    ? [{
      operatorName: replacedOperator,
      operatorId: replacedOperatorId,
      shiftName: '',
      shiftStart: '',
      shiftEnd: '',
      assignedAt: new Date(),
    }]
    : buildReplacedShift(existingShifts, targetShiftName, {
      replacedOperator,
      replacedOperatorId,
      shiftName,
      shiftStart,
      shiftEnd,
    });

  const allPreviousOperatorIds = replaceAll
    ? existingShifts.map((s) => s.operatorId).filter(Boolean)
    : [];

  const replacement = await replacementModel.create({
    equipmentId,
    regNo,
    machine,
    date: selectedDate ? new Date(selectedDate) : new Date(),
    month,
    year,
    time,
    status: 'active',
    type: REPLACEMENT_TYPES.OPERATOR,
    currentOperator: replaceAll
      ? existingShifts.map((s) => s.operatorName).filter(Boolean).join(', ')
      : currentOperator,
    currentOperatorId: currentOperatorId || undefined,
    replacedOperator,
    replacedOperatorId,
    targetShiftName: replaceAll ? 'ALL' : targetShiftName || '',
    shiftName: shiftName || '',
    shiftStart: shiftStart || '',
    shiftEnd: shiftEnd || '',
    remarks,
    replaceAll,
    previousOperators: replaceAll ? existingShifts : [],
    site: Array.isArray(currentEquipment?.site)
      ? currentEquipment.site.at(-1)
      : currentEquipment?.site || '',
    hired: currentEquipment?.hired || false,
    hiredFrom: currentEquipment?.hiredFrom || '',
    rentRate: currentEquipment?.rentRate || null,
    location: currentEquipment?.location ? [currentEquipment.location] : [],
    remainingShifts: [],
  });

  const updateOp = {
    $set: {
      certificationBody: updatedShifts,
      updatedAt: new Date(),
    },
  };

  if (existingShifts.length) {
    updateOp.$push = {
      lastCertificationBody: {
        $each: existingShifts,
      },
    };
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

  await replacementModel
    .findByIdAndUpdate(replacement._id, {
      $set: {
        remainingShifts: updatedEquipment.certificationBody || [],
        site: Array.isArray(updatedEquipment.site)
          ? updatedEquipment.site.at(-1)
          : updatedEquipment.site || '',
        hired: updatedEquipment.hired || false,
        hiredFrom: updatedEquipment.hiredFrom || '',
        rentRate: updatedEquipment.rentRate || null,
        location: updatedEquipment.location || '',
      },
    })
    .catch(() => null);

  if (replaceAll) {
    await Promise.all(
      allPreviousOperatorIds.map((id) =>
        safeUpdateOperator(id, { equipmentNumber: '' })
      )
    );

    await Promise.all(
      allPreviousOperatorIds.map((id) =>
        operatorMobilizationService.syncOperatorDemobilizedFromEquipment({
          operatorId: id,
          regNo,
          machine,
          remarks,
          date: selectedDate,
          sendEmail: false,
        })
      )
    );
  } else if (currentOperatorId) {
    await safeUpdateOperator(currentOperatorId, { equipmentNumber: '' });

    await operatorMobilizationService.syncOperatorDemobilizedFromEquipment({
      operatorId: currentOperatorId,
      operatorName: currentOperator,
      regNo,
      machine,
      remarks,
      date: selectedDate,
      sendEmail: false,
    });
  }

  if (replacedOperatorId) {
    await safeUpdateOperator(replacedOperatorId, {
      equipmentNumber: regNo,
    });

    await operatorMobilizationService.syncOperatorMobilizedFromEquipment({
      operatorId: replacedOperatorId,
      operatorName: replacedOperator,
      regNo,
      machine,
      site: Array.isArray(updatedEquipment.site)
        ? updatedEquipment.site.at(-1)
        : updatedEquipment.site || '',
      deployType: 'site',
      shiftName: shiftName || '',
      shiftStart: shiftStart || '',
      shiftEnd: shiftEnd || '',
      hired: updatedEquipment.hired || false,
      hiredFrom: updatedEquipment.hiredFrom || '',
      remarks,
      date: selectedDate,
      sendEmail: false,
    });
  }

  await notifySafely(STAFF_MAIN, {
    title: `Operator Replaced on ${machine} (${regNo})`,
    description: replaceAll
      ? `All operators replaced by ${replacedOperator} on ${machine} (${regNo})`
      : `Operator changed from ${currentOperator} to ${replacedOperator} on ${machine} (${regNo})`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    sourceId: updatedEquipment._id,
  });

  await alertReplacementViaEmail({
    type: 'operator',
    regNo,
    machine,
    currentOperator,
    replacedOperator,
    replaceAll,
    previousOperators: replaceAll ? existingShifts : [],
    targetShiftName: replaceAll ? 'ALL' : targetShiftName || '',
    shiftName: shiftName || '',
    shiftStart: shiftStart || '',
    shiftEnd: shiftEnd || '',
    remainingShifts: updatedEquipment.certificationBody || [],
    site: updatedEquipment.site || '',
    month,
    year,
    time,
    date: selectedDate ? new Date(selectedDate) : new Date(),
    remarks,
    hired: updatedEquipment.hired || false,
    hiredFrom: updatedEquipment.hiredFrom || '',
    rentRate: updatedEquipment.rentRate || null,
    location: updatedEquipment.location || '',
  }).catch((err) =>
    logger.error('[replacement.service] replaceOperator: replace operator email failed:', err)
  );

  dashboardServices.clearDashboardCache()
  wsUtils.dispatchDashboardUpdate('replacement');

  return {
    status: HTTP.CREATED,
    ok: true,
    message: 'Operator replaced successfully',
    data: {
      replacement,
      updatedEquipment,
    },
  };
};

const replaceEquipment = async (data) => {
  const {
    equipmentId,
    regNo,
    machine,
    replacedEquipmentId,
    replacedEquipmentRegNo,
    replacedEquipmentMachine,
    newSiteForReplaced,
    month,
    year,
    time,
    selectedDate,
    remarks,
    operators = [],
  } = data;

  const currentEquipment = await equipmentModel.findById(equipmentId);

  if (!currentEquipment) {
    return {
      status: HTTP.NOT_FOUND,
      ok: false,
      message: 'Current equipment not found',
    };
  }

  const currentSite = currentEquipment.site;

  if (!currentSite) {
    return {
      status: HTTP.BAD_REQUEST,
      ok: false,
      message: 'Current equipment has no site assigned',
    };
  }

  const replacedEquipment = await equipmentModel.findById(replacedEquipmentId);

  if (!replacedEquipment) {
    return {
      status: HTTP.NOT_FOUND,
      ok: false,
      message: 'Replacement equipment not found',
    };
  }

  const chainId =
    currentEquipment.activeChainId || new mongoose.Types.ObjectId();

  const outgoingChainId = newSiteForReplaced
    ? new mongoose.Types.ObjectId()
    : null;

  const validOperators = operators.filter((op) => op.operatorName);

  const finalOperatorName = validOperators.map((op) => op.operatorName).join(', ')
    || currentEquipment.certificationBody?.map((cb) => cb.operatorName).filter(Boolean).join(', ')
    || '';

  const finalOperatorId = validOperators[0]?.operatorId
    || currentEquipment.certificationBody?.at(-1)?.operatorId
    || '';

  const outgoingOperator =
    currentEquipment.certificationBody?.map((cb) => cb.operatorName).filter(Boolean).join(', ') || '';

  const outgoingOperatorId =
    currentEquipment.certificationBody?.at(-1)?.operatorId || '';

  const incomingOperator = finalOperatorName
    || replacedEquipment.certificationBody?.map((cb) => cb.operatorName).filter(Boolean).join(', ')
    || '';

  const incomingOperatorId = finalOperatorId
    || replacedEquipment.certificationBody?.at(-1)?.operatorId
    || '';

  const replacement = await replacementModel.create({
    equipmentId,
    regNo,
    machine,
    date: selectedDate ? new Date(selectedDate) : new Date(),
    month,
    year,
    time,
    status: 'active',
    type: REPLACEMENT_TYPES.EQUIPMENT,
    replacedEquipmentId,
    replacedEquipmentRegNo,
    replacedEquipmentMachine,
    newSiteForReplaced,
    site: Array.isArray(currentSite)
      ? currentSite.at(-1)
      : currentSite || '',
    hired: currentEquipment.hired || false,
    hiredFrom: currentEquipment.hiredFrom || '',
    rentRate: currentEquipment.rentRate || null,
    location: currentEquipment.location
      ? [currentEquipment.location]
      : [],
    remarks,
    currentOperator: finalOperatorName,
    currentOperatorId: finalOperatorId,
    outgoingOperator,
    outgoingOperatorId,
    incomingOperator,
    incomingOperatorId,
    chainId,
  });

  const incomingEquipmentUpdate = {
    $set: {
      site: currentSite,
      status: 'active',
      updatedAt: new Date(),
      activeChainId: chainId,
    },
    $inc: {
      'replacementRecord.equipmentReplacement': 1,
    },
    ...(replacedEquipment.site && {
      $push: {
        lastSite: replacedEquipment.site,
      },
    }),
  };

  if (validOperators.length) {
    if (replacedEquipment.certificationBody?.length > 0) {
      incomingEquipmentUpdate.$push = {
        ...(incomingEquipmentUpdate.$push || {}),
        lastCertificationBody: replacedEquipment.certificationBody,
      };
    }

    incomingEquipmentUpdate.$set.certificationBody = validOperators.map((op) => ({
      operatorName: op.operatorName,
      operatorId: op.operatorId,
      shiftName: op.shiftName || '',
      assignedAt: new Date(),
    }));
  }

  const [updatedReplacedEquipment, updatedCurrentEquipment] =
    await Promise.all([
      equipmentModel.findOneAndUpdate(
        { _id: replacedEquipmentId },
        incomingEquipmentUpdate,
        { new: true }
      ),

      equipmentModel.findOneAndUpdate(
        { _id: equipmentId },
        {
          $set: {
            site: newSiteForReplaced || null,
            status: newSiteForReplaced ? 'active' : 'idle',
            updatedAt: new Date(),
            activeChainId: outgoingChainId,
          },
          $push: {
            lastSite: currentSite,
          },
          $inc: {
            'replacementRecord.equipmentReplacement': 1,
          },
        },
        { new: true }
      ),
    ]);

  if (!updatedReplacedEquipment) {
    return {
      status: HTTP.NOT_FOUND,
      ok: false,
      message: 'Replacement equipment not found',
    };
  }

  if (validOperators.length) {
    const previousOperatorIds = (replacedEquipment.certificationBody || [])
      .map((cb) => cb.operatorId)
      .filter(Boolean);

    await Promise.all(
      previousOperatorIds
        .filter((id) => !validOperators.some((op) => op.operatorId === id))
        .map((id) => safeUpdateOperator(id, { equipmentNumber: '' }))
    );

    await Promise.all(
      validOperators.map((op) => safeUpdateOperator(op.operatorId, { equipmentNumber: replacedEquipmentRegNo }))
    );

    await Promise.all(
      validOperators.map((op) =>
        operatorMobilizationService.syncOperatorMobilizedFromEquipment({
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          regNo: replacedEquipmentRegNo,
          machine: replacedEquipmentMachine,
          site: Array.isArray(currentSite) ? currentSite.at(-1) : currentSite || '',
          deployType: 'site',
          shiftName: op.shiftName || '',
          hired: updatedReplacedEquipment.hired || false,
          hiredFrom: updatedReplacedEquipment.hiredFrom || '',
          remarks,
          date: selectedDate,
          sendEmail: false,
        })
      )
    );
  }

  const displacedOperatorIds = (replacedEquipment.certificationBody || [])
    .map((cb) => cb.operatorId)
    .filter((id) => id && !validOperators.some((op) => op.operatorId === id));

  await Promise.all(
    displacedOperatorIds.map((id) =>
      operatorMobilizationService.syncOperatorDemobilizedFromEquipment({
        operatorId: id,
        regNo: replacedEquipmentRegNo,
        machine: replacedEquipmentMachine,
        remarks,
        date: selectedDate,
        sendEmail: false,
      })
    )
  );

  await notifySafely(STAFF_MAIN, {
    title: `Equipment Replaced at ${currentSite}`,
    description: `${machine} (${regNo}) replaced by ${replacedEquipmentMachine} (${replacedEquipmentRegNo}) at site: ${currentSite}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
    sourceId: updatedCurrentEquipment._id,
  });

  await alertReplacementViaEmail({
    type: 'equipment',
    regNo,
    machine,
    replacedEquipmentRegNo,
    replacedEquipmentMachine,
    site: currentSite,
    newSiteForReplaced,
    month,
    year,
    time,
    date: selectedDate ? new Date(selectedDate) : new Date(),
    remarks,
    hired: currentEquipment.hired || false,
    hiredFrom: currentEquipment.hiredFrom || '',
    rentRate: currentEquipment.rentRate || null,
    location: currentEquipment.location
      ? [currentEquipment.location]
      : [],
    incomingHiredFrom: replacedEquipment.hiredFrom || '',
    outgoingOperator,
    incomingOperator,
    currentOperator: finalOperatorName,
  }).catch((err) =>
    logger.error('[replacement.service] replaceEquipment: replace equipment email failed:', err)
  );

  return {
    status: HTTP.CREATED,
    ok: true,
    message: 'Equipment replaced successfully',
    data: {
      replacement,
      currentEquipment: updatedCurrentEquipment,
      replacedEquipment: updatedReplacedEquipment,
    },
  };
};

const getReplacementHistory = async (
  equipmentId,
  pagination,
  type = null
) => {
  const query = {
    equipmentId,
    ...(type ? { type } : {}),
  };

  const result = await paginate(
    replacementModel,
    query,
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

const enrichAndReturn = async (replacements) => {
  const equipmentIds = [
    ...new Set([
      ...replacements.map((r) => r.equipmentId.toString()),
      ...replacements
        .filter(
          (r) =>
            r.type === 'equipment' &&
            r.replacedEquipmentId
        )
        .map((r) => r.replacedEquipmentId.toString()),
    ]),
  ];

  const operatorIds = [
    ...new Set([
      ...replacements
        .filter((r) => r.currentOperatorId)
        .map((r) => r.currentOperatorId),
      ...replacements
        .filter((r) => r.replacedOperatorId)
        .map((r) => r.replacedOperatorId),
    ]),
  ];

  const equipmentMapById =
    await fetchEquipmentMapById(equipmentIds);

  const allRegNos = [
    ...new Set(
      Object.values(equipmentMapById).map(
        (eq) => eq.regNo
      )
    ),
  ];

  const [imageMap, operatorMap] = await Promise.all([
    fetchImageMap(allRegNos),
    fetchOperatorMapById(operatorIds),
  ]);

  return enrichReplacements(
    replacements,
    equipmentMapById,
    imageMap,
    operatorMap
  );
};

const fetchAllReplacements = async () => {
  const replacements = await replacementModel
    .find({})
    .sort({
      date: -1,
      createdAt: -1,
    })
    .limit(RECENT_LIMIT)
    .lean();

  return enrichAndReturn(replacements);
};

const fetchFilteredReplacements = async (
  filterType,
  startDate = null,
  endDate = null,
  months = null
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

  const replacements = await replacementModel
    .find(query)
    .sort({
      date: -1,
      createdAt: -1,
    })
    .limit(FILTERED_LIMIT)
    .lean();

  return enrichAndReturn(replacements);
};

module.exports = {
  replaceOperator,
  replaceEquipment,
  getReplacementHistory,
  fetchAllReplacements,
  fetchFilteredReplacements,
};
