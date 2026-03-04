// ─────────────────────────────────────────────────────────────────────────────
// Equipment Constants
// ─────────────────────────────────────────────────────────────────────────────

const EQUIPMENT_STATUSES = ['idle', 'active', 'maintenance', 'loading', 'going', 'leased'];

const HIRED_FILTER = {
  HIRED: 'hired',
  OWN:   'own'
};

const DEPLOY_TYPES = {
  SITE:    'site',
  COMPANY: 'company'
};

const NOTIFICATION_PRIORITY = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low'
};

const NOTIFICATION_TYPE = {
  NORMAL: 'normal'
};

const REPLACEMENT_TYPES = {
  OPERATOR:  'operator',
  EQUIPMENT: 'equipment'
};

const DEFAULT_PAGE_LIMITS = {
  FETCH:        20,
  MOBILIZATION: 100,
  REPLACEMENT:  100,
  FILTERED:     500
};

const INVALID_OPERATOR_VALUES = new Set(['Not Assigned', '', 'undefined', null, undefined]);

module.exports = {
  EQUIPMENT_STATUSES,
  HIRED_FILTER,
  DEPLOY_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  REPLACEMENT_TYPES,
  DEFAULT_PAGE_LIMITS,
  INVALID_OPERATOR_VALUES
};