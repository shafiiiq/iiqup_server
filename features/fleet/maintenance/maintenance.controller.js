const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const maintenanceService = require('./maintenance.service');
const { maintenancePdf } = require('./maintenance.pdf.registration');
const { announceMaintenanceCreated } = require('./maintenance.notification');
const { markDocumentsViewedSafely } = require('#core/document/document.view.service');
const { buildMaintenanceFileName } = require('./maintenance.pdf');
const { parseFilterQuery } = require('./maintenance.helper');

const handleRoute = (logTag, handler) => async (req, res) => {
  try {
    sendSuccess(res, await handler(req));
  } catch (error) {
    logger.error(`[maintenance.controller] ${logTag}:`, error);
    sendError(res, {
      ok: false,
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

const createMaintenance = handleRoute('createMaintenance', async (req) => {
  const result = await maintenanceService.createMaintenance({ body: req.body, uploadedBy: req.userId });
  result.data.forEach((record) => {
    maintenancePdf.requestInBackground({ documentId: String(record._id), user: req.user });
  });
  announceMaintenanceCreated({ records: result.data, actorUniqueCode: req.user.uniqueCode });
  markDocumentsViewedSafely({
    uniqueCode: req.user.uniqueCode,
    sourceKey: 'maintenance',
    documentIds: result.data.map((record) => String(record._id)),
  });
  return result;
});

const updateMaintenance = handleRoute('updateMaintenance', async (req) => {
  const result = await maintenanceService.updateMaintenance({ id: req.params.id, body: req.body, uploadedBy: req.userId });
  maintenancePdf.requestInBackground({ documentId: req.params.id, user: req.user });
  return result;
});

const downloadMaintenancePdf = async (req, res) => {
  try {
    const { data: record } = await maintenanceService.fetchMaintenanceById(req.params.id);
    const pdfBytes = await maintenancePdf.read({ documentId: req.params.id, user: req.user });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${buildMaintenanceFileName(record)}"`,
      'Content-Length': pdfBytes.length,
    });
    res.end(pdfBytes);
  } catch (error) {
    logger.error('[maintenance.controller] downloadMaintenancePdf:', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const deleteMaintenance = handleRoute('deleteMaintenance', (req) =>
  maintenanceService.deleteMaintenance(req.params.id)
);

const getMaintenanceById = handleRoute('getMaintenanceById', (req) =>
  maintenanceService.fetchMaintenanceById(req.params.id)
);

const getMaintenanceList = handleRoute('getMaintenanceList', (req) =>
  maintenanceService.fetchMaintenanceList({ filters: parseFilterQuery(req.query), pagination: req.pagination })
);

const getMaintenanceTypeCounts = handleRoute('getMaintenanceTypeCounts', (req) =>
  maintenanceService.fetchMaintenanceTypeCounts(parseFilterQuery(req.query))
);

const getMaintenanceDocuments = handleRoute('getMaintenanceDocuments', (req) =>
  maintenanceService.fetchMaintenanceDocuments(parseFilterQuery(req.query))
);

const getMaintenanceByRegNo = handleRoute('getMaintenanceByRegNo', (req) =>
  maintenanceService.fetchMaintenanceByRegNo({ regNo: req.params.regNo, serviceType: req.params.serviceType })
);

const getLatestFullService = handleRoute('getLatestFullService', (req) =>
  maintenanceService.fetchLatestFullService(req.params.regNo)
);

const getFullServiceNotifications = handleRoute('getFullServiceNotifications', () =>
  maintenanceService.fetchFullServiceNotification()
);

module.exports = {
  downloadMaintenancePdf,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  getMaintenanceById,
  getMaintenanceList,
  getMaintenanceTypeCounts,
  getMaintenanceDocuments,
  getMaintenanceByRegNo,
  getLatestFullService,
  getFullServiceNotifications,
};