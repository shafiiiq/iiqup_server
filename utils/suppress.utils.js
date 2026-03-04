// utils/suppress-warnings.js
const SUPPRESSED_WARNINGS = [
  'Duplicate schema index',
  'useNewUrlParser is a deprecated option',
  'useUnifiedTopology is a deprecated option',
];

// ─────────────────────────────────────────────────────────────────────────────
// Suppress known, harmless warnings from Mongoose and MongoDB driver
// ─────────────────────────────────────────────────────────────────────────────

const originalEmit = process.emit.bind(process);

process.emit = function (event, ...args) {
  if (event === 'warning') {
    const warning = args[0];
    const message = warning?.message || String(warning);
    if (SUPPRESSED_WARNINGS.some(w => message.includes(w))) return false;
  }
  return originalEmit(event, ...args);
};