const HTTP = require('#shared/response/response.status');
const documentModel = require('./document.model');
const { RENEWAL_STATUS, serializeDocument, createLocationLabelResolver } = require('./document.helper');

const EXPIRY_HORIZON_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRY_RESULT_LIMIT = 2000;

const getExpiryTracking = async () => {
  const horizon = new Date(Date.now() + EXPIRY_HORIZON_DAYS * MILLISECONDS_PER_DAY);
  const documents = await documentModel
    .find({
      deletedAt: null,
      expiryDate: { $ne: null, $lte: horizon },
      renewalStatus: { $ne: RENEWAL_STATUS.EXPIRED },
    })
    .sort({ expiryDate: 1 })
    .limit(EXPIRY_RESULT_LIMIT)
    .lean();

  const resolveLocationLabel = createLocationLabelResolver();
  const data = await Promise.all(
    documents.map(async (documentItem) => ({
      ...(await serializeDocument(documentItem)),
      locationLabel: await resolveLocationLabel(documentItem.sourceType, documentItem.sourceId),
    }))
  );

  return { status: HTTP.OK, message: 'Expiry tracking retrieved', data };
};

module.exports = { getExpiryTracking };