const admin = require('firebase-admin');
const logger = require('#shared/logger/logger');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  logger.info('[firebase.utils] Admin initialized');
}

module.exports = admin;
