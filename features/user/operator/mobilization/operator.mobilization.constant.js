const RECENT_LIMIT = 100;

const NOTIFICATION_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const OPERATOR_MOB_ACTIONS = {
  MOBILIZED: 'mobilized',
  DEMOBILIZED: 'demobilized',
};

const STAFF_MAIN = JSON.parse(process.env.STAFF_MAIN);

module.exports = {
  RECENT_LIMIT,
  NOTIFICATION_PRIORITY,
  OPERATOR_MOB_ACTIONS,
  STAFF_MAIN,
};