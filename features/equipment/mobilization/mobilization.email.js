const {
  operationsGmailClient,
  buildEmailFooter,
  MONTH_NAMES,
  formatDate,
  renderLocation,
  formatTime,
} = require('#shared/email/email.instance');

const SIGN_OFF = {
  name: 'SALIH K. B',
  title: 'Operations Supervisor',
  mobile: '+974-51700493',
};

const ACTION_LABEL = {
  mobilized: 'MOBILIZATION',
  demobilized: 'DEMOBILIZATION',
  status_changed: 'STATUS CHANGE',
  one_day_mob: 'MOBILIZATION',
  add_shifts: 'ADDITIONAL SHIFTS ADDED',
};

const ACTION_SUBJECT = (machine, regNo, site, clientCompany) => ({
  mobilized: `Mobilized - ${machine} (${regNo})${clientCompany ? ` - ${clientCompany}` : site ? ` - ${site}` : ''}`,
  demobilized: `Demobilized - ${machine} (${regNo})${site ? ` - ${site}` : ''}`,
  status_changed: `Status Changed - ${machine} (${regNo})`,
  one_day_mob: `Mobilization and Demobilization - ${machine} (${regNo})${clientCompany ? ` - ${clientCompany}` : site ? ` - ${site}` : ''}`,
  add_shifts: `Additional Shifts Added - ${machine} (${regNo})${site ? ` - ${site}` : ''}`,
});

const renderChainTimelineRow = (event) => {
  if (event.type === 'mobilized') {
    const destination =
      event.deployType === 'company'
        ? `client <strong>${event.clientCompany}</strong>`
        : event.site
          ? `site <strong>${event.site}</strong>`
          : 'an unspecified location';
    return `${formatDate(event.date)} — <strong>${event.machine || ''} (${event.regNo})</strong> mobilized to ${destination}`;
  }

  if (event.type === 'demobilized') {
    return `${formatDate(event.date)} — <strong>${event.machine || ''} (${event.regNo})</strong> demobilized`;
  }

  if (event.type === 'replaced') {
    return `${formatDate(event.date)} — <strong>${event.fromMachine || ''} (${event.fromRegNo})</strong> replaced by <strong>${event.toMachine || ''} (${event.toRegNo})</strong>`;
  }

  return '';
};

const renderChainTimeline = (timeline = []) => {
  if (!timeline.length) return '';
  return `<ol style="margin:0;padding-left:18px;">${timeline
    .map((event) => `<li style="margin-bottom:6px;">${renderChainTimelineRow(event)}</li>`)
    .join('')}</ol>`;
};

const renderChainStatusRows = (equipmentStatuses = []) =>
  equipmentStatuses
    .map((eq) => {
      if (eq.found === false) {
        return `
      <tr>
        <td style="color:#666;">${eq.regNo}</td>
        <td>Record not found</td>
      </tr>`;
      }

      const statusParts = [eq.isActive ? `Active (${eq.status})` : 'Idle'];
      if (eq.site) statusParts.push(`Site: ${eq.site}`);
      if (eq.location) statusParts.push(`Location: ${eq.location}`);

      return `
      <tr>
        <td style="color:#666;">${eq.machine || ''} (${eq.regNo})</td>
        <td>${statusParts.join(' · ')}</td>
      </tr>`;
    })
    .join('');

const renderChainSection = (chainInfo) => {
  if (!chainInfo || !chainInfo.timeline || chainInfo.timeline.length <= 1) return '';

  return `
    <tr style="background:#f5f5f5;">
      <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Equipment History</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:10px 12px;">
        ${renderChainTimeline(chainInfo.timeline)}
      </td>
    </tr>
    <tr style="background:#f5f5f5;">
      <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Current Status of Chain Equipment</td>
    </tr>
    ${renderChainStatusRows(chainInfo.equipmentStatuses)}
    <tr>
      <td style="color:#666;">Chain Status</td>
      <td>${chainInfo.isChainClosed ? 'Closed — no equipment currently active on this chain' : 'Still active'}</td>
    </tr>
  `;
};

