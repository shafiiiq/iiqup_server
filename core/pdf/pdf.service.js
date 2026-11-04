const puppeteer = require('puppeteer')
const PQueue = require('p-queue').default
const logger = require('#shared/logger/logger')
const { buildRenderUser, issuePrintToken } = require('./pdf.token')
const {
  FRONTEND_URL,
  PUPPETEER_LAUNCH_OPTIONS,
  DEFAULT_PDF_OPTIONS,
  MAX_CONCURRENT_RENDERS,
  BLOCKED_URL_PATTERNS,
} = require('./pdf.config')

let browserPromise = null

const renderQueue = new PQueue({ concurrency: MAX_CONCURRENT_RENDERS })
const inFlightRenders = new Map()

const launchBrowser = async () => {
  const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS)
  browser.on('disconnected', () => {
    browserPromise = null
  })
  return browser
}

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null
      throw error
    })
  }

  const browser = await browserPromise
  if (!browser.isConnected()) {
    browserPromise = null
    return getBrowser()
  }

  return browser
}

const closeBrowser = async () => {
  if (!browserPromise) return
  const browser = await browserPromise
  browserPromise = null
  await browser.close()
}

const blockNonEssentialRequests = async (page) => {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = request.url()
    if (BLOCKED_URL_PATTERNS.some((pattern) => url.includes(pattern))) {
      return request.abort()
    }
    request.continue()
  })
}

const seedAuthTokens = async (page, printToken, renderUser) => {
  await page.evaluateOnNewDocument((accessToken, refreshToken, userData) => {
    const storage = window.localStorage
    storage.setItem('keys.session.persistence', 'persistent')
    storage.setItem('credentials.user.access_token', accessToken)
    storage.setItem('credentials.user.refresh_token', refreshToken)
    storage.setItem('credentials.user.data', JSON.stringify({
      _id: userData.id,
      email: userData.email,
      authMail: userData.email,
      uniqueCode: userData.uniqueCode,
      role: userData.role,
      userType: userData.userType,
      name: userData.name,
    }))
    storage.setItem('session.user.expires_at', String(Date.now() + 60 * 60 * 1000))
    storage.setItem('hasSeenOnboard', 'true')
  }, printToken, printToken, renderUser)
}

const waitForDocumentReady = async (page) => {
  try {
    await page.waitForFunction(
      () =>
        document.querySelector('.a2-paper[data-a2-paper-ready="true"]:not(.a2-paper-probe)') ||
        document.querySelector('[class*="error-state"], [class*="error state"]'),
      { timeout: 45000 }
    )
    const errorText = await page.$eval(
      '.purchase.order.report.error.message',
      (element) => element.textContent
    ).catch(() => null)
    if (errorText) throw new Error(`PurchaseOrder report failed to render: ${errorText}`)
  } catch (error) {
    await page.screenshot({ path: '/tmp/pdf-debug.png', fullPage: true })
    const html = await page.content()
    require('fs').writeFileSync('/tmp/pdf-debug.html', html)
    throw error
  }

  await page.evaluate(async () => {
    await document.fonts.ready
    const images = Array.from(document.querySelectorAll('img'))
    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve()
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true })
        img.addEventListener('error', resolve, { once: true })
      })
    }))
  })

  await page.waitForFunction(
    () => {
      const count = document.querySelectorAll('.a2-paper:not(.a2-paper-probe)').length
      if (window.__a2PrevPageCount === count) {
        window.__a2StableTicks = (window.__a2StableTicks || 0) + 1
      } else {
        window.__a2StableTicks = 0
      }
      window.__a2PrevPageCount = count
      return window.__a2StableTicks >= 5
    },
    { timeout: 15000, polling: 100 }
  )

  await new Promise((resolve) => setTimeout(resolve, 300))
}

const renderPageToPdfInternal = async (path, user, options = {}) => {
  const { width, height } = options
  const renderUser = buildRenderUser(user)
  const printToken = issuePrintToken(renderUser)

  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await blockNonEssentialRequests(page)
    await seedAuthTokens(page, printToken, renderUser)

    const separator = path.includes('?') ? '&' : '?'
    await page.goto(`${FRONTEND_URL}${path}${separator}pdf=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.emulateMediaType('print')
    await waitForDocumentReady(page)
    await page.evaluate(() => {
      document.querySelectorAll('.main-header, .navigation-buttons, .spacer, .no-print')
        .forEach((element) => element.remove())
    })

    const pdfOptions = { ...DEFAULT_PDF_OPTIONS }
    if (width && height) {
      pdfOptions.width = `${width}mm`
      pdfOptions.height = `${height}mm`
    }

    return await page.pdf(pdfOptions)
  } catch (error) {
    logger.error(`[pdf.service] renderPageToPdf failed for ${path}:`, error)
    throw error
  } finally {
    await page.close()
  }
}

const renderPageToPdf = (path, user, options = {}) => {
  const key = `${path}::${options.width || ''}x${options.height || ''}::${options.renderKey || ''}`
  const existing = inFlightRenders.get(key)
  if (existing) return existing

  const promise = renderQueue
    .add(() => renderPageToPdfInternal(path, user, options))
    .finally(() => inFlightRenders.delete(key))

  inFlightRenders.set(key, promise)
  return promise
}

module.exports = {
  renderPageToPdf,
  closeBrowser,
}