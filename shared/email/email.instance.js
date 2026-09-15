// shared/gmail/gmail.instances.js
const GmailClient = require('./email.client');
const { GMAIL_ACCOUNTS } = require('./email.constant');
const { MONTH_NAMES, formatDate, renderLocation } = require('./email.helper');
const { buildEmailFooter } = require('./email.layout');

// ─────────────────────────────────────────────────────────────────────────────
// Shared Singleton Instances
// ─────────────────────────────────────────────────────────────────────────────

const serviceGmailClient = new GmailClient(GMAIL_ACCOUNTS.SERVICE);
const operationsGmailClient = new GmailClient(GMAIL_ACCOUNTS.OPERATIONS);

module.exports = {
	serviceGmailClient,
	operationsGmailClient,
	MONTH_NAMES,
	formatDate,
	renderLocation,
	buildEmailFooter,
};