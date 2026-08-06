// shared/email/index.js
const { serviceGmailClient, operationsGmailClient } = require('./client/gmail.instance');
const GmailClient = require('./client/gmail.client');
const { buildEmailFooter, buildSignOff, buildSignatureBlock } = require('./templates/email.layout');
const { MONTH_NAMES, formatDate, renderLocation, formatTime, loadImageAsBase64, getMimeType } = require('./helpers/email.helper');
const { GMAIL_SCOPES, GMAIL_ACCOUNTS } = require('./constants/email.constant');

module.exports = {
  serviceGmailClient,
  operationsGmailClient,
  GmailClient,
  buildEmailFooter,
  buildSignOff,
  buildSignatureBlock,
  MONTH_NAMES,
  formatDate,
  renderLocation,
  formatTime,
  loadImageAsBase64,
  getMimeType,
  GMAIL_SCOPES,
  GMAIL_ACCOUNTS,
};