// shared/gmail/gmail.instances.js
const GmailClient = require('./gmail.client');
const { GMAIL_ACCOUNTS } = require('../constants/email.constant');

// ─────────────────────────────────────────────────────────────────────────────
// Shared Singleton Instances
// ─────────────────────────────────────────────────────────────────────────────

const serviceGmailClient = new GmailClient(GMAIL_ACCOUNTS.SERVICE);
const operationsGmailClient = new GmailClient(GMAIL_ACCOUNTS.OPERATIONS);

module.exports = { serviceGmailClient, operationsGmailClient };