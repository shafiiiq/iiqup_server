// ─── Model Registry ───────────────────────────────────────────────────────────

const serviceReportModel = require('../../equipment/report/report.model');
const stocksModel = require('../../stock/stock.model');
const equipmentModel = require('../../equipment/equipment.model');
const toolkitModel = require('../../toolkit/toolkit.model');
const complaintModel = require('../../complaint/complaint.model');
const mobilizationModel = require('../../equipment/mobilization/mobilizations.model');
const replacementModel = require('../../equipment/replacement/replacement.model');
const lpoModel = require('../../lpo/lpo.model');
const backchargeModel = require('../../backcharge/backcharge.model');
const documentModel = require('../../document/document.model');

// ─────────────────────────────────────────────────────────────────────────────
// Filtered model factory
// Wraps a real Mongoose model with a fixed filter field + value.
// Exposes the same interface the analyser uses:
//   .countDocuments(query)
//   .find(query).sort().limit().skip().lean()
//   .schema.paths
// ─────────────────────────────────────────────────────────────────────────────

const createFilteredModel = (baseModel, filterField, filterValue) => ({
  schema: baseModel.schema,

  countDocuments: (extraQuery = {}) =>
    baseModel.countDocuments({ [filterField]: filterValue, ...extraQuery }),

  find: (extraQuery = {}) => {
    let _sort = { createdAt: -1 };
    let _limit = 0;
    let _skip = 0;
    let _lean = false;

    const chain = {
      sort: (s) => {
        _sort = s;
        return chain;
      },
      limit: (n) => {
        _limit = n;
        return chain;
      },
      skip: (n) => {
        _skip = n;
        return chain;
      },
      lean: () => {
        _lean = true;
        return chain;
      },
      then: (resolve, reject) => {
        let q = baseModel
          .find({ [filterField]: filterValue, ...extraQuery })
          .sort(_sort);
        if (_skip) q = q.skip(_skip);
        if (_limit) q = q.limit(_limit);
        if (_lean) q = q.lean();
        return q.then(resolve, reject);
      },
    };

    return chain;
  },
});

// ─── Registry ────────────────────────────────────────────────────────────────

const REGISTRY = [
  // ── serviceReportModel split by serviceType ───────────────────────────────
  {
    model: createFilteredModel(serviceReportModel, 'serviceType', 'oil'),
    key: 'oilService',
    label: 'Oil Service',
  },
  {
    model: createFilteredModel(serviceReportModel, 'serviceType', 'normal'),
    key: 'normalService',
    label: 'Normal Service',
  },
  {
    model: createFilteredModel(serviceReportModel, 'serviceType', 'tyre'),
    key: 'tyreService',
    label: 'Tyre Service',
  },
  {
    model: createFilteredModel(serviceReportModel, 'serviceType', 'battery'),
    key: 'batteryService',
    label: 'Battery Service',
  },
  {
    model: createFilteredModel(serviceReportModel, 'serviceType', 'major'),
    key: 'majorService',
    label: 'Major Service',
  },

  // ── mobilizationModel split by action ─────────────────────────────────────
  {
    model: createFilteredModel(mobilizationModel, 'action', 'mobilized'),
    key: 'mobilized',
    label: 'Mobilized',
  },
  {
    model: createFilteredModel(mobilizationModel, 'action', 'demobilized'),
    key: 'demobilized',
    label: 'Demobilized',
  },
  {
    model: createFilteredModel(mobilizationModel, 'action', 'status_changed'),
    key: 'statusChanged',
    label: 'Status Changed',
  },

  // ── replacementModel split by type ────────────────────────────────────────
  {
    model: createFilteredModel(replacementModel, 'type', 'operator'),
    key: 'operatorReplacement',
    label: 'Operator Replacement',
  },
  {
    model: createFilteredModel(replacementModel, 'type', 'site'),
    key: 'siteReplacement',
    label: 'Site Replacement',
  },
  {
    model: createFilteredModel(replacementModel, 'type', 'equipment'),
    key: 'equipmentReplacement',
    label: 'Equipment Replacement',
  },

  // ── other models ──────────────────────────────────────────────────────────
  { model: equipmentModel, key: 'equipment', label: 'Equipment' },
  { model: stocksModel, key: 'stocks', label: 'Stocks' },
  { model: toolkitModel, key: 'toolkit', label: 'Toolkit' },
  { model: complaintModel, key: 'complaints', label: 'Complaints' },
  { model: lpoModel, key: 'lpo', label: 'LPO' },
  { model: backchargeModel, key: 'backcharge', label: 'Backcharge' },
  { model: documentModel, key: 'document', label: 'Documents' },
];

// ─── Schema introspection ─────────────────────────────────────────────────────

const getSchemaMap = () => {
  const map = {};
  for (const { model, key, label } of REGISTRY) {
    const paths = model.schema.paths;
    map[key] = {
      label,
      fields: Object.entries(paths)
        .filter(([path]) => !['__v', '_id'].includes(path))
        .map(([path, schemaType]) => ({
          path,
          type: schemaType.instance || typeof schemaType.defaultValue,
        })),
    };
  }
  return map;
};

module.exports = { REGISTRY, getSchemaMap };
