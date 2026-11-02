const { formatDate } = require('#shared/email/email.instance');
const { ACTION_LABEL, ACTION_SUBJECT } = require('../mobilization/mobilization.email');
const {
  buildRow,
  buildSection,
  compactSections,
  formatMonthYear,
  formatLocationText,
  buildOperatorRows,
  extractOperatorNames,
  buildRateSection,
  formatTimeLabel,
} = require('./activity.format');
const { buildChainSections } = require('./activity.chain.formatter');

const resolveActionKey = (record) =>
  record.action === 'mobilized' && record.isOneDayMob && record.demobDate ? 'one_day_mob' : record.action;

const resolveOperatorList = (record, actionKey) => {
  if (actionKey === 'demobilized') {
    return record.previousOperators?.length ? record.previousOperators : record.operators || [];
  }
  return record.withOperator ? record.operators || [] : [];
};

const buildEquipmentSection = (record, actionKey) => {
  const isDeployment = actionKey === 'mobilized' || actionKey === 'one_day_mob';
  const isCompanyDeployment = record.deployType === 'company';

  return buildSection('Equipment Details', [
    buildRow('Machine', record.machine, true),
    buildRow('Registration No.', record.regNo, true),
    buildRow('Hired From', record.hiredFrom),
    isDeployment && isCompanyDeployment ? buildRow('Leased to Company', record.clientCompany, true) : null,
    isDeployment && !isCompanyDeployment ? buildRow('Deployed to Site', record.site, true) : null,
    actionKey === 'demobilized' ? buildRow('Removed from Site', record.site || 'N/A') : null,
    actionKey === 'status_changed' ? buildRow('Previous Status', record.previousStatus) : null,
    actionKey === 'status_changed' ? buildRow('New Status', record.newStatus, true) : null,
  ]);
};

const buildOperatorSection = (record, actionKey) =>
  buildSection(
    actionKey === 'demobilized' ? 'Previous Operator(s)' : 'Operators',
    buildOperatorRows(resolveOperatorList(record, actionKey), 'Operator')
  );

const buildDetailsSection = (record, actionKey) => {
  const isDemobilization = actionKey === 'demobilized';

  return buildSection(isDemobilization ? 'Demobilization Details' : 'Mobilization Details', [
    buildRow('Date', formatDate(record.date)),
    buildRow('Month / Year', formatMonthYear(record.month, record.year)),
    buildRow('Time', formatTimeLabel(record.time)),
    isDemobilization ? buildRow('Last Mobilized Date', record.lastMobilizedDate || 'N/A') : null,
    isDemobilization ? buildRow('Last Mobilized Time', formatTimeLabel(record.lastMobilizedTime) || 'N/A') : null,
    buildRow('Remarks', record.remarks),
    buildRow('Location', formatLocationText(record.location)),
  ]);
};

const buildOneDayDemobilizationSection = (record, actionKey) => {
  if (actionKey !== 'one_day_mob') return null;

  const demobilizationDate = new Date(record.demobDate);

  return buildSection('Demobilization Details', [
    buildRow('Demob Date', formatDate(demobilizationDate)),
    buildRow(
      'Demob Month / Year',
      formatMonthYear(demobilizationDate.getMonth() + 1, demobilizationDate.getFullYear())
    ),
    buildRow('Demob Time', formatTimeLabel(record.demobTime || record.time)),
    buildRow('Demob Remarks', record.demobRemarks),
  ]);
};

const formatMobilizationActivity = (record, context = {}) => {
  const actionKey = resolveActionKey(record);

  return {
    subject:
      ACTION_SUBJECT(record.machine, record.regNo, record.site, record.clientCompany)[actionKey] ??
      `Equipment Update – ${record.machine}`,
    intro: `This is to inform you that an equipment ${ACTION_LABEL[actionKey] ?? actionKey} event has been recorded in the system. Please find the details below.`,
    sections: compactSections([
      buildEquipmentSection(record, actionKey),
      buildOperatorSection(record, actionKey),
      buildDetailsSection(record, actionKey),
      buildOneDayDemobilizationSection(record, actionKey),
      buildRateSection(record.hired ? 'Hire Details' : 'Working Details', record.rentRate),
      ...buildChainSections(context.chainInfo),
    ]),
    operatorNames: extractOperatorNames(
      resolveOperatorList(record, actionKey).map((operator) => operator.operatorName)
    ),
    regNos: [record.regNo],
  };
};

module.exports = { formatMobilizationActivity };