const generateMobilizationTemplate = (
  recipientName = 'Valued Customer',
  data = {}
) => {
  const {
    action = 'mobilized',
    regNo = '',
    machine = '',
    site = '',
    deployType = 'site',
    clientCompany = '',
    operators = [],
    withOperator = false,
    month = '',
    year = '',
    time = '',
    date = '',
    previousStatus = '',
    newStatus = '',
    hired = false,
    hiredFrom = '',
    rentRate = null,
    location = [],
    remarks = '',
    allOperators = [],
    previousOperators = [],
    lastMobilizedDate = '',
    lastMobilizedTime = '',
    demobDate = '',
    demobMonth = '',
    demobYear = '',
    demobTime = '',
    demobRemarks = '',
    chainInfo = null,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;color:#333;">
      <p>Dear ${recipientName},</p>
      <p>This is to inform you that an equipment <strong>${ACTION_LABEL[action] ?? action}</strong> event has been recorded in the system. Please find the details below.</p>

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
        ${
          hiredFrom
            ? `
        <tr>
          <td style="color:#666;">Hired From</td>
          <td>${hiredFrom}</td>
        </tr>`
            : ''
        }
        ${
          (action === 'mobilized' ||
            action === 'one_day_mob' ||
            action === 'add_shifts') &&
          deployType === 'company'
            ? `
        <tr>
          <td style="color:#666;">Leased to Company</td>
          <td><strong>${clientCompany}</strong></td>
        </tr>`
            : ''
        }
        ${
          (action === 'mobilized' ||
            action === 'one_day_mob' ||
            action === 'add_shifts') &&
          deployType !== 'company'
            ? `
        <tr>
          <td style="color:#666;">Deployed to Site</td>
          <td><strong>${site}</strong></td>
        </tr>`
            : ''
        }
        ${
          action === 'demobilized'
            ? `
        <tr>
          <td style="color:#666;">Removed from Site</td>
          <td>${site || 'N/A'}</td>
        </tr>
        ${
          previousOperators?.filter((op) => op.operatorName)?.length
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Previous Operator(s)</td>
        </tr>
        ${previousOperators
          .map(
            (op, i) => `
        <tr>
          <td style="color:#666;">Operator ${previousOperators.length > 1 ? i + 1 : ''}</td>
          <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : op.shiftStart ? ` &nbsp;<span style="color:#888;">${formatTime(op.shiftStart)}${op.shiftEnd ? ' – ' + formatTime(op.shiftEnd) : ''}</span>` : ''}</td>
        </tr>`
          )
          .join('')}`
            : ''
        }
        ${
          !previousOperators?.filter((op) => op.operatorName)?.length &&
          operators?.filter((op) => op.operatorName)?.length
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Previous Operator(s)</td>
        </tr>
        ${operators
          .filter((op) => op.operatorName)
          .map(
            (op, i) => `
        <tr>
          <td style="color:#666;">Operator ${operators.filter((o) => o.operatorName).length > 1 ? i + 1 : ''}</td>
          <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : op.shiftStart ? ` &nbsp;<span style="color:#888;">${formatTime(op.shiftStart)}${op.shiftEnd ? ' – ' + formatTime(op.shiftEnd) : ''}</span>` : ''}</td>
        </tr>`
          )
          .join('')}`
            : ''
        }`
            : ''
        }
        ${
          withOperator && operators?.filter((op) => op.operatorName)?.length
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Operators</td>
        </tr>
        ${(() => {
          const filled = operators.filter((op) => op.operatorName);
          const isDayNight =
            filled.length === 2 &&
            filled[0]?.shiftName === 'Day Shift' &&
            filled[1]?.shiftName === 'Night Shift';

          if (isDayNight) {
            return `
            <tr>
              <td style="color:#666;">Day Shift Operator</td>
              <td><strong>${filled[0].operatorName}</strong> &nbsp;<span style="color:#888;">Day Shift${filled[0].shiftStart ? ' · ' + formatTime(filled[0].shiftStart) + (filled[0].shiftEnd ? ' – ' + formatTime(filled[0].shiftEnd) : '') : ''}</span></td>
            </tr>
            <tr>
              <td style="color:#666;">Night Shift Operator</td>
              <td><strong>${filled[1].operatorName}</strong> &nbsp;<span style="color:#888;">Night Shift${filled[1].shiftStart ? ' · ' + formatTime(filled[1].shiftStart) + (filled[1].shiftEnd ? ' – ' + formatTime(filled[1].shiftEnd) : '') : ''}</span></td>
            </tr>`;
          }

          return filled
            .map(
              (op, i) => `
          <tr>
            <td style="color:#666;">${filled.length > 1 ? `Operator ${i + 1}` : 'Operator'}</td>
            <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : op.shiftStart ? ` &nbsp;<span style="color:#888;">${formatTime(op.shiftStart)}${op.shiftEnd ? ' – ' + formatTime(op.shiftEnd) : ''}</span>` : ''}</td>
          </tr>`
            )
            .join('');
        })()}`
            : ''
        }
        ${
          action === 'add_shifts'
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Newly Added Shifts</td>
        </tr>
        ${operators
          .filter((op) => op.operatorName)
          .map(
            (op, i) => `
        <tr>
          <td style="color:#666;">New Operator ${operators.filter((o) => o.operatorName).length > 1 ? i + 1 : ''}</td>
          <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : op.shiftStart ? ` &nbsp;<span style="color:#888;">${formatTime(op.shiftStart)}${op.shiftEnd ? ' – ' + formatTime(op.shiftEnd) : ''}</span>` : ''}</td>
        </tr>`
          )
          .join('')}
        ${
          allOperators.length
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">All Active Operators After Update</td>
        </tr>
        ${allOperators
          .filter((op) => op.operatorName)
          .map(
            (op, i) => `
        <tr>
          <td style="color:#666;">Operator ${allOperators.filter((o) => o.operatorName).length > 1 ? i + 1 : ''}</td>
          <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : ''}</td>
        </tr>`
          )
          .join('')}`
            : ''
        }`
            : ''
        }
        ${
          action === 'status_changed'
            ? `
        <tr>
          <td style="color:#666;">Previous Status</td>
          <td>${previousStatus}</td>
        </tr>
        <tr>
          <td style="color:#666;">New Status</td>
          <td><strong>${newStatus}</strong></td>
        </tr>`
            : ''
        }
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">${action === 'demobilized' ? 'Demobilization Details' : 'Mobilization Details'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Date</td>
          <td>${formatDate(date)}</td>
        </tr>
        <tr>
          <td style="color:#666;">Month / Year</td>
          <td>${MONTH_NAMES[month] ?? month} ${year}</td>
        </tr>
        <tr>
          <td style="color:#666;">Time</td>
          <td>${time}</td>
        </tr>
        ${
          action === 'demobilized'
            ? `
        <tr>
          <td style="color:#666;">Last Mobilized Date</td>
          <td>${lastMobilizedDate || 'N/A'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Last Mobilized Time</td>
          <td>${lastMobilizedTime || 'N/A'}</td>
        </tr>`
            : ''
        }
        ${
          action === 'one_day_mob'
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Demobilization Details</td>
        </tr>
        <tr>
          <td style="color:#666;">Demob Date</td>
          <td>${formatDate(demobDate)}</td>
        </tr>
        <tr>
          <td style="color:#666;">Demob Month / Year</td>
          <td>${MONTH_NAMES[demobMonth] ?? demobMonth} ${demobYear}</td>
        </tr>
        <tr>
          <td style="color:#666;">Demob Time</td>
          <td>${demobTime}</td>        
        </tr>
        ${
          demobRemarks
            ? `
        <tr>
          <td style="color:#666;">Demob Remarks</td>
          <td>${demobRemarks}</td>
        </tr>`
            : ''
        }`
            : ''
        }
        ${
          remarks
            ? `
        <tr>
          <td style="color:#666;">Remarks</td>
          <td>${remarks}</td>
        </tr>`
            : ''
        }
        ${
          renderLocation(location)
            ? `
        <tr>
          <td style="color:#666;">Location</td>
          <td>${renderLocation(location)}</td>
        </tr>`
            : ''
        }
        ${
          rentRate
            ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">${hired ? 'Hire Details' : 'Working Details'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Basis</td>
          <td>${rentRate.basis ? rentRate.basis.charAt(0).toUpperCase() + rentRate.basis.slice(1) : 'N/A'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Rate</td>
          <td><strong>${rentRate.rate ? `${rentRate.rate} ${rentRate.currency || 'QAR'}` : 'N/A'}</strong></td>
        </tr>`
            : ''
        }
        ${renderChainSection(chainInfo)}
      </table>

      ${buildEmailFooter(SIGN_OFF)}
    </body>
    </html>
  `;
};

const alertMobilizationViaEmail = async (data = {}) => {
  const toList = JSON.parse(process.env.MOBILIZATION_TO || '[]');
  const to = toList.join(', ');
  const ccList = JSON.parse(process.env.MOBILIZATION_CC || '[]');
  const cc = ccList.join(', ');
  const subject =
    ACTION_SUBJECT(data.machine, data.regNo, data.site, data.clientCompany)[
      data.action
    ] ?? `Equipment Update – ${data.machine}`;

  const htmlContent = generateMobilizationTemplate('Team', data);
  const textContent = `Equipment ${data.action}: ${data.machine} (${data.regNo}). Site: ${data.site || 'N/A'}. Date: ${data.date}. Time: ${data.time}. Remarks: ${data.remarks || 'None'}.`;

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

module.exports = {
  alertMobilizationViaEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generateMobilizationTemplate,
};