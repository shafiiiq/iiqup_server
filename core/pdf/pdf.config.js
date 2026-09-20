const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

const PUPPETEER_LAUNCH_OPTIONS = {
  headless: 'new',
  protocolTimeout: 120000,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
}

const MAX_CONCURRENT_RENDERS = Number(process.env.PDF_MAX_CONCURRENT_RENDERS) || 2 

const DEFAULT_PDF_OPTIONS = {
  printBackground: true,
  preferCSSPageSize: true,
}

const BLOCKED_URL_PATTERNS = [
  '/webpush',
  '/explorer/release/latest',
  '/socket.io',
  '/authn/verify/device-trust',
]

module.exports = {
  FRONTEND_URL,
  PUPPETEER_LAUNCH_OPTIONS,
  DEFAULT_PDF_OPTIONS,
  MAX_CONCURRENT_RENDERS,
  BLOCKED_URL_PATTERNS,
}