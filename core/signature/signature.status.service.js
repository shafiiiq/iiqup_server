const SignatureAsset = require('./signature.asset.model')
const SignatureActivation = require('./signature.activation.model')
const SignatureDevice = require('./signature.device.model')
const { verifyDeviceToken, isPrimaryDevice } = require('./signature.device.service')
const { MAX_SIGNATURE_DEVICES, DEVICE_ROLE } = require('./signature.constant')

const getMySignatureStatus = async ({ userId, deviceToken }) => {
  const [asset, activation, device, activeDevices] = await Promise.all([
    SignatureAsset.findOne({ userId, isCurrent: true }).select('version').lean(),
    SignatureActivation.findOne({ userId }).select('usedAt expiresAt').lean(),
    verifyDeviceToken({ userId, deviceToken }),
    SignatureDevice.find({ userId, isActive: true }).select('role').lean(),
  ])
  const hasPrimaryDevice = activeDevices.some(isPrimaryDevice)

  return {
    hasSignature: Boolean(asset),
    signatureVersion: asset?.version ?? null,
    hasPendingActivation: Boolean(activation && !activation.usedAt && activation.expiresAt > new Date()),
    isDeviceActivated: Boolean(device),
    deviceRole: device ? (isPrimaryDevice(device) ? DEVICE_ROLE.PRIMARY : DEVICE_ROLE.FAMILY) : null,
    activeDeviceCount: activeDevices.length,
    maxDeviceCount: MAX_SIGNATURE_DEVICES,
    canRequestFamilyAccess:
      Boolean(asset) && !device && hasPrimaryDevice && activeDevices.length < MAX_SIGNATURE_DEVICES,
  }
}

module.exports = { getMySignatureStatus }