// ─────────────────────────────────────────────────────────────────────────────
// Equipment Service
// Flat named async functions — no prototype objects, no class syntax.
// Follows the same conventions as dashboard.service.js.
// ─────────────────────────────────────────────────────────────────────────────

const equipmentModel      = require('../models/equipment.model');
const mobilizationModel   = require('../models/mobilizations.model');
const replacementsModel   = require('../models/replacements.model');
const EquipmentImageModel = require('../models/images.model');

const { createNotification }       = require('./notification.service');
const PushNotificationService      = require('../push/notification.push');
const OperatorService              = require('./operator.service');
const { alertMobilizationViaEmail } = require('../gmail/mobilization.gmail');
const { alertReplacementViaEmail }  = require('../gmail/replacement.gmail');

const {
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  REPLACEMENT_TYPES,
  DEFAULT_PAGE_LIMITS
} = require('../constants/equipment.constants');

const {
  buildHiredQuery,
  buildStatusQuery,
  buildSearchQuery,
  buildDateRangeQuery,
  resolveDateRange,
  normaliseImages,
  normaliseCertificationBody,
  normaliseSite,
  buildOperatorUpdateData,
  extractEquipmentChanges,
  getCurrentDateTime,
  getPaginationMeta
} = require('../helpers/equipment.helper');

const {
  safeUpdateOperator,
  fetchEquipmentMapByRegNo,
  fetchEquipmentMapById,
  fetchImageMap,
  fetchOperatorMapByName,
  fetchOperatorMapById,
  enrichMobilizations,
  enrichReplacements
} = require('../utils/equipment.utils');

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Notification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: creates an in-app notification + push notification.
 * Errors are logged but never surfaced to callers.
 * @param {object} params
 */
