const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const equipmentService = require('./equipment.service');

const addEquipment = async (req, res) => {
  try {
    const result = await equipmentService.insertEquipment(req.body);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] addEquipment:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipments = async (req, res) => {
  try {
    const { hired, status, site, excludeStatus } = req.query;
    const statusFilter = Array.isArray(status) ? status : status ? [status] : null;
    const excludeStatusFilter = Array.isArray(excludeStatus) ? excludeStatus : excludeStatus ? [excludeStatus] : null;

    if (!req.pagination || req.pagination.page === 1) {
      await equipmentService.autoDemobilizeOverdueEquipment();
    }

    const result = await equipmentService.fetchEquipments(req.pagination, hired, statusFilter, site || null, excludeStatusFilter);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipments:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentsById = async (req, res) => {
  try {
    const result = await equipmentService.fetchEquipmentById(req.params.id);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentsById:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentByRegNo = async (req, res) => {
  try {
    const result = await equipmentService.fetchEquipmentByRegNo(req.params.regNo);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentByRegNo:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentsForExport = async (req, res) => {
  try {
    const { hired, status, site, excludeStatus } = req.query;
    const statusFilter = Array.isArray(status) ? status : status ? [status] : null;
    const excludeStatusFilter = Array.isArray(excludeStatus) ? excludeStatus : excludeStatus ? [excludeStatus] : null;

    const result = await equipmentService.fetchEquipmentsForExport(hired, statusFilter, site || null, excludeStatusFilter);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentsForExport:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const updateRemarks = async (req, res) => {
  try {
    const result = await equipmentService.updateRemarks(req.params.regNo, req.body.remarks);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] updateRemarks:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const updateEquipments = async (req, res) => {
  try {
    const result = await equipmentService.updateEquipment(req.params.regNo, req.body);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] updateEquipments:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const updateIdleLocation = async (req, res) => {
  try {
    const result = await equipmentService.updateIdleLocation(req.params.regNo, req.body);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] updateIdleLocation:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const markEquipmentSold = async (req, res) => {
  try {
    const { regNo } = req.body;
    if (!regNo) return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'regNo is required' });

    const result = await equipmentService.markEquipmentSold(regNo);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] markEquipmentSold:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const deleteEquipments = async (req, res) => {
  try {
    const result = await equipmentService.deleteEquipment(req.params.regNo);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] deleteEquipments:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentsByStatus = async (req, res) => {
  try {
    const { status, hired } = req.query;
    const result = await equipmentService.fetchEquipmentsByStatus(status, req.pagination, hired);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentsByStatus:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentStats = async (req, res) => {
  try {
    const result = await equipmentService.fetchEquipmentStats(req.query.hired);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentStats:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentTabCounts = async (req, res) => {
  try {
    await equipmentService.autoDemobilizeOverdueEquipment();
    const result = await equipmentService.fetchEquipmentTabCounts();
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentTabCounts:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentRecordsSummary = async (req, res) => {
  try {
    const result = await equipmentService.fetchEquipmentRecordsSummary(req.query.hired);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentRecordsSummary:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getEquipmentCount = async (req, res) => {
  try {
    const { searchTerm, searchField = 'all', hired } = req.query;
    const result = await equipmentService.fetchEquipmentCount(searchTerm, searchField, hired);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getEquipmentCount:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getSites = async (req, res) => {
  try {
    const data = await equipmentService.fetchUniqueSites();
    respond(res, { status: HTTP.OK, ok: true, data });
  } catch (error) {
    logger.error('[EquipmentController] getSites:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getSiteMachineBreakdown = async (req, res) => {
  try {
    const { site } = req.query;
    const result = await equipmentService.fetchSiteMachineBreakdown(site);
    respond(res, result);
  } catch (error) {
    logger.error('[EquipmentController] getSiteMachineBreakdown:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

module.exports = {
  addEquipment,
  getEquipments,
  getEquipmentsById,
  getEquipmentByRegNo,
  getEquipmentsForExport,
  updateEquipments,
  updateIdleLocation,
  updateRemarks,
  markEquipmentSold,
  deleteEquipments,
  getEquipmentsByStatus,
  getEquipmentStats,
  getEquipmentTabCounts,
  getEquipmentRecordsSummary,
  getEquipmentCount,
  getSites,
  getSiteMachineBreakdown,
};