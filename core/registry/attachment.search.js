const ATTACHMENT_DOCUMENT_SEARCH_LIMIT = 10;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildDocumentSearchFilter = ({ term, referenceField, textFields = [], counterField = null }) => {
  const trimmedTerm = String(term || '').trim();
  if (!trimmedTerm) return {};

  const pattern = { $regex: escapeRegex(trimmedTerm), $options: 'i' };
  const conditions = [{ [referenceField]: pattern }, ...textFields.map((field) => ({ [field]: pattern }))];
  if (counterField && /^\d{1,9}$/.test(trimmedTerm)) conditions.push({ [counterField]: Number(trimmedTerm) });

  return { $or: conditions };
};

module.exports = { ATTACHMENT_DOCUMENT_SEARCH_LIMIT, buildDocumentSearchFilter };