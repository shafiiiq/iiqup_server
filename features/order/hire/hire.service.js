const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const HireOrder = require('./hire.model')
const { buildSignatures, resolveVendorCode, calculateTotal, wrapServiceError } = require('./hire.helper')
const { notifyStaffMain, notifyStaffHero } = require('./hire.notification')
const { DEFAULT_TERMS } = require('./hire.constant')

const UPLOAD_ALLOWED_STATUSES = [
  'hire_order_uploaded',
  'manager_approved',
  'purchase_approved',
  'accounts_approved',
  'ceo_approved',
  'md_approved',
  'items_available',
]

const createHireOrder = async (hireOrderData) => {
  try {
    const totalAmount = calculateTotal(hireOrderData.items, hireOrderData.showDiscountInTotal, hireOrderData.discount)
    const signatures = buildSignatures(hireOrderData.signatures)
    const { vendorCode, vendorMail } = await resolveVendorCode(hireOrderData.company.vendor)

    const hireOrder = new HireOrder({
      ...hireOrderData,
      totalAmount,
      signatures,
      vendorCode,
      vendorMail,
      isAmendmented: false,
      amendments: [],
      termsAndConditions: hireOrderData.termsAndConditions?.length ? hireOrderData.termsAndConditions : DEFAULT_TERMS,
    })

    const saved = await hireOrder.save()

    if (hireOrderData.normalHireOrder) {
      await notifyStaffMain({
        title: `Hire Order ${saved.hireOrderRef} Created`,
        description: `Hire Order: ${saved.hireOrderRef} for ${hireOrderData.company.vendor}. Awaiting upload.`,
        sourceId: 'hire_order_approval',
      })
    }

    return saved
  } catch (error) {
    throw wrapServiceError('createHireOrder', error)
  }
}

const updateHireOrder = async (refNo, updateData) => {
  try {
    const existing = await HireOrder.findOne({ hireOrderRef: refNo.trim() })
    if (!existing) throw new Error('Hire order not found')

    if (updateData.isAmendmented === true) {
      const amendment = {
        amendmentDate: new Date(),
        amendedBy: updateData.amendedBy || 'System',
        reason: updateData.amendmentReason || 'Amendment requested',
      }

      if (updateData.items?.length > 0) {
        amendment.amendedItems = updateData.items
        amendment.amendedColumns = updateData.columns || existing.columns
        amendment.amendedTotalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

        if (updateData.showDiscountInTotal && updateData.discount) {
          amendment.amendedTotalAmount -= updateData.discount
          amendment.amendedDiscount = updateData.discount
        }
      }

      if (updateData.company) amendment.amendedCompany = updateData.company
      if (updateData.quoteNo) amendment.amendedQuoteNo = updateData.quoteNo
      if (updateData.requestText) amendment.amendedRequestText = updateData.requestText
      if (updateData.termsAndConditions) amendment.amendedTermsAndConditions = updateData.termsAndConditions

      return await HireOrder.findOneAndUpdate(
        { hireOrderRef: refNo.trim() },
        {
          $set: {
            isAmendmented: true,
            pmSigned: false,
            accountsSigned: false,
            managerSigned: false,
            ceoSigned: false,
            workflowStatus: 'hire_order_amended',
          },
          $push: { amendments: amendment },
        },
        { new: true, runValidators: true }
      )
    }

    if (updateData.items?.length > 0) {
      updateData.totalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    }

    if (updateData.showDiscountInTotal && updateData.discount) {
      updateData.totalAmount = (updateData.totalAmount || 0) - (updateData.discount || 0)
    }

    delete updateData.amendedBy
    delete updateData.amendmentReason

    return await HireOrder.findOneAndUpdate({ hireOrderRef: refNo.trim() }, { $set: updateData }, {
      new: true,
      runValidators: true,
    })
  } catch (error) {
    throw wrapServiceError('updateHireOrder', error)
  }
}

const deleteHireOrder = async (refNo) => {
  try {
    const hireOrder = await HireOrder.findOneAndDelete({ hireOrderRef: refNo })
    if (!hireOrder) throw new Error('Hire order not found')
    return hireOrder
  } catch (error) {
    throw wrapServiceError('deleteHireOrder', error)
  }
}

const saveVendorEmail = async (vendorCode, emails) => {
  try {
    const emailArray = Array.isArray(emails) ? emails : [emails]
    return await HireOrder.updateMany({ vendorCode }, { $set: { vendorMail: emailArray } })
  } catch (error) {
    throw wrapServiceError('saveVendorEmail', error)
  }
}

const uploadHireOrder = async (hireOrderRef, uploadedBy, description, isAmendment = false) => {
  try {
    const hireOrder = await HireOrder.findOne({ hireOrderRef })
    if (!hireOrder) throw Object.assign(new Error('Hire order not found'), { status: HTTP.NOT_FOUND })

    const validStatuses = isAmendment ? UPLOAD_ALLOWED_STATUSES : ['hire_order_created']
    if (!validStatuses.includes(hireOrder.workflowStatus)) {
      throw Object.assign(
        new Error(`Invalid workflow status for Hire Order ${isAmendment ? 'amendment' : 'upload'}`),
        { status: HTTP.BAD_REQUEST }
      )
    }

    const updated = await HireOrder.findOneAndUpdate(
      { hireOrderRef },
      {
        $set: { workflowStatus: 'hire_order_uploaded', updatedAt: new Date() },
        $push: {
          approvalTrail: {
            approvedBy: uploadedBy,
            role: 'WORKSHOP_MANAGER',
            approvalDate: new Date(),
            comments: description || `Hire order document uploaded: ${hireOrderRef}`,
            action: 'uploaded',
          },
        },
      },
      { new: true, runValidators: true }
    )

    await notifyStaffHero({
      title: `Hire Order Approval Needed - ${hireOrderRef}`,
      description: `New Hire Order created. Ref: ${hireOrderRef}. Manager approval needed.`,
      sourceId: 'hire_order_approval',
      navigateTo: `/(signature)/op/${hireOrderRef}`,
      navigateText: 'View and Sign',
      navigteToId: hireOrderRef,
      hasButton: true,
    })

    return updated
  } catch (error) {
    logger.error('[hire.service] uploadHireOrder:', error)
    throw error
  }
}

module.exports = {
  createHireOrder,
  updateHireOrder,
  deleteHireOrder,
  saveVendorEmail,
  uploadHireOrder,
}