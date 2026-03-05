// ─────────────────────────────────────────────────────────────────────────────
// Notification Constants
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = [ 
  process.env.MAINTENANCE_HEAD,
  process.env.WORKSHOP_MANAGER,
  process.env.SUPER_ADMIN,
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = { ALLOWED_ROLES, SEVEN_DAYS_MS };
