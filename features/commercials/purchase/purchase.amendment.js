const buildAmendmentFields = (updateData) => {
  const amendment = {
    amendmentDate: new Date(),
    amendedBy: updateData.amendedBy || 'System',
    reason: updateData.amendmentReason || 'Amendment requested',
  }

  if (updateData.items?.length > 0) {
    const subtotal = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    const discountAmount = updateData.showDiscountInTotal && updateData.discount ? updateData.discount : 0

    amendment.amendedItems = updateData.items
    amendment.amendedDiscount = discountAmount
    amendment.amendedTotalAmount = subtotal - discountAmount
  }

  if (updateData.company) amendment.amendedCompany = updateData.company
  if (updateData.equipments) amendment.amendedEquipments = updateData.equipments
  if (updateData.workingHrs !== undefined) amendment.amendedWorkingHrs = updateData.workingHrs
  if (updateData.runningKm !== undefined) amendment.amendedRunningKm = updateData.runningKm
  if (updateData.quoteNo) amendment.amendedQuoteNo = updateData.quoteNo
  if (updateData.requestText) amendment.amendedRequestText = updateData.requestText
  if (updateData.termsAndConditions) amendment.amendedTermsAndConditions = updateData.termsAndConditions

  return amendment
}

module.exports = { buildAmendmentFields }