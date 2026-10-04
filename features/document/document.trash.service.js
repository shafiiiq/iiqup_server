const mongoose = require('mongoose');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { deleteObject } = require('#core/s3/s3.config');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');
const documentModel = require('./document.model');
const documentFolderModel = require('./documentFolder.model');
const {
  ROOT_PATH_LABEL,
  SOURCE_TYPE_LABELS,
  findSourceEntity,
  resolveSourceLabel,
  serializeDocument,
  buildAreaFilter,
  buildPreviewKey,
} = require('./document.helper');

const FOLDER_PATH_SEPARATOR = ' / ';
const STORAGE_DELETE_BATCH_SIZE = 10;
const DELETED_SOURCE_LABEL = 'Deleted source';

const refreshDashboard = () => {
  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('documents');
};

const assertValidIds = (ids) => {
  if (!Array.isArray(ids) || !ids.every((id) => mongoose.isValidObjectId(id))) {
    throw new AppError('Invalid ID list', HTTP.BAD_REQUEST);
  }
};

const splitIntoChunks = (items, chunkSize) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) chunks.push(items.slice(index, index + chunkSize));
  return chunks;
};

const AREA_PATH_LABELS = {
  all: ROOT_PATH_LABEL,
  renewed: 'Renewed Documents',
  expired: 'Expired Documents',
  source: 'Data Source',
};

const buildFolderPath = async (folderId, area = 'all') => {
  const folderNames = [];
  const visitedFolderIds = new Set();
  let cursorFolderId = folderId;
  while (cursorFolderId && !visitedFolderIds.has(String(cursorFolderId))) {
    visitedFolderIds.add(String(cursorFolderId));
    const folderItem = await documentFolderModel.findById(cursorFolderId).select('name parentFolderId').lean();
    if (!folderItem) break;
    folderNames.unshift(folderItem.name);
    cursorFolderId = folderItem.parentFolderId;
  }
  return [AREA_PATH_LABELS[area] || ROOT_PATH_LABEL, ...folderNames].join(FOLDER_PATH_SEPARATOR);
};

const collectActiveFolderTreeIds = async (rootFolder) => {
  const activeFolders = await documentFolderModel
    .find({ sourceType: rootFolder.sourceType, sourceId: rootFolder.sourceId, deletedAt: null })
    .select('_id parentFolderId')
    .lean();
  const childIdsByParentId = new Map();
  activeFolders.forEach((folderItem) => {
    if (!folderItem.parentFolderId) return;
    const parentId = folderItem.parentFolderId.toString();
    childIdsByParentId.set(parentId, [...(childIdsByParentId.get(parentId) || []), folderItem._id.toString()]);
  });
  const treeIds = [];
  const pendingIds = [rootFolder._id.toString()];
  while (pendingIds.length > 0) {
    const currentId = pendingIds.pop();
    treeIds.push(currentId);
    pendingIds.push(...(childIdsByParentId.get(currentId) || []));
  }
  return treeIds;
};

const buildAvailableFolderName = async ({ sourceType, sourceId, parentFolderId, area, name }) => {
  let candidate = name;
  let counter = 1;
  while (
    await documentFolderModel
      .exists({ sourceType, sourceId, parentFolderId, area: buildAreaFilter(area), name: candidate, deletedAt: null })
      .collation({ locale: 'en', strength: 2 })
  ) {
    candidate = counter === 1 ? `${name} (Restored)` : `${name} (Restored ${counter})`;
    counter += 1;
  }
  return candidate;
};

const resolveRestoreParentId = async (trashedItem) => {
  if (!trashedItem.trashedFromFolderId) return null;
  const parentExists = await documentFolderModel.exists({ _id: trashedItem.trashedFromFolderId, deletedAt: null });
  return parentExists ? trashedItem.trashedFromFolderId : null;
};

const TRASH_RESET_FIELDS = {
  deletedAt: null,
  deletedBy: null,
  trashBatchId: null,
  isTrashRoot: false,
  trashedFromPath: null,
  trashedFromFolderId: null,
};

const trashItems = async ({ documentIds, folderIds, deletedBy }) => {
  assertValidIds(documentIds);
  assertValidIds(folderIds);
  const deletedAt = new Date();
  let trashedCount = 0;

  const folders = await documentFolderModel.find({ _id: { $in: folderIds }, deletedAt: null });
  for (const folderItem of folders) {
    const trashBatchId = new mongoose.Types.ObjectId().toString();
    const treeIds = await collectActiveFolderTreeIds(folderItem);
    const trashedFromPath = await buildFolderPath(folderItem.parentFolderId, folderItem.area || 'all');
    const batchFields = { deletedAt, deletedBy, trashBatchId };
    await documentFolderModel.updateMany({ _id: { $in: treeIds } }, { $set: batchFields });
    await documentModel.updateMany({ folderId: { $in: treeIds }, deletedAt: null }, { $set: batchFields });
    await documentFolderModel.updateOne(
      { _id: folderItem._id },
      { $set: { isTrashRoot: true, trashedFromPath, trashedFromFolderId: folderItem.parentFolderId } }
    );
    trashedCount += 1;
  }

  const documents = await documentModel.find({ _id: { $in: documentIds }, deletedAt: null });
  for (const documentItem of documents) {
    const trashedFromPath = await buildFolderPath(documentItem.folderId, documentItem.area || 'all');
    await documentModel.updateOne(
      { _id: documentItem._id },
      {
        $set: {
          deletedAt,
          deletedBy,
          trashBatchId: new mongoose.Types.ObjectId().toString(),
          isTrashRoot: true,
          trashedFromPath,
          trashedFromFolderId: documentItem.folderId,
        },
      }
    );
    trashedCount += 1;
  }

  refreshDashboard();
  return { status: HTTP.OK, message: 'Moved to Trash', data: { count: trashedCount } };
};

