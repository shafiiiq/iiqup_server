const { USER_ROLES } = require('../../../features/user/staff/staff.constant');

const SERVICE_TYPES = ['oil', 'normal', 'tyre', 'battery', 'major'];
const OIL_SERVICE_TYPES = ['oil', 'normal'];
const CHECKLIST_STATUSES = ['✓', '✗', '--', ''];
const ATTACHMENT_UPLOAD_FEATURE = 'maintenance';
const DASHBOARD_UPDATE_EVENTS = ['serviceHistory', 'serviceReport'];
const NOTIFICATION_SOURCE_KEY = 'maintenance';
const NOTIFICATION_RECIPIENT_ROLES = [
  USER_ROLES.WORKSHOP_MANAGER,
  USER_ROLES.MAINTENANCE_HEAD,
  USER_ROLES.MECHANIC_HEAD,
];

module.exports = {
  SERVICE_TYPES,
  OIL_SERVICE_TYPES,
  CHECKLIST_STATUSES,
  ATTACHMENT_UPLOAD_FEATURE,
  DASHBOARD_UPDATE_EVENTS,
  NOTIFICATION_SOURCE_KEY,
  NOTIFICATION_RECIPIENT_ROLES,
};