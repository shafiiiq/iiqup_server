const LPO                    = require('../models/lpo.model');
const { createNotification } = require('./notification.service');
const PushNotificationService = require('../push/notification.push');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the default signatures object, merging provided values with defaults.
 * @param {object|null} signatures
 * @returns {object}
 */
const buildSignatures = (signatures) => ({
  accountsDept:              signatures?.accountsDept              || 'ROSHAN SHA',
  purchasingManager:         signatures?.purchasingManager         || 'ABDUL MALIK',
  operationsManager:         signatures?.operationsManager         || 'SURESHKANTH',
  authorizedSignatory:       signatures?.authorizedSignatory       || 'AHAMMED KAMAL',
  authorizedSignatoryTitle:  signatures?.authorizedSignatoryTitle  || 'CEO'
});

/**
 * Resolves or generates a vendor code for the given vendor name.
 * @param {string} vendorName
 * @returns {Promise<{ vendorCode: string, vendorMail: string|null }>}
 */
const resolveVendorCode = async (vendorName) => {
  const existingVendor = await LPO.findOne({
    'company.vendor': { $regex: new RegExp(`^${vendorName.trim()}$`, 'i') },
    vendorCode: { $ne: null }
  }).select('vendorCode vendorMail');

  if (existingVendor) {
    return { vendorCode: existingVendor.vendorCode, vendorMail: existingVendor.vendorMail || [] };
  }

  const lastVendor = await LPO.findOne({ vendorCode: { $ne: null } })
    .sort({ createdAt: -1 })
    .select('vendorCode');

  if (lastVendor?.vendorCode) {
    const num        = parseInt(lastVendor.vendorCode.split('-')[1]) + 1;
    const vendorCode = `VEN-${String(num).padStart(3, '0')}`;
    return { vendorCode, vendorMail: null };
  }

  return { vendorCode: 'VEN-001', vendorMail: null };
};

/**
 * Calculates the total amount from items, optionally applying a discount.
 * @param {object[]} items
 * @param {boolean}  showDiscountInTotal
 * @param {number}   discount
 * @returns {number}
 */
const calculateTotal = (items, showDiscountInTotal, discount) => {
  let total = items.reduce((sum, item) => sum + item.totalPrice, 0);
  if (showDiscountInTotal && discount) total -= discount;
  return total;
};

/**
 * Builds signed credential fields for a given role prefix.
 * @param {string} prefix  e.g. 'PMR' | 'MANAGER' | 'CEO' | 'MD' | 'ACCOUNTS'
 * @param {object} creds
 * @returns {object}
 */
const buildSignedFields = (prefix, creds) => {
  const fields = {
    [`lpoDetails.${prefix}signed`]:      true,
    [`lpoDetails.${prefix}authorised`]:  creds.authorised,
    [`lpoDetails.${prefix}approvedBy`]:  creds.approvedBy,
    [`lpoDetails.${prefix}approvedDate`]: creds.approvedDate || new Date().toISOString()
  };

  if (creds.approvedFrom)    fields[`lpoDetails.${prefix}approvedFrom`]    = creds.approvedFrom;
  if (creds.approvedIP)      fields[`lpoDetails.${prefix}approvedIP`]      = creds.approvedIP;
  if (creds.approvedBDevice) fields[`lpoDetails.${prefix}approvedBDevice`] = creds.approvedBDevice;
  if (creds.approvedLocation) fields[`lpoDetails.${prefix}approvedLocation`] = creds.approvedLocation;

  return fields;
};

/**
 * Sends a notification and a push notification together.
 * @param {object} notifPayload
 * @param {string|Array} recipient 
 * @param {string} title
 * @param {string} description
 * @param {string} priority 
 * @returns {Promise<void>}
 */
const notify = async (notifPayload, recipient, title, description, priority = 'high') => {
  const notification = await createNotification({ ...notifPayload, recipient, time: new Date() });

  await PushNotificationService.sendGeneralNotification(
    recipient,
    title,
    description,
    priority,
    'normal',
    notification.data._id.toString()
  );
};

const roleScreenMap = (role, isMD) => {
  const map = {
    PURCHASE_MANAGER:  'purchaseManagerSign',
    MANAGER:           'managerSign',
    CEO:               isMD ? 'mdSign' : 'ceoSign',
    MANAGING_DIRECTOR: 'mdSign',
    ACCOUNTS:          'accountsSign',
  };
  return map[role] || 'lpoSign';
};

