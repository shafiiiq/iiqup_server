const { formatDate } = require('#shared/email/email.instance');
const {
  ACTION_LABEL,
  ACTION_SUBJECT,
  buildOperatorReplacementSubject,
} = require('#features/user/operator/mobilization/operator.mobilization.email');
const {
  buildRow,
  buildSection,
  compactSections,
  formatMonthYear,
  formatShiftLabel,
  extractOperatorNames,
  buildRateSection,
  formatTimeLabel,
} = require('./activity.format');

const buildDateTimeSection = (record) =>
  buildSection('Date & Time', [
    buildRow('Date', formatDate(record.date)),
    buildRow('Month / Year', formatMonthYear(record.month, record.year)),
    buildRow('Time', formatTimeLabel(record.time)),
    buildRow('Remarks', record.remarks),
  ]);

const buildDeploymentRow = (record) =>
  record.deployType === 'company'
    ? buildRow('Client Company', record.clientCompany, true)
    : buildRow('Site', record.site, true);

const buildReplacementSections = (record) => [
  buildSection('Operator Replacement', [
    buildRow('Outgoing Operator', record.outgoingOperatorName),
    buildRow('Incoming Operator', record.incomingOperatorName, true),
    buildRow('Equipment', record.regNo),
    buildDeploymentRow(record),
  ]),
  buildDateTimeSection(record),
];

const buildMobilizationSections = (record, context) => {
  const operator = context.operator || {};
  const isMobilization = record.action === 'mobilized';

  return [
    buildSection('Operator Details', [
      buildRow('Name', record.operatorName, true),
      buildRow('Qatar ID', record.qatarId || operator.qatarId),
      buildRow('Unique Code', operator.uniqueCode),
      buildRow('Nationality', operator.nationality),
      buildRow('Sponsorship', operator.sponsorship),
      buildRow('Designation', record.designation, true),
      buildRow('Hired From', record.hiredFrom),
    ]),
    record.regNo
      ? buildSection('Equipment', [
          buildRow('Machine', record.machine, true),
          buildRow('Registration No.', record.regNo, true),
        ])
      : null,
    isMobilization
      ? buildSection('Deployment', [
          record.deployType === 'company'
            ? buildRow('Leased to Company', record.clientCompany, true)
            : buildRow('Site', record.site, true),
          buildRow('Shift', formatShiftLabel(record)),
        ])
      : null,
    buildRateSection('Rate Details', record.rentRate),
    buildDateTimeSection(record),
  ];
};

const formatOperatorActivity = (record, context = {}) => {
  const isReplacement = record.action === 'replaced';

  return {
    subject: isReplacement
      ? buildOperatorReplacementSubject(record)
      : ACTION_SUBJECT(record.operatorName, record.regNo)[record.action] ??
        `Operator Update – ${record.operatorName}`,
    intro: `This is to inform you that an operator ${isReplacement ? 'REPLACEMENT' : ACTION_LABEL[record.action] ?? record.action} event has been recorded in the system. Please find the details below.`,
    sections: compactSections(
      isReplacement ? buildReplacementSections(record) : buildMobilizationSections(record, context)
    ),
    operatorNames: isReplacement
      ? extractOperatorNames([record.outgoingOperatorName, record.incomingOperatorName])
      : extractOperatorNames([record.operatorName]),
    regNos: [record.regNo],
  };
};

module.exports = { formatOperatorActivity };