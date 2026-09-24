const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { paginate } = require('#shared/pagination/pagination');
const { notifySafely } = require('#shared/notify/notify.user');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');

const OperatorModel = require('../operator.model');
const EquipmentModel = require('#features/equipment/equipment.model');

const OperatorMobilizationModel = require('./operator.mobilization.model');
const { alertOperatorMobilizationViaEmail, alertOperatorReplacementViaEmail } = require('./operator.mobilization.email');
const { RECENT_LIMIT, NOTIFICATION_PRIORITY, OPERATOR_MOB_ACTIONS, STAFF_MAIN } = require('./operator.mobilization.constant');

const getCurrentDateTime = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
};

const isOperatorAssignedElsewhere = async (operatorId, excludeRegNo = null) => {
  const query = { 'certificationBody.operatorId': String(operatorId) };
  if (excludeRegNo) query.regNo = { $ne: excludeRegNo };
  const match = await EquipmentModel.findOne(query).lean();
  return Boolean(match);
};

const resolveRentRate = (rentRate, fallback) => {
  if (rentRate?.basis || rentRate?.rate) {
    return { basis: rentRate.basis || 'daily', rate: Number(rentRate.rate) || 0, currency: rentRate.currency || 'QAR' };
  }
  return fallback || null;
};

const syncOperatorMobilizedFromEquipment = async ({
  operatorId,
  operatorName,
  regNo = '',
  machine = '',
  site = '',
  deployType = 'site',
  clientCompany = '',
  shiftName = '',
  shiftStart = '',
  shiftEnd = '',
  hired = false,
  hiredFrom = '',
  designation = '',
  rentRate = null,
  remarks = '',
  date = null,
  sendEmail = true,
}) => {
  if (!operatorId) return null;

  try {
    const operator = await OperatorModel.findById(operatorId);
    if (!operator) return null;

    const { month, year, time } = getCurrentDateTime();
    const eventDate = date ? new Date(date) : new Date();
    const deployLocation = deployType === 'company' ? clientCompany : site;

    const resolvedRentRate = resolveRentRate(rentRate, operator.rentRate);
    const resolvedDesignation = designation || operator.designation || '';

    const record = await OperatorMobilizationModel.create({
      operatorId: operator._id,
      operatorName: operatorName || operator.name,
      qatarId: operator.qatarId,
      action: OPERATOR_MOB_ACTIONS.MOBILIZED,
      status: 'mobilized',
      mode: regNo ? 'with-equipment' : 'operator-only',
      regNo,
      machine,
      site: deployLocation || '',
      deployType,
      clientCompany,
      designation: resolvedDesignation,
      rentRate: resolvedRentRate,
      shiftName,
      shiftStart,
      shiftEnd,
      hired,
      hiredFrom,
      month,
      year,
      date: eventDate,
      time,
      remarks,
    });

    const pushFields = {};
    if (operator.site?.length) pushFields.lastSite = { $each: operator.site };
    if (operator.mobDate) pushFields.lastMobDate = operator.mobDate;

    const rentRateChanged =
      rentRate && (rentRate.basis || rentRate.rate) &&
      (operator.rentRate?.rate !== resolvedRentRate.rate || operator.rentRate?.basis !== resolvedRentRate.basis);

    if (rentRateChanged && operator.rentRate) {
      pushFields.lastRentRate = { ...operator.rentRate.toObject(), changedAt: new Date() };
    }

    await OperatorModel.findByIdAndUpdate(operator._id, {
      $set: {
        status: 'mobilized',
        equipmentNumber: regNo || '',
        mode: regNo ? 'with-equipment' : 'operator-only',
        site: deployLocation ? [deployLocation] : operator.site,
        mobDate: eventDate,
        designation: resolvedDesignation,
        ...(resolvedRentRate && { rentRate: resolvedRentRate }),
        updatedAt: new Date(),
      },
      ...(Object.keys(pushFields).length && { $push: pushFields }),
    });

    await notifySafely(STAFF_MAIN, {
      title: `${operator.name} Mobilized`,
      description: `${operator.name} has been mobilized to ${deployType === 'company' ? `client: ${clientCompany}` : `site: ${site}`
        }${regNo ? ` on ${machine} (${regNo})` : ''}`,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      sourceId: operator._id,
    });

    if (sendEmail) alertOperatorMobilizationViaEmail({
      action: OPERATOR_MOB_ACTIONS.MOBILIZED,
      operatorName: operator.name,
      qatarId: operator.qatarId,
      uniqueCode: operator.uniqueCode,
      nationality: operator.nationality,
      sponsorship: operator.sponsorship,
      designation: resolvedDesignation,
      rentRate: resolvedRentRate,
      regNo,
      machine,
      site,
      deployType,
      clientCompany,
      shiftName,
      shiftStart,
      shiftEnd,
      month,
      year,
      time,
      date: eventDate,
      remarks,
      hired,
      hiredFrom,
    }).catch((err) => logger.error('[OperatorMobilization] mobilization email failed:', err));

    dashboardServices.clearDashboardCache();
    wsUtils.dispatchDashboardUpdate('operatorMobilization');

    return record;
  } catch (err) {
    logger.error('[OperatorMobilization] syncOperatorMobilizedFromEquipment failed:', err);
    return null;
  }
};

