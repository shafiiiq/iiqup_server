const { notifyUsers } = require('#shared/notify/notify.user')
const { staffMainRecipients } = require('./quotation.constant')

const notifyQuotationCreated = (quotationRef, vendor) =>
  notifyUsers(staffMainRecipients(), {
    priority: 'normal',
    title: `Quotation ${quotationRef} Created`,
    description: `Quotation ${quotationRef} created for ${vendor}.`,
    sourceId: 'quotation_created',
  })

const notifyQuotationSent = (quotationRef, vendor) =>
  notifyUsers(staffMainRecipients(), {
    priority: 'normal',
    title: `Quotation ${quotationRef} Sent`,
    description: `Quotation ${quotationRef} sent to ${vendor}.`,
    sourceId: 'quotation_sent',
  })

module.exports = {
  notifyQuotationCreated,
  notifyQuotationSent,
}