const getTrashSources = async () => {
  const rootFilter = { isTrashRoot: true, deletedAt: { $ne: null } };
  const groupStage = {
    $group: { _id: { sourceType: '$sourceType', sourceId: '$sourceId' }, itemCount: { $sum: 1 } },
  };
  const [documentGroups, folderGroups] = await Promise.all([
    documentModel.aggregate([{ $match: rootFilter }, groupStage]),
    documentFolderModel.aggregate([{ $match: rootFilter }, groupStage]),
  ]);

  const countBySourceKey = new Map();
  [...documentGroups, ...folderGroups].forEach((group) => {
    const sourceKey = `${group._id.sourceType}:${group._id.sourceId}`;
    countBySourceKey.set(sourceKey, {
      sourceType: group._id.sourceType,
      sourceId: group._id.sourceId,
      itemCount: (countBySourceKey.get(sourceKey)?.itemCount || 0) + group.itemCount,
    });
  });

  const trashedBytesRows = await documentModel.aggregate([
    { $match: { deletedAt: { $ne: null } } },
    { $group: { _id: { sourceType: '$sourceType', sourceId: '$sourceId' }, bytes: { $sum: '$fileSize' } } },
  ]);
  const trashedBytesBySourceKey = new Map(
    trashedBytesRows.map((row) => [`${row._id.sourceType}:${row._id.sourceId}`, row.bytes])
  );

  const sources = await Promise.all(
    [...countBySourceKey.values()].map(async (source) => {
      const sourceEntity = await findSourceEntity(source.sourceType, source.sourceId).catch(() => null);
      return {
        ...source,
        bytes: trashedBytesBySourceKey.get(`${source.sourceType}:${source.sourceId}`) || 0,
        typeLabel: SOURCE_TYPE_LABELS[source.sourceType],
        label: sourceEntity ? resolveSourceLabel(source.sourceType, sourceEntity) : DELETED_SOURCE_LABEL,
      };
    })
  );

  sources.sort((first, second) => first.label.localeCompare(second.label));
  return { status: HTTP.OK, message: 'Trash sources retrieved', data: sources };
};

const getTrashItems = async ({ sourceType, sourceId }) => {
  const filter = { sourceType, sourceId, isTrashRoot: true, deletedAt: { $ne: null } };
  const [documents, folders] = await Promise.all([
    documentModel.find(filter).sort({ deletedAt: -1 }).lean(),
    documentFolderModel.find(filter).sort({ deletedAt: -1 }).lean(),
  ]);

  const serializedFolders = await Promise.all(
    folders.map(async (folderItem) => {
      const [documentCount, folderCount, bytesRows] = await Promise.all([
        documentModel.countDocuments({ trashBatchId: folderItem.trashBatchId }),
        documentFolderModel.countDocuments({ trashBatchId: folderItem.trashBatchId, _id: { $ne: folderItem._id } }),
        documentModel.aggregate([
          { $match: { trashBatchId: folderItem.trashBatchId } },
          { $group: { _id: null, bytes: { $sum: '$fileSize' } } },
        ]),
      ]);
      return {
        _id: folderItem._id.toString(),
        bytes: bytesRows[0]?.bytes || 0,
        name: folderItem.name,
        trashedFromPath: folderItem.trashedFromPath,
        deletedAt: folderItem.deletedAt,
        itemCount: documentCount + folderCount,
      };
    })
  );

  return {
    status: HTTP.OK,
    message: 'Trash items retrieved',
    data: { documents: await Promise.all(documents.map(serializeDocument)), folders: serializedFolders },
  };
};

