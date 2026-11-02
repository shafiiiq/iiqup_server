const mobilizationModel = require('../mobilization/mobilization.model');
const replacementModel = require('../replacement/replacement.model');
const operatorMobilizationModel = require('#features/user/operator/mobilization/operator.mobilization.model');

const { ACTIVITY_SOURCES } = require('./activity.constant');
const { formatMobilizationActivity } = require('./activity.mobilization.formatter');
const { formatReplacementActivity } = require('./activity.replacement.formatter');
const { formatOperatorActivity } = require('./activity.operator.formatter');
const {
  fetchMobilizationContext,
  fetchReplacementContext,
  fetchOperatorContext,
} = require('./activity.context');

const ACTIVITY_SOURCE_REGISTRY = {
  [ACTIVITY_SOURCES.MOBILIZATION]: {
    model: mobilizationModel,
    format: formatMobilizationActivity,
    fetchContext: fetchMobilizationContext,
    searchFields: [
      'regNo',
      'machine',
      'site',
      'clientCompany',
      'operator',
      'hiredFrom',
      'remarks',
      'operators.operatorName',
      'previousOperators.operatorName',
    ],
  },
  [ACTIVITY_SOURCES.REPLACEMENT]: {
    model: replacementModel,
    format: formatReplacementActivity,
    fetchContext: fetchReplacementContext,
    searchFields: [
      'regNo',
      'machine',
      'site',
      'currentOperator',
      'replacedOperator',
      'outgoingOperator',
      'incomingOperator',
      'replacedEquipmentRegNo',
      'replacedEquipmentMachine',
      'newSiteForReplaced',
      'hiredFrom',
      'remarks',
    ],
  },
  [ACTIVITY_SOURCES.OPERATOR]: {
    model: operatorMobilizationModel,
    format: formatOperatorActivity,
    fetchContext: fetchOperatorContext,
    searchFields: [
      'operatorName',
      'qatarId',
      'regNo',
      'machine',
      'site',
      'clientCompany',
      'designation',
      'hiredFrom',
      'outgoingOperatorName',
      'incomingOperatorName',
      'remarks',
    ],
  },
};

module.exports = { ACTIVITY_SOURCE_REGISTRY };