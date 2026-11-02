const PurchaseOrder = require('#features/commercials/purchase/purchase.model');
const HireOrder = require('#features/commercials/hire/hire.model');
const Quotation = require('#features/commercials/quotation/quotation.model');
const Backcharge = require('#features/commercials/backcharge/backcharge.model');
const { buildDocumentSearchFilter, ATTACHMENT_DOCUMENT_SEARCH_LIMIT } = require('./attachment.search');
const { formatQarAmount, humanizeStatus } = require('./attachment.detail');
const { readTrailingNumber } = require('./attachment.identifier');

const NUMBER_IDENTIFIER_PATTERN = '^\\d{1,9}$';

const buildTrailingNumberPattern = (number) => `-0*${number}$`;
const attachmentRegistry = {
  purchase_order: {
    label: 'Purchase Order',
    icon: 'document-text-outline',
    keywords: ['po', 'purchase', 'order'],
    identifier: { label: 'PO number', placeholder: 'e.g. 123', pattern: '^\\d{1,9}$' },
    modelKey: 'purchaseorders',
    screenKey: 'purchaseOrderList',
    findDocument: (identifier) => {
      const number = Number(identifier);
      return PurchaseOrder.findOne({
        $or: [{ purchaseorderCounter: number }, { purchaseorderRef: { $regex: `-${number}$` } }],
      })
        .select('purchaseorderRef purchaseorderCounter company isAmendmented')
        .lean();
    },
    describe: (doc) => ({
      reference: doc.purchaseorderRef,
      title: `Purchase Order #${doc.purchaseorderCounter}`,
      subtitle: `${doc.company?.vendor ?? ''} · ${doc.purchaseorderRef}`,
    }),
    pdfPath: (doc) =>
      `/order/purchase/pdf/download/${encodeURIComponent(doc.purchaseorderRef)}${doc.isAmendmented ? '?amendment=true' : ''}`,
    identifierOf: (doc) => String(doc.purchaseorderCounter),
    listDocuments: (term) =>
      PurchaseOrder.find(
        buildDocumentSearchFilter({
          term,
          referenceField: 'purchaseorderRef',
          textFields: ['company.vendor'],
          counterField: 'purchaseorderCounter',
        })
      )
        .select('purchaseorderRef purchaseorderCounter company isAmendmented date totalAmount totalDiscountAmount workflowStatus')
        .sort({ createdAt: -1 })
        .limit(ATTACHMENT_DOCUMENT_SEARCH_LIMIT)
        .lean(),
    describeDetails: (doc) => [
      { label: 'Vendor', value: doc.company?.vendor ?? '-' },
      { label: 'Date', value: doc.date ?? '-' },
      { label: 'Total (QAR)', value: formatQarAmount(doc.totalDiscountAmount || doc.totalAmount) },
      { label: 'Status', value: humanizeStatus(doc.workflowStatus) },
    ],
  },
  hire_order: {
    label: 'Hire Order',
    icon: 'document-text-outline',
    keywords: ['hire', 'order', 'lpo'],
    identifier: { label: 'Hire order number', placeholder: 'e.g. 12', pattern: NUMBER_IDENTIFIER_PATTERN },
    modelKey: 'hireorders',
    screenKey: 'hireOrderList',
    findDocument: (identifier) => {
      const number = Number(identifier);
      return HireOrder.findOne({
        $or: [{ hireOrderCounter: number }, { hireOrderRef: { $regex: buildTrailingNumberPattern(number) } }],
      })
        .select('hireOrderRef hireOrderCounter company')
        .lean();
    },
    describe: (doc) => ({
      reference: doc.hireOrderRef,
      title: `Hire Order ${doc.hireOrderRef}`,
      subtitle: `${doc.company?.vendor ?? ''} · ${doc.hireOrderRef}`,
    }),
    pdfPath: (doc) => `/order/hire/pdf/download/${encodeURIComponent(doc.hireOrderRef)}`,
    identifierOf: (doc) => String(doc.hireOrderCounter ?? readTrailingNumber(doc.hireOrderRef)),
    listDocuments: (term) =>
      HireOrder.find(
        buildDocumentSearchFilter({
          term,
          referenceField: 'hireOrderRef',
          textFields: ['company.vendor'],
          counterField: 'hireOrderCounter',
        })
      )
        .select('hireOrderRef hireOrderCounter company date totalAmount totalDiscountAmount workflowStatus')
        .sort({ createdAt: -1 })
        .limit(ATTACHMENT_DOCUMENT_SEARCH_LIMIT)
        .lean(),
    describeDetails: (doc) => [
      { label: 'Vendor', value: doc.company?.vendor ?? '-' },
      { label: 'Date', value: doc.date ?? '-' },
      { label: 'Total (QAR)', value: formatQarAmount(doc.totalDiscountAmount || doc.totalAmount) },
      { label: 'Status', value: humanizeStatus(doc.workflowStatus) },
    ],
  },
  quotation: {
    label: 'Quotation',
    icon: 'document-text-outline',
    keywords: ['quotation', 'quote'],
    identifier: { label: 'Quotation number', placeholder: 'e.g. 12', pattern: NUMBER_IDENTIFIER_PATTERN },
    modelKey: 'quotations',
    screenKey: 'quotationList',
    findDocument: (identifier) => {
      const number = Number(identifier);
      return Quotation.findOne({
        $or: [{ quotationCounter: number }, { quotationRef: { $regex: buildTrailingNumberPattern(number) } }],
      })
        .select('quotationRef quotationCounter company')
        .lean();
    },
    describe: (doc) => ({
      reference: doc.quotationRef,
      title: `Quotation ${doc.quotationRef}`,
      subtitle: `${doc.company?.vendor ?? ''} · ${doc.quotationRef}`,
    }),
    pdfPath: (doc) => `/quotation/pdf/download/${encodeURIComponent(doc.quotationRef)}`,
    identifierOf: (doc) => String(doc.quotationCounter ?? readTrailingNumber(doc.quotationRef)),
    listDocuments: (term) =>
      Quotation.find(
        buildDocumentSearchFilter({
          term,
          referenceField: 'quotationRef',
          textFields: ['company.vendor', 'location'],
          counterField: 'quotationCounter',
        })
      )
        .select('quotationRef quotationCounter company location date totalAmount totalDiscountAmount status')
        .sort({ createdAt: -1 })
        .limit(ATTACHMENT_DOCUMENT_SEARCH_LIMIT)
        .lean(),
    describeDetails: (doc) => [
      { label: 'Vendor', value: doc.company?.vendor ?? '-' },
      { label: 'Date', value: doc.date ?? '-' },
      { label: 'Location', value: doc.location || '-' },
      { label: 'Total (QAR)', value: formatQarAmount(doc.totalDiscountAmount || doc.totalAmount) },
      { label: 'Status', value: humanizeStatus(doc.status) },
    ],
  },
  backcharge: {
    label: 'Backcharge',
    icon: 'document-text-outline',
    keywords: ['backcharge', 'back', 'charge'],
    identifier: { label: 'Backcharge number', placeholder: 'e.g. 141', pattern: NUMBER_IDENTIFIER_PATTERN },
    modelKey: 'backcharges',
    screenKey: 'backchargeList',
    findDocument: (identifier) =>
      Backcharge.findOne({ refNo: { $regex: buildTrailingNumberPattern(Number(identifier)) } })
        .select('refNo supplierName')
        .lean(),
    describe: (doc) => ({
      reference: doc.refNo,
      title: `Backcharge ${doc.refNo}`,
      subtitle: `${doc.supplierName ?? ''} · ${doc.refNo}`,
    }),
    pdfPath: (doc) => `/backcharge/pdf/download/${encodeURIComponent(doc.refNo)}`,
    identifierOf: (doc) => String(readTrailingNumber(doc.refNo)),
    listDocuments: (term) =>
      Backcharge.find(
        buildDocumentSearchFilter({
          term,
          referenceField: 'refNo',
          textFields: ['supplierName', 'plateNo', 'equipmentType'],
        })
      )
        .select('refNo supplierName equipmentType plateNo date costSummary status')
        .sort({ createdAt: -1 })
        .limit(ATTACHMENT_DOCUMENT_SEARCH_LIMIT)
        .lean(),
    describeDetails: (doc) => [
      { label: 'Supplier', value: doc.supplierName ?? '-' },
      { label: 'Equipment', value: [doc.equipmentType, doc.plateNo].filter(Boolean).join(' · ') || '-' },
      { label: 'Date', value: doc.date ?? '-' },
      { label: 'Total (QAR)', value: formatQarAmount(doc.costSummary?.totalCost) },
      { label: 'Status', value: humanizeStatus(doc.status) },
    ],
  },
};

module.exports = { attachmentRegistry };