const syncOperatorDemobilizedFromEquipment = async ({
  operatorId,
  operatorName,
  regNo = '',
  machine = '',
  remarks = '',
  date = null,
  sendEmail = true,
}) => {
  if (!operatorId) return null;

  try {
    const stillAssigned = await isOperatorAssignedElsewhere(operatorId, regNo);
    if (stillAssigned) return null;

    const operator = await OperatorModel.findById(operatorId);
    if (!operator) return null;
    if (operator.status === 'demobilized') return null;

    const { month, year, time } = getCurrentDateTime();
    const eventDate = date ? new Date(date) : new Date();

    const record = await OperatorMobilizationModel.create({
      operatorId: operator._id,
      operatorName: operatorName || operator.name,
      qatarId: operator.qatarId,
      action: OPERATOR_MOB_ACTIONS.DEMOBILIZED,
      status: 'demobilized',
      mode: regNo ? 'with-equipment' : 'operator-only',
      regNo,
      machine,
      site: Array.isArray(operator.site) ? operator.site.at(-1) || '' : operator.site || '',
      designation: operator.designation || '',
      rentRate: operator.rentRate || null,
      month,
      year,
      date: eventDate,
      time,
      remarks,
    });

    const pushFields = {};
    if (operator.site?.length) pushFields.lastSite = { $each: operator.site };
    if (operator.demobDate) pushFields.lastDemobDate = operator.demobDate;

    await OperatorModel.findByIdAndUpdate(operator._id, {
      $set: { status: 'demobilized', equipmentNumber: '', mode: null, site: [], demobDate: eventDate, updatedAt: new Date() },
      ...(Object.keys(pushFields).length && { $push: pushFields }),
    });

    await notifySafely(STAFF_MAIN, {
      title: `${operator.name} Demobilized`,
      description: `${operator.name} has been demobilized${regNo ? ` from ${machine} (${regNo})` : ''}`,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      sourceId: operator._id,
    });

    if (sendEmail) alertOperatorMobilizationViaEmail({
      action: OPERATOR_MOB_ACTIONS.DEMOBILIZED,
      operatorName: operator.name,
      qatarId: operator.qatarId,
      uniqueCode: operator.uniqueCode,
      nationality: operator.nationality,
      sponsorship: operator.sponsorship,
      designation: operator.designation || '',
      rentRate: operator.rentRate || null,
      regNo,
      machine,
      month,
      year,
      time,
      date: eventDate,
      remarks,
    }).catch((err) => logger.error('[OperatorMobilization] demobilization email failed:', err));

    dashboardServices.clearDashboardCache();
    wsUtils.dispatchDashboardUpdate('operatorMobilization');

    return record;
  } catch (err) {
    logger.error('[OperatorMobilization] syncOperatorDemobilizedFromEquipment failed:', err);
    return null;
  }
};

