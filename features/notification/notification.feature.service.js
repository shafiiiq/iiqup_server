const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { attachmentRegistry } = require('#core/registry/attachment.registry');

const MAX_FEATURE_LINKS = 5;

const getDefinition = (featureKey) => {
  const definition = attachmentRegistry[featureKey];
  if (!definition) throw new AppError('Unknown feature', HTTP.BAD_REQUEST);
  return definition;
};

const listAttachmentFeatures = () =>
  Object.entries(attachmentRegistry).map(([key, definition]) => ({
    key,
    label: definition.label,
    icon: definition.icon,
    keywords: definition.keywords || [],
    identifierLabel: definition.identifier.label,
    placeholder: definition.identifier.placeholder,
  }));

const buildFeatureLinkFromDocument = (featureKey, document, identifier) => {
  const definition = getDefinition(featureKey);
  const described = definition.describe(document);
  return {
    featureKey,
    label: definition.label,
    identifier: identifier ?? described.reference,
    reference: described.reference,
    title: described.title,
    subtitle: described.subtitle,
    screenKey: definition.screenKey,
    modelKey: definition.modelKey,
    pdfPath: definition.pdfPath(document),
  };
};

const resolveFeatureLink = async ({ featureKey, identifier }) => {
  const definition = getDefinition(featureKey);
  const value = String(identifier || '').trim();
  if (!new RegExp(definition.identifier.pattern).test(value)) {
    throw new AppError(`Enter a valid ${definition.identifier.label}`, HTTP.BAD_REQUEST);
  }

  const document = await definition.findDocument(value);
  if (!document) throw new AppError(`${definition.label} ${value} not found`, HTTP.NOT_FOUND);

  return buildFeatureLinkFromDocument(featureKey, document, value);
};

const searchFeatureDocuments = async ({ featureKey, term }) => {
  const definition = getDefinition(featureKey);
  const documents = await definition.listDocuments(term);
  return documents.map((document) => ({
    link: buildFeatureLinkFromDocument(featureKey, document, definition.identifierOf(document)),
    details: definition.describeDetails(document),
  }));
};

const resolveFeatureLinks = (inputs = []) =>
  Promise.all((Array.isArray(inputs) ? inputs : []).slice(0, MAX_FEATURE_LINKS).map(resolveFeatureLink));

module.exports = {
  listAttachmentFeatures,
  buildFeatureLinkFromDocument,
  resolveFeatureLink,
  resolveFeatureLinks,
  searchFeatureDocuments,
};