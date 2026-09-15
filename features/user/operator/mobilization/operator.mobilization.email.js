const {
  operationsGmailClient,
  buildEmailFooter,
  MONTH_NAMES,
  formatDate,
} = require('#shared/email/email.instance');

const SIGN_OFF = {
  name: 'SALIH K. B',
  title: 'Operations Supervisor',
  mobile: '+974-51700493',
};

const ACTION_LABEL = {
  mobilized: 'MOBILIZATION',
  demobilized: 'DEMOBILIZATION',
};

const ACTION_SUBJECT = (operatorName, regNo) => ({
  mobilized: `Operator Mobilized - ${operatorName}${regNo ? ` - ${regNo}` : ''}`,
  demobilized: `Operator Demobilized - ${operatorName}${regNo ? ` - ${regNo}` : ''}`,
});

const generateOperatorMobilizationTemplate = (recipientName = 'Team', data = {}) => {
  const {
    action = 'mobilized',
    operatorName = '',
    qatarId = '',
    uniqueCode = '',
    nationality = '',
    sponsorship = '',
    designation = '',
    rentRate = null,
    regNo = '',
    machine = '',
    site = '',
    deployType = 'site',
    clientCompany = '',
    shiftName = '',
    shiftStart = '',
    shiftEnd = '',
    month = '',
    year = '',
    time = '',
    date = '',
    remarks = '',
    hiredFrom = '',
  } = data;

  const shiftDisplay = shiftName || (shiftStart ? `${shiftStart}${shiftEnd ? ' – ' + shiftEnd : ''}` : '');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;color:#333;">
      <p>Dear ${recipientName},</p>
      <p>This is to inform you that an operator <strong>${ACTION_LABEL[action] ?? action}</strong> event has been recorded in the system. Please find the details below.</p>

      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:560px;margin:16px 0;border-color:#ddd;">
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Operator Details</td>
        </tr>
        <tr><td style="width:180px;color:#666;">Name</td><td><strong>${operatorName}</strong></td></tr>
        <tr><td style="color:#666;">Qatar ID</td><td>${qatarId}</td></tr>
        <tr><td style="color:#666;">Unique Code</td><td>${uniqueCode}</td></tr>
        <tr><td style="color:#666;">Nationality</td><td>${nationality}</td></tr>
        <tr><td style="color:#666;">Sponsorship</td><td>${sponsorship}</td></tr>
        ${designation ? `<tr><td style="color:#666;">Designation</td><td><strong>${designation}</strong></td></tr>` : ''}
        ${hiredFrom ? `<tr><td style="color:#666;">Hired From</td><td>${hiredFrom}</td></tr>` : ''}

        ${
          regNo
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Equipment</td>
        </tr>
        <tr><td style="color:#666;">Machine</td><td><strong>${machine}</strong></td></tr>
        <tr><td style="color:#666;">Registration No.</td><td><strong>${regNo}</strong></td></tr>`
            : ''
        }

        ${
          action === 'mobilized'
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Deployment</td>
        </tr>
        ${
          deployType === 'company'
            ? `<tr><td style="color:#666;">Leased to Company</td><td><strong>${clientCompany}</strong></td></tr>`
            : `<tr><td style="color:#666;">Site</td><td><strong>${site}</strong></td></tr>`
        }
        ${shiftDisplay ? `<tr><td style="color:#666;">Shift</td><td>${shiftDisplay}</td></tr>` : ''}`
            : ''
        }

        ${
          rentRate
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Rate Details</td>
        </tr>
        <tr><td style="color:#666;">Basis</td><td>${rentRate.basis ? rentRate.basis.charAt(0).toUpperCase() + rentRate.basis.slice(1) : 'N/A'}</td></tr>
        <tr><td style="color:#666;">Rate</td><td><strong>${rentRate.rate ? `${rentRate.rate} ${rentRate.currency || 'QAR'}` : 'N/A'}</strong></td></tr>`
            : ''
        }

        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Date &amp; Time</td>
        </tr>
        <tr><td style="color:#666;">Date</td><td>${formatDate(date)}</td></tr>
        <tr><td style="color:#666;">Month / Year</td><td>${MONTH_NAMES[month] ?? month} ${year}</td></tr>
        <tr><td style="color:#666;">Time</td><td>${time}</td></tr>
        ${remarks ? `<tr><td style="color:#666;">Remarks</td><td>${remarks}</td></tr>` : ''}
      </table>

      ${buildEmailFooter(SIGN_OFF)}
    </body>
    </html>
  `;
};

const alertOperatorMobilizationViaEmail = async (data = {}) => {
  const toList = JSON.parse(process.env.OPERATOR_MOBILIZATION_TO || process.env.MOBILIZATION_TO || '[]');
  const to = toList.join(', ');
  const ccList = JSON.parse(process.env.OPERATOR_MOBILIZATION_CC || process.env.MOBILIZATION_CC || '[]');
  const cc = ccList.join(', ');
  const subject = ACTION_SUBJECT(data.operatorName, data.regNo)[data.action] ?? `Operator Update – ${data.operatorName}`;

  const htmlContent = generateOperatorMobilizationTemplate('Team', data);
  const textContent = `Operator ${data.action}: ${data.operatorName}. ${data.regNo ? `Equipment: ${data.regNo}. ` : ''}Date: ${data.date}. Time: ${data.time}. Remarks: ${data.remarks || 'None'}.`;

  return operationsGmailClient.sendEmail(to, subject, htmlContent, textContent, [], cc);
};

module.exports = {
  alertOperatorMobilizationViaEmail,
  generateOperatorMobilizationTemplate,
};