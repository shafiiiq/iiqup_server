// features/equipment/replacement/replacement.gmail.js
const {
  operationsGmailClient,
  buildEmailFooter,
  MONTH_NAMES,
  formatDate,
  renderLocation,
} = require('../../../shared/email');

// ─────────────────────────────────────────────────────────────────────────────
// Sender Identity
// ─────────────────────────────────────────────────────────────────────────────

const SIGN_OFF = {
  name: 'SALIH K. B',
  title: 'Operations Supervisor',
  mobile: '+974-51700493',
  companyColor: '#333', // preserved from original (differs from mobilization's #444)
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REPLACEMENT_SUBJECT = (machine, regNo, site, clientCompany) => ({
  operator: `Operator Replacement - ${machine} (${regNo})${site ? ` - ${site}` : ''}`,
  equipment: `Equipment Replacement - ${machine} (${regNo})${clientCompany ? ` - ${clientCompany}` : site ? ` - ${site}` : ''}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// Email Template
// ─────────────────────────────────────────────────────────────────────────────

const generateReplacementTemplate = (
  recipientName = 'Valued Customer',
  data = {}
) => {
  const {
    type = 'operator',
    regNo = '',
    machine = '',
    currentOperator = '',
    replacedOperator = '',
    operator = '',
    outgoingOperator = '',
    incomingOperator = '',
    targetShiftName = '',
    remainingShifts = [],
    replacedEquipmentRegNo = '',
    replacedEquipmentMachine = '',
    site = '',
    newSiteForReplaced = '',
    month = '',
    year = '',
    time = '',
    date = '',
    remarks = '',
    hired = false,
    hiredFrom = '',
    rentRate = null,
    location = [],
    incomingHiredFrom = '',
    replaceAll = false,
  } = data;

  const resolvedOutgoingOperator =
    outgoingOperator || currentOperator || operator || '';
  const resolvedIncomingOperator =
    incomingOperator || replacedOperator || operator || '';

  // ── "Active Operators After Replacement" rows ────────────────────────────
  const validShifts = remainingShifts.filter((s) => s.operatorName);

  const shiftsHtml = validShifts
    .map((s, i) => {
      const label = validShifts.length > 1 ? ` ${i + 1}` : '';
      const shiftDisplay = s.shiftName
        ? s.shiftName
        : s.shiftStart
          ? `${s.shiftStart}${s.shiftEnd ? ' – ' + s.shiftEnd : ''}`
          : 'Full Shift';

      return `
      <tr>
        <td style="color:#666;">Operator${label} Name</td>
        <td><strong>${s.operatorName}</strong></td>
      </tr>
      <tr>
        <td style="color:#666;">Operator${label} Shift</td>
        <td>${shiftDisplay}</td>
      </tr>`;
    })
    .join('');

  const activeOperatorsSection = validShifts.length
    ? `
    <tr style="background:#f5f5f5;">
      <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Active Operators After Replacement</td>
    </tr>
    ${shiftsHtml}`
    : '';

  // ── Operator replacement section rows ─────────────────────────────────────
  const operatorReplacementRows = replaceAll
    ? `
    <tr>
      <td style="color:#666;">Replacement Type</td>
      <td><strong>All Operators Replaced</strong></td>
   </tr>
   ${(data.previousOperators?.length ? data.previousOperators : [])
     .map(
       (op, i) => `
    <tr>
     <td style="color:#666;">Previous Operator ${data.previousOperators.length > 1 ? i + 1 : ''}</td>
     <td>${op.operatorName}${op.shiftName ? ` (${op.shiftName})` : ''}</td>
    </tr>`
     )
     .join('')}
    <tr>
      <td style="color:#666;">New Operator</td>
     <td><strong>${replacedOperator}</strong></td>
    </tr>`
    : `
      ${
        targetShiftName
          ? `
    <tr>
      <td style="color:#666;">Shift</td>
      <td>${targetShiftName}</td>
    </tr>`
          : ''
      }
    <tr>
      <td style="color:#666;">Outgoing Operator</td>
      <td>${currentOperator}</td>
    </tr>
    <tr>
      <td style="color:#666;">Incoming Operator</td>
      <td><strong>${replacedOperator}</strong></td>
    </tr>`;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;color:#333;">
      <p>Dear ${recipientName},</p>
      <p>This is to inform you that a <strong>${type === 'operator' ? 'Operator Replacement' : 'Equipment Replacement'}</strong> has been recorded in the system. Please find the details below.</p>

      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:560px;margin:16px 0;border-color:#ddd;">
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Equipment Details</td>
        </tr>
        <tr>
          <td style="width:180px;color:#666;">Machine</td>
          <td><strong>${machine}</strong></td>
        </tr>
        <tr>
          <td style="color:#666;">Registration No.</td>
          <td><strong>${regNo}</strong></td>
        </tr>
        <tr>
          <td style="color:#666;">Site</td>
          <td>${site || 'N/A'}</td>
        </tr>
        ${hiredFrom ? `<tr><td style="color:#666;">Hired From</td><td>${hiredFrom}</td></tr>` : ''}

        ${
          type === 'operator'
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Operator Replacement</td>
        </tr>
        ${operatorReplacementRows}
        ${activeOperatorsSection}`
            : ''
        }

        ${
          type === 'equipment'
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Equipment Replacement</td>
        </tr>
        <tr>
          <td style="color:#666;">Outgoing Equipment</td>
          <td>${machine} (${regNo})</td>
        </tr>
        ${hired ? `<tr><td style="color:#666;">Outgoing Hired From</td><td>${hiredFrom}</td></tr>` : ''}
        <tr>
          <td style="color:#666;">Incoming Equipment</td>
          <td><strong>${replacedEquipmentMachine} (${replacedEquipmentRegNo})</strong></td>
        </tr>
        ${incomingHiredFrom ? `<tr><td style="color:#666;">Incoming Hired From</td><td>${incomingHiredFrom}</td></tr>` : ''}
        ${
          resolvedOutgoingOperator || resolvedIncomingOperator
            ? `
        <tr>
          <td style="color:#666;">Outgoing Operator</td>
          <td>${resolvedOutgoingOperator || 'N/A'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Incoming Operator</td>
          <td><strong>${resolvedIncomingOperator || 'N/A'}</strong></td>
        </tr>`
            : ''
        }
        ${newSiteForReplaced ? `<tr><td style="color:#666;">New Site for Outgoing</td><td>${newSiteForReplaced}</td></tr>` : ''}`
            : ''
        }

        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Date &amp; Time</td>
        </tr>
        <tr><td style="color:#666;">Date</td><td>${formatDate(date)}</td></tr>
        <tr><td style="color:#666;">Month / Year</td><td>${MONTH_NAMES[month] ?? month} ${year}</td></tr>
        <tr><td style="color:#666;">Time</td><td>${time}</td></tr>
        ${remarks ? `<tr><td style="color:#666;">Remarks</td><td>${remarks}</td></tr>` : ''}
        ${renderLocation(location) ? `<tr><td style="color:#666;">Location</td><td>${renderLocation(location)}</td></tr>` : ''}
        ${
          hired && rentRate
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Outgoing Hire Details</td>
        </tr>
        <tr><td style="color:#666;">Basis</td><td>${rentRate.basis ? rentRate.basis.charAt(0).toUpperCase() + rentRate.basis.slice(1) : 'N/A'}</td></tr>
        <tr><td style="color:#666;">Rate</td><td><strong>${rentRate.rate} ${rentRate.currency || 'QAR'}</strong></td></tr>`
            : ''
        }
      </table>

      ${buildEmailFooter(SIGN_OFF)}
    </body>
    </html>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const alertReplacementViaEmail = async (data = {}) => {
  const toList = JSON.parse(process.env.REPLACEMENT_TO || '[]');
  const to = toList.join(', ');
  const ccList = JSON.parse(process.env.REPLACEMENT_CC || '[]');
  const cc = ccList.join(', ');
  const subject =
    REPLACEMENT_SUBJECT(
      data.machine,
      data.regNo,
      data.site,
      data.clientCompany
    )[data.type] ?? `Replacement Update – ${data.machine}`;

  const htmlContent = generateReplacementTemplate('Team', data);
  const textContent = `${data.type === 'operator' ? 'Operator' : 'Equipment'} Replacement: ${data.machine} (${data.regNo}). Date: ${data.date}. Time: ${data.time}. Remarks: ${data.remarks || 'None'}.`;

  return operationsGmailClient.sendEmail(
    to,
    subject,
    htmlContent,
    textContent,
    [],
    cc
  );
};

const getAuthorizationUrl = async () => {
  await operationsGmailClient.initialize();
  return operationsGmailClient.getAuthUrl();
};

const exchangeCodeForTokens = async (code) => {
  await operationsGmailClient.initialize();
  return operationsGmailClient.getTokensFromCode(code);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  alertReplacementViaEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generateReplacementTemplate,
};