const RECENT_LIMIT = 100;

const NOTIFICATION_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const OPERATOR_MOB_ACTIONS = {
  MOBILIZED: 'mobilized',
  DEMOBILIZED: 'demobilized',
  REPLACED: 'replaced',
};

const OPERATOR_MOB_ORIGINS = {
  EQUIPMENT: 'equipment',
  OPERATOR: 'operator',
  REPLACEMENT: 'replacement',
};

const STAFF_MAIN = JSON.parse(process.env.STAFF_MAIN);

module.exports = {
  RECENT_LIMIT,
  NOTIFICATION_PRIORITY,
  OPERATOR_MOB_ACTIONS,
  OPERATOR_MOB_ORIGINS,
  STAFF_MAIN,
};