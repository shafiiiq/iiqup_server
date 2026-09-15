const logger = require('#shared/logger/logger');
const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const UploadSession = require('./upload.model');
const {
  createMultipartUpload,
  getUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} = require('#core/s3/s3.config');
const { MAX_FILE_SIZE, PART_URL_BATCH_SIZE } = require('./upload.config');
const { sanitizeFileName, buildS3Key, calculatePartPlan } = require('./upload.helper');

const completionHandlers = {};

const registerCompletionHandler = (feature, handlerFn) => {
  completionHandlers[feature] = handlerFn;
};

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

  logger.info('[upload.service] initiateUpload', {
    sessionId: session._id.toString(),
    feature,
    s3Key,
    totalParts,
  });

  return { sessionId: session._id.toString(), s3Key, partSize, totalParts };
};

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
    logger.error('[upload.service] completeUpload S3 failure', { sessionId, error: error.message });
    throw new AppError('Failed to finalize upload on S3', HTTP.INTERNAL_SERVER_ERROR);
  }

  session.status = 'completed';
  session.completedAt = new Date();
  session.parts = finalParts;
  await session.save();

  logger.info('[upload.service] completeUpload success', {
    sessionId,
    s3Key: session.s3Key,
    feature: session.feature,
  });

  const handler = completionHandlers[session.feature];
  if (handler) {
    try {
      await handler(session);
    } catch (error) {
      logger.error('[upload.service] completion handler failed', {
        sessionId,
        feature: session.feature,
        error: error.message,
      });
    }
  }

  return { sessionId, s3Key: session.s3Key, alreadyCompleted: false };
};

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