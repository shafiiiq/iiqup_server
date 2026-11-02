const maintenanceModel = require('#features/fleet/maintenance/maintenance.model');
const mobilizationModel = require('#features/fleet/mobilization/mobilization.model');
const purchaseOrderModel = require('#features/commercials/purchase/purchase.model');
const backchargeModel = require('#features/commercials/backcharge/backcharge.model');
const hireOrderModel = require('#features/commercials/hire/hire.model');
const quotationModel = require('#features/commercials/quotation/quotation.model');

const DIRECTION = { GROWTH: 'growth', LOSS: 'loss', NEUTRAL: 'neutral' };

const createFilteredModel = (baseModel, filterField, filterValue) => ({
  schema: baseModel.schema,

  countDocuments: (extraQuery = {}) =>
    baseModel.countDocuments({ [filterField]: filterValue, ...extraQuery }),

  aggregate: (pipeline = []) =>
    baseModel.aggregate([{ $match: { [filterField]: filterValue } }, ...pipeline]),

  find: (extraQuery = {}, projection = null) => {
    let sortSpec = { createdAt: -1 };
    let limitCount = 0;
    let skipCount = 0;
    let leanEnabled = false;

    const chain = {
      sort: (spec) => { sortSpec = spec; return chain; },
      limit: (count) => { limitCount = count; return chain; },
      skip: (count) => { skipCount = count; return chain; },
      lean: () => { leanEnabled = true; return chain; },
      then: (resolve, reject) => {
        let query = baseModel.find({ [filterField]: filterValue, ...extraQuery }, projection).sort(sortSpec);
        if (skipCount) query = query.skip(skipCount);
        if (limitCount) query = query.limit(limitCount);
        if (leanEnabled) query = query.lean();
        return query.then(resolve, reject);
      },
    };

    return chain;
  },
});

const REGISTRY = [
  
  { key: 'mobilized', label: 'Mobilized', direction: DIRECTION.GROWTH, model: createFilteredModel(mobilizationModel, 'action', 'mobilized') },
  { key: 'demobilized', label: 'Demobilized', direction: DIRECTION.LOSS, model: createFilteredModel(mobilizationModel, 'action', 'demobilized') },
  
  { key: 'quotation', label: 'Quotations', direction: DIRECTION.GROWTH, model: quotationModel },
  { key: 'purchaseorder', label: 'Purchase Order', direction: DIRECTION.LOSS, model: purchaseOrderModel },
  { key: 'backcharge', label: 'Backcharge', direction: DIRECTION.GROWTH, model: backchargeModel },
  { key: 'hireorder', label: 'Hire Order', direction: DIRECTION.GROWTH, model: hireOrderModel },

  { key: 'oilService', label: 'Oil Service', direction: DIRECTION.LOSS, model: createFilteredModel(maintenanceModel, 'serviceType', 'oil') },
  { key: 'normalService', label: 'Normal Service', direction: DIRECTION.LOSS, model: createFilteredModel(maintenanceModel, 'serviceType', 'normal') },
  { key: 'tyreService', label: 'Tyre Service', direction: DIRECTION.LOSS, model: createFilteredModel(maintenanceModel, 'serviceType', 'tyre') },
  { key: 'batteryService', label: 'Battery Service', direction: DIRECTION.LOSS, model: createFilteredModel(maintenanceModel, 'serviceType', 'battery') },
  { key: 'majorService', label: 'Major Service', direction: DIRECTION.LOSS, model: createFilteredModel(maintenanceModel, 'serviceType', 'major') },
];

module.exports = { REGISTRY, DIRECTION };
