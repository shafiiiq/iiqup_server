const { formatDate } = require('#shared/email/email.instance');
const { REPLACEMENT_SUBJECT } = require('../replacement/replacement.email');
const {
  buildRow,
  buildSection,
  compactSections,
  formatMonthYear,
  formatLocationText,
  formatShiftLabel,
  buildOperatorRows,
  extractOperatorNames,
  buildRateSection,
  formatTimeLabel,
} = require('./activity.format');

const REPLACEMENT_LABEL = {
  operator: 'Operator Replacement',
  equipment: 'Equipment Replacement',
};

const buildEquipmentSection = (record) =>
  buildSection('Equipment Details', [
    buildRow('Machine', record.machine, true),
    buildRow('Registration No.', record.regNo, true),
    buildRow('Site', record.site || 'N/A'),
    buildRow('Hired From', record.hiredFrom),
  ]);

const buildOperatorReplacementRows = (record) => {
  if (record.replaceAll) {
    return [
      buildRow('Replacement Type', 'All Operators Replaced', true),
      ...buildOperatorRows(record.previousOperators || [], 'Previous Operator', false),
      buildRow('New Operator', record.replacedOperator, true),
    ];
  }

  return [
    buildRow('Shift', record.targetShiftName),
    buildRow('Outgoing Operator', record.currentOperator),
    buildRow('Incoming Operator', record.replacedOperator, true),
  ];
};

const buildActiveOperatorsSection = (record) => {
  const activeShifts = (record.remainingShifts || []).filter((shift) => shift.operatorName);

  const rows = activeShifts.flatMap((shift, shiftIndex) => {
    const numberSuffix = activeShifts.length > 1 ? ` ${shiftIndex + 1}` : '';
    return [
      buildRow(`Operator${numberSuffix} Name`, shift.operatorName, true),
      buildRow(`Operator${numberSuffix} Shift`, formatShiftLabel(shift) || 'Full Shift'),
    ];
  });

  return buildSection('Active Operators After Replacement', rows);
};

const buildEquipmentReplacementSection = (record, context) => {
  const outgoingOperator = record.outgoingOperator || record.currentOperator || '';
  const incomingOperator = record.incomingOperator || record.replacedOperator || '';

  return buildSection('Equipment Replacement', [
    buildRow('Outgoing Equipment', `${record.machine} (${record.regNo})`),
    record.hired ? buildRow('Outgoing Hired From', record.hiredFrom) : null,
    buildRow(
      'Incoming Equipment',
      `${record.replacedEquipmentMachine} (${record.replacedEquipmentRegNo})`,
      true
    ),
    buildRow('Incoming Hired From', context.incomingHiredFrom),
    outgoingOperator || incomingOperator ? buildRow('Outgoing Operator', outgoingOperator || 'N/A') : null,
    outgoingOperator || incomingOperator ? buildRow('Incoming Operator', incomingOperator || 'N/A', true) : null,
    buildRow('New Site for Outgoing', record.newSiteForReplaced),
  ]);
};

const buildDateTimeSection = (record) =>
  buildSection('Date & Time', [
    buildRow('Date', formatDate(record.date)),
    buildRow('Month / Year', formatMonthYear(record.month, record.year)),
    buildRow('Time', formatTimeLabel(record.time)),
    buildRow('Remarks', record.remarks),
    buildRow('Location', formatLocationText(record.location)),
  ]);

const formatReplacementActivity = (record, context = {}) => {
  const isOperatorReplacement = record.type === 'operator';

  return {
    subject:
      REPLACEMENT_SUBJECT(record.machine, record.regNo, record.site, '')[record.type] ??
      `Replacement Update – ${record.machine}`,
    intro: `This is to inform you that a ${REPLACEMENT_LABEL[record.type] ?? record.type} has been recorded in the system. Please find the details below.`,
    sections: compactSections([
      buildEquipmentSection(record),
      isOperatorReplacement
        ? buildSection('Operator Replacement', buildOperatorReplacementRows(record))
        : buildEquipmentReplacementSection(record, context),
      isOperatorReplacement ? buildActiveOperatorsSection(record) : null,
      buildDateTimeSection(record),
      record.hired ? buildRateSection('Outgoing Hire Details', record.rentRate) : null,
    ]),
    operatorNames: extractOperatorNames([
      record.currentOperator,
      record.replacedOperator,
      record.outgoingOperator,
      record.incomingOperator,
    ]),
    regNos: [record.regNo, record.replacedEquipmentRegNo],
  };
};

module.exports = { formatReplacementActivity };