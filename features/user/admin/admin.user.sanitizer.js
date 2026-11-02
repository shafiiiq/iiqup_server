const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

const sanitizeFieldValue = (field, rawValue) => {
  const text = String(rawValue ?? '').trim()

  if (!text) {
    if (field.isRequired) throw new AppError(`${field.label} is required`, HTTP.BAD_REQUEST)
    return ''
  }

  if (field.type === 'email') {
    const email = text.toLowerCase()
    if (!EMAIL_PATTERN.test(email)) throw new AppError(`${field.label} is not a valid email`, HTTP.BAD_REQUEST)
    return email
  }

  if (field.type === 'number') {
    const number = Number(text)
    if (!Number.isInteger(number)) throw new AppError(`${field.label} must be a whole number`, HTTP.BAD_REQUEST)
    return number
  }

  return text
}

const sanitizeEditableValues = (fields, body) =>
  fields.reduce((values, field) => {
    if (body[field.key] === undefined) return values
    return { ...values, [field.key]: sanitizeFieldValue(field, body[field.key]) }
  }, {})

module.exports = { sanitizeEditableValues }