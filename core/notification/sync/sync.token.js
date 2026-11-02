const crypto = require('crypto');

const SYNC_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

const readSecret = () => {
  const secret = process.env.NOTIFICATION_SYNC_SECRET;
  if (!secret) throw new Error('NOTIFICATION_SYNC_SECRET is required');
  return secret;
};

const signPayload = (encodedPayload) =>
  crypto.createHmac('sha256', readSecret()).update(encodedPayload).digest('base64url');

const createSyncToken = (uniqueCode) => {
  const expiresAt = Math.floor(Date.now() / 1000) + SYNC_TOKEN_LIFETIME_SECONDS;
  const encodedPayload = Buffer.from(JSON.stringify({ uniqueCode, expiresAt })).toString('base64url');
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
};

const verifySyncToken = (token) => {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = Buffer.from(signPayload(encodedPayload));
  const receivedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== receivedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.uniqueCode || payload.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

module.exports = { createSyncToken, verifySyncToken };