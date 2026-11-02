const { toPlainContent } = require('#core/signature/signature.plain')

const resolveLatestAmendment = (quotation) =>
  quotation.amendments?.length ? quotation.amendments[quotation.amendments.length - 1] : null

const pickAmended = (amendedValue, originalValue, fallbackValue) =>
  amendedValue?.length ? amendedValue : originalValue || fallbackValue

const resolveEffectiveContent = (quotation) => {
  const amendment = resolveLatestAmendment(quotation)
  const company = quotation.company || {}

  return toPlainContent({
    quotationRef: quotation.quotationRef,
    date: quotation.date,
    authorizedSignatoryTitle:
      amendment?.amendedSignatures?.authorizedSignatoryTitle ?? quotation.signatures?.authorizedSignatoryTitle ?? null,
    vendor: amendment?.amendedCompany?.vendor ?? company.vendor ?? null,
    attention: amendment?.amendedCompany?.attention ?? company.attention ?? null,
    designation: amendment?.amendedCompany?.designation ?? company.designation ?? null,
    location: amendment?.amendedLocation ?? quotation.location ?? null,
    customFields: pickAmended(amendment?.amendedCustomFields, quotation.customFields, []),
    requestText: amendment?.amendedRequestText ?? quotation.requestText ?? null,
    noticeText: amendment?.amendedNoticeText ?? quotation.noticeText ?? null,
    priceStatementText: amendment?.amendedPriceStatementText ?? quotation.priceStatementText ?? null,
    contactText: amendment?.amendedContactText ?? quotation.contactText ?? null,
    columns: pickAmended(amendment?.amendedColumns, quotation.columns, []),
    items: pickAmended(amendment?.amendedItems, quotation.items, []),
    termsAndConditions: pickAmended(amendment?.amendedTermsAndConditions, quotation.termsAndConditions, []),
    discount: amendment ? amendment.amendedDiscount ?? null : quotation.discount ?? null,
    totalAmount: amendment?.amendedTotalAmount ?? quotation.totalDiscountAmount ?? quotation.totalAmount ?? 0,
    showTotalRow: amendment?.amendedShowTotalRow ?? quotation.showTotalRow ?? true,
  })
}

module.exports = { resolveEffectiveContent }