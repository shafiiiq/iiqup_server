const APNS_PRODUCTION_HOST = 'https://api.push.apple.com'
const APNS_SANDBOX_HOST = 'https://api.sandbox.push.apple.com'

const APNS_KEY_ID = process.env.APNS_KEY_ID
const APNS_TEAM_ID = process.env.APNS_TEAM_ID
const APNS_PRIVATE_KEY = (process.env.APNS_PRIVATE_KEY || '').replace(/\\n/g, '\n')

module.exports = {
  APNS_HOST: process.env.APNS_USE_SANDBOX === 'true' ? APNS_SANDBOX_HOST : APNS_PRODUCTION_HOST,
  APNS_KEY_ID,
  APNS_TEAM_ID,
  APNS_PRIVATE_KEY,
  APNS_BUNDLE_ID: process.env.APNS_BUNDLE_ID || 'com.iiqup.ansarigroup',
  IS_APNS_CONFIGURED: Boolean(APNS_KEY_ID && APNS_TEAM_ID && APNS_PRIVATE_KEY),
  PROVIDER_TOKEN_LIFETIME_MS: 50 * 60 * 1000,
  REQUEST_TIMEOUT_MS: 10000,
  POLL_INTERVAL_MS: 10000,
  MINIMUM_PROGRESS_STEP: 0.01,
  PUSH_PRIORITY: 10,
  END_DISMISSAL_SECONDS: 300,
  LIVE_ACTIVITY_LOGO_NAME: 'appLogo',
  REJECTED_TOKEN_REASONS: ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic', 'ExpiredToken'],
}