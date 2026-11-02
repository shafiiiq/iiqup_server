const { toPlainContent } = require('#core/signature/signature.plain')

const resolveEffectiveContent = (backcharge) =>
  toPlainContent({
    refNo: backcharge.refNo,
    date: backcharge.date,
    workDate: backcharge.workDate,
    equipmentType: backcharge.equipmentType,
    plateNo: backcharge.plateNo,
    model: backcharge.model,
    supplierName: backcharge.supplierName,
    contactPerson: backcharge.contactPerson,
    siteLocation: backcharge.siteLocation,
    scopeOfWork: backcharge.scopeOfWork?.combinedText ?? '',
    workshopComments: backcharge.workshopComments?.combinedText ?? '',
    sparePartsTable: backcharge.sparePartsTable || [],
    costSummary: backcharge.costSummary || {},
    authorizedSignatoryMode: backcharge.signatures?.authorizedSignatory?.authorizedSignatoryMode ?? 'CEO',
  })

module.exports = { resolveEffectiveContent }