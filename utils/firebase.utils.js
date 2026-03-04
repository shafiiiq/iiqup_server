// utils/firebase.utils.js
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin Initialization (singleton)
// ─────────────────────────────────────────────────────────────────────────────

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('[Firebase] Admin initialized');
}

module.exports = admin;