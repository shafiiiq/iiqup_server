const { resolveDocumentActivitySource } = require('./document.activity.registry');
const { notifyDocumentTasksChanged } = require('./document.task.notification');

const WITHOUT_TIMESTAMP_UPDATE = { timestamps: false };

const markDocumentEmailedToSupplier = async ({ sourceKey, documentId }) => {
  const definition = resolveDocumentActivitySource(sourceKey);
  await definition.model.updateOne(
    { [definition.referenceField]: documentId },
    { $set: { supplierEmailedAt: new Date() } },
    WITHOUT_TIMESTAMP_UPDATE
  );
  notifyDocumentTasksChanged({ sourceKey, documentId });
};

module.exports = { markDocumentEmailedToSupplier };