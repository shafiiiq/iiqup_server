const assert = require('assert');
const { generateReplacementTemplate } = require('../gmail/replacement.gmail');

const html = generateReplacementTemplate('Team', {
  type: 'equipment',
  machine: 'Excavator',
  regNo: 'ABC-123',
  site: 'Site A',
  date: '2026-07-05',
  month: 7,
  year: 2026,
  time: '10:00',
  currentOperator: 'Old Operator',
  operator: 'New Operator',
  remarks: 'Swap completed',
});

assert.match(html, /Outgoing Operator/);
assert.match(html, /Incoming Operator/);
assert.match(html, /Old Operator/);
assert.match(html, /New Operator/);
console.log('replacement email template regression test passed');
