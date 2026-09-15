const HTTP = require('#shared/response/response.status')
const { notifyUsers } = require('#shared/notify/notify.user')
const Quotation = require('./quotation.model')
const { staffMainRecipients } = require('./quotation.constant')

const resolveAuthRole = (signatoryTitle) => {
  const isMD = signatoryTitle === 'MANAGING DIRECTOR'
  return {
    envKey: isMD ? process.env.MD : process.env.CEO,
    role: isMD ? 'MANAGING_DIRECTOR' : 'CEO',
    roleLabel: isMD ? 'Managing Director' : 'CEO',
  }
}

const signQuotation = async (refNo, signData) => {
  const { uniqueCode, signedDate, signedFrom, signedIP, signedDevice, signedLocation } = signData

  const quotation = await Quotation.findOne({ quotationRef: refNo })
  if (!quotation) throw { status: HTTP.NOT_FOUND, message: `Quotation not found: ${refNo}` }

  const expected = resolveAuthRole(quotation.signatures?.authorizedSignatoryTitle)

  if (!expected.envKey || expected.envKey !== uniqueCode) {
    throw {
      status: HTTP.FORBIDDEN,
      message: `Unauthorised: only the designated ${expected.roleLabel} is authorised to sign this quotation`,
    }
  }

  if (quotation.authorizedSigned === true) {
    throw { status: HTTP.CONFLICT, message: 'This quotation has already been signed' }
  }

  const updated = await Quotation.findOneAndUpdate(
    { quotationRef: refNo },
    {
      authorizedSigned: true,
      signature: {
        signed: true,
        approvedBy: uniqueCode,
        approvedDate: signedDate,
        approvedFrom: signedFrom,
        approvedIP: signedIP,
        approvedDevice: signedDevice,
        approvedLocation: signedLocation,
      },
    },
    { new: true }
  )

  if (!updated) throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to update Quotation record' }

  notifyUsers(staffMainRecipients(), {
    priority: 'high',
    title: `Quotation ${refNo} Signed`,
    description: `Quotation ${refNo} has been signed by the ${expected.roleLabel}.`,
    sourceId: 'quotation_signed',
  }).catch(() => {})

  return { status: HTTP.OK, message: `${expected.roleLabel} signature recorded successfully`, data: updated, role: expected.role }
}

module.exports = { signQuotation, resolveAuthRole }