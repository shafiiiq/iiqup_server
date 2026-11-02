const { MOBILIZATION_ACTIONS } = require('../mobilization/mobilization.constant');
const { REPLACEMENT_TYPES } = require('../replacement/replacement.constant');
const { OPERATOR_MOB_ORIGINS } = require('#features/user/operator/mobilization/operator.mobilization.constant');

const ACTIVITY_DEFAULT_LIMIT = 20;
const ACTIVITY_MAX_LIMIT = 50;
const ACTIVITY_SORT_FIELD = 'date';

const ACTIVITY_SOURCES = {
  MOBILIZATION: 'mobilization',
  REPLACEMENT: 'replacement',
  OPERATOR: 'operator',
};

const ACTIVITY_TABS = {
  ALL: 'all',
  MOBILIZATION: 'mobilization',
  DEMOBILIZATION: 'demobilization',
  EQUIPMENT_REPLACEMENT: 'equipment-replacement',
  OPERATOR_REPLACEMENT: 'operator-replacement',
  OPERATOR_ONLY: 'operator-only',
  STATUS_CHANGES: 'status-changes',
};

const TAB_SOURCE_QUERIES = {
  [ACTIVITY_TABS.ALL]: [
    {
      source: ACTIVITY_SOURCES.MOBILIZATION,
      query: {
        action: {
          $in: [
            MOBILIZATION_ACTIONS.MOBILIZED,
            MOBILIZATION_ACTIONS.DEMOBILIZED,
            MOBILIZATION_ACTIONS.STATUS_CHANGED,
          ],
        },
      },
    },
    {
      source: ACTIVITY_SOURCES.REPLACEMENT,
      query: { type: { $in: [REPLACEMENT_TYPES.EQUIPMENT, REPLACEMENT_TYPES.OPERATOR] } },
    },
    { source: ACTIVITY_SOURCES.OPERATOR, query: { origin: OPERATOR_MOB_ORIGINS.OPERATOR } },
  ],
  [ACTIVITY_TABS.MOBILIZATION]: [
    { source: ACTIVITY_SOURCES.MOBILIZATION, query: { action: MOBILIZATION_ACTIONS.MOBILIZED } },
  ],
  [ACTIVITY_TABS.DEMOBILIZATION]: [
    { source: ACTIVITY_SOURCES.MOBILIZATION, query: { action: MOBILIZATION_ACTIONS.DEMOBILIZED } },
  ],
  [ACTIVITY_TABS.EQUIPMENT_REPLACEMENT]: [
    { source: ACTIVITY_SOURCES.REPLACEMENT, query: { type: REPLACEMENT_TYPES.EQUIPMENT } },
  ],
  [ACTIVITY_TABS.OPERATOR_REPLACEMENT]: [
    { source: ACTIVITY_SOURCES.REPLACEMENT, query: { type: REPLACEMENT_TYPES.OPERATOR } },
  ],
  [ACTIVITY_TABS.OPERATOR_ONLY]: [
    { source: ACTIVITY_SOURCES.OPERATOR, query: { origin: OPERATOR_MOB_ORIGINS.OPERATOR } },
  ],
  [ACTIVITY_TABS.STATUS_CHANGES]: [
    { source: ACTIVITY_SOURCES.MOBILIZATION, query: { action: MOBILIZATION_ACTIONS.STATUS_CHANGED } },
  ],
};

module.exports = {
  ACTIVITY_DEFAULT_LIMIT,
  ACTIVITY_MAX_LIMIT,
  ACTIVITY_SORT_FIELD,
  ACTIVITY_SOURCES,
  ACTIVITY_TABS,
  TAB_SOURCE_QUERIES,
};