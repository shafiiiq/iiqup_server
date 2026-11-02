const Quotation = require('./quotation.model')
const { buildSignatures, resolveVendorCode, resolveTotal, wrapServiceError } = require('./quotation.helper')
const { DEFAULT_TERMS, STATUS } = require('./quotation.constant')

const createQuotation = async (quotationData) => {
  try {
    const totalAmount = resolveTotal(quotationData.items, quotationData.showDiscountInTotal, quotationData.discount, quotationData.manualTotal)
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

    return await quotation.save()
  } catch (error) {
    throw wrapServiceError('createQuotation', error)
  }
}

const buildAmendmentFields = (updateData, existing) => {
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
  if (updateData.manualTotal != null) amendment.amendedTotalAmount = updateData.manualTotal
  amendment.amendedManualTotal = updateData.manualTotal ?? null
  amendment.amendedShowTotalRow = updateData.showTotalRow ?? true
  if (updateData.signatures) amendment.amendedSignatures = updateData.signatures

  return amendment
}
const updateQuotation = async (refNo, updateData) => {
  try {
    const existing = await Quotation.findOne({ quotationRef: refNo.trim() })
    if (!existing) throw new Error('Quotation not found')

    if (updateData.isAmendmented === true && updateData.editLastAmendment === true) {
      const lastIndex = existing.amendments.length - 1
      if (lastIndex < 0) throw new Error('No amendment exists to edit')

      const previous = existing.amendments[lastIndex].toObject()
      const amendment = { ...previous, ...buildAmendmentFields(updateData, existing), amendmentDate: previous.amendmentDate }

      return await Quotation.findOneAndUpdate(
        { quotationRef: refNo.trim() },
        { $set: { [`amendments.${lastIndex}`]: amendment } },
        { new: true, runValidators: true }
      )
    }

    if (updateData.isAmendmented === true) {
      const amendment = buildAmendmentFields(updateData, existing)

      return await Quotation.findOneAndUpdate(
        { quotationRef: refNo.trim() },
        { $set: { isAmendmented: true, authorizedSigned: false }, $push: { amendments: amendment } },
        { new: true, runValidators: true }
      )
    }

    if (updateData.items?.length > 0) {
      updateData.totalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    }

    if (updateData.showDiscountInTotal && updateData.discount) {
      updateData.totalAmount = (updateData.totalAmount || 0) - (updateData.discount || 0)
    }

    if (updateData.manualTotal != null) updateData.totalAmount = updateData.manualTotal

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

    return updated
  } catch (error) {
    throw wrapServiceError('markQuotationSent', error)
  }
}

const getPendingSignatures = async (uniqueCode) => {
  try {
    const isCeo = Boolean(process.env.CEO) && process.env.CEO === uniqueCode
    const isMd = Boolean(process.env.MD) && process.env.MD === uniqueCode
    if (!isCeo && !isMd) return []

    return await Quotation.find({
      authorizedSigned: { $ne: true },
      'signatures.authorizedSignatoryTitle': isMd ? 'MANAGING DIRECTOR' : { $ne: 'MANAGING DIRECTOR' },
    })
      .select('-items.image')
      .sort({ createdAt: -1 })
      .lean()
  } catch (error) {
    throw wrapServiceError('getPendingSignatures', error)
  }
}

module.exports = {
  getPendingSignatures,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  saveVendorEmail,
  markQuotationSent,
}