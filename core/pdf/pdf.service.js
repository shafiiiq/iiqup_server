const puppeteer = require('puppeteer')
const PQueue = require('p-queue').default
const logger = require('#shared/logger/logger')
const { generateAuthTokens } = require('#middlewares/jwt.middleware')
const {
  FRONTEND_URL,
  PDF_RENDER_SECRET,
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

const seedAuthTokens = async (page, tokens, user, pdfRenderSecret) => {
  await page.evaluateOnNewDocument((accessToken, userData, renderSecret) => {
    const now = new Date()
    const userSession = {
      userId: userData.id,
      email: userData.email,
      authMail: userData.email,
      uniqueCode: userData.uniqueCode,
      loginTime: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    }

    const storedUser = {
      _id: userData.id,
      email: userData.email,
      authMail: userData.email,
      uniqueCode: userData.uniqueCode,
      role: userData.role,
      userType: userData.userType,
      name: userData.name,
    }

    window.localStorage.setItem('accessToken', accessToken)
    window.localStorage.setItem('refreshToken', userData.refreshToken)
    window.localStorage.setItem('userSession', JSON.stringify(userSession))
    window.localStorage.setItem('user', JSON.stringify(storedUser))
    window.localStorage.setItem('isUserLoggedIn', 'true')
    window.localStorage.setItem('hasSeenIntro', 'true')
    window.localStorage.setItem('pdfRenderSecret', renderSecret || '')
  }, tokens.accessToken, { ...user, refreshToken: tokens.refreshToken }, pdfRenderSecret)
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
  const tokens = generateAuthTokens({
    _id: user._id || user.id,
    email: user.email,
    role: user.role,
    uniqueCode: user.uniqueCode,
    userType: user.userType,
    name: user.name,
  })

  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await blockNonEssentialRequests(page)
    await seedAuthTokens(page, tokens, user, PDF_RENDER_SECRET)

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
  const key = `${path}::${options.width || ''}x${options.height || ''}`
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