const buildNextStepNotif = (role, lpoRef, updated) => {
  const isMD = updated.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR';

  const map = {
     MANAGER: {
       title:        `Purchase Manager Approval Needed — LPO ${lpoRef}`,
       description:  `Manager signed LPO ${lpoRef}. Purchase Manager approval needed.`,
       sourceId:     'lpo_approval',
       navigateTo:   `/(screens)/purchaseManagerSign/${lpoRef}`,
       navigateText: 'View and Sign',
       recipient:    JSON.parse(process.env.OFFICE_HERO),
     },
     PURCHASE_MANAGER: {
       title:        `Accounts Approval Needed — LPO ${lpoRef}`,
       description:  `Purchase Manager signed LPO ${lpoRef}. Accounts approval needed.`,
       sourceId:     'accounts_approval',
       navigateTo:   `/(screens)/accountsSign/${lpoRef}`,
       navigateText: 'View and Sign',
       recipient:    JSON.parse(process.env.OFFICE_HERO),
     },
     ACCOUNTS: {
       title:        `${updated.signatures?.authorizedSignatoryTitle || 'CEO'} Approval Needed — LPO ${lpoRef}`,
       description:  `Accounts signed LPO ${lpoRef}. ${updated.signatures?.authorizedSignatoryTitle || 'CEO'} approval needed.`,
       sourceId:     isMD ? 'md_approval' : 'ceo_approval',
       navigateTo:   isMD ? `/(screens)/mdSign/${lpoRef}` : `/(screens)/ceoSign/${lpoRef}`,
       navigateText: 'View and Sign',
       recipient:    JSON.parse(process.env.OFFICE_HERO),
     },
     CEO: {
       title:        `LPO ${lpoRef} Fully Signed`,
       description:  `CEO signed LPO ${lpoRef}. All signatures complete.`,
       sourceId:     'final_approval',
       navigateTo:   `/(screens)/signedLpo/${lpoRef}`,
       navigateText: 'View LPO',
       recipient:    JSON.parse(process.env.OFFICE_MAIN),
     },
     MANAGING_DIRECTOR: {
       title:        `LPO ${lpoRef} Fully Signed`,
       description:  `MD signed LPO ${lpoRef}. All signatures complete.`,
       sourceId:     'final_approval',
       navigateTo:   `/(screens)/signedLpo/${lpoRef}`,
       navigateText: 'View LPO',
       recipient:    JSON.parse(process.env.OFFICE_MAIN),
     },
     // ACCOUNTS intentionally omitted — handled by allSigned check
  };

  return map[role] || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new LPO record with vendor code resolution and optional notification.
 * @param {object} lpoData
 * @returns {Promise<object>}
 */
const createLPO = async (lpoData) => {
  try {
    const totalAmount              = calculateTotal(lpoData.items, lpoData.showDiscountInTotal, lpoData.discount);
    const signatures               = buildSignatures(lpoData.signatures);
    const { vendorCode, vendorMail } = await resolveVendorCode(lpoData.company.vendor);

    const lpo = new LPO({
      ...lpoData,
      totalAmount,
      signatures,
      vendorCode,
      vendorMail,
      isAmendmented: false,
      amendments:    []
    });

    if (lpoData.normalLPO) {
      const title       = `LPO ${lpo.lpoRef} Created`;
      const description = `LPO: ${lpoData.lpoRef} for ${lpoData.company.vendor} for ${lpoData.equipments}, Await until lpo is uploaded`;

      await notify(
        { title, description, priority: 'high', sourceId: 'lpo_approval' },
        JSON.parse(process.env.OFFICE_MAIN),
        title,
        description
      );
    }

    return await lpo.save();
  } catch (error) {
    console.error('[LPOService] createLPO:', error);
    throw new Error(`Error creating LPO: ${error.message}`);
  }
};

/**
 * Uploads an LPO document (or amendment) to a given LPO reference, advancing the workflow.
 * @param {object}  lpoFileData
 * @param {string}  uploadedBy
 * @param {string}  lpoRef
 * @param {string}  description
 * @param {boolean} isAmendment
 * @returns {Promise<object>}
 */
const uploadLPO = async (lpoFileData, uploadedBy, lpoRef, description, isAmendment = false) => {
  try {
    const LpoData = await LPO.findOne({ lpoRef });
    if (!LpoData) throw Object.assign(new Error('LPO not found'), { status: 404 });

    const validStatuses = isAmendment
      ? ['lpo_uploaded', 'purchase_approved', 'accounts_approved', 'manager_approved', 'ceo_approved', 'md_approved', 'items_available']
      : ['lpo_created'];

    if (!validStatuses.includes(LpoData.workflowStatus)) {
      throw Object.assign(
        new Error(`Invalid workflow status for LPO ${isAmendment ? 'amendment' : 'upload'}`),
        { status: 400 }
      );
    }

    const updateData = {
      workflowStatus:               isAmendment ? 'lpo_amended' : 'lpo_uploaded',
      updatedAt:                    new Date(),
      'lpoDetails.lpoFile':         lpoFileData,
      'lpoDetails.lpoRef':          lpoRef,
      'lpoDetails.description':     description || '',
      'lpoDetails.uploadedBy':      uploadedBy,
      'lpoDetails.uploadedDate':    new Date(),
      'lpoDetails.status':          isAmendment ? 'amended' : 'uploaded'
    };

    if (isAmendment) {
      Object.assign(updateData, {
        'lpoDetails.isAmendment':       true,
        'lpoDetails.amendmentDate':     new Date().toLocaleDateString('en-GB'),
        'lpoDetails.PMRsigned':         false,
        'lpoDetails.PMRauthorised':     false,
        'lpoDetails.MANAGERsigned':     false,
        'lpoDetails.MANAGERauthorised': false,
        'lpoDetails.ACCOUNTSsigned':    false,
        'lpoDetails.ACCOUNTSauthorised': false,
        'lpoDetails.CEOsigned':         false,
        'lpoDetails.CEOauthorised':     false,
        'lpoDetails.MDsigned':          false,
        'lpoDetails.MDauthorised':      false
      });
    }

    updateData.$push = {
      approvalTrail: {
        approvedBy:   uploadedBy,
        role:         'WORKSHOP_MANAGER',
        approvalDate: new Date(),
        comments:     isAmendment ? `LPO amendment uploaded: ${lpoRef}` : `LPO document uploaded: ${lpoRef}`,
        action:       'uploaded'
      }
    };

    const lpoUpdated = await LPO.findOneAndUpdate({ lpoRef }, updateData, { new: true, runValidators: true });

    const title       = isAmendment ? `LPO Amendment Approval Needed - ${lpoRef}` : `LPO Approval Needed - ${lpoRef}`;
    const description2 = isAmendment
      ? `LPO has been amended. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve the amendment.`
      : `New LPO created. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve.`;

    await notify(
      {
        title, description: description2, priority: 'high', sourceId: 'lpo_approval',
        navigateTo: `/(screens)/purchaseManagerSign/${lpoRef}`,
        navigateText: 'View and Sign', navigteToId: lpoRef, hasButton: true
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description2
    );

    return {
      status:  202,
      message: isAmendment
        ? 'LPO amendment uploaded successfully and sent for re-approval'
        : 'LPO uploaded successfully and sent to PURCHASE_MANAGER for approval',
      data: lpoUpdated
    };
  } catch (error) {
    console.error('[LPOService] uploadLPO:', error);
    throw error;
  }
};

/**
 * Updates an existing LPO by ref number, supporting both regular edits and amendments.
 * @param {string} refNo
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateLPO = async (refNo, updateData) => {
  try {
    const existingLPO = await LPO.findOne({ lpoRef: refNo.trim() });
    if (!existingLPO) throw new Error('LPO not found');

    if (updateData.isAmendmented === true) {
      const amendment = {
        amendmentDate: new Date(),
        amendedBy:     updateData.amendedBy || 'System',
        reason:        updateData.amendmentReason || 'Amendment requested'
      };

      if (updateData.items?.length > 0) {
        amendment.amendedItems       = updateData.items;
        amendment.amendedTotalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

        if (updateData.showDiscountInTotal && updateData.discount) {
          amendment.amendedTotalAmount -= updateData.discount;
          amendment.amendedDiscount    = updateData.discount;
        }
      }

      if (updateData.company)           amendment.amendedCompany          = updateData.company;
      if (updateData.equipments)        amendment.amendedEquipments       = updateData.equipments;
      if (updateData.workingHrs  !== undefined) amendment.amendedWorkingHrs  = updateData.workingHrs;
      if (updateData.runningKm   !== undefined) amendment.amendedRunningKm   = updateData.runningKm;
      if (updateData.quoteNo)           amendment.amendedQuoteNo           = updateData.quoteNo;
      if (updateData.requestText)       amendment.amendedRequestText       = updateData.requestText;
      if (updateData.termsAndConditions) amendment.amendedTermsAndConditions = updateData.termsAndConditions;

      return await LPO.findOneAndUpdate(
        { lpoRef: refNo.trim() },
        {
          $set:  { isAmendmented: true, pmSigned: false, accountsSigned: false, managerSigned: false, ceoSigned: false },
          $push: { amendments: amendment }
        },
        { new: true, runValidators: true }
      );
    }

    if (updateData.items?.length > 0) {
      updateData.totalAmount = updateData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    }

    if (updateData.showDiscountInTotal && updateData.discount) {
      updateData.totalAmount = (updateData.totalAmount || 0) - (updateData.discount || 0);
    }

    delete updateData.amendedBy;
    delete updateData.amendmentReason;

    return await LPO.findOneAndUpdate(
      { lpoRef: refNo.trim() },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  } catch (error) {
    console.error('[LPOService] updateLPO:', error);
    throw new Error(`Error updating LPO: ${error.message}`);
  }
};

/**
 * Deletes an LPO by reference number.
 * @param {string} refNo
 * @returns {Promise<object>}
 */
const deleteLPO = async (refNo) => {
  try {
    const lpo = await LPO.findOneAndDelete({ lpoRef: refNo });
    if (!lpo) throw new Error('LPO not found');
    return lpo;
  } catch (error) {
    console.error('[LPOService] deleteLPO:', error);
    throw new Error(`Error deleting LPO: ${error.message}`);
  }
};

/**
 * Saves or updates the vendor email across all LPOs sharing the same vendor code.
 * @param {string} vendorCode
 * @param {string} email
 * @returns {Promise<object>}
 */
const saveVendorEmail = async (vendorCode, emails) => {
  try {
    const emailArray = Array.isArray(emails) ? emails : [emails];
    return await LPO.updateMany({ vendorCode }, { $set: { vendorMail: emailArray } });
  } catch (error) {
    console.error('[LPOService] saveVendorEmail:', error);
    throw new Error(`Error saving vendor email: ${error.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Approval Workflow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records purchase manager approval for an LPO.
 * @param {string} lpoRef
 * @param {object} approvalData
 * @returns {Promise<object>}
 */
const purchaseApproval = async (lpoRef, approvalData) => {
  try {
    const {
      approvedBy, comments = '', signed = false, authorised = false,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation
    } = approvalData;

    const lpo = await LPO.findOne({ lpoRef });
    if (!lpo) throw { status: 404, message: 'LPO not found' };

    const validStatuses = ['lpo_uploaded', 'lpo_amended'];
    if (!validStatuses.includes(lpo.workflowStatus)) {
      throw { status: 400, message: `Invalid workflow status. Expected 'lpo_uploaded' or 'lpo_amended', got '${lpo.workflowStatus}'` };
    }

    const updateFields = {
      'lpoDetails.purchaseApprovalDate': new Date(),
      'lpoDetails.status':               'purchase_approved',
      workflowStatus:                    'purchase_approved',
      $push: {
        approvalTrail: { approvedBy, role: 'PURCHASE_MANAGER', action: 'approved', comments: comments || 'Purchase approved' }
      }
    };

    if (signed) {
      Object.assign(updateFields, buildSignedFields('PMR', { approvedBy, authorised, approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation }));
    }

    const lpoUpdated = await LPO.findOneAndUpdate({ lpoRef }, updateFields, { new: true });
    if (!lpoUpdated) throw { status: 404, message: 'Failed to update LPO' };

    const isAmendment = lpoUpdated.isAmendmented;
    const title       = isAmendment ? `Amendment! MANAGER Approval Needed - LPO ${lpoRef}` : `MANAGER Approval Needed - LPO ${lpoRef}`;
    const description = isAmendment
      ? 'Purchase Manager signed and approved amendment LPO. Manager approval needed.'
      : 'Purchase Manager signed and approved LPO. Manager approval needed.';

    await notify(
      {
        title, description, priority: 'high', sourceId: 'accounts_approval',
        navigateTo: `/(screens)/managerSign/${lpoRef}`,
        navigateText: 'View and Sign', navigteToId: lpoRef, hasButton: true
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return {
      status:  200,
      message: `Purchase Manager approval ${signed ? 'and signing ' : ''}completed successfully`,
      data:    lpoUpdated,
      signed,
      authorised
    };
  } catch (error) {
    console.error('[LPOService] purchaseApproval:', error);
    throw error;
  }
};

/**
 * Records manager approval for an LPO and routes to CEO or MD based on document settings.
 * @param {string} lpoRef
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const managerApproval = async (lpoRef, approvedBy, comments = '', approvedCreds) => {
  try {
    const updateFields = {
      'lpoDetails.managerApprovalDate': new Date(),
      'lpoDetails.status':              'manager_approved',
      workflowStatus:                   'manager_approved',
      $push: {
        approvalTrail: { approvedBy, role: 'MANAGER', action: 'approved', comments: comments || 'MANAGER approved' }
      }
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, buildSignedFields('MANAGER', approvedCreds));
    }

    const lpoUpdated = await LPO.findOneAndUpdate({ lpoRef }, updateFields, { new: true });
    if (!lpoUpdated) throw { status: 404, message: 'LPO not found' };

    const isAmendment    = lpoUpdated.isAmendmented;
    const signatoryTitle = lpoUpdated.signatures?.authorizedSignatoryTitle || 'CEO';
    const isCEO          = signatoryTitle === 'CEO';
    const signedLabel    = approvedCreds?.signed ? 'signed and ' : '';
    const prefix         = isAmendment ? 'Amendment! ' : '';

    let target, screen, title, description, source;

    if (isCEO && !isAmendment) {
      target = process.env.CEO; screen = `/(screens)/ceoSign/${lpoRef}`;
      title  = `CEO Approval Needed - LPO ${lpoRef}`;
      description = `Manager ${signedLabel}approved LPO. CEO approval needed.`;
      source = 'ceo_approval';
    } else if (!isCEO && !isAmendment) {
      target = process.env.MD; screen = `/(screens)/mdSign/${lpoRef}`;
      title  = `MD Approval Needed - LPO ${lpoRef}`;
      description = `Manager ${signedLabel}approved LPO. MD approval needed.`;
      source = 'md_approval';
    } else if (isCEO && isAmendment) {
      target = process.env.CEO; screen = `/(screens)/ceoSign/${lpoRef}`;
      title  = `${prefix}CEO Approval Needed - LPO ${lpoRef}`;
      description = `Manager ${signedLabel}approved amendment LPO. CEO approval needed.`;
      source = 'ceo_approval';
    } else if (!isCEO && isAmendment) {
      target = process.env.MD; screen = `/(screens)/mdSign/${lpoRef}`;
      title  = `${prefix}MD Approval Needed - LPO ${lpoRef}`;
      description = `Manager ${signedLabel}approved amendment LPO. MD approval needed.`;
      source = 'md_approval';
    } else {
      throw { status: 400, message: 'Invalid authorized signatory position' };
    }

    await notify(
      {
        title, description, priority: 'high', sourceId: source,
        navigateTo: screen, navigateText: 'View and Sign', navigteToId: lpoRef, hasButton: true
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return { status: 200, message: 'MANAGER approval completed', data: lpoUpdated };
  } catch (error) {
    console.error('[LPOService] managerApproval:', error);
    throw error;
  }
};

/**
 * Records CEO or MD approval for an LPO.
 * @param {string} lpoRef
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @param {string} authUser  'CEO' | 'MD'
 * @returns {Promise<object>}
 */
const ceoApproval = async (lpoRef, approvedBy, comments = '', approvedCreds, authUser) => {
  try {
    const approverType    = authUser === 'MD' ? 'MD' : 'CEO';
    const approvalStatus  = `${approverType.toLowerCase()}_approved`;

    const updateFields = {
      [`lpoDetails.${approverType.toLowerCase()}ApprovalDate`]: new Date(),
      'lpoDetails.status': approvalStatus,
      workflowStatus:      approvalStatus,
      $push: {
        approvalTrail: {
          approvedBy, role: approverType, action: 'approved',
          comments: comments || `${approverType} approved`
        }
      }
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, buildSignedFields(approverType, approvedCreds));
    }

    const lpoUpdated = await LPO.findOneAndUpdate({ lpoRef }, updateFields, { new: true });
    if (!lpoUpdated) throw { status: 404, message: 'LPO not found' };

    const isAmendment    = lpoUpdated.isAmendmented;
    const signatoryTitle = lpoUpdated.signatures?.authorizedSignatoryTitle === 'CEO' ? 'CEO' : 'MD';
    const prefix         = isAmendment ? 'Amendment! ' : '';

    const title       = `${prefix}ACCOUNTS Approval Needed - LPO ${lpoRef}`;
    const description = `${signatoryTitle} signed and approved ${isAmendment ? 'amendment ' : ''}LPO. Accounts approval needed.`;

    await notify(
      {
        title, description, priority: 'high', sourceId: 'final_approval',
        navigateTo: `/(screens)/accountsSign/${lpoRef}`,
        navigateText: 'View and Sign', navigteToId: lpoRef, hasButton: true
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return { status: 200, message: `${approverType} approval completed`, data: lpoUpdated };
  } catch (error) {
    console.error('[LPOService] ceoApproval:', error);
    throw error;
  }
};

/**
 * Records accounts approval for an LPO, completing the workflow.
 * @param {string} lpoRef
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const accountsApproval = async (lpoRef, approvedBy, comments = '', approvedCreds) => {
  try {
    const updateFields = {
      'lpoDetails.accountsApprovalDate': new Date(),
      'lpoDetails.status':               'accounts_approved',
      workflowStatus:                    'accounts_approved',
      $push: {
        approvalTrail: { approvedBy, role: 'ACCOUNTS', action: 'approved', comments: comments || 'ACCOUNTS approved' }
      }
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, buildSignedFields('ACCOUNTS', approvedCreds));
    }

    const lpoUpdated = await LPO.findOneAndUpdate({ lpoRef }, updateFields, { new: true });
    if (!lpoUpdated) throw { status: 404, message: 'LPO not found' };

    const isAmendment = lpoUpdated.isAmendmented;
    const title       = isAmendment ? `Amendment! Approved - LPO ${lpoRef}` : `Approved - LPO ${lpoRef}`;
    const description = isAmendment
      ? 'Accounts approved amendment LPO. Items can now be procured.'
      : 'Accounts approved LPO. Items can now be procured.';

    await notify(
      {
        title, description, priority: 'high', sourceId: 'manager_approval',
        navigateTo: `/(screens)/signedLpo/${lpoRef}`,
        navigateText: 'View the item required', navigteToId: lpoRef, hasButton: true
      },
      JSON.parse(process.env.OFFICE_MAIN),
      title,
      description
    );

    return { status: 200, message: 'ACCOUNTS approval completed', data: lpoUpdated };
  } catch (error) {
    console.error('[LPOService] accountsApproval:', error);
    throw error;
  }
};

/**
 * Marks items as procured and available for an LPO.
 * @param {string} lpoRef
 * @param {string} markedBy
 * @returns {Promise<object>}
 */
const markItemsAvailable = async (lpoRef, markedBy) => {
  try {
    const lpoUpdated = await LPO.findOneAndUpdate(
      { lpoRef },
      {
        'lpoDetails.status': 'items_procured',
        workflowStatus:      'items_available',
        $push: {
          approvalTrail: { approvedBy: markedBy, role: 'PROCUREMENT', action: 'approved', comments: 'Items procured and available' }
        }
      },
      { new: true }
    );

    if (!lpoUpdated) throw { status: 404, message: 'LPO not found' };

    const title       = `LPO Approved - ${lpoRef}`;
    const description = 'All requested items can now be procured';

    await notify(
      { title, description, priority: 'high', sourceId: 'items_ready' },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return { status: 200, message: 'Items marked as available', data: lpoUpdated };
  } catch (error) {
    console.error('[LPOService] markItemsAvailable:', error);
    throw error;
  }
};

/**
 * Signs an LPO on behalf of a recognised signatory resolved from uniqueCode.
 * @param {string} lpoRef
 * @param {object} signData
 * @returns {Promise<object>}
 */
const signLPO = async (lpoRef, signData) => {
  const {
    uniqueCode, signedDate, signedFrom, override = false,
    signedIP = null, signedDevice = null, signedLocation = null
  } = signData;

  // ── Role resolution ────────────────────────────────────────────────────────
  const roleMap = [
    { envKey: process.env.MANAGER,          field: 'managerSigned',  detailsPrefix: 'MANAGER',  role: 'MANAGER',           order: 1 },
    { envKey: process.env.PURCHASE_MANAGER, field: 'pmSigned',       detailsPrefix: 'PMR',      role: 'PURCHASE_MANAGER',  order: 2 },
    { envKey: process.env.WORKSHOP_MANAGER, field: 'pmSigned',       detailsPrefix: 'PMR',      role: 'PURCHASE_MANAGER',  order: 2 },  // shares same field
    { envKey: process.env.CEO,              field: 'ceoSigned',      detailsPrefix: 'CEO',      role: 'CEO',               order: 4 },
    { envKey: process.env.MD,               field: 'ceoSigned',      detailsPrefix: 'MD',       role: 'MANAGING_DIRECTOR', order: 4 },
    { envKey: process.env.ACCOUNTS,         field: 'accountsSigned', detailsPrefix: 'ACCOUNTS', role: 'ACCOUNTS',          order: 3 },
  ];

  const matched = roleMap.find(r => r.envKey === uniqueCode);
  if (!matched) {
    throw { status: 403, message: 'Unauthorised: your account is not recognised as an authorised signatory for LPO documents' };
  }

  const lpo = await LPO.findOne({ lpoRef });
  if (!lpo) throw { status: 404, message: `LPO not found: ${lpoRef}` };

  if (lpo.workflowStatus === 'lpo_created') {
     throw { status: 403, message: 'LPO_NOT_UPLOADED' }; 
  }

  // ── CEO vs MD guard ────────────────────────────────────────────────────────
  if (matched.role === 'CEO' || matched.role === 'MANAGING_DIRECTOR') {
    const savedTitle   = lpo.signatures?.authorizedSignatoryTitle || 'CEO';
    const expectedRole = savedTitle === 'MANAGING DIRECTOR' ? 'MANAGING_DIRECTOR' : 'CEO';
    if (matched.role !== expectedRole) {
      throw { status: 403, message: `This document requires ${savedTitle} signature, not ${matched.role}` };
    }
  }

  // ── Already signed guard ───────────────────────────────────────────────────
  if (lpo[matched.field] === true) {
    throw { status: 409, message: `This position (${matched.role}) has already been signed` };
  }

  // ── Out-of-order detection ─────────────────────────────────────────────────
  const isMD     = lpo.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR';
  const authRole = isMD ? 'MANAGING_DIRECTOR' : 'CEO';

  const chain = [
    { role: 'MANAGER',          signed: lpo.managerSigned,  order: 1 },
    { role: 'PURCHASE_MANAGER', signed: lpo.pmSigned,       order: 2 },
    { role: 'ACCOUNTS',         signed: lpo.accountsSigned, order: 3 },
    { role: authRole,           signed: lpo.ceoSigned,      order: 4 },
  ];

  const myOrder       = matched.order;
  const unsignedAbove = chain.filter(c => c.order < myOrder && !c.signed);

  if (unsignedAbove.length > 0 && !override) {
    return {
      status:          202,
      requireOverride: true,
      message:         'Out-of-order signing detected. Confirm override to proceed.',
      unsignedAbove:   unsignedAbove.map(c => c.role),
    };
  }

  // ── Write the signature ────────────────────────────────────────────────────
  const p            = matched.detailsPrefix;
  const updateFields = {
    [matched.field]:                     true,
    [`lpoDetails.${p}signed`]:           true,
    [`lpoDetails.${p}authorised`]:       true,
    [`lpoDetails.${p}approvedBy`]:       uniqueCode,
    [`lpoDetails.${p}approvedDate`]:     signedDate,
    [`lpoDetails.${p}approvedFrom`]:     signedFrom,
    [`lpoDetails.${p}approvedIP`]:       signedIP,
    [`lpoDetails.${p}approvedBDevice`]:  signedDevice,
    [`lpoDetails.${p}approvedLocation`]: signedLocation,
    $push: {
      approvalTrail: {
        approvedBy:   uniqueCode,
        role:         matched.role,
        action:       override && unsignedAbove.length > 0 ? 'override_signed' : 'signed',
        comments:     override && unsignedAbove.length > 0
          ? `Override signed by ${matched.role} — predecessors not yet signed`
          : `Signed via web by ${matched.role}`,
        approvalDate: new Date(),
      }
    }
  };

  const updated = await LPO.findOneAndUpdate({ lpoRef }, updateFields, { new: true });
  if (!updated) throw { status: 500, message: 'Failed to update LPO record' };

  // ── Notifications ──────────────────────────────────────────────────────────

  // 1. Override — notify OFFICE_HERO once per unsigned person above
  if (override && unsignedAbove.length > 0) {
    for (const above of unsignedAbove) {
      const title       = `Action Required — LPO ${lpoRef} override signed`;
      const description = `${matched.role} has signed LPO ${lpoRef} out of order. ${above.role} signature is still required.`;

      await notify(
        {
          title, description, priority: 'high', sourceId: 'lpo_approval',
          navigateTo:   `/(screens)/${roleScreenMap(above.role, isMD)}/${lpoRef}`,
          navigateText: 'View and Sign',
          navigteToId:  lpoRef,
          hasButton:    true,
        },
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description
      );
    }
  }

  // 2. Normal next-step notification (only when signing in order)
  if (!override || unsignedAbove.length === 0) {
    const nextNotif = buildNextStepNotif(matched.role, lpoRef, updated);
    if (nextNotif) {
      await notify(
        {
          title:        nextNotif.title,
          description:  nextNotif.description,
          priority:     'high',
          sourceId:     nextNotif.sourceId,
          navigateTo:   nextNotif.navigateTo,
          navigateText: nextNotif.navigateText,
          navigteToId:  lpoRef,
          hasButton:    true,
        },
        nextNotif.recipient,
        nextNotif.title,
        nextNotif.description
      );
    }
  }

  // 3. All signed — only fire when all 4 have signed
  const allSigned =
    updated.pmSigned &&
    updated.managerSigned &&
    updated.ceoSigned &&
    updated.accountsSigned;

  if (allSigned) {
    const title       = `LPO Signed & Ready — ${lpoRef}`;
    const description = `All 4 signatures complete on LPO ${lpoRef}. Items can now be procured.`;

    await notify(
      {
        title, description, priority: 'high', sourceId: 'manager_approval',
        navigateTo:   `/(screens)/signedLpo/${lpoRef}`,
        navigateText: 'View the item required',
        navigteToId:  lpoRef,
        hasButton:    true,
      },
      JSON.parse(process.env.OFFICE_MAIN),
      title,
      description
    );
  }

  return {
    status:  200,
    message: `${matched.role} signature recorded successfully`,
    data:    updated,
    role:    matched.role,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all LPO records sorted by creation date descending.
 * @returns {Promise<object[]>}
 */
const getAllLPOs = async () => {
  try {
    return await LPO.find({}).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[LPOService] getAllLPOs:', error);
    throw new Error(`Error fetching LPOs: ${error.message}`);
  }
};

/**
 * Returns a single LPO by its reference number.
 * @param {string} refNo
 * @returns {Promise<object>}
 */
const getLPOByRef = async (refNo) => {
  try {
    const lpo = await LPO.findOne({ lpoRef: refNo });
    if (!lpo) throw new Error('LPO not found');
    return lpo;
  } catch (error) {
    console.error('[LPOService] getLPOByRef:', error);
    throw new Error(`Error fetching LPO: ${error.message}`);
  }
};

/**
 * Returns all LPOs where the calling user has not yet signed
 * but the preceding step in the chain is complete.
 * @param {string} uniqueCode
 * @returns {Promise<object[]>}
 */
const getPendingSignatures = async (uniqueCode) => {
  try {
    const roleMap = [
      {
        // Manager signs first — no prerequisite
        envKey: process.env.MANAGER,
        query: {
          managerSigned:  { $ne: true },
          workflowStatus: { $in: ['lpo_uploaded', 'lpo_amended'] },
        },
      },
      {
         // PM signs after Manager
         envKey: process.env.PURCHASE_MANAGER,
        query: {
          managerSigned:  true,
           pmSigned:       { $ne: true },
           workflowStatus: { $in: ['lpo_uploaded', 'lpo_amended'] },
        },
      },
      {
        // Workshop Manager also signs at step 2 — same field as PM
        envKey: process.env.WORKSHOP_MANAGER,
         query: {
           managerSigned:  true,
           pmSigned:       { $ne: true },
           workflowStatus: { $in: ['lpo_uploaded', 'lpo_amended'] },
        },
       },
       {
        // Accounts signs after Manager + PM
         envKey: process.env.ACCOUNTS,
         query: {
           managerSigned:  true,
          pmSigned:       true,
           accountsSigned: { $ne: true },
          workflowStatus: { $in: ['lpo_uploaded', 'lpo_amended'] },
         },
      },
      {
      // CEO signs after all three above
        envKey: process.env.CEO,
        query: {
          managerSigned:  true,
           pmSigned:       true,
           accountsSigned: true,
           ceoSigned:      { $ne: true },
           workflowStatus: { $in: ['lpo_uploaded', 'lpo_amended'] },
           'signatures.authorizedSignatoryTitle': { $nin: ['MANAGING DIRECTOR'] },
         },
       },
       {
        // MD signs after all three above
        envKey: process.env.MD,
        query: {
          managerSigned:  true,
          pmSigned:       true,
          accountsSigned: true,
           ceoSigned:      { $ne: true },
           workflowStatus: { $in: ['lpo_uploaded', 'lpo_amended'] },
           'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR',
         },
       },
    ];

    const matched = roleMap.find(r => r.envKey === uniqueCode);
    if (!matched) return [];

    return await LPO.find(matched.query)
      .select('lpoRef date company equipments totalAmount workflowStatus pmSigned managerSigned ceoSigned accountsSigned signatures')
      .sort({ createdAt: -1 })
      .lean();

  } catch (error) {
    console.error('[LPOService] getPendingSignatures:', error);
    throw new Error(`Error fetching pending LPO signatures: ${error.message}`);
  }
};

/**
 * Returns all LPOs where the calling user has already signed their role field.
 * @param {string} uniqueCode
 * @returns {Promise<object[]>}
 */
const getSignedByUser = async (uniqueCode) => {
  try {
    const roleMap = [
      {
        envKey: process.env.PURCHASE_MANAGER,
        query:  { pmSigned: true },
      },
      {
        envKey: process.env.WORKSHOP_MANAGER,
        query:  { pmSigned: true },  
      },
      {
        envKey: process.env.MANAGER,
        query:  { managerSigned: true },
      },
      {
        envKey: process.env.CEO,
        query:  {
          ceoSigned: true,
          'signatures.authorizedSignatoryTitle': { $nin: ['MANAGING DIRECTOR'] },
        },
      },
      {
        envKey: process.env.MD,
        query:  {
          ceoSigned: true,
          'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR',
        },
      },
      {
        envKey: process.env.ACCOUNTS,
        query:  { accountsSigned: true },
      },
    ];

    const matched = roleMap.find(r => r.envKey === uniqueCode);
    if (!matched) return [];

    return await LPO.find(matched.query)
      .select('lpoRef date company equipments totalAmount workflowStatus pmSigned managerSigned ceoSigned accountsSigned signatures')
      .sort({ createdAt: -1 })
      .lean();

  } catch (error) {
    console.error('[LPOService] getSignedByUser:', error);
    throw new Error(`Error fetching signed LPOs: ${error.message}`);
  }
};

/**
 * Returns a summary of company/vendor details from all LPOs.
 * @returns {Promise<object[]>}
 */
const getAllCompanyDetails = async () => {
  try {
    const lpos = await LPO.find({}, 'company lpoRef date');
    return lpos.map(lpo => ({
      lpoRef:      lpo.lpoRef,
      date:        lpo.date,
      vendor:      lpo.company.vendor,
      attention:   lpo.company.attention,
      designation: lpo.company.designation
    }));
  } catch (error) {
    console.error('[LPOService] getAllCompanyDetails:', error);
    throw new Error(`Error fetching company details: ${error.message}`);
  }
};

/**
 * Returns the numeric portion of the latest LPO reference string.
 * @returns {Promise<string|null>}
 */
const getLatestLPORef = async () => {
  try {
    const latestLPO = await LPO.findOne({}).sort({ createdAt: -1 }).select('lpoRef');
    if (!latestLPO?.lpoRef) return null;

    const match = latestLPO.lpoRef.match(/^ATE(\d+)\/SP/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('[LPOService] getLatestLPORef:', error);
    throw new Error(`Error fetching latest LPO reference: ${error.message}`);
  }
};

/**
 * Returns the most recently created LPO document.
 * @returns {Promise<object>}
 */
const getLatestLPO = async () => {
  try {
    return await LPO.findOne({}).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[LPOService] getLatestLPO:', error);
    throw new Error(`Error fetching latest LPO: ${error.message}`);
  }
};

/**
 * Returns the next available LPO counter value.
 * @returns {Promise<number>}
 */
const getNextLPOCounter = async () => {
  try {
    const latestLPO = await LPO.findOne({}).sort({ lpoCounter: -1 }).select('lpoCounter');
    return latestLPO ? latestLPO.lpoCounter + 1 : 1;
  } catch (error) {
    console.error('[LPOService] getNextLPOCounter:', error);
    throw new Error(`Error fetching next LPO counter: ${error.message}`);
  }
};

/**
 * Returns all LPOs created within a date range.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<object[]>}
 */
const getLPOsByDateRange = async (startDate, endDate) => {
  try {
    return await LPO.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[LPOService] getLPOsByDateRange:', error);
    throw new Error(`Error fetching LPOs by date range: ${error.message}`);
  }
};

/**
 * Returns all LPOs matching a vendor name (case-insensitive).
 * @param {string} vendorName
 * @returns {Promise<object[]>}
 */
const getLPOsByCompany = async (vendorName) => {
  try {
    return await LPO.find({
      'company.vendor': { $regex: vendorName, $options: 'i' }
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[LPOService] getLPOsByCompany:', error);
    throw new Error(`Error fetching LPOs by company: ${error.message}`);
  }
};

/**
 * Returns all LPOs where any equipment entry starts with the given registration number.
 * @param {string} regNo
 * @returns {Promise<object[]>}
 */
const getLposByRegNo = async (regNo) => {
  try {
    const regex = new RegExp(`^${regNo}\\s*–`, 'i');
    return await LPO.find({ equipments: { $elemMatch: { $regex: regex } } }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[LPOService] getLposByRegNo:', error);
    throw new Error(`Error fetching LPOs by registration number: ${error.message}`);
  }
};

/**
 * Returns all LPOs created for stock.
 * @returns {Promise<object[]>}
 */
const getLposForStock = async () => {
  try {
    return await LPO.find({ equipment: { $regex: /^For Stock$/i } }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[LPOService] getLposForStock:', error);
    throw new Error(`Error fetching stock LPOs: ${error.message}`);
  }
};

/**
 * Returns all LPOs created for all equipment.
 * @returns {Promise<object[]>}
 */
const getLposForAllEquipments = async () => {
  try {
    return await LPO.find({ equipment: { $regex: /^For all equipment$/i } }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[LPOService] getLposForAllEquipments:', error);
    throw new Error(`Error fetching all equipment LPOs: ${error.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  createLPO,
  uploadLPO,
  updateLPO,
  deleteLPO,
  saveVendorEmail,
  purchaseApproval,
  managerApproval,
  ceoApproval,
  accountsApproval,
  markItemsAvailable,
  signLPO,
  getAllLPOs,
  getLPOByRef,
  getPendingSignatures,
  getSignedByUser,
  getAllCompanyDetails,
  getLatestLPORef,
  getLatestLPO,
  getNextLPOCounter,
  getLPOsByDateRange,
  getLPOsByCompany,
  getLposByRegNo,
  getLposForStock,
  getLposForAllEquipments
};