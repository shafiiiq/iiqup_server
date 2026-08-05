const { v4: uuidv4 } = require('uuid');
const logger = require('../logger/logger');
const AppError = require('../errors/AppError');
const HTTP = require('../constants/httpStatus.constant');
const UploadSession = require('./upload.model');
const {
  createMultipartUpload,
  getUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} = require('../../config/aws/s3.aws');
const { MIN_PART_SIZE, MAX_FILE_SIZE, PART_URL_BATCH_SIZE } = require('./upload.config');

// ─────────────────────────────────────────────────────────────────────────────
// Completion handler registry
// Features register a callback here so file-handling can notify them when an
// upload finishes, without file-handling importing anything feature-specific.
// ─────────────────────────────────────────────────────────────────────────────

const completionHandlers = {};

const registerCompletionHandler = (feature, handlerFn) => {
  completionHandlers[feature] = handlerFn;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const sanitizeFileName = (name) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

const buildS3Key = (feature, keyPrefix, fileName) => {
  const safeName = sanitizeFileName(fileName);
  const prefix = keyPrefix || `uploads/${feature}`;
  return `${prefix}/${Date.now()}-${uuidv4()}-${safeName}`;
};

const calculatePartPlan = (fileSize) => {
  const partSize = MIN_PART_SIZE;
  const totalParts = Math.max(1, Math.ceil(fileSize / partSize));
  return { partSize, totalParts };
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initiates a resumable multipart upload session.
 * @param {object} params
 * @returns {Promise<object>}
 */
const initiateUpload = async ({
  feature,
  context,
  entityId,
  keyPrefix,
  fileName,
  mimeType,
  fileSize,
  uploadedBy,
}) => {
  if (!feature || !fileName || !mimeType || !fileSize || !uploadedBy) {
    throw new AppError(
      'feature, fileName, mimeType, fileSize and uploadedBy are required',
      HTTP.BAD_REQUEST
    );
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw new AppError(
      `File exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`,
      HTTP.BAD_REQUEST
    );
  }

  const s3Key = buildS3Key(feature, keyPrefix, fileName);
  const { partSize, totalParts } = calculatePartPlan(fileSize);
  const s3UploadId = await createMultipartUpload(s3Key, mimeType);

  const session = await UploadSession.create({
    feature,
    context,
    entityId,
    uploadedBy,
    fileName: sanitizeFileName(fileName),
    originalName: fileName,
    mimeType,
    fileSize,
    s3Key,
    s3UploadId,
    partSize,
    totalParts,
    status: 'initiated',
  });

  logger.info('[UploadService] initiateUpload', {
    sessionId: session._id.toString(),
    feature,
    s3Key,
    totalParts,
  });

  return { sessionId: session._id.toString(), s3Key, partSize, totalParts };
};

/**
 * Generates presigned PUT URLs for the requested part numbers.
 * @param {object} params
 * @returns {Promise<object>}
 */
const getPartUrls = async ({ sessionId, uploadedBy, partNumbers }) => {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new AppError('Upload session not found', HTTP.NOT_FOUND);
  if (session.uploadedBy !== uploadedBy) {
    throw new AppError('Not authorized for this upload session', HTTP.FORBIDDEN);
  }
  if (['completed', 'aborted'].includes(session.status)) {
    throw new AppError(`Cannot request part URLs for a ${session.status} session`, HTTP.CONFLICT);
  }

  const requested = (partNumbers || []).slice(0, PART_URL_BATCH_SIZE);
  if (requested.length === 0) throw new AppError('partNumbers is required', HTTP.BAD_REQUEST);

  const invalid = requested.some((n) => n < 1 || n > session.totalParts);
  if (invalid) {
    throw new AppError(`partNumbers must be between 1 and ${session.totalParts}`, HTTP.BAD_REQUEST);
  }

  const urls = await Promise.all(
    requested.map(async (partNumber) => ({
      partNumber,
      url: await getUploadPartUrl(session.s3Key, session.s3UploadId, partNumber),
    }))
  );

  if (session.status === 'initiated') {
    session.status = 'uploading';
    await session.save();
  }

  return { sessionId, urls };
};

/**
 * Records that a part finished uploading — bookkeeping for progress/resume.
 * S3 itself remains the source of truth at completion time.
 * @param {object} params
 * @returns {Promise<object>}
 */
const acknowledgePart = async ({ sessionId, uploadedBy, partNumber, etag, size }) => {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new AppError('Upload session not found', HTTP.NOT_FOUND);
  if (session.uploadedBy !== uploadedBy) {
    throw new AppError('Not authorized for this upload session', HTTP.FORBIDDEN);
  }

  const existingIndex = session.parts.findIndex((p) => p.partNumber === partNumber);
  const partRecord = { partNumber, etag, size };
  if (existingIndex >= 0) session.parts[existingIndex] = partRecord;
  else session.parts.push(partRecord);

  await session.save();

  return { sessionId, completedParts: session.parts.length, totalParts: session.totalParts };
};

/**
 * Finalizes the multipart upload on S3 and notifies the owning feature.
 * @param {object} params
 * @returns {Promise<object>}
 */
const completeUpload = async ({ sessionId, uploadedBy, parts }) => {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new AppError('Upload session not found', HTTP.NOT_FOUND);
  if (session.uploadedBy !== uploadedBy) {
    throw new AppError('Not authorized for this upload session', HTTP.FORBIDDEN);
  }
  if (session.status === 'completed') {
    return { sessionId, s3Key: session.s3Key, alreadyCompleted: true };
  }

  const finalParts = (parts && parts.length ? parts : session.parts)
    .slice()
    .sort((a, b) => a.partNumber - b.partNumber);

  if (finalParts.length !== session.totalParts) {
    throw new AppError(
      `Expected ${session.totalParts} parts, received ${finalParts.length}`,
      HTTP.BAD_REQUEST
    );
  }

  try {
    await completeMultipartUpload(session.s3Key, session.s3UploadId, finalParts);
  } catch (error) {
    session.status = 'failed';
    session.error = error.message;
    await session.save();
    logger.error('[UploadService] completeUpload S3 failure', { sessionId, error: error.message });
    throw new AppError('Failed to finalize upload on S3', HTTP.INTERNAL_SERVER_ERROR);
  }

  session.status = 'completed';
  session.completedAt = new Date();
  session.parts = finalParts;
  await session.save();

  logger.info('[UploadService] completeUpload success', {
    sessionId,
    s3Key: session.s3Key,
    feature: session.feature,
  });

  const handler = completionHandlers[session.feature];
  if (handler) {
    try {
      await handler(session);
    } catch (error) {
      logger.error('[UploadService] completion handler failed', {
        sessionId,
        feature: session.feature,
        error: error.message,
      });
    }
  }

  return { sessionId, s3Key: session.s3Key, alreadyCompleted: false };
};

/**
 * Aborts an in-progress upload and cleans up the S3-side multipart upload.
 * @param {object} params
 * @returns {Promise<object>}
 */
const abortUpload = async ({ sessionId, uploadedBy }) => {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new AppError('Upload session not found', HTTP.NOT_FOUND);
  if (session.uploadedBy !== uploadedBy) {
    throw new AppError('Not authorized for this upload session', HTTP.FORBIDDEN);
  }
  if (session.status === 'completed') {
    throw new AppError('Cannot abort a completed upload', HTTP.CONFLICT);
  }

  await abortMultipartUpload(session.s3Key, session.s3UploadId);
  session.status = 'aborted';
  await session.save();

  return { sessionId, status: 'aborted' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

const getSessionStatus = async ({ sessionId, uploadedBy }) => {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new AppError('Upload session not found', HTTP.NOT_FOUND);
  if (session.uploadedBy !== uploadedBy) {
    throw new AppError('Not authorized for this upload session', HTTP.FORBIDDEN);
  }

  return {
    sessionId: session._id.toString(),
    status: session.status,
    completedParts: session.parts.length,
    totalParts: session.totalParts,
    fileSize: session.fileSize,
    s3Key: session.s3Key,
  };
};

/**
 * Fetches and verifies a batch of completed upload sessions belonging to a user/feature.
 * @param {object} params
 * @returns {Promise<Array>}
 */
const getCompletedSessions = async ({ sessionIds, uploadedBy, feature }) => {
  if (!sessionIds || sessionIds.length === 0) {
    throw new AppError('sessionIds is required', HTTP.BAD_REQUEST);
  }

  const sessions = await UploadSession.find({ _id: { $in: sessionIds } });

  if (sessions.length !== sessionIds.length) {
    throw new AppError('One or more upload sessions not found', HTTP.NOT_FOUND);
  }

  for (const session of sessions) {
    if (session.uploadedBy !== uploadedBy) {
      throw new AppError('Not authorized for one or more upload sessions', HTTP.FORBIDDEN);
    }
    if (session.feature !== feature) {
      throw new AppError('One or more sessions do not belong to this feature', HTTP.BAD_REQUEST);
    }
    if (session.status !== 'completed') {
      throw new AppError(
        `Session ${session._id} is not completed (status: ${session.status})`,
        HTTP.BAD_REQUEST
      );
    }
  }

  const bySessionId = new Map(sessions.map((s) => [s._id.toString(), s]));
  return sessionIds.map((id) => bySessionId.get(id));
};

module.exports = {
  registerCompletionHandler,
  initiateUpload,
  getPartUrls,
  acknowledgePart,
  completeUpload,
  abortUpload,
  getSessionStatus,
  getCompletedSessions,
};