const { serviceGmailClient } = require('#shared/email/email.instance')
const { buildEmailFooter } = require('#shared/email/email.layout')

const SIGN_OFF = {
  name: 'AHAMMED KAMAL',
  title: 'CEO',
  mobile: '+974 51700481',
}

const generateQuotationTemplate = () => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body>
    <p>Dear Sir,</p>
    <p><strong>Please find the attached Quotation for your reference.</strong></p>
    <p><strong>If you need any further details, please don't hesitate to contact us.</strong></p>
    ${buildEmailFooter(SIGN_OFF)}
  </body>
  </html>
`

const sendQuotationViaEmail = async (toList = [], client = '', recipientName = '', attachments = []) => {
  if (!toList.length) throw new Error('[Gmail] No recipient email provided')

  const to = toList.join(', ')
  const ccList = JSON.parse(process.env.QUOTATION_CC || '[]')
  const cc = ccList.join(', ')

  const subject = `M/S ${client} - MR. ${recipientName} Quotation`
  const htmlContent = generateQuotationTemplate()
  const textContent = `Please find the attached Quotation for your reference...`

  return serviceGmailClient.sendEmail(to, subject, htmlContent, textContent, attachments, cc)
}

module.exports = {
  sendQuotationViaEmail,
  generateQuotationTemplate,
}