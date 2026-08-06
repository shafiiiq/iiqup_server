// ─────────────────────────────────────────────────────────────────────────────
// Email Constants
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Account Configs (used by shared/gmail/gmail.client.js)
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_ACCOUNTS = {
  SERVICE: {
    refreshTokenEnv: 'SERVICE_GMAIL_REFRESH_TOKEN',
    clientIdEnv: 'SERVICE_GOOGLE_CLIENT_ID',
    clientSecretEnv: 'SERVICE_GOOGLE_CLEINT_SECRET',
    mailerEnv: 'SERVICE_OTP_MAILER',
    fromName: 'SERVICE AL ANSARI TRANSPORT',
    encodeSubject: false,
  },
  OPERATIONS: {
    refreshTokenEnv: 'OPERATIONS_GMAIL_REFRESH_TOKEN',
    clientIdEnv: 'OPERATIONS_GOOGLE_CLIENT_ID',
    clientSecretEnv: 'OPERATIONS_GOOGLE_CLEINT_SECRET',
    mailerEnv: 'OPERATIONS_MAILER',
    fromName: 'SALIH K. BASHEER',
    encodeSubject: true,
  },
};

module.exports = { GMAIL_SCOPES, GMAIL_ACCOUNTS };