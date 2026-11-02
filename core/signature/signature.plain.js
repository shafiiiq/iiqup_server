const toPlainContent = (value) => JSON.parse(JSON.stringify(value ?? null))

module.exports = { toPlainContent }