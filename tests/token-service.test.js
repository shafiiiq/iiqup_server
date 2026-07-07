const assert = require('assert');
const { buildNotificationMessage } = require('../services/token.service');

const message = buildNotificationMessage({
  title: 'Header testing',
  description: 'Body testing',
  notificationId: '12345',
  type: 'normal',
  priority: 'high',
});

assert.strictEqual(message.apns.headers['apns-push-type'], 'alert');
assert.strictEqual(message.apns.payload.aps.sound, 'default');
assert.strictEqual(message.apns.payload.aps.alert.title, 'Header testing');
assert.strictEqual(message.data.notificationId, '12345');
console.log('token service notification payload test passed');
