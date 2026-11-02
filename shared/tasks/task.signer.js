const Staff = require('#features/user/staff/staff.model')
const { MANAGING_DIRECTOR_TITLE } = require('./task.constant')

const buildSignerSlot = ({ label, signed, signedBy, fallbackCode }) => ({
  label,
  signed: Boolean(signed),
  uniqueCode: signed ? signedBy || fallbackCode || null : fallbackCode || null,
})

const resolveAuthorizedSignatory = (title) =>
  title === MANAGING_DIRECTOR_TITLE
    ? { label: 'Managing Director', detailsKey: 'MD', fallbackCode: process.env.MD }
    : { label: 'CEO', detailsKey: 'CEO', fallbackCode: process.env.CEO }

const resolveSigners = async (entries) => {
  const uniqueCodes = [
    ...new Set(entries.flatMap((entry) => entry.signers.map((signer) => signer.uniqueCode)).filter(Boolean)),
  ]

  const staffMembers = uniqueCodes.length
    ? await Staff.find({ uniqueCode: { $in: uniqueCodes } })
        .select('uniqueCode name profilePic')
        .lean()
    : []

  const staffByCode = new Map(staffMembers.map((member) => [member.uniqueCode, member]))

  return entries.map((entry) => ({
    ...entry,
    signers: entry.signers.map((signer) => {
      const member = staffByCode.get(signer.uniqueCode)
      return {
        label: signer.label,
        signed: signer.signed,
        name: member?.name ?? signer.label,
        profilePicPath: member?.profilePic?.filePath ?? null,
      }
    }),
  }))
}

module.exports = { buildSignerSlot, resolveAuthorizedSignatory, resolveSigners }