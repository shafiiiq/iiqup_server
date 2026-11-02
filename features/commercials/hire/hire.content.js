const { toPlainContent } = require('#core/signature/signature.plain')

const resolveLatestAmendment = (hireOrder) =>
  hireOrder.amendments?.length ? hireOrder.amendments[hireOrder.amendments.length - 1] : null

const pickAmended = (amendedValue, originalValue, fallbackValue) =>
  amendedValue?.length ? amendedValue : originalValue || fallbackValue

const resolveEffectiveContent = (hireOrder) => {
  const amendment = resolveLatestAmendment(hireOrder)
  const company = hireOrder.company || {}

  return toPlainContent({
    hireOrderRef: hireOrder.hireOrderRef,
    date: hireOrder.date,
    authorizedSignatoryTitle: hireOrder.signatures?.authorizedSignatoryTitle ?? null,
    vendor: amendment?.amendedCompany?.vendor ?? company.vendor ?? null,
    attention: amendment?.amendedCompany?.attention ?? company.attention ?? null,
    designation: amendment?.amendedCompany?.designation ?? company.designation ?? null,
    quoteNo: amendment?.amendedQuoteNo ?? hireOrder.quoteNo ?? null,
    requestText: amendment?.amendedRequestText ?? hireOrder.requestText ?? null,
    customFields: pickAmended(amendment?.amendedCustomFields, hireOrder.customFields, []),
    columns: pickAmended(amendment?.amendedColumns, hireOrder.columns, []),
    items: pickAmended(amendment?.amendedItems, hireOrder.items, []),
    termsAndConditions: pickAmended(amendment?.amendedTermsAndConditions, hireOrder.termsAndConditions, []),
    discount: amendment ? amendment.amendedDiscount ?? null : hireOrder.discount ?? null,
    totalAmount: amendment?.amendedTotalAmount ?? hireOrder.totalDiscountAmount ?? hireOrder.totalAmount ?? 0,
    showTotalRow: amendment?.amendedShowTotalRow ?? hireOrder.showTotalRow ?? true,
  })
}

module.exports = { resolveEffectiveContent }