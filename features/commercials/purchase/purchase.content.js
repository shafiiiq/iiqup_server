const mapItems = (items = []) =>
  items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
  }))

const resolveLatestAmendment = (purchaseorder) =>
  purchaseorder.amendments?.length ? purchaseorder.amendments[purchaseorder.amendments.length - 1] : null

const resolveEffectiveContent = (purchaseorder) => {
  const amendment = resolveLatestAmendment(purchaseorder)
  const company = purchaseorder.company || {}

  return {
    purchaseorderRef: purchaseorder.purchaseorderRef,
    date: purchaseorder.date,
    authorizedSignatoryTitle: purchaseorder.signatures?.authorizedSignatoryTitle ?? null,
    vendor: amendment?.amendedCompany?.vendor ?? company.vendor ?? null,
    attention: amendment?.amendedCompany?.attention ?? company.attention ?? null,
    designation: amendment?.amendedCompany?.designation ?? company.designation ?? null,
    equipments: [...(amendment?.amendedEquipments?.length ? amendment.amendedEquipments : purchaseorder.equipments || [])],
    quoteNo: amendment?.amendedQuoteNo ?? purchaseorder.quoteNo ?? null,
    requestText: amendment?.amendedRequestText ?? purchaseorder.requestText ?? null,
    workingHrs: amendment ? amendment.amendedWorkingHrs ?? null : purchaseorder.workingHrs ?? null,
    runningKm: amendment ? amendment.amendedRunningKm ?? null : purchaseorder.runningKm ?? null,
    items: mapItems(amendment?.amendedItems?.length ? amendment.amendedItems : purchaseorder.items),
    termsAndConditions: [
      ...(amendment?.amendedTermsAndConditions?.length ? amendment.amendedTermsAndConditions : purchaseorder.termsAndConditions || []),
    ],
    discount: amendment ? amendment.amendedDiscount ?? null : purchaseorder.discount ?? null,
    totalAmount: amendment?.amendedTotalAmount ?? purchaseorder.totalDiscountAmount ?? purchaseorder.totalAmount ?? 0,
  }
}

module.exports = { resolveEffectiveContent }