const mobilizeOperator = async (data) => {
  const {
    operatorId,
    regNo = '',
    machine = '',
    site = '',
    deployType = 'site',
    clientCompany = '',
    shiftName = '',
    shiftStart = '',
    shiftEnd = '',
    designation = '',
    rentRate = null,
    remarks = '',
    selectedDate = null,
  } = data;

  const operator = await OperatorModel.findById(operatorId);
  if (!operator) return { status: HTTP.NOT_FOUND, ok: false, message: 'Operator not found' };

  let equipment = null;
  if (regNo) {
    equipment = await EquipmentModel.findOne({ regNo });
    if (!equipment) return { status: HTTP.NOT_FOUND, ok: false, message: 'Equipment not found' };
  }

  if (!regNo && operator.equipmentNumber) {
    await EquipmentModel.findOneAndUpdate(
      { regNo: operator.equipmentNumber },
      { $pull: { certificationBody: { operatorId: operator._id.toString() } }, $set: { updatedAt: new Date() } }
    );
  }

  const record = await syncOperatorMobilizedFromEquipment({
    operatorId: operator._id,
    operatorName: operator.name,
    regNo,
    machine: machine || equipment?.machine || '',
    site,
    deployType,
    clientCompany,
    shiftName,
    shiftStart,
    shiftEnd,
    hired: operator.hired,
    hiredFrom: operator.hiredFrom,
    designation,
    rentRate,
    remarks,
    date: selectedDate,
  });

  if (!record) return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: 'Failed to mobilize operator' };

  if (equipment) {
    const alreadyCertified = equipment.certificationBody?.some((c) => c.operatorId === operator._id.toString());
    if (!alreadyCertified) {
      await EquipmentModel.findOneAndUpdate(
        { regNo },
        {
          $push: {
            certificationBody: {
              operatorName: operator.name,
              operatorId: operator._id.toString(),
              shiftName,
              shiftStart,
              shiftEnd,
              assignedAt: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
        }
      );
    }
  }

  const updatedOperator = await OperatorModel.findById(operatorId);
  return {
    status: HTTP.CREATED,
    ok: true,
    message: 'Operator mobilized successfully',
    data: { mobilization: record, operator: updatedOperator },
  };
};

const demobilizeOperator = async (data) => {
  const { operatorId, remarks = '', selectedDate = null, demobilizeMode = 'operator-only' } = data;

  const operator = await OperatorModel.findById(operatorId);
  if (!operator) return { status: HTTP.NOT_FOUND, ok: false, message: 'Operator not found' };

  const regNo = operator.equipmentNumber;
  let equipment = null;

  if (regNo) {
    equipment = await EquipmentModel.findOne({ regNo });
    if (equipment) {
      const removedShifts = equipment.certificationBody.filter((c) => c.operatorId === operator._id.toString());
      await EquipmentModel.findOneAndUpdate(
        { regNo },
        {
          $pull: { certificationBody: { operatorId: operator._id.toString() } },
          ...(removedShifts.length && { $push: { lastCertificationBody: { $each: removedShifts } } }),
          $set: { updatedAt: new Date() },
        }
      );

      if (demobilizeMode === 'with-equipment') {
        await EquipmentModel.findOneAndUpdate(
          { regNo },
          {
            $set: {
              status: 'idle',
              site: null,
              certificationBody: [],
              activeChainId: null,
              demobDate: new Date(),
              updatedAt: new Date(),
            },
            $inc: { 'mobilizationsRecord.demobilization': 1 },
          }
        );
      }
    }
  }

  const record = await syncOperatorDemobilizedFromEquipment({
    operatorId: operator._id,
    operatorName: operator.name,
    regNo,
    machine: equipment?.machine || '',
    remarks,
    date: selectedDate,
  });

  if (!record) {
    return {
      status: HTTP.BAD_REQUEST,
      ok: false,
      message: 'Operator could not be demobilized — they may still be assigned to another equipment or are already demobilized',
    };
  }

  const updatedOperator = await OperatorModel.findById(operatorId);
  return {
    status: HTTP.CREATED,
    ok: true,
    message: 'Operator demobilized successfully',
    data: { demobilization: record, operator: updatedOperator },
  };
};

const replaceOperator = async (data) => {
  const {
    currentOperatorId,
    newOperatorId,
    regNo = '',
    site = '',
    deployType = 'site',
    clientCompany = '',
    assignmentAction = 'demobilize',
    remarks = '',
    selectedDate = null,
  } = data;

  const currentOperator = await OperatorModel.findById(currentOperatorId);
  if (!currentOperator) return { status: HTTP.NOT_FOUND, ok: false, message: 'Current operator not found' };

  const newOperator = await OperatorModel.findById(newOperatorId);
  if (!newOperator) return { status: HTTP.NOT_FOUND, ok: false, message: 'New operator not found' };

  const oldRegNo = currentOperator.equipmentNumber;

  if (oldRegNo) {
    await EquipmentModel.findOneAndUpdate(
      { regNo: oldRegNo },
      { $pull: { certificationBody: { operatorId: currentOperator._id.toString() } }, $set: { updatedAt: new Date() } }
    );
  }

  await syncOperatorDemobilizedFromEquipment({
    operatorId: currentOperator._id,
    operatorName: currentOperator.name,
    regNo: oldRegNo,
    machine: '',
    remarks,
    date: selectedDate,
    sendEmail: false,
  });

  let mobilizationRecord = null;

  if (assignmentAction === 'mobilize') {
    mobilizationRecord = await syncOperatorMobilizedFromEquipment({
      operatorId: newOperator._id,
      operatorName: newOperator.name,
      regNo,
      machine: '',
      site,
      deployType,
      clientCompany,
      hired: newOperator.hired,
      hiredFrom: newOperator.hiredFrom,
      designation: newOperator.designation,
      rentRate: newOperator.rentRate,
      remarks,
      date: selectedDate,
      sendEmail: false,
    });

    if (regNo) {
      const equipment = await EquipmentModel.findOne({ regNo });
      if (equipment) {
        const alreadyCertified = equipment.certificationBody?.some((c) => c.operatorId === newOperator._id.toString());
        if (!alreadyCertified) {
          await EquipmentModel.findOneAndUpdate(
            { regNo },
            {
              $push: {
                certificationBody: {
                  operatorName: newOperator.name,
                  operatorId: newOperator._id.toString(),
                  assignedAt: new Date(),
                },
              },
              $set: { updatedAt: new Date() },
            }
          );
        }
      }
    }
  }

  await notifySafely(STAFF_MAIN, {
    title: 'Operator Replaced',
    description: `${currentOperator.name} has been replaced by ${newOperator.name}${oldRegNo ? ` on ${oldRegNo}` : ''}`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    sourceId: newOperator._id,
  });

  const { month, year, time } = getCurrentDateTime();

  alertOperatorReplacementViaEmail({
    outgoingOperatorName: currentOperator.name,
    incomingOperatorName: newOperator.name,
    regNo: oldRegNo || regNo,
    site,
    deployType,
    clientCompany,
    month,
    year,
    time,
    date: selectedDate ? new Date(selectedDate) : new Date(),
    remarks,
  }).catch((err) => logger.error('[OperatorMobilization] replacement email failed:', err));

  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('operatorMobilization');

  const updatedCurrentOperator = await OperatorModel.findById(currentOperatorId);
  const updatedNewOperator = await OperatorModel.findById(newOperatorId);

  return {
    status: HTTP.CREATED,
    ok: true,
    message: 'Operator replaced successfully',
    data: { currentOperator: updatedCurrentOperator, newOperator: updatedNewOperator, mobilizationRecord },
  };
};

const getMobilizationHistory = async (operatorId, pagination) => {
  const result = await paginate(OperatorMobilizationModel, { operatorId }, pagination, { sort: { date: -1, createdAt: -1 } });
  return { status: HTTP.OK, ok: true, data: result.data, pagination: result.pagination };
};

const fetchAllOperatorMobilizations = async () => {
  const data = await OperatorMobilizationModel.find({}).sort({ date: -1, createdAt: -1 }).limit(RECENT_LIMIT).lean();
  return { status: HTTP.OK, ok: true, data };
};

module.exports = {
  syncOperatorMobilizedFromEquipment,
  syncOperatorDemobilizedFromEquipment,
  mobilizeOperator,
  demobilizeOperator,
  replaceOperator,
  getMobilizationHistory,
  fetchAllOperatorMobilizations,
};