const restoreItems = async ({ documentIds, folderIds }) => {
  assertValidIds(documentIds);
  assertValidIds(folderIds);
  let restoredCount = 0;

  const folders = await documentFolderModel.find({ _id: { $in: folderIds }, isTrashRoot: true });
  for (const folderItem of folders) {
    const parentFolderId = await resolveRestoreParentId(folderItem);
    const name = await buildAvailableFolderName({
      sourceType: folderItem.sourceType,
      sourceId: folderItem.sourceId,
      parentFolderId,
      area: folderItem.area || 'all',
      name: folderItem.name,
    });
    await documentFolderModel.updateMany(
      { trashBatchId: folderItem.trashBatchId, _id: { $ne: folderItem._id } },
      { $set: TRASH_RESET_FIELDS }
    );
    await documentModel.updateMany({ trashBatchId: folderItem.trashBatchId }, { $set: TRASH_RESET_FIELDS });
    await documentFolderModel.updateOne({ _id: folderItem._id }, { $set: { ...TRASH_RESET_FIELDS, parentFolderId, name } });
    restoredCount += 1;
  }

  const documents = await documentModel.find({ _id: { $in: documentIds }, isTrashRoot: true });
  for (const documentItem of documents) {
    const folderId = await resolveRestoreParentId(documentItem);
    await documentModel.updateOne({ _id: documentItem._id }, { $set: { ...TRASH_RESET_FIELDS, folderId } });
    restoredCount += 1;
  }

  refreshDashboard();
  return { status: HTTP.OK, message: 'Restored', data: { count: restoredCount } };
};

const permanentlyDeleteItems = async ({ documentIds, folderIds }) => {
  assertValidIds(documentIds);
  assertValidIds(folderIds);

  const targetFolderIds = new Set(folderIds.map(String));
  const targetDocumentIds = new Set(documentIds.map(String));

  const rootFolders = await documentFolderModel.find({ _id: { $in: folderIds } });
  for (const rootFolder of rootFolders) {
    if (rootFolder.trashBatchId) {
      const batchFolders = await documentFolderModel.find({ trashBatchId: rootFolder.trashBatchId }).select('_id').lean();
      const batchDocuments = await documentModel.find({ trashBatchId: rootFolder.trashBatchId }).select('_id').lean();
      batchFolders.forEach((folderItem) => targetFolderIds.add(String(folderItem._id)));
      batchDocuments.forEach((documentItem) => targetDocumentIds.add(String(documentItem._id)));
    } else {
      const treeIds = await collectActiveFolderTreeIds(rootFolder);
      const treeDocuments = await documentModel
        .find({ folderId: { $in: treeIds }, deletedAt: null })
        .select('_id')
        .lean();
      treeIds.forEach((treeId) => targetFolderIds.add(treeId));
      treeDocuments.forEach((documentItem) => targetDocumentIds.add(String(documentItem._id)));
    }
  }

  const documents = await documentModel.find({ _id: { $in: [...targetDocumentIds] } }).select('s3Key').lean();
  const storageKeys = [...new Set(documents.map((documentItem) => documentItem.s3Key))];
  const stillReferencedKeys = new Set(
    await documentModel.distinct('s3Key', {
      s3Key: { $in: storageKeys },
      _id: { $nin: documents.map((documentItem) => documentItem._id) },
    })
  );
  const keysToDelete = storageKeys.filter((storageKey) => !stillReferencedKeys.has(storageKey));

  await Promise.allSettled(keysToDelete.map((storageKey) => deleteObject(buildPreviewKey(storageKey))));

  const failedKeys = new Set();
  for (const keyBatch of splitIntoChunks(keysToDelete, STORAGE_DELETE_BATCH_SIZE)) {
    const results = await Promise.allSettled(keyBatch.map((storageKey) => deleteObject(storageKey)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedKeys.add(keyBatch[index]);
        logger.error('[document.trash.service] permanentlyDeleteItems storage delete failed', result.reason);
      }
    });
  }

  const deletableDocumentIds = documents
    .filter((documentItem) => !failedKeys.has(documentItem.s3Key))
    .map((documentItem) => documentItem._id);
  await documentModel.deleteMany({ _id: { $in: deletableDocumentIds } });

  if (failedKeys.size > 0) {
    refreshDashboard();
    throw new AppError(`${failedKeys.size} file(s) could not be deleted from storage. Try again.`, HTTP.BAD_GATEWAY || 502);
  }

  await documentFolderModel.deleteMany({ _id: { $in: [...targetFolderIds] } });
  refreshDashboard();
  return {
    status: HTTP.OK,
    message: 'Deleted permanently',
    data: { documentCount: deletableDocumentIds.length, folderCount: targetFolderIds.size },
  };
};

const emptyTrash = async ({ sourceType, sourceId }) => {
  const filter = {
    isTrashRoot: true,
    deletedAt: { $ne: null },
    ...(sourceType && sourceId ? { sourceType, sourceId } : {}),
  };
  const [documents, folders] = await Promise.all([
    documentModel.find(filter).select('_id').lean(),
    documentFolderModel.find(filter).select('_id').lean(),
  ]);
  return permanentlyDeleteItems({
    documentIds: documents.map((documentItem) => String(documentItem._id)),
    folderIds: folders.map((folderItem) => String(folderItem._id)),
  });
};

module.exports = {
  trashItems,
  getTrashSources,
  getTrashItems,
  restoreItems,
  permanentlyDeleteItems,
  emptyTrash,
};