const serviceReportModel = require('#features/equipment/report/report.model');
const stocksModel = require('#features/stock/parts/parts.model');
const equipmentModel = require('#features/equipment/equipment.model');
const toolkitModel = require('#features/stock/toolkit/toolkit.model');
const complaintModel = require('#features/complaint/complaint.model');
const mobilizationModel = require('#features/equipment/mobilization/mobilization.model');
const replacementModel = require('#features/equipment/replacement/replacement.model');
const lpoModel = require('#features/order/purchase/purchase.model');
const backchargeModel = require('#features/backcharge/backcharge.model');
const documentModel = require('#features/document/document.model');

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
  { key: 'oilService', label: 'Oil Service', direction: DIRECTION.LOSS, model: createFilteredModel(serviceReportModel, 'serviceType', 'oil') },
  { key: 'normalService', label: 'Normal Service', direction: DIRECTION.LOSS, model: createFilteredModel(serviceReportModel, 'serviceType', 'normal') },
  { key: 'tyreService', label: 'Tyre Service', direction: DIRECTION.LOSS, model: createFilteredModel(serviceReportModel, 'serviceType', 'tyre') },
  { key: 'batteryService', label: 'Battery Service', direction: DIRECTION.LOSS, model: createFilteredModel(serviceReportModel, 'serviceType', 'battery') },
  { key: 'majorService', label: 'Major Service', direction: DIRECTION.LOSS, model: createFilteredModel(serviceReportModel, 'serviceType', 'major') },

  { key: 'mobilized', label: 'Mobilized', direction: DIRECTION.GROWTH, model: createFilteredModel(mobilizationModel, 'action', 'mobilized') },
  { key: 'demobilized', label: 'Demobilized', direction: DIRECTION.LOSS, model: createFilteredModel(mobilizationModel, 'action', 'demobilized') },
  { key: 'statusChanged', label: 'Status Changed', direction: DIRECTION.NEUTRAL, model: createFilteredModel(mobilizationModel, 'action', 'status_changed') },

  { key: 'operatorReplacement', label: 'Operator Replacement', direction: DIRECTION.LOSS, model: createFilteredModel(replacementModel, 'type', 'operator') },
  { key: 'siteReplacement', label: 'Site Replacement', direction: DIRECTION.LOSS, model: createFilteredModel(replacementModel, 'type', 'site') },
  { key: 'equipmentReplacement', label: 'Equipment Replacement', direction: DIRECTION.LOSS, model: createFilteredModel(replacementModel, 'type', 'equipment') },

  { key: 'equipment', label: 'Equipment', direction: DIRECTION.GROWTH, model: equipmentModel },
  { key: 'stocks', label: 'Stocks', direction: DIRECTION.GROWTH, model: stocksModel },
  { key: 'toolkit', label: 'Toolkit', direction: DIRECTION.GROWTH, model: toolkitModel },
  { key: 'complaints', label: 'Complaints', direction: DIRECTION.LOSS, model: complaintModel },
  { key: 'lpo', label: 'LPO', direction: DIRECTION.LOSS, model: lpoModel },
  { key: 'backcharge', label: 'Backcharge', direction: DIRECTION.GROWTH, model: backchargeModel },
  { key: 'document', label: 'Documents', direction: DIRECTION.NEUTRAL, model: documentModel },
];

module.exports = { REGISTRY, DIRECTION };
