const modelRegistry = {
  maintenance: {
    model: require('#features/fleet/maintenance/maintenance.model'),
    tabLabel: 'Maintenance',
    attachmentFields: [],
    screens: {},
  },
  complaints: {
    model: require('#features/fleet/complaint/complaint.model'),
    tabLabel: 'Complaints',
    attachmentFields: ['mediaFiles'],
    screens: {
      complaintList: { platform: 'app', purpose: 'read', documentParam: 'complaintId' },
    },
  },
  purchaseorders: {
    model: require('#features/commercials/purchase/purchase.model'),
    tabLabel: 'Purchase Orders',
    attachmentFields: [],
    screens: {
      purchaseOrderList: { platform: 'app', purpose: 'read', documentParam: 'purchaseOrderId' },
    },
  },
  hireorders: {
    model: require('#features/commercials/hire/hire.model'),
    tabLabel: 'Hire Orders',
    attachmentFields: [],
    screens: {
      hireOrderList: { platform: 'app', purpose: 'read', documentParam: 'hireOrderId' },
    },
  },
  quotations: {
    model: require('#features/commercials/quotation/quotation.model'),
    tabLabel: 'Quotations',
    attachmentFields: [],
    screens: {
      quotationList: { platform: 'app', purpose: 'read', documentParam: 'quotationId' },
    },
  },
  backcharges: {
    model: require('#features/commercials/backcharge/backcharge.model'),
    tabLabel: 'Backcharges',
    attachmentFields: [],
    screens: {
      backchargeList: { platform: 'app', purpose: 'read', documentParam: 'backchargeId' },
    },
  },
};

const isRegisteredModelKey = (modelKey) => Object.hasOwn(modelRegistry, modelKey);

const getRegistryEntry = (modelKey) => (isRegisteredModelKey(modelKey) ? modelRegistry[modelKey] : null);

const findScreenDefinition = (modelKey, screenKey) => getRegistryEntry(modelKey)?.screens?.[screenKey] || null;

module.exports = { modelRegistry, isRegisteredModelKey, getRegistryEntry, findScreenDefinition };