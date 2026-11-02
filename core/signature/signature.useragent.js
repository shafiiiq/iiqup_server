const BROWSER_PATTERNS = [
  { name: 'Edge', pattern: /Edg\//i },
  { name: 'Opera', pattern: /OPR\//i },
  { name: 'Chrome', pattern: /Chrome\//i },
  { name: 'Firefox', pattern: /Firefox\//i },
  { name: 'Safari', pattern: /Safari\//i },
]

const OPERATING_SYSTEM_PATTERNS = [
  { name: 'Windows', pattern: /Windows/i },
  { name: 'Android', pattern: /Android/i },
  { name: 'iOS', pattern: /iPhone|iPad|iPod/i },
  { name: 'macOS', pattern: /Mac OS X|Macintosh/i },
  { name: 'Linux', pattern: /Linux/i },
]

const findName = (patterns, text) => patterns.find(({ pattern }) => pattern.test(text))?.name || 'Unknown'

const parseUserAgent = (userAgent) => {
  const text = String(userAgent || '')
  return {
    browser: findName(BROWSER_PATTERNS, text),
    operatingSystem: findName(OPERATING_SYSTEM_PATTERNS, text),
  }
}

module.exports = { parseUserAgent }