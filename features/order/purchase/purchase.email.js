const { serviceGmailClient } = require('#shared/email/email.instance');
const { buildEmailFooter } = require('#shared/email/email.layout');

const SIGN_OFF = {
  name: 'FIROZ KHAN .M.A.',
  title: 'Workshop Manager',
  mobile: '+974 51700481',
};

const generatePurchaseOrderTemplate = () => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body>
    <p>Dear Sir,</p>
    <p><strong>Please find the attached Purchase Order for your reference.</strong></p>
    <p><strong>If you need any further details, please don't hesitate to contact our Purchase Manager Mr. Abdul Malik.00974-51700494.</strong></p>
    ${buildEmailFooter(SIGN_OFF)}
  </body>
  </html>
`;

const dispatchPurchaseOrderViaEmail = async (
  toList = [],
  client = '',
  recipientName = '',
  attachments = [],
  equipment = ''
) => {
  if (!toList.length) throw new Error('[Gmail] No recipient email provided');

  const to = toList.join(', ');
  const ccList = JSON.parse(process.env.PurchaseOrder_CC || '[]');
  const cc = ccList.join(', ');

  const subject = `M/S ${client} - MR. ${recipientName} Purchase Order for ${equipment}`;
  const htmlContent = generatePurchaseOrderTemplate();
  const textContent = `Please find the attached Purchase Order for your reference...`;

  return serviceGmailClient.sendEmail(
    to,
    subject,
    htmlContent,
    textContent,
    attachments,
    cc
  );
};

const getAuthorizationUrl = async () => {
  await serviceGmailClient.initialize();
  return serviceGmailClient.getAuthUrl();
};

const exchangeCodeForTokens = async (code) => {
  await serviceGmailClient.initialize();
  return serviceGmailClient.getTokensFromCode(code);
};

module.exports = {
  dispatchPurchaseOrderViaEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generatePurchaseOrderTemplate,
};
