const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const PurchaseOrder = require('./purchase.model')
const wsUtils = require('#core/socket/socket.io')
const dashboardServices = require('#features/dashboard/dashboard.service')
const { buildSignatures, resolveVendorCode, calculateTotal, wrapServiceError } = require('./purchase.helper')
const { notifyStaffMain, notifyStaffHero } = require('./purchase.notification')

const UPLOAD_ALLOWED_STATUSES = [
  'purchaseorder_uploaded',
  'purchase_manager_approved',
  'accounts_approved',
  'operation_manager_approved',
  'ceo_approved',
  'md_approved',
  'items_available',
]

const createPurchaseOrder = async (purchaseorderData) => {
  try {
    const totalAmount = calculateTotal(purchaseorderData.items, purchaseorderData.showDiscountInTotal, purchaseorderData.discount)
    const signatures = buildSignatures(purchaseorderData.signatures)
    const { vendorCode, vendorMail } = await resolveVendorCode(purchaseorderData.company.vendor)

    const purchaseorder = new PurchaseOrder({
      ...purchaseorderData,
      totalAmount,
      signatures,
      vendorCode,
      vendorMail,
      isAmendmented: false,
      amendments: [],
    })

    if (purchaseorderData.normalPurchaseOrder) {
      await notifyStaffMain({
        title: `Purchase Order ${purchaseorder.purchaseorderRef} Created`,
        description: `Purchase Order: ${purchaseorderData.purchaseorderRef} for ${purchaseorderData.company.vendor} for ${purchaseorderData.equipments}, Await until purchaseorder is uploaded`,
        sourceId: 'purchaseorder_approval',
      })
    }

    dashboardServices.clearDashboardCache()
    wsUtils.dispatchDashboardUpdate('purchaseorder')

    return await purchaseorder.save()
  } catch (error) {
    throw wrapServiceError('createPurchaseOrder', error)
  }
}

const uploadPurchaseOrder = async (purchaseorderFileData, uploadedBy, purchaseorderRef, description, isAmendment = false) => {
  try {
    const purchaseorderData = await PurchaseOrder.findOne({ purchaseorderRef })
    if (!purchaseorderData) throw Object.assign(new Error('Purchase Order not found'), { status: HTTP.NOT_FOUND })

    const validStatuses = isAmendment ? UPLOAD_ALLOWED_STATUSES : ['purchaseorder_created']
    if (!validStatuses.includes(purchaseorderData.workflowStatus)) {
      throw Object.assign(
        new Error(`Invalid workflow status for Purchase Order ${isAmendment ? 'amendment' : 'upload'}`),
        { status: HTTP.BAD_REQUEST }
      )
    }

    const uploadTimestamp = new Date()
    const updateData = {
      workflowStatus: isAmendment ? 'purchaseorder_amended' : 'purchaseorder_uploaded',
      updatedAt: uploadTimestamp,
      'purchaseorderDetails.purchaseorderFile': { ...purchaseorderFileData, generatedFor: uploadTimestamp.toISOString() },
      updatedAt: new Date(),
      'purchaseorderDetails.purchaseorderFile': purchaseorderFileData,
      'purchaseorderDetails.purchaseorderRef': purchaseorderRef,
      'purchaseorderDetails.description': description || '',
      'purchaseorderDetails.uploadedBy': uploadedBy,
      'purchaseorderDetails.uploadedDate': new Date(),
      'purchaseorderDetails.status': isAmendment ? 'amended' : 'uploaded',
    }

    if (isAmendment) {
      Object.assign(updateData, {
        'purchaseorderDetails.isAmendment': true,
        'purchaseorderDetails.amendmentDate': new Date().toLocaleDateString('en-GB'),
        'purchaseorderDetails.PMRsigned': false,
        'purchaseorderDetails.PMRauthorised': false,
        'purchaseorderDetails.MANAGERsigned': false,
        'purchaseorderDetails.MANAGERauthorised': false,
        'purchaseorderDetails.ACCOUNTSsigned': false,
        'purchaseorderDetails.ACCOUNTSauthorised': false,
        'purchaseorderDetails.CEOsigned': false,
        'purchaseorderDetails.CEOauthorised': false,
        'purchaseorderDetails.MDsigned': false,
        'purchaseorderDetails.MDauthorised': false,
      })
    }

    updateData.$push = {
      approvalTrail: {
        approvedBy: uploadedBy,
        role: 'WORKSHOP_MANAGER',
        approvalDate: new Date(),
        comments: isAmendment ? `Purchase Order amendment uploaded: ${purchaseorderRef}` : `Purchase Order document uploaded: ${purchaseorderRef}`,
        action: 'uploaded',
      },
    }

    const purchaseorderUpdated = await PurchaseOrder.findOneAndUpdate({ purchaseorderRef }, updateData, {
      new: true,
      runValidators: true,
    })

    const title = isAmendment ? `Purchase Order Amendment Approval Needed - ${purchaseorderRef}` : `Purchase Order Approval Needed - ${purchaseorderRef}`
    const notifDescription = isAmendment
      ? `Purchase Order has been amended. Purchase Order Ref: ${purchaseorderRef}. Manager Approval Needed! Please review and approve the amendment.`
      : `New Purchase Order created. Purchase Order Ref: ${purchaseorderRef}. Manager Approval Needed! Please review and approve.`

    await notifyStaffHero({
      title,
      description: notifDescription,
      sourceId: 'purchaseorder_approval',
      navigateTo: `/(signature)/op/${purchaseorderRef}`,
      navigateText: 'View and Sign',
      navigteToId: purchaseorderRef,
      hasButton: true,
    })

    return {
      status: 202,
      message: isAmendment
        ? 'Purchase Order amendment uploaded successfully and sent for re-approval'
        : 'Purchase Order uploaded successfully and sent to PURCHASE_MANAGER for approval',
      data: purchaseorderUpdated,
    }
  } catch (error) {
    logger.error('[purchase.service] uploadPurchaseOrder:', error)
    throw error
  }
}

