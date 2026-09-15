const logger = require('#shared/logger/logger')
const Quotation = require('./quotation.model')
const { buildSignatures, resolveVendorCode, calculateTotal, wrapServiceError } = require('./quotation.helper')
const { notifyQuotationCreated, notifyQuotationSent } = require('./quotation.notification')
const { DEFAULT_TERMS, STATUS } = require('./quotation.constant')

const createQuotation = async (quotationData) => {
  try {
    const totalAmount = calculateTotal(quotationData.items, quotationData.showDiscountInTotal, quotationData.discount)
    const signatures = buildSignatures(quotationData.signatures)
    const { vendorCode, vendorMail } = await resolveVendorCode(quotationData.company.vendor)

    const quotation = new Quotation({
      ...quotationData,
      totalAmount,
      signatures,
      vendorCode,
      vendorMail,
      isAmendmented: false,
      amendments: [],
      status: STATUS.DRAFT,
      termsAndConditions: quotationData.termsAndConditions?.length ? quotationData.termsAndConditions : DEFAULT_TERMS,
    })

    const saved = await quotation.save()

    notifyQuotationCreated(saved.quotationRef, saved.company.vendor).catch((err) =>
      logger.error('[quotation.service] notifyQuotationCreated failed:', err)
    )

    return saved
  } catch (error) {
    throw wrapServiceError('createQuotation', error)
  }
}

const updateQuotation = async (refNo, updateData) => {
  try {
    const existing = await Quotation.findOne({ quotationRef: refNo.trim() })
    if (!existing) throw new Error('Quotation not found')

    if (updateData.isAmendmented === true) {
      const amendment = {
        amendmentDate: new Date(),
        amendedBy: updateData.amendedBy || 'System',
        reason: updateData.amendmentReason || 'Amendment requested',
      }

      if (updateData.items?.length > 0) {
        amendment.amendedItems = updateData.items
        amendment.amendedColumns = updateData.columns || existing.columns
        amendment.amendedTotalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

        if (updateData.showDiscountInTotal && updateData.discount) {
          amendment.amendedTotalAmount -= updateData.discount
          amendment.amendedDiscount = updateData.discount
        }
      }

      if (updateData.company) amendment.amendedCompany = updateData.company
      if (updateData.location) amendment.amendedLocation = updateData.location
      if (updateData.customFields) amendment.amendedCustomFields = updateData.customFields
      if (updateData.requestText) amendment.amendedRequestText = updateData.requestText
      if (updateData.noticeText) amendment.amendedNoticeText = updateData.noticeText
      if (updateData.priceStatementText) amendment.amendedPriceStatementText = updateData.priceStatementText
      if (updateData.contactText) amendment.amendedContactText = updateData.contactText
      if (updateData.termsAndConditions) amendment.amendedTermsAndConditions = updateData.termsAndConditions

      return await Quotation.findOneAndUpdate(
        { quotationRef: refNo.trim() },
        { $set: { isAmendmented: true }, $push: { amendments: amendment } },
        { new: true, runValidators: true }
      )
    }

    if (updateData.items?.length > 0) {
      updateData.totalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    }

    if (updateData.showDiscountInTotal && updateData.discount) {
      updateData.totalAmount = (updateData.totalAmount || 0) - (updateData.discount || 0)
    }

    delete updateData.amendedBy
    delete updateData.amendmentReason

    return await Quotation.findOneAndUpdate({ quotationRef: refNo.trim() }, { $set: updateData }, {
      new: true,
      runValidators: true,
    })
  } catch (error) {
    throw wrapServiceError('updateQuotation', error)
  }
}

const deleteQuotation = async (refNo) => {
  try {
    const quotation = await Quotation.findOneAndDelete({ quotationRef: refNo })
    if (!quotation) throw new Error('Quotation not found')
    return quotation
  } catch (error) {
    throw wrapServiceError('deleteQuotation', error)
  }
}

const saveVendorEmail = async (vendorCode, emails) => {
  try {
    const emailArray = Array.isArray(emails) ? emails : [emails]
    return await Quotation.updateMany({ vendorCode }, { $set: { vendorMail: emailArray } })
  } catch (error) {
    throw wrapServiceError('saveVendorEmail', error)
  }
}

const markQuotationSent = async (refNo, quotationFileData) => {
  try {
    const updated = await Quotation.findOneAndUpdate(
      { quotationRef: refNo },
      { status: STATUS.SENT, quotationFile: quotationFileData },
      { new: true }
    )
    if (!updated) throw new Error('Quotation not found')

    notifyQuotationSent(updated.quotationRef, updated.company.vendor).catch((err) =>
      logger.error('[quotation.service] notifyQuotationSent failed:', err)
    )

    return updated
  } catch (error) {
    throw wrapServiceError('markQuotationSent', error)
  }
}

module.exports = {
  createQuotation,
  updateQuotation,
  deleteQuotation,
  saveVendorEmail,
  markQuotationSent,
}