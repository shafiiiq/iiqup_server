const FRONTEND_URL = process.env.FRONTEND_URL || 'https://alansariconnect.vercel.app'

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

const PRINT_TOKEN_TYPE = 'print'
const PRINT_TOKEN_LIFETIME = '5m'
const PRINT_TOKEN_ALLOWED_POST_PATHS = ['/api/v1/s3/pre-signed-url']

const DEFAULT_PDF_OPTIONS = {
  printBackground: true,
  preferCSSPageSize: true,
}

const BLOCKED_URL_PATTERNS = [
  '/webpush',
  '/explorer/release/latest',
  '/socket.io',
]

module.exports = {
  FRONTEND_URL,
  PUPPETEER_LAUNCH_OPTIONS,
  DEFAULT_PDF_OPTIONS,
  MAX_CONCURRENT_RENDERS,
  BLOCKED_URL_PATTERNS,
  PRINT_TOKEN_TYPE,
  PRINT_TOKEN_LIFETIME,
  PRINT_TOKEN_ALLOWED_POST_PATHS,
}