const updatePurchaseOrder = async (refNo, updateData) => {
  try {
    const existingPurchaseOrder = await PurchaseOrder.findOne({ purchaseorderRef: refNo.trim() })
    if (!existingPurchaseOrder) throw new Error('Purchase Order not found')

    if (updateData.isAmendmented === true) {
      const amendment = {
        amendmentDate: new Date(),
        amendedBy: updateData.amendedBy || 'System',
        reason: updateData.amendmentReason || 'Amendment requested',
      }

      if (updateData.items?.length > 0) {
        amendment.amendedItems = updateData.items
        amendment.amendedTotalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

        if (updateData.showDiscountInTotal && updateData.discount) {
          amendment.amendedTotalAmount -= updateData.discount
          amendment.amendedDiscount = updateData.discount
        }
      }

      if (updateData.company) amendment.amendedCompany = updateData.company
      if (updateData.equipments) amendment.amendedEquipments = updateData.equipments
      if (updateData.workingHrs !== undefined) amendment.amendedWorkingHrs = updateData.workingHrs
      if (updateData.runningKm !== undefined) amendment.amendedRunningKm = updateData.runningKm
      if (updateData.quoteNo) amendment.amendedQuoteNo = updateData.quoteNo
      if (updateData.requestText) amendment.amendedRequestText = updateData.requestText
      if (updateData.termsAndConditions) amendment.amendedTermsAndConditions = updateData.termsAndConditions

      return await PurchaseOrder.findOneAndUpdate(
        { purchaseorderRef: refNo.trim() },
        {
          $set: {
            isAmendmented: true,
            pmSigned: false,
            accountsSigned: false,
            managerSigned: false,
            ceoSigned: false,
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

    return await PurchaseOrder.findOneAndUpdate({ purchaseorderRef: refNo.trim() }, { $set: updateData }, {
      new: true,
      runValidators: true,
    })
  } catch (error) {
    throw wrapServiceError('updatePurchaseOrder', error)
  }
}

const deletePurchaseOrder = async (refNo) => {
  try {
    const purchaseorder = await PurchaseOrder.findOneAndDelete({ purchaseorderRef: refNo })
    if (!purchaseorder) throw new Error('Purchase Order not found')
    return purchaseorder
  } catch (error) {
    throw wrapServiceError('deletePurchaseOrder', error)
  }
}

const sendPurchaseOrderViaEmail = async (vendorCode, emails) => {
  try {
    const emailArray = Array.isArray(emails) ? emails : [emails]
    return await PurchaseOrder.updateMany({ vendorCode }, { $set: { vendorMail: emailArray } })
  } catch (error) {
    throw wrapServiceError('sendPurchaseOrderViaEmail', error)
  }
}

module.exports = {
  createPurchaseOrder,
  uploadPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  sendPurchaseOrderViaEmail,
}