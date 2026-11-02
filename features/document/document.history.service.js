const mongoose = require('mongoose');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');
const documentModel = require('./document.model');
const documentFolderModel = require('./documentFolder.model');
const trashService = require('./document.trash.service');
const { RENEWAL_STATUS, buildAreaFilter } = require('./document.helper');

const EXPIRED_AREA = 'expired';
const EXPIRED_FOLDER_SUFFIX = '_expired';
const MAXIMUM_LINEAGE_LENGTH = 1000;

const refreshDashboard = () => {
  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('documents');
};

const buildExpiredDocumentName = (realName, position) => `${realName}${EXPIRED_FOLDER_SUFFIX}_${position}`;

const collectLineage = async (startDocument) => {
  const lineage = [];
  const visitedIds = new Set();
  let cursorDocument = startDocument;
  while (cursorDocument && !visitedIds.has(cursorDocument._id.toString()) && lineage.length < MAXIMUM_LINEAGE_LENGTH) {
    visitedIds.add(cursorDocument._id.toString());
    lineage.push(cursorDocument);
    cursorDocument = cursorDocument.renewedFromDocumentId
      ? await documentModel.findById(cursorDocument.renewedFromDocumentId)
      : null;
  }
  return lineage;
};

const collectActiveLineage = async (startDocument) =>
  (await collectLineage(startDocument)).filter((documentItem) => documentItem.deletedAt === null);

const buildAvailableExpiredFolderName = async ({ sourceType, sourceId, name }) => {
  let candidate = name;
  let counter = 2;
  while (
    await documentFolderModel
      .exists({
        sourceType,
        sourceId,
        parentFolderId: null,
        area: buildAreaFilter(EXPIRED_AREA),
        name: candidate,
        deletedAt: null,
      })
      .collation({ locale: 'en', strength: 2 })
  ) {
    candidate = `${name} (${counter})`;
    counter += 1;
  }
  return candidate;
};

const resolveExpiredFolder = async ({ expiredDocuments, previousDocument, realName }) => {
  for (const expiredDocument of expiredDocuments) {
    if (expiredDocument.area !== EXPIRED_AREA || !expiredDocument.folderId) continue;
    const existingFolder = await documentFolderModel.findOne({
      _id: expiredDocument.folderId,
      sourceType: previousDocument.sourceType,
      sourceId: previousDocument.sourceId,
      area: EXPIRED_AREA,
      deletedAt: null,
    });
    if (existingFolder) return existingFolder;
  }
  return documentFolderModel.create({
    sourceType: previousDocument.sourceType,
    sourceId: previousDocument.sourceId,
    parentFolderId: null,
    area: EXPIRED_AREA,
    name: await buildAvailableExpiredFolderName({
      sourceType: previousDocument.sourceType,
      sourceId: previousDocument.sourceId,
      name: `${realName}${EXPIRED_FOLDER_SUFFIX}`,
    }),
  });
};

const deleteFolderIfEmpty = async (folderId) => {
  if (!folderId) return;
  const [hasDocuments, hasFolders] = await Promise.all([
    documentModel.exists({ folderId }),
    documentFolderModel.exists({ parentFolderId: folderId }),
  ]);
  if (!hasDocuments && !hasFolders) await documentFolderModel.deleteOne({ _id: folderId });
};

const groupExpiredLineage = async (renewedDocumentId) => {
  const renewedDocument = await documentModel.findById(renewedDocumentId);
  const previousDocument = renewedDocument?.renewedFromDocumentId
    ? await documentModel.findById(renewedDocument.renewedFromDocumentId)
    : null;
  if (!previousDocument) return;

  const realName = previousDocument.displayName;
  const expiredDocuments = await collectActiveLineage(previousDocument);
  const expiredFolder = await resolveExpiredFolder({ expiredDocuments, previousDocument, realName });

  for (const [index, expiredDocument] of expiredDocuments.entries()) {
    await documentModel.updateOne(
      { _id: expiredDocument._id },
      {
        $set: {
          displayName: buildExpiredDocumentName(realName, index + 1),
          folderId: expiredFolder._id,
          area: EXPIRED_AREA,
          renewalStatus: RENEWAL_STATUS.EXPIRED,
        },
      }
    );
  }
};

const requireRenewedDocument = async (renewedDocumentId, shouldBeTrashed) => {
  if (!mongoose.isValidObjectId(renewedDocumentId)) throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  const renewedDocument = await documentModel.findById(renewedDocumentId);
  if (
    !renewedDocument ||
    Boolean(renewedDocument.deletedAt) !== shouldBeTrashed ||
    !renewedDocument.renewedFromDocumentId
  ) {
    throw new AppError('Renewed document not found', HTTP.NOT_FOUND);
  }
  return renewedDocument;
};

const requirePreviousDocument = async (renewedDocument) => {
  const previousDocument = await documentModel.findById(renewedDocument.renewedFromDocumentId);
  if (!previousDocument) throw new AppError('Previous version not found', HTTP.NOT_FOUND);
  return previousDocument;
};

const revertRenewal = async ({ renewedDocumentId, deletedBy }) => {
  const renewedDocument = await requireRenewedDocument(renewedDocumentId, false);
  const previousDocument = await requirePreviousDocument(renewedDocument);

  const realName = renewedDocument.displayName;
  const expiredFolderId = previousDocument.area === EXPIRED_AREA ? previousDocument.folderId : null;
  const previousRenewalStatus = previousDocument.renewedFromDocumentId ? RENEWAL_STATUS.RENEWED : RENEWAL_STATUS.NONE;

  await documentModel.updateOne(
    { _id: previousDocument._id },
    {
      $set: {
        displayName: realName,
        folderId: renewedDocument.folderId,
        area: renewedDocument.area || 'all',
        renewalStatus: previousRenewalStatus,
      },
    }
  );

  const remainingExpiredDocuments = (await collectActiveLineage(previousDocument)).filter(
    (documentItem) => documentItem._id.toString() !== previousDocument._id.toString()
  );
  for (const [index, expiredDocument] of remainingExpiredDocuments.entries()) {
    await documentModel.updateOne(
      { _id: expiredDocument._id },
      { $set: { displayName: buildExpiredDocumentName(realName, index + 1) } }
    );
  }
  await deleteFolderIfEmpty(expiredFolderId);

  await trashService.trashItems({ documentIds: [renewedDocumentId], folderIds: [], deletedBy });
  refreshDashboard();
  return { status: HTTP.OK, message: 'Renewal reverted', data: { documentId: previousDocument._id.toString() } };
};

const reapplyRenewal = async ({ renewedDocumentId }) => {
  const renewedDocument = await requireRenewedDocument(renewedDocumentId, true);
  await requirePreviousDocument(renewedDocument);

  await trashService.restoreItems({ documentIds: [renewedDocumentId], folderIds: [] });
  await documentModel.updateOne(
    { _id: renewedDocument.renewedFromDocumentId },
    { $set: { renewalStatus: RENEWAL_STATUS.EXPIRED } }
  );
  await groupExpiredLineage(renewedDocumentId);

  refreshDashboard();
  return { status: HTTP.OK, message: 'Renewal restored', data: { documentId: renewedDocumentId } };
};

module.exports = { groupExpiredLineage, revertRenewal, reapplyRenewal };