const _sendNotification = async ({ title, description, priority, sourceId, recipient = null }) => {
  try {
    const notification = await createNotification({
      title,
      description,
      priority,
      sourceId,
      time:      new Date(),
      recipient
    });

    await PushNotificationService.sendGeneralNotification(
      recipient,
      title,
      description,
      priority,
      NOTIFICATION_TYPE.NORMAL,
      notification.data._id.toString()
    );
  } catch (err) {
    console.error('[EquipmentService] Notification failed:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Next available sequential ID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a sequential numeric ID that is not already in use.
 * Attempts up to maxAttempts times starting from `baseId`.
 * @param {number} baseId
 * @param {number} [maxAttempts=10]
 * @returns {Promise<number>}
 */
const _resolveNextId = async (baseId, maxAttempts = 10) => {
  const existing = new Set(
    (await equipmentModel.find({}, { id: 1 }).lean()).map(e => e.id)
  );

  for (let i = 0; i < maxAttempts; i++) {
    if (!existing.has(baseId + i)) return baseId + i;
  }

  throw new Error('Unable to find available ID after multiple attempts');
};

// ─────────────────────────────────────────────────────────────────────────────
// Insertion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new equipment record.
 * @param {object} data
 * @returns {Promise<object>}
 */
const insertEquipment = async (data) => {
  try {
    const existing = await equipmentModel.findOne({ regNo: data.regNo });
    if (existing) {
      return { status: 500, ok: false, message: 'Equipment already exists' };
    }

    if (data.company === 'HIRED' && !data.hiredFrom) {
      return { status: 400, ok: false, message: 'hiredFrom is required when company is HIRED' };
    }

    const count  = await equipmentModel.countDocuments();
    data.id      = await _resolveNextId(count + 1);

    const equipment = await equipmentModel.create(data);

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    await _sendNotification({
      title:       'New Asset Launched',
      description: `Alhamdulillah, We are happy to inform you! We have bought a brand new ${equipment.machine} (${equipment.brand}) today`,
      priority:    NOTIFICATION_PRIORITY.HIGH,
      sourceId:    equipment._id,
      recipient:   officeMain
    });

    return { status: 200, ok: true, message: 'Equipment added successfully', data: equipment };

  } catch (err) {
    console.error('[EquipmentService] insertEquipment:', err);
    return { status: 500, ok: false, message: 'Missing data or an error occurred', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch / Search / Stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns paginated equipment records with optional hired/status filters.
 * @param {number}      page
 * @param {number}      limit
 * @param {string|null} hiredFilter
 * @param {string|null} statusFilter
 * @returns {Promise<object>}
 */
const fetchEquipments = async (page = 1, limit = DEFAULT_PAGE_LIMITS.FETCH, hiredFilter = null, statusFilter = null) => {
  try {
    const skip  = (page - 1) * limit;
    const query = {
      ...buildHiredQuery(hiredFilter),
      ...(statusFilter ? { status: statusFilter } : {})
    };

    const [totalCount, equipments] = await Promise.all([
      equipmentModel.countDocuments(query),
      equipmentModel.find(query).sort({ year: -1, createdAt: -1 }).skip(skip).limit(limit).lean()
    ]);

    const { totalPages, hasNextPage } = getPaginationMeta(totalCount, page, limit);

    return { status: 200, ok: true, equipments, currentPage: page, totalPages, totalCount, hasNextPage };
  } catch (err) {
    console.error('[EquipmentService] fetchEquipments:', err);
    return { status: 500, ok: false, message: err.message || 'Error fetching equipments' };
  }
};

/**
 * Returns paginated equipment records filtered by status.
 * @param {string}      status
 * @param {number}      page
 * @param {number}      limit
 * @param {string|null} hiredFilter
 * @returns {Promise<object>}
 */
const fetchEquipmentsByStatus = async (status, page = 1, limit = DEFAULT_PAGE_LIMITS.FETCH, hiredFilter = null) => {
  try {
    const skip  = (page - 1) * limit;
    const query = {
      ...buildHiredQuery(hiredFilter),
      ...(status && status !== 'all' ? buildStatusQuery(status) : {})
    };

    const [totalCount, equipments] = await Promise.all([
      equipmentModel.countDocuments(query),
      equipmentModel.find(query).sort({ year: -1, createdAt: -1 }).skip(skip).limit(limit).lean()
    ]);

    const { totalPages, hasNextPage } = getPaginationMeta(totalCount, page, limit);

    return { status: 200, ok: true, equipments, currentPage: page, totalPages, totalCount, hasNextPage };
  } catch (err) {
    console.error('[EquipmentService] fetchEquipmentsByStatus:', err);
    return { status: 500, ok: false, message: err.message || 'Error fetching equipments by status' };
  }
};

/**
 * Full-text search across equipment fields with pagination.
 * @param {string}      searchTerm
 * @param {number}      page
 * @param {number}      limit
 * @param {string}      searchField
 * @param {string|null} hiredFilter
 * @returns {Promise<object>}
 */
const searchEquipments = async (searchTerm, page = 1, limit = DEFAULT_PAGE_LIMITS.FETCH, searchField = 'all', hiredFilter = null) => {
  try {
    const skip  = (page - 1) * limit;
    const query = {
      ...buildHiredQuery(hiredFilter),
      ...buildSearchQuery(searchTerm, searchField)
    };

    const [totalCount, equipments] = await Promise.all([
      equipmentModel.countDocuments(query),
      equipmentModel.find(query).sort({ year: -1, createdAt: -1 }).skip(skip).limit(limit).lean()
    ]);

    const { totalPages, hasNextPage } = getPaginationMeta(totalCount, page, limit);

    return { status: 200, ok: true, equipments, currentPage: page, totalPages, totalCount, hasNextPage };
  } catch (err) {
    console.error('[EquipmentService] searchEquipments:', err);
    return { status: 500, ok: false, message: err.message || 'Error searching equipments' };
  }
};

/**
 * Returns equipment records matching a specific registration number.
 * @param {string} regNo
 * @returns {Promise<object>}
 */
const fetchEquipmentByReg = async (regNo) => {
  try {
    const data = await equipmentModel.find({ regNo });
    return { status: 200, ok: true, data };
  } catch (err) {
    console.error('[EquipmentService] fetchEquipmentByReg:', err);
    return { status: 500, ok: false, message: err.message || 'Error fetching equipment' };
  }
};

/**
 * Returns status breakdown, company distribution, and site distribution stats.
 * @param {string|null} hiredFilter
 * @returns {Promise<object>}
 */
const fetchEquipmentStats = async (hiredFilter = null) => {
  try {
    const query = buildHiredQuery(hiredFilter);

    const [totalCount, statusCounts, companyStats, siteStats] = await Promise.all([
      equipmentModel.countDocuments(query),
      equipmentModel.aggregate([
        { $match: query },
        { $group: { _id: { $toLower: '$status' }, count: { $sum: 1 } } }
      ]),
      equipmentModel.aggregate([
        { $match: query },
        { $group: { _id: '$company', count: { $sum: 1 } } }
      ]),
      equipmentModel.aggregate([
        { $match: query },
        { $match: { site: { $ne: null } } },
        { $group: { _id: '$site', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ])
    ]);

    const statusBreakdown = { total: totalCount, idle: 0, active: 0, maintenance: 0, loading: 0, going: 0, leased: 0, unknown: 0 };
    statusCounts.forEach(({ _id, count }) => {
      if (statusBreakdown.hasOwnProperty(_id)) statusBreakdown[_id] = count;
      else statusBreakdown.unknown += count;
    });

    return {
      status: 200,
      ok:     true,
      stats: {
        statusBreakdown,
        companyBreakdown: Object.fromEntries(companyStats.map(({ _id, count }) => [_id, count])),
        siteBreakdown:    Object.fromEntries(siteStats.map(({ _id, count })    => [_id, count])),
        totalEquipment:   totalCount
      }
    };
  } catch (err) {
    console.error('[EquipmentService] fetchEquipmentStats:', err);
    return { status: 500, ok: false, message: err.message || 'Error fetching equipment statistics' };
  }
};

/**
 * Returns a deduplicated, sorted list of all unique site names.
 * @returns {Promise<string[]>}
 */
const fetchUniqueSites = async () => {
  try {
    const sites = await equipmentModel.distinct('site');
    return sites.filter(s => s?.trim()).sort();
  } catch (err) {
    console.error('[EquipmentService] fetchUniqueSites:', err);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Update / Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates an equipment record by registration number.
 * Handles operator assignment, certificationBody migration, status change logging,
 * and notification dispatch.
 * @param {string}      regNo
 * @param {object}      updatedData
 * @param {string|null} equipmentNumber  - legacy operator-only update path
 * @param {string|null} operatorName     - legacy operator-only update path
 * @returns {Promise<object>}
 */
const updateEquipment = async (regNo, updatedData, equipmentNumber = null, operatorName = null) => {
  try {
    // ── Legacy: operator-only update by equipment number ──────────────────────
    if (equipmentNumber && operatorName) {
      const equipment = await equipmentModel.findOne({ regNo: equipmentNumber });
      if (!equipment) return { status: 404, ok: false, message: 'Equipment not found' };

      const result = await equipmentModel.findOneAndUpdate(
        { regNo: equipmentNumber },
        { operator: operatorName },
        { new: true, runValidators: true }
      );

      await _sendNotification({
        title:       'Operator Updated',
        description: `${equipment.machine} - ${equipment.regNo}'s new operator is ${operatorName}`,
        priority:    NOTIFICATION_PRIORITY.MEDIUM,
        sourceId:    equipment._id
      });

      return { status: 200, ok: true, message: 'Equipment updated successfully', data: result };
    }

    // ── Standard update ───────────────────────────────────────────────────────
    const equipment = await equipmentModel.findOne({ regNo });
    if (!equipment) return { status: 404, ok: false, message: 'Equipment not found' };

    if (updatedData.company === 'HIRED' && !updatedData.hiredFrom && !equipment.hiredFrom) {
      return { status: 400, ok: false, message: 'hiredFrom is required when company is HIRED' };
    }

    const originalEquipment = equipment.toObject();

    // Strip fields that must not be overwritten directly
    const { _id, __v, createdAt, operator, operatorId, lastSite, lastLocation, lastCertificationBody, ...cleanUpdatedData } = updatedData;

    const setFields  = { ...cleanUpdatedData, updatedAt: new Date() };
    const pushFields = {};
    let   newOperatorId = null;

    if (cleanUpdatedData.site !== undefined && cleanUpdatedData.site !== originalEquipment.site) {
      if (originalEquipment.site) pushFields.lastSite = originalEquipment.site;
      setFields.site = cleanUpdatedData.site || null;
    }

    if (cleanUpdatedData.location !== undefined && cleanUpdatedData.location !== originalEquipment.location) {
      if (originalEquipment.location) pushFields.lastLocation = originalEquipment.location;
      setFields.location = cleanUpdatedData.location || null;
    }

    if (operator !== undefined && operator !== originalEquipment.certificationBody?.operatorName) {
      if (originalEquipment.certificationBody) pushFields.lastCertificationBody = originalEquipment.certificationBody;
      newOperatorId = operatorId || null;
      setFields.certificationBody = { operatorName: operator, operatorId: operatorId || '', assignedAt: new Date() };
    }

    const updateOp = { $set: setFields };
    if (Object.keys(pushFields).length) updateOp.$push = pushFields;

    const result = await equipmentModel.findOneAndUpdate({ regNo }, updateOp, { new: true, runValidators: true });

    // Update operator assignment records
    if (newOperatorId) {
      const prevOperatorId = originalEquipment.certificationBody?.operatorId;
      if (prevOperatorId && prevOperatorId !== newOperatorId) {
        await safeUpdateOperator(prevOperatorId, { equipmentNumber: '' });
      }
      await safeUpdateOperator(newOperatorId, { equipmentNumber: regNo });
    }

    // Log status change as mobilization record
    if (updatedData.status && originalEquipment.status !== updatedData.status) {
      const { month, year, time } = getCurrentDateTime();
      await mobilizationModel.create({
        equipmentId:    equipment._id,
        regNo:          equipment.regNo,
        machine:        equipment.machine,
        action:         'status_changed',
        previousStatus: originalEquipment.status,
        newStatus:      updatedData.status,
        withOperator:   false,
        month, year, date: new Date(), time,
        remarks:        'Status updated via edit modal',
        status:         updatedData.status
      });
    }

    // Notification for meaningful changes
    const changes = extractEquipmentChanges(originalEquipment, result, updatedData);
    if (changes.length) {
      const description = `${equipment.machine} - ${equipment.regNo}'s new ${changes.join(', ')}`;
      await _sendNotification({
        title:       'Equipment Updated',
        description,
        priority:    NOTIFICATION_PRIORITY.MEDIUM,
        sourceId:    equipment._id
      });
    }

    return { status: 200, ok: true, message: 'Equipment updated successfully', data: result };

  } catch (err) {
    console.error('[EquipmentService] updateEquipment:', err);
    return { status: 500, ok: false, message: 'Unable to update equipment' };
  }
};

/**
 * Changes equipment status and creates a mobilization record for the transition.
 * @param {object} data
 * @returns {Promise<object>}
 */
const changeEquipmentStatus = async (data) => {
  try {
    const { equipmentId, regNo, machine, previousStatus, newStatus, month, year, time, remarks } = data;

    const [statusChange, updatedEquipment] = await Promise.all([
      mobilizationModel.create({
        equipmentId, regNo, machine,
        action: 'status_changed', previousStatus, newStatus,
        withOperator: false, month, year,
        date: new Date(), time,
        remarks: remarks || '',
        status: newStatus
      }),
      equipmentModel.findOneAndUpdate(
        { _id: equipmentId },
        { $set: { status: newStatus, updatedAt: new Date() } },
        { new: true }
      )
    ]);

    if (!updatedEquipment) return { status: 404, ok: false, message: 'Equipment not found' };

    return { status: 200, ok: true, message: 'Equipment status changed successfully', data: { statusChange, updatedEquipment } };

  } catch (err) {
    console.error('[EquipmentService] changeEquipmentStatus:', err);
    throw err;
  }
};

/**
 * Deletes an equipment record and fires a removal notification.
 * @param {string} regNo
 * @returns {Promise<object>}
 */
const deleteEquipment = async (regNo) => {
  try {
    const equipment = await equipmentModel.findOne({ regNo });
    if (!equipment) return { status: 404, ok: false, message: 'Equipment not found' };

    const deleted = await equipmentModel.findOneAndDelete({ regNo: equipment.regNo });

    await _sendNotification({
      title:       'Equipment Removed',
      description: `Equipment ${deleted.machine} - ${deleted.regNo} has been removed from the system or sold`,
      priority:    NOTIFICATION_PRIORITY.MEDIUM,
      sourceId:    deleted._id
    });

    return { status: 200, ok: true, message: 'Equipment deleted successfully', data: deleted };

  } catch (err) {
    console.error('[EquipmentService] deleteEquipment:', err);
    return { status: 500, ok: false, message: 'Unable to delete equipment' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds an image to an equipment image record (upserts if missing).
 * @param {string} equipmentNo
 * @param {string} imagePath
 * @param {string} imageLabel
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<object>}
 */
const addEquipmentImage = async (equipmentNo, imagePath, imageLabel, fileName, mimeType) => {
  try {
    if (!imagePath || !imageLabel) {
      return { status: 400, success: false, message: 'Image path and label are required' };
    }

    const equipmentNoStr = String(equipmentNo);

    const equipment = await EquipmentImageModel.findOneAndUpdate(
      { equipmentNo: equipmentNoStr },
      {
        $push:        { images: { path: imagePath, label: imageLabel, fileName, mimeType } },
        $set:         { updatedAt: new Date() },
        $setOnInsert: { equipmentName: `Equipment ${equipmentNoStr}`, createdAt: new Date() }
      },
      { upsert: true, new: true, runValidators: true }
    );

    return {
      status:  200,
      success: true,
      message: equipment.images.length === 1 ? 'Equipment created with image successfully' : 'Image added to existing equipment successfully',
      data: {
        equipmentNo:   equipmentNoStr,
        equipmentName: equipment.equipmentName,
        totalImages:   equipment.images.length,
        imagePath,
        imageLabel,
        fileName,
        isNewEquipment: equipment.images.length === 1
      }
    };

  } catch (err) {
    console.error('[EquipmentService] addEquipmentImage:', err);
    const status  = err.name === 'ValidationError' ? 400 : 500;
    const message = err.name === 'ValidationError' ? `Validation error: ${err.message}` : 'Failed to add equipment image';
    return { status, success: false, message, error: err.message };
  }
};

/**
 * Returns a single equipment's image records with normalised URLs.
 * @param {string} regNo
 * @returns {Promise<object>}
 */
const getEquipmentImages = async (regNo) => {
  try {
    const equipment = await EquipmentImageModel.findOne({ equipmentNo: regNo });
    if (!equipment) return { status: 404, success: false, message: 'Equipment not found' };

    const result = equipment.toObject();
    result.images = normaliseImages(result.images || []);

    return { status: 200, success: true, message: 'Equipment details retrieved successfully', data: result };

  } catch (err) {
    console.error('[EquipmentService] getEquipmentImages:', err);
    return { status: 500, success: false, message: 'Failed to retrieve equipment details', error: err.message };
  }
};

/**
 * Returns images for multiple equipment records in a single DB call.
 * @param {string[]} regNos
 * @returns {Promise<object>}
 */
const getBulkEquipmentImages = async (regNos) => {
  try {
    const imageMap = await fetchImageMap(regNos);

    // Initialise all requested regNos with empty arrays
    const result = Object.fromEntries(regNos.map(r => [r, { success: false, images: [] }]));
    Object.keys(imageMap).forEach(regNo => {
      result[regNo] = { success: true, images: imageMap[regNo] };
    });

    return {
      status:         200,
      success:        true,
      message:        'Bulk equipment images retrieved successfully',
      data:           result,
      totalRequested: regNos.length,
      totalFound:     Object.values(result).filter(r => r.success).length
    };

  } catch (err) {
    console.error('[EquipmentService] getBulkEquipmentImages:', err);
    return { status: 500, success: false, message: 'Failed to retrieve bulk equipment images', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobilization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mobilizes an equipment to a site or client company.
 * @param {object} data
 * @returns {Promise<object>}
 */
const mobilizeEquipment = async (data) => {
  try {
    const {
      equipmentId, regNo, machine, site, operator, operatorId,
      withOperator, deployType, clientCompany,
      month, year, time, selectedDate, remarks
    } = data;

    const isCompanyDeploy = deployType === 'company';
    const deployLocation  = isCompanyDeploy ? clientCompany : site;
    const newStatus       = isCompanyDeploy ? 'leased' : 'active';

    const mobilization = await mobilizationModel.create({
      equipmentId, regNo, machine,
      action:       'mobilized',
      deployType:   deployType || 'site',
      clientCompany: clientCompany || '',
      site:          deployLocation,
      operator:      withOperator ? operator : undefined,
      withOperator, month, year,
      date:          selectedDate ? new Date(selectedDate) : new Date(),
      time, remarks,
      status:        newStatus
    });

    const currentEquipment = await equipmentModel.findById(equipmentId);

    const updateOperation = {
      $set: { status: newStatus, site: deployLocation, updatedAt: new Date() }
    };

    if (currentEquipment?.site) {
      updateOperation.$push = { lastSite: currentEquipment.site };
    }

    if (withOperator && operator && operatorId) {
      if (currentEquipment?.certificationBody) {
        updateOperation.$push = { ...(updateOperation.$push || {}), lastCertificationBody: currentEquipment.certificationBody };
      }
      updateOperation.$set.certificationBody = { operatorName: operator, operatorId, assignedAt: new Date() };
    }

    const updatedEquipment = await equipmentModel.findOneAndUpdate(
      { _id: equipmentId },
      updateOperation,
      { new: true }
    );

    if (!updatedEquipment) return { status: 404, ok: false, message: 'Equipment not found' };

    if (withOperator && operatorId) await safeUpdateOperator(operatorId, { equipmentNumber: regNo });

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    await _sendNotification({
      title:       `${machine} (${regNo}) Mobilized`,
      description: isCompanyDeploy
        ? `${machine} (${regNo}) has been leased to company: ${clientCompany}`
        : `${machine} (${regNo}) has been mobilized to site: ${site}`,
      priority:    NOTIFICATION_PRIORITY.HIGH,
      sourceId:    updatedEquipment._id,
      recipient:   officeMain
    });

    await alertMobilizationViaEmail({
      action: 'mobilized', regNo, machine, site: deployLocation,
      deployType: deployType || 'site', clientCompany: clientCompany || '',
      operator: withOperator ? operator : '', withOperator,
      month, year, time, date: selectedDate ? new Date(selectedDate) : new Date(), remarks,
      hired:    updatedEquipment?.hired    || false,
      rentRate: updatedEquipment?.rentRate || null,
      location: updatedEquipment?.location ? [updatedEquipment.location] : []
    }).catch(e => console.error('Mobilization email failed:', e));

    return { status: 201, ok: true, message: 'Equipment mobilized successfully', data: { mobilization, updatedEquipment } };

  } catch (err) {
    console.error('[EquipmentService] mobilizeEquipment:', err);
    throw err;
  }
};

/**
 * Demobilizes an equipment, setting it to idle.
 * @param {object} data
 * @returns {Promise<object>}
 */
const demobilizeEquipment = async (data) => {
  try {
    const { equipmentId, regNo, machine, month, year, time, selectedDate, remarks } = data;

    const currentEquipment  = await equipmentModel.findById(equipmentId);
    const currentOperatorId = currentEquipment?.certificationBody?.operatorId;
    const currentSite       = currentEquipment?.site || null;

    const [demobilization, updatedEquipment] = await Promise.all([
      mobilizationModel.create({
        equipmentId, regNo, machine,
        action: 'demobilized', withOperator: false,
        month, year, date: selectedDate ? new Date(selectedDate) : new Date(),
        time, remarks, status: 'idle'
      }),
      equipmentModel.findOneAndUpdate(
      { _id: equipmentId },
      {
        $set:  { status: 'idle', site: null, updatedAt: new Date() },
        ...(currentSite && { $push: { lastSite: currentSite } })
      },
      { new: true }
    )]);

    if (!updatedEquipment) return { status: 404, ok: false, message: 'Equipment not found' };

    await safeUpdateOperator(currentOperatorId, { equipmentNumber: '' });

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    await _sendNotification({
      title:       `${machine} (${regNo}) Demobilized`,
      description: `${machine} (${regNo}) has been demobilized`,
      priority:    NOTIFICATION_PRIORITY.HIGH,
      sourceId:    updatedEquipment._id,
      recipient:   officeMain
    });

    await alertMobilizationViaEmail({
      action: 'demobilized', regNo, machine,
      month, year, time, date: selectedDate ? new Date(selectedDate) : new Date(), remarks,
      site:     currentSite || '',
      hired:    currentEquipment?.hired    || false,
      rentRate: currentEquipment?.rentRate || null,
      location: currentEquipment?.location ? [currentEquipment.location] : [],
    }).catch(e => console.error('Demobilization email failed:', e));

    return { status: 201, ok: true, message: 'Equipment demobilized successfully', data: { demobilization, updatedEquipment } };

  } catch (err) {
    console.error('[EquipmentService] demobilizeEquipment:', err);
    throw err;
  }
};

/**
 * Returns paginated mobilization history for a single equipment.
 * @param {string} equipmentId
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<object>}
 */
const getMobilizationHistory = async (equipmentId, page, limit) => {
  try {
    const skip = (page - 1) * limit;

    const [history, totalCount] = await Promise.all([
      mobilizationModel.find({ equipmentId }).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
      mobilizationModel.countDocuments({ equipmentId })
    ]);

    const { totalPages, hasNextPage } = getPaginationMeta(totalCount, page, limit);

    return { history, currentPage: page, totalPages, totalCount, hasNextPage };
  } catch (err) {
    console.error('[EquipmentService] getMobilizationHistory:', err);
    throw err;
  }
};

/**
 * Returns the 100 most recent mobilizations, enriched with equipment, image, and operator data.
 * @returns {Promise<object[]>}
 */
const fetchAllMobilizations = async () => {
  try {
    const mobilizations = await mobilizationModel.find({})
      .sort({ date: -1, createdAt: -1 })
      .limit(DEFAULT_PAGE_LIMITS.MOBILIZATION)
      .lean();

    const regNos        = [...new Set(mobilizations.map(m => m.regNo))];
    const operatorNames = [...new Set(mobilizations.filter(m => m.operator).map(m => m.operator))];

    const [equipmentMap, imageMap, operatorMap] = await Promise.all([
      fetchEquipmentMapByRegNo(regNos),
      fetchImageMap(regNos),
      fetchOperatorMapByName(operatorNames)
    ]);

    return enrichMobilizations(mobilizations, equipmentMap, imageMap, operatorMap);
  } catch (err) {
    console.error('[EquipmentService] fetchAllMobilizations:', err);
    throw err;
  }
};

/**
 * Returns mobilizations filtered by time range, enriched with related data.
 * @param {string}      filterType
 * @param {string|null} startDate
 * @param {string|null} endDate
 * @param {number|null} months
 * @param {string|null} specificTime
 * @param {string|null} startTime
 * @param {string|null} endTime
 * @returns {Promise<object[]>}
 */
const fetchFilteredMobilizations = async (filterType, startDate = null, endDate = null, months = null, specificTime = null, startTime = null, endTime = null) => {
  try {
    const { startDateTime, endDateTime } = resolveDateRange(filterType, startDate, endDate, months);
    const query = buildDateRangeQuery(startDateTime, endDateTime);

    if (specificTime)            query.time = specificTime;
    else if (startTime && endTime) query.time = { $gte: startTime, $lte: endTime };

    const mobilizations = await mobilizationModel.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(DEFAULT_PAGE_LIMITS.FILTERED)
      .lean();

    const regNos        = [...new Set(mobilizations.map(m => m.regNo))];
    const operatorNames = [...new Set(mobilizations.filter(m => m.operator).map(m => m.operator))];

    const [equipmentMap, imageMap, operatorMap] = await Promise.all([
      fetchEquipmentMapByRegNo(regNos),
      fetchImageMap(regNos),
      fetchOperatorMapByName(operatorNames)
    ]);

    return enrichMobilizations(mobilizations, equipmentMap, imageMap, operatorMap);
  } catch (err) {
    console.error('[EquipmentService] fetchFilteredMobilizations:', err);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Replacements
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records an operator replacement on an equipment.
 * @param {object} data
 * @returns {Promise<object>}
 */
const replaceOperator = async (data) => {
  try {
    const {
      equipmentId, regNo, machine,
      currentOperator, currentOperatorId, replacedOperator, replacedOperatorId,
      month, year, time, selectedDate, remarks
    } = data;

    const replacement = await replacementsModel.create({
      equipmentId, regNo, machine,
      date: selectedDate ? new Date(selectedDate) : new Date(),
      month, year, time, status: 'active',
      type: REPLACEMENT_TYPES.OPERATOR,
      currentOperator,
      currentOperatorId: currentOperatorId || undefined,
      replacedOperator, replacedOperatorId, remarks
    });

    const currentEquipment = await equipmentModel.findById(equipmentId);

    const replaceOp = {
      $set: {
        certificationBody: { operatorName: replacedOperator, operatorId: replacedOperatorId, assignedAt: new Date() },
        updatedAt: new Date()
      }
    };
    if (currentEquipment?.certificationBody) {
      replaceOp.$push = { lastCertificationBody: currentEquipment.certificationBody };
    }

    const updatedEquipment = await equipmentModel.findOneAndUpdate({ _id: equipmentId }, replaceOp, { new: true });

    if (!updatedEquipment) return { status: 404, ok: false, message: 'Equipment not found' };

    await Promise.all([
      safeUpdateOperator(currentOperatorId,  { equipmentNumber: ''    }),
      safeUpdateOperator(replacedOperatorId, { equipmentNumber: regNo })
    ]);

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    await _sendNotification({
      title:       `Operator Replaced on ${machine} (${regNo})`,
      description: `Operator changed from ${currentOperator} to ${replacedOperator} on ${machine} (${regNo})`,
      priority:    NOTIFICATION_PRIORITY.MEDIUM,
      sourceId:    updatedEquipment._id,
      recipient:   officeMain
    });

    await alertReplacementViaEmail({
      type: 'operator', regNo, machine,
      currentOperator, replacedOperator, site: updatedEquipment.site || '',
      month, year, time, date: selectedDate ? new Date(selectedDate) : new Date(), remarks,
      hired:    updatedEquipment?.hired    || false,
      rentRate: updatedEquipment?.rentRate || null,
      location: updatedEquipment?.location ? [updatedEquipment.location] : []
    }).catch(e => console.error('Replace operator email failed:', e));

    return { status: 201, ok: true, message: 'Operator replaced successfully', data: { replacement, updatedEquipment } };

  } catch (err) {
    console.error('[EquipmentService] replaceOperator:', err);
    throw err;
  }
};

/**
 * Records an equipment replacement at a site.
 * @param {object} data
 * @returns {Promise<object>}
 */
const replaceEquipment = async (data) => {
  try {
    const {
      equipmentId, regNo, machine,
      replacedEquipmentId, replacedEquipmentRegNo, replacedEquipmentMachine,
      newSiteForReplaced, month, year, time, selectedDate, remarks
    } = data;

    const currentEquipment = await equipmentModel.findById(equipmentId);
    if (!currentEquipment) return { status: 404, ok: false, message: 'Current equipment not found' };

    const currentSite = currentEquipment.site;
    if (!currentSite) return { status: 400, ok: false, message: 'Current equipment has no site assigned' };

    const replacement = await replacementsModel.create({
      equipmentId, regNo, machine,
      date: selectedDate ? new Date(selectedDate) : new Date(),
      month, year, time, status: 'active',
      type: REPLACEMENT_TYPES.EQUIPMENT,
      replacedEquipmentId, remarks
    });

    const replacedEquipment = await equipmentModel.findById(replacedEquipmentId);

    const [updatedReplacedEquipment, updatedCurrentEquipment] = await Promise.all([
      equipmentModel.findOneAndUpdate(
        { _id: replacedEquipmentId },
        {
          $set:  { site: currentSite, status: 'active', updatedAt: new Date() },
          ...(replacedEquipment?.site && { $push: { lastSite: replacedEquipment.site } })
        },
        { new: true }
      ),
      equipmentModel.findOneAndUpdate(
        { _id: equipmentId },
        {
          $set:  { site: newSiteForReplaced || null, status: newSiteForReplaced ? 'active' : 'idle', updatedAt: new Date() },
          $push: { lastSite: currentSite }
        },
        { new: true }
      )
    ]);

    if (!updatedReplacedEquipment) return { status: 404, ok: false, message: 'Replacement equipment not found' };

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    await _sendNotification({
      title:       `Equipment Replaced at ${currentSite}`,
      description: `${machine} (${regNo}) replaced by ${replacedEquipmentMachine} (${replacedEquipmentRegNo}) at site: ${currentSite}`,
      priority:    NOTIFICATION_PRIORITY.HIGH,
      sourceId:    updatedCurrentEquipment._id,
      recipient:   officeMain
    });
 
    await alertReplacementViaEmail({
      type: 'equipment', regNo, machine,
      replacedEquipmentRegNo, replacedEquipmentMachine,
      site: currentSite, newSiteForReplaced,
      month, year, time, date: selectedDate ? new Date(selectedDate) : new Date(), remarks,
      hired:    currentEquipment?.hired    || false,
      rentRate: currentEquipment?.rentRate || null,
      location: currentEquipment?.location ? [currentEquipment.location] : []
    }).catch(e => console.error('Replace equipment email failed:', e));

    return {
      status: 201, ok: true, message: 'Equipment replaced successfully',
      data: { replacement, currentEquipment: updatedCurrentEquipment, replacedEquipment: updatedReplacedEquipment }
    };

  } catch (err) {
    console.error('[EquipmentService] replaceEquipment:', err);
    throw err;
  }
};

/**
 * Returns paginated replacement history for a single equipment.
 * @param {string}      equipmentId
 * @param {number}      page
 * @param {number}      limit
 * @param {string|null} type - 'operator' | 'equipment' | null (all)
 * @returns {Promise<object>}
 */
const getReplacementHistory = async (equipmentId, page, limit, type = null) => {
  try {
    const skip  = (page - 1) * limit;
    const query = { equipmentId, ...(type ? { type } : {}) };

    const [history, totalCount] = await Promise.all([
      replacementsModel.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
      replacementsModel.countDocuments(query)
    ]);

    const { totalPages, hasNextPage } = getPaginationMeta(totalCount, page, limit);

    return { history, currentPage: page, totalPages, totalCount, hasNextPage };
  } catch (err) {
    console.error('[EquipmentService] getReplacementHistory:', err);
    throw err;
  }
};

/**
 * Returns the 100 most recent replacements, enriched with equipment and operator data.
 * @returns {Promise<object[]>}
 */
const fetchAllReplacements = async () => {
  try {
    const replacements = await replacementsModel.find({})
      .sort({ date: -1, createdAt: -1 })
      .limit(DEFAULT_PAGE_LIMITS.REPLACEMENT)
      .lean();

    const equipmentIds = [...new Set([
      ...replacements.map(r => r.equipmentId.toString()),
      ...replacements.filter(r => r.type === 'equipment' && r.replacedEquipmentId).map(r => r.replacedEquipmentId.toString())
    ])];

    const operatorIds = [...new Set([
      ...replacements.filter(r => r.currentOperatorId).map(r => r.currentOperatorId),
      ...replacements.filter(r => r.replacedOperatorId).map(r => r.replacedOperatorId)
    ])];

    const equipmentMapById = await fetchEquipmentMapById(equipmentIds);
    const allRegNos        = [...new Set(Object.values(equipmentMapById).map(eq => eq.regNo))];

    const [imageMap, operatorMap] = await Promise.all([
      fetchImageMap(allRegNos),
      fetchOperatorMapById(operatorIds)
    ]);

    return enrichReplacements(replacements, equipmentMapById, imageMap, operatorMap);
  } catch (err) {
    console.error('[EquipmentService] fetchAllReplacements:', err);
    throw err;
  }
};

/**
 * Returns replacements filtered by time range, enriched with related data.
 * @param {string}      filterType
 * @param {string|null} startDate
 * @param {string|null} endDate
 * @param {number|null} months
 * @returns {Promise<object[]>}
 */
const fetchFilteredReplacements = async (filterType, startDate = null, endDate = null, months = null) => {
  try {
    const { startDateTime, endDateTime } = resolveDateRange(filterType, startDate, endDate, months);
    const query = buildDateRangeQuery(startDateTime, endDateTime);

    const replacements = await replacementsModel.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(DEFAULT_PAGE_LIMITS.FILTERED)
      .lean();

    const equipmentIds = [...new Set([
      ...replacements.map(r => r.equipmentId.toString()),
      ...replacements.filter(r => r.type === 'equipment' && r.replacedEquipmentId).map(r => r.replacedEquipmentId.toString())
    ])];

    const operatorIds = [...new Set([
      ...replacements.filter(r => r.currentOperatorId).map(r => r.currentOperatorId),
      ...replacements.filter(r => r.replacedOperatorId).map(r => r.replacedOperatorId)
    ])];

    const equipmentMapById = await fetchEquipmentMapById(equipmentIds);
    const allRegNos        = [...new Set(Object.values(equipmentMapById).map(eq => eq.regNo))];

    const [imageMap, operatorMap] = await Promise.all([
      fetchImageMap(allRegNos),
      fetchOperatorMapById(operatorIds)
    ]);

    return enrichReplacements(replacements, equipmentMapById, imageMap, operatorMap);
  } catch (err) {
    console.error('[EquipmentService] fetchFilteredReplacements:', err);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Insertion
  insertEquipment,
  // Fetch / Search / Stats
  fetchEquipments,
  fetchEquipmentsByStatus,
  searchEquipments,
  fetchEquipmentByReg,
  fetchEquipmentStats,
  fetchUniqueSites,
  // Update / Delete
  updateEquipment,
  changeEquipmentStatus,
  deleteEquipment,
  // Images
  addEquipmentImage,
  getEquipmentImages,
  getBulkEquipmentImages,
  // Mobilization
  mobilizeEquipment,
  demobilizeEquipment,
  getMobilizationHistory,
  fetchAllMobilizations,
  fetchFilteredMobilizations,
  // Replacements
  replaceOperator,
  replaceEquipment,
  getReplacementHistory,
  fetchAllReplacements,
  fetchFilteredReplacements
};