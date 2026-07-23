const Quotation = require('../models/quotation.model');
const { createNotification } = require('./notification.service');
const { default: wsUtils } = require('../sockets/websocket.js');
const analyser = require('../analyser/dashboard.analyser');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the default signatures object, merging provided values with defaults.
 * @param {object|null} signatures
 * @returns {object}
 */
const buildSignatures = (signatures) => ({
  accountsDept: signatures?.accountsDept || 'ROSHAN SHA',
  purchasingManager: signatures?.purchasingManager || 'ABDUL MALIK',
  operationsManager: signatures?.operationsManager || 'SURESHKANTH',
  authorizedSignatory: signatures?.authorizedSignatory || 'AHAMMED KAMAL',
  authorizedSignatoryTitle: signatures?.authorizedSignatoryTitle || 'CEO',
});

/**
 * Resolves or generates a vendor code for the given vendor name.
 * @param {string} vendorName
 * @returns {Promise<{ vendorCode: string, vendorMail: string|null }>}
 */
const resolveVendorCode = async (vendorName) => {
  const existingVendor = await Quotation.findOne({
    'company.vendor': { $regex: new RegExp(`^${vendorName.trim()}$`, 'i') },
    vendorCode: { $ne: null },
  }).select('vendorCode vendorMail');

  if (existingVendor) {
    return {
      vendorCode: existingVendor.vendorCode,
      vendorMail: existingVendor.vendorMail || [],
    };
  }

  const lastVendor = await Quotation.findOne({ vendorCode: { $ne: null } })
    .sort({ createdAt: -1 })
    .select('vendorCode');

  if (lastVendor?.vendorCode) {
    const num = parseInt(lastVendor.vendorCode.split('-')[1]) + 1;
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
    [`quotationDetails.${prefix}signed`]: true,
    [`quotationDetails.${prefix}authorised`]: creds.authorised,
    [`quotationDetails.${prefix}approvedBy`]: creds.approvedBy,
    [`quotationDetails.${prefix}approvedDate`]:
      creds.approvedDate || new Date().toISOString(),
  };

  if (creds.approvedFrom)
    fields[`quotationDetails.${prefix}approvedFrom`] = creds.approvedFrom;
  if (creds.approvedIP)
    fields[`quotationDetails.${prefix}approvedIP`] = creds.approvedIP;
  if (creds.approvedBDevice)
    fields[`quotationDetails.${prefix}approvedBDevice`] = creds.approvedBDevice;
  if (creds.approvedLocation)
    fields[`quotationDetails.${prefix}approvedLocation`] =
      creds.approvedLocation;

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
const notify = async (
  notifPayload,
  recipient,
  title,
  description,
  priority = 'high'
) => {
  const notification = await createNotification({
    ...notifPayload,
    category: 'quotation',
    recipient,
    time: new Date(),
  });

  // await PushNotificationService.sendGeneralNotification(
  //   recipient,
  //   title,
  //   description,
  //   priority,
  //   'normal',
  //   notification.data._id.toString()
  // );
};

const roleScreenMap = (role, isMD) => {
  const map = {
    PURCHASE_MANAGER: 'pm',
    MANAGER: 'op',
    CEO: isMD ? 'md' : 'ceo',
    MANAGING_DIRECTOR: 'md',
    ACCOUNTS: 'accounts',
  };
  return map[role] || 'quotationSign';
};

const buildNextStepNotif = (role, quotationRef, updated) => {
  const isMD =
    updated.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR';

  const map = {
    MANAGER: {
      title: `Purchase Manager Approval Needed — Quotation ${quotationRef}`,
      description: `Manager signed Quotation ${quotationRef}. Purchase Manager approval needed.`,
      sourceId: 'quotation_approval',
      navigateTo: `/(signature)/pm/${quotationRef}`,
      navigateText: 'View and Sign',
      recipient: JSON.parse(process.env.OFFICE_HERO),
    },
    PURCHASE_MANAGER: {
      title: `Accounts Approval Needed — Quotation ${quotationRef}`,
      description: `Purchase Manager signed Quotation ${quotationRef}. Accounts approval needed.`,
      sourceId: 'accounts_approval',
      navigateTo: `/(signature)/accounts/${quotationRef}`,
      navigateText: 'View and Sign',
      recipient: JSON.parse(process.env.OFFICE_HERO),
    },
    ACCOUNTS: {
      title: `${updated.signatures?.authorizedSignatoryTitle || 'CEO'} Approval Needed — Quotation ${quotationRef}`,
      description: `Accounts signed Quotation ${quotationRef}. ${updated.signatures?.authorizedSignatoryTitle || 'CEO'} approval needed.`,
      sourceId: isMD ? 'md_approval' : 'ceo_approval',
      navigateTo: isMD
        ? `/(signature)/md/${quotationRef}`
        : `/(signature)/ceo/${quotationRef}`,
      navigateText: 'View and Sign',
      recipient: JSON.parse(process.env.OFFICE_HERO),
    },
    CEO: {
      title: `Quotation ${quotationRef} Fully Signed`,
      description: `CEO signed Quotation ${quotationRef}. All signatures complete.`,
      sourceId: 'final_approval',
      navigateTo: `/(workflow)/quotation/${quotationRef}`,
      navigateText: 'View Quotation',
      recipient: JSON.parse(process.env.OFFICE_MAIN),
    },
    MANAGING_DIRECTOR: {
      title: `Quotation ${quotationRef} Fully Signed`,
      description: `MD signed Quotation ${quotationRef}. All signatures complete.`,
      sourceId: 'final_approval',
      navigateTo: `/(workflow)/quotation/${quotationRef}`,
      navigateText: 'View Quotation',
      recipient: JSON.parse(process.env.OFFICE_MAIN),
    },
  };

  return map[role] || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new Quotation record with vendor code resolution and optional notification.
 * @param {object} quotationData
 * @returns {Promise<object>}
 */
const createQuotation = async (quotationData) => {
  try {
    const totalAmount = calculateTotal(
      quotationData.items,
      quotationData.showDiscountInTotal,
      quotationData.discount
    );
    const signatures = buildSignatures(quotationData.signatures);
    const { vendorCode, vendorMail } = await resolveVendorCode(
      quotationData.company.vendor
    );

    const quotation = new Quotation({
      ...quotationData,
      totalAmount,
      signatures,
      vendorCode,
      vendorMail,
      isAmendmented: false,
      amendments: [],
    });

    if (quotationData.normalQuotation) {
      const title = `Quotation ${quotation.quotationRef} Created`;
      const description = `Quotation: ${quotationData.quotationRef} for ${quotationData.company.vendor} for ${quotationData.equipments}, Await until quotation is uploaded`;

      await notify(
        {
          title,
          description,
          priority: 'high',
          sourceId: 'quotation_approval',
        },
        JSON.parse(process.env.OFFICE_MAIN),
        title,
        description
      );
    }

    analyser.clearCache();
    wsUtils.sendDashboardUpdate('quotation');

    return await quotation.save();
  } catch (error) {
    throw new Error(`[QuotationService] createQuotation:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Uploads an Quotation document (or amendment) to a given Quotation reference, advancing the workflow.
 * @param {object}  quotationFileData
 * @param {string}  uploadedBy
 * @param {string}  quotationRef
 * @param {string}  description
 * @param {boolean} isAmendment
 * @returns {Promise<object>}
 */
const uploadQuotation = async (
  quotationFileData,
  uploadedBy,
  quotationRef,
  description,
  isAmendment = false
) => {
  try {
    const QuotationData = await Quotation.findOne({ quotationRef });
    if (!QuotationData)
      throw Object.assign(new Error('Quotation not found'), { status: 404 });

    const validStatuses = isAmendment
      ? [
          'quotation_uploaded',
          'purchase_approved',
          'accounts_approved',
          'manager_approved',
          'ceo_approved',
          'md_approved',
          'items_available',
        ]
      : ['quotation_created'];

    if (!validStatuses.includes(QuotationData.workflowStatus)) {
      throw Object.assign(
        new Error(
          `Invalid workflow status for Quotation ${isAmendment ? 'amendment' : 'upload'}`
        ),
        { status: 400 }
      );
    }

    const updateData = {
      workflowStatus: isAmendment ? 'quotation_amended' : 'quotation_uploaded',
      updatedAt: new Date(),
      'quotationDetails.quotationFile': quotationFileData,
      'quotationDetails.quotationRef': quotationRef,
      'quotationDetails.description': description || '',
      'quotationDetails.uploadedBy': uploadedBy,
      'quotationDetails.uploadedDate': new Date(),
      'quotationDetails.status': isAmendment ? 'amended' : 'uploaded',
    };

    if (isAmendment) {
      Object.assign(updateData, {
        'quotationDetails.isAmendment': true,
        'quotationDetails.amendmentDate': new Date().toLocaleDateString(
          'en-GB'
        ),
        'quotationDetails.PMRsigned': false,
        'quotationDetails.PMRauthorised': false,
        'quotationDetails.MANAGERsigned': false,
        'quotationDetails.MANAGERauthorised': false,
        'quotationDetails.ACCOUNTSsigned': false,
        'quotationDetails.ACCOUNTSauthorised': false,
        'quotationDetails.CEOsigned': false,
        'quotationDetails.CEOauthorised': false,
        'quotationDetails.MDsigned': false,
        'quotationDetails.MDauthorised': false,
      });
    }

    updateData.$push = {
      approvalTrail: {
        approvedBy: uploadedBy,
        role: 'WORKSHOP_MANAGER',
        approvalDate: new Date(),
        comments: isAmendment
          ? `Quotation amendment uploaded: ${quotationRef}`
          : `Quotation document uploaded: ${quotationRef}`,
        action: 'uploaded',
      },
    };

    const quotationUpdated = await Quotation.findOneAndUpdate(
      { quotationRef },
      updateData,
      { new: true, runValidators: true }
    );

    const title = isAmendment
      ? `Quotation Amendment Approval Needed - ${quotationRef}`
      : `Quotation Approval Needed - ${quotationRef}`;
    const description2 = isAmendment
      ? `Quotation has been amended. Quotation Ref: ${quotationRef}. Manager Approval Needed! Please review and approve the amendment.`
      : `New Quotation created. Quotation Ref: ${quotationRef}. Manager Approval Needed! Please review and approve.`;

    await notify(
      {
        title,
        description: description2,
        priority: 'high',
        sourceId: 'quotation_approval',
        navigateTo: `/(signature)/op/${quotationRef}`,
        navigateText: 'View and Sign',
        navigteToId: quotationRef,
        hasButton: true,
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description2
    );

    return {
      status: 202,
      message: isAmendment
        ? 'Quotation amendment uploaded successfully and sent for re-approval'
        : 'Quotation uploaded successfully and sent to PURCHASE_MANAGER for approval',
      data: quotationUpdated,
    };
  } catch (error) {
    console.error('[QuotationService] uploadQuotation:', error);
    throw error;
  }
};

/**
 * Updates an existing Quotation by ref number, supporting both regular edits and amendments.
 * @param {string} refNo
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateQuotation = async (refNo, updateData) => {
  try {
    const existingQuotation = await Quotation.findOne({
      quotationRef: refNo.trim(),
    });
    if (!existingQuotation) throw new Error('Quotation not found');

    if (updateData.isAmendmented === true) {
      const amendment = {
        amendmentDate: new Date(),
        amendedBy: updateData.amendedBy || 'System',
        reason: updateData.amendmentReason || 'Amendment requested',
      };

      if (updateData.items?.length > 0) {
        amendment.amendedItems = updateData.items;
        amendment.amendedTotalAmount = updateData.items.reduce(
          (sum, item) => sum + (item.totalPrice || 0),
          0
        );

        if (updateData.showDiscountInTotal && updateData.discount) {
          amendment.amendedTotalAmount -= updateData.discount;
          amendment.amendedDiscount = updateData.discount;
        }
      }

      if (updateData.company) amendment.amendedCompany = updateData.company;
      if (updateData.equipments)
        amendment.amendedEquipments = updateData.equipments;
      if (updateData.workingHrs !== undefined)
        amendment.amendedWorkingHrs = updateData.workingHrs;
      if (updateData.runningKm !== undefined)
        amendment.amendedRunningKm = updateData.runningKm;
      if (updateData.quoteNo) amendment.amendedQuoteNo = updateData.quoteNo;
      if (updateData.requestText)
        amendment.amendedRequestText = updateData.requestText;
      if (updateData.termsAndConditions)
        amendment.amendedTermsAndConditions = updateData.termsAndConditions;

      return await Quotation.findOneAndUpdate(
        { quotationRef: refNo.trim() },
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
      );
    }

    if (updateData.items?.length > 0) {
      updateData.totalAmount = updateData.items.reduce(
        (sum, item) => sum + (item.totalPrice || 0),
        0
      );
    }

    if (updateData.showDiscountInTotal && updateData.discount) {
      updateData.totalAmount =
        (updateData.totalAmount || 0) - (updateData.discount || 0);
    }

    delete updateData.amendedBy;
    delete updateData.amendmentReason;

    return await Quotation.findOneAndUpdate(
      { quotationRef: refNo.trim() },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`[QuotationService] updateQuotation:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Deletes an Quotation by reference number.
 * @param {string} refNo
 * @returns {Promise<object>}
 */
const deleteQuotation = async (refNo) => {
  try {
    const quotation = await Quotation.findOneAndDelete({ quotationRef: refNo });
    if (!quotation) throw new Error('Quotation not found');
    return quotation;
  } catch (error) {
    throw new Error(`[QuotationService] deleteQuotation:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Saves or updates the vendor email across all Quotations sharing the same vendor code.
 * @param {string} vendorCode
 * @param {string} email
 * @returns {Promise<object>}
 */
const saveVendorEmail = async (vendorCode, emails) => {
  try {
    const emailArray = Array.isArray(emails) ? emails : [emails];
    return await Quotation.updateMany(
      { vendorCode },
      { $set: { vendorMail: emailArray } }
    );
  } catch (error) {
    throw new Error(`[QuotationService] saveVendorEmail:${error.message}`, {
      cause: error,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Approval Workflow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records purchase manager approval for an Quotation.
 * @param {string} quotationRef
 * @param {object} approvalData
 * @returns {Promise<object>}
 */
const purchaseApproval = async (quotationRef, approvalData) => {
  try {
    const {
      approvedBy,
      comments = '',
      signed = false,
      authorised = false,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
    } = approvalData;

    const quotation = await Quotation.findOne({ quotationRef });
    if (!quotation) throw { status: 404, message: 'Quotation not found' };

    const validStatuses = ['quotation_uploaded', 'quotation_amended'];
    if (!validStatuses.includes(quotation.workflowStatus)) {
      throw {
        status: 400,
        message: `Invalid workflow status. Expected 'quotation_uploaded' or 'quotation_amended', got '${quotation.workflowStatus}'`,
      };
    }

    const updateFields = {
      'quotationDetails.purchaseApprovalDate': new Date(),
      'quotationDetails.status': 'purchase_approved',
      workflowStatus: 'purchase_approved',
      $push: {
        approvalTrail: {
          approvedBy,
          role: 'PURCHASE_MANAGER',
          action: 'approved',
          comments: comments || 'Purchase approved',
        },
      },
    };

    if (signed) {
      Object.assign(
        updateFields,
        buildSignedFields('PMR', {
          approvedBy,
          authorised,
          approvedDate,
          approvedFrom,
          approvedIP,
          approvedBDevice,
          approvedLocation,
        })
      );
      updateFields.pmSigned = true;
    }

    const quotationUpdated = await Quotation.findOneAndUpdate(
      { quotationRef },
      updateFields,
      { new: true }
    );
    if (!quotationUpdated)
      throw { status: 404, message: 'Failed to update Quotation' };

    const isAmendment = quotationUpdated.isAmendmented;
    const title = isAmendment
      ? `Amendment! MANAGER Approval Needed - Quotation ${quotationRef}`
      : `MANAGER Approval Needed - Quotation ${quotationRef}`;
    const description = isAmendment
      ? 'Purchase Manager signed and approved amendment Quotation. Manager approval needed.'
      : 'Purchase Manager signed and approved Quotation. Manager approval needed.';

    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: 'accounts_approval',
        navigateTo: `/(signature)/op/${quotationRef}`,
        navigateText: 'View and Sign',
        navigteToId: quotationRef,
        hasButton: true,
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return {
      status: 200,
      message: `Purchase Manager approval ${signed ? 'and signing ' : ''}completed successfully`,
      data: quotationUpdated,
      signed,
      authorised,
    };
  } catch (error) {
    console.error('[QuotationService] purchaseApproval:', error);
    throw error;
  }
};

/**
 * Records manager approval for an Quotation and routes to CEO or MD based on document settings.
 * @param {string} quotationRef
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const managerApproval = async (
  quotationRef,
  approvedBy,
  comments = '',
  approvedCreds
) => {
  try {
    const updateFields = {
      'quotationDetails.managerApprovalDate': new Date(),
      'quotationDetails.status': 'manager_approved',
      workflowStatus: 'manager_approved',
      $push: {
        approvalTrail: {
          approvedBy,
          role: 'MANAGER',
          action: 'approved',
          comments: comments || 'MANAGER approved',
        },
      },
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, buildSignedFields('MANAGER', approvedCreds));
      updateFields.managerSigned = true;
    }

    const quotationUpdated = await Quotation.findOneAndUpdate(
      { quotationRef },
      updateFields,
      { new: true }
    );
    if (!quotationUpdated)
      throw { status: 404, message: 'Quotation not found' };

    const isAmendment = quotationUpdated.isAmendmented;
    const signatoryTitle =
      quotationUpdated.signatures?.authorizedSignatoryTitle || 'CEO';
    const isCEO = signatoryTitle === 'CEO';
    const signedLabel = approvedCreds?.signed ? 'signed and ' : '';
    const prefix = isAmendment ? 'Amendment! ' : '';

    let target, screen, title, description, source;

    if (isCEO && !isAmendment) {
      target = process.env.CEO;
      screen = `/(signature)/ceo/${quotationRef}`;
      title = `CEO Approval Needed - Quotation ${quotationRef}`;
      description = `Manager ${signedLabel}approved Quotation. CEO approval needed.`;
      source = 'ceo_approval';
    } else if (!isCEO && !isAmendment) {
      target = process.env.MD;
      screen = `/(signature)/md/${quotationRef}`;
      title = `MD Approval Needed - Quotation ${quotationRef}`;
      description = `Manager ${signedLabel}approved Quotation. MD approval needed.`;
      source = 'md_approval';
    } else if (isCEO && isAmendment) {
      target = process.env.CEO;
      screen = `/(signature)/ceo/${quotationRef}`;
      title = `${prefix}CEO Approval Needed - Quotation ${quotationRef}`;
      description = `Manager ${signedLabel}approved amendment Quotation. CEO approval needed.`;
      source = 'ceo_approval';
    } else if (!isCEO && isAmendment) {
      target = process.env.MD;
      screen = `/(signature)/md/${quotationRef}`;
      title = `${prefix}MD Approval Needed - Quotation ${quotationRef}`;
      description = `Manager ${signedLabel}approved amendment Quotation. MD approval needed.`;
      source = 'md_approval';
    } else {
      throw { status: 400, message: 'Invalid authorized signatory position' };
    }

    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: source,
        navigateTo: screen,
        navigateText: 'View and Sign',
        navigteToId: quotationRef,
        hasButton: true,
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return {
      status: 200,
      message: 'MANAGER approval completed',
      data: quotationUpdated,
    };
  } catch (error) {
    console.error('[QuotationService] managerApproval:', error);
    throw error;
  }
};

/**
 * Records CEO or MD approval for an Quotation.
 * @param {string} quotationRef
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @param {string} authUser  'CEO' | 'MD'
 * @returns {Promise<object>}
 */
const ceoApproval = async (
  quotationRef,
  approvedBy,
  comments = '',
  approvedCreds,
  authUser
) => {
  try {
    const approverType = authUser === 'MD' ? 'MD' : 'CEO';
    const approvalStatus = `${approverType.toLowerCase()}_approved`;

    const updateFields = {
      [`quotationDetails.${approverType.toLowerCase()}ApprovalDate`]:
        new Date(),
      'quotationDetails.status': approvalStatus,
      workflowStatus: approvalStatus,
      $push: {
        approvalTrail: {
          approvedBy,
          role: approverType,
          action: 'approved',
          comments: comments || `${approverType} approved`,
        },
      },
    };

    if (approvedCreds?.signed) {
      Object.assign(
        updateFields,
        buildSignedFields(approverType, approvedCreds)
      );
      updateFields.ceoSigned = true;
    }

    const quotationUpdated = await Quotation.findOneAndUpdate(
      { quotationRef },
      updateFields,
      { new: true }
    );
    if (!quotationUpdated)
      throw { status: 404, message: 'Quotation not found' };

    const isAmendment = quotationUpdated.isAmendmented;
    const signatoryTitle =
      quotationUpdated.signatures?.authorizedSignatoryTitle === 'CEO'
        ? 'CEO'
        : 'MD';
    const prefix = isAmendment ? 'Amendment! ' : '';

    const title = `${prefix}ACCOUNTS Approval Needed - Quotation ${quotationRef}`;
    const description = `${signatoryTitle} signed and approved ${isAmendment ? 'amendment ' : ''}Quotation. Accounts approval needed.`;

    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: 'final_approval',
        navigateTo: `/(signature)/accounts/${quotationRef}`,
        navigateText: 'View and Sign',
        navigteToId: quotationRef,
        hasButton: true,
      },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return {
      status: 200,
      message: `${approverType} approval completed`,
      data: quotationUpdated,
    };
  } catch (error) {
    console.error('[QuotationService] ceoApproval:', error);
    throw error;
  }
};

/**
 * Records accounts approval for an Quotation, completing the workflow.
 * @param {string} quotationRef
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const accountsApproval = async (
  quotationRef,
  approvedBy,
  comments = '',
  approvedCreds
) => {
  try {
    const updateFields = {
      'quotationDetails.accountsApprovalDate': new Date(),
      'quotationDetails.status': 'accounts_approved',
      workflowStatus: 'accounts_approved',
      $push: {
        approvalTrail: {
          approvedBy,
          role: 'ACCOUNTS',
          action: 'approved',
          comments: comments || 'ACCOUNTS approved',
        },
      },
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, buildSignedFields('ACCOUNTS', approvedCreds));
      updateFields.accountsSigned = true;
    }

    const quotationUpdated = await Quotation.findOneAndUpdate(
      { quotationRef },
      updateFields,
      { new: true }
    );
    if (!quotationUpdated)
      throw { status: 404, message: 'Quotation not found' };

    const isAmendment = quotationUpdated.isAmendmented;
    const title = isAmendment
      ? `Amendment! Approved - Quotation ${quotationRef}`
      : `Approved - Quotation ${quotationRef}`;
    const description = isAmendment
      ? 'Accounts approved amendment Quotation. Items can now be procured.'
      : 'Accounts approved Quotation. Items can now be procured.';

    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: 'manager_approval',
        navigateTo: `/(workflow)/quotation/${quotationRef}`,
        navigateText: 'View the item required',
        navigteToId: quotationRef,
        hasButton: true,
      },
      JSON.parse(process.env.OFFICE_MAIN),
      title,
      description
    );

    return {
      status: 200,
      message: 'ACCOUNTS approval completed',
      data: quotationUpdated,
    };
  } catch (error) {
    console.error('[QuotationService] accountsApproval:', error);
    throw error;
  }
};

/**
 * Marks items as procured and available for an Quotation.
 * @param {string} quotationRef
 * @param {string} markedBy
 * @returns {Promise<object>}
 */
const markItemsAvailable = async (quotationRef, markedBy) => {
  try {
    const quotationUpdated = await Quotation.findOneAndUpdate(
      { quotationRef },
      {
        'quotationDetails.status': 'items_procured',
        workflowStatus: 'items_available',
        $push: {
          approvalTrail: {
            approvedBy: markedBy,
            role: 'PROCUREMENT',
            action: 'approved',
            comments: 'Items procured and available',
          },
        },
      },
      { new: true }
    );

    if (!quotationUpdated)
      throw { status: 404, message: 'Quotation not found' };

    const title = `Quotation Approved - ${quotationRef}`;
    const description = 'All requested items can now be procured';

    await notify(
      { title, description, priority: 'high', sourceId: 'items_ready' },
      JSON.parse(process.env.OFFICE_HERO),
      title,
      description
    );

    return {
      status: 200,
      message: 'Items marked as available',
      data: quotationUpdated,
    };
  } catch (error) {
    console.error('[QuotationService] markItemsAvailable:', error);
    throw error;
  }
};

/**
 * Signs an Quotation on behalf of a recognised signatory resolved from uniqueCode.
 * @param {string} quotationRef
 * @param {object} signData
 * @returns {Promise<object>}
 */
const signQuotation = async (quotationRef, signData) => {
  const {
    uniqueCode,
    signedDate,
    signedFrom,
    override = false,
    signedIP = null,
    signedDevice = null,
    signedLocation = null,
  } = signData;

  // ── Role resolution ────────────────────────────────────────────────────────
  const normalizeRole = (value) => {
    if (!value) return null;
    const normalized = String(value).trim().toUpperCase();
    const aliases = {
      PURCHASE_MANAGER: 'PURCHASE_MANAGER',
      PURCHASEMANAGER: 'PURCHASE_MANAGER',
      PM: 'PURCHASE_MANAGER',
      MANAGER: 'MANAGER',
      ACCOUNTS: 'ACCOUNTS',
      ACCOUNTANT: 'ACCOUNTS',
      CEO: 'CEO',
      MD: 'MANAGING_DIRECTOR',
      MANAGING_DIRECTOR: 'MANAGING_DIRECTOR',
    };
    return aliases[normalized] || normalized;
  };

  const roleConfig = {
    MANAGER: {
      envKey: process.env.MANAGER,
      field: 'managerSigned',
      detailsPrefix: 'MANAGER',
      role: 'MANAGER',
      order: 1,
    },
    PURCHASE_MANAGER: {
      envKey: process.env.PURCHASE_MANAGER,
      field: 'pmSigned',
      detailsPrefix: 'PMR',
      role: 'PURCHASE_MANAGER',
      order: 2,
    },
    ACCOUNTS: {
      envKey: process.env.ACCOUNTS,
      field: 'accountsSigned',
      detailsPrefix: 'ACCOUNTS',
      role: 'ACCOUNTS',
      order: 3,
    },
    CEO: {
      envKey: process.env.CEO,
      field: 'ceoSigned',
      detailsPrefix: 'CEO',
      role: 'CEO',
      order: 4,
    },
    MANAGING_DIRECTOR: {
      envKey: process.env.MD,
      field: 'ceoSigned',
      detailsPrefix: 'MD',
      role: 'MANAGING_DIRECTOR',
      order: 4,
    },
  };

  const requestedRole = normalizeRole(signData.role);
  const matched = requestedRole
    ? roleConfig[requestedRole]
    : Object.values(roleConfig).find((r) => r.envKey === uniqueCode);

  if (!matched || matched.envKey !== uniqueCode) {
    throw {
      status: 403,
      message:
        'Unauthorised: your account is not recognised as an authorised signatory for Quotation documents',
    };
  }

  const quotation = await Quotation.findOne({ quotationRef });
  if (!quotation)
    throw { status: 404, message: `Quotation not found: ${quotationRef}` };

  if (quotation.workflowStatus === 'quotation_created') {
    throw { status: 403, message: 'Quotation_NOT_UPLOADED' };
  }

  // ── Role-specific restrictions ─────────────────────────────────────────────
  if (
    matched.role === 'CEO' &&
    quotation.signatures?.authorizedSignatoryTitle !== 'CEO'
  ) {
    throw {
      status: 403,
      message: 'Only the designated CEO is authorised to sign this Quotation',
    };
  }

  if (
    matched.role === 'MANAGING_DIRECTOR' &&
    quotation.signatures?.authorizedSignatoryTitle !== 'MANAGING DIRECTOR'
  ) {
    throw {
      status: 403,
      message:
        'Only the designated Managing Director is authorised to sign this Quotation',
    };
  }

  // ── Already signed guard ───────────────────────────────────────────────────
  if (quotation[matched.field] === true) {
    throw {
      status: 409,
      message: `The authorized signatory role has already been signed`,
    };
  }

  // ── Out-of-order detection ─────────────────────────────────────────────────
  const isMD =
    quotation.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR';
  const authRole = isMD ? 'MANAGING_DIRECTOR' : 'CEO';

  const chain = [
    { role: 'MANAGER', signed: quotation.managerSigned, order: 1 },
    { role: 'PURCHASE_MANAGER', signed: quotation.pmSigned, order: 2 },
    { role: 'ACCOUNTS', signed: quotation.accountsSigned, order: 3 },
    { role: authRole, signed: quotation.ceoSigned, order: 4 },
  ];

  const myOrder = matched.order;
  const unsignedAbove = chain.filter((c) => c.order < myOrder && !c.signed);

  if (unsignedAbove.length > 0 && !override) {
    return {
      status: 202,
      requireOverride: true,
      message: 'Out-of-order signing detected. Confirm override to proceed.',
      unsignedAbove: unsignedAbove.map((c) => c.role),
    };
  }

  // ── Write the signature ────────────────────────────────────────────────────
  const p = matched.detailsPrefix;
  const workflowProgressMap = {
    MANAGER: 'manager_approved',
    PURCHASE_MANAGER: 'purchase_approved',
    ACCOUNTS: 'accounts_approved',
    CEO: 'ceo_approved',
    MANAGING_DIRECTOR: 'md_approved',
  };

  const updateFields = {
    [matched.field]: true,
    [`quotationDetails.${p}signed`]: true,
    [`quotationDetails.${p}authorised`]: true,
    [`quotationDetails.${p}approvedBy`]: uniqueCode,
    [`quotationDetails.${p}approvedDate`]: signedDate,
    [`quotationDetails.${p}approvedFrom`]: signedFrom,
    [`quotationDetails.${p}approvedIP`]: signedIP,
    [`quotationDetails.${p}approvedBDevice`]: signedDevice,
    [`quotationDetails.${p}approvedLocation`]: signedLocation,
    workflowStatus: workflowProgressMap[matched.role],
    $push: {
      approvalTrail: {
        approvedBy: uniqueCode,
        role: matched.role,
        action:
          override && unsignedAbove.length > 0 ? 'override_signed' : 'signed',
        comments:
          override && unsignedAbove.length > 0
            ? `Override signed by ${matched.role} — predecessors not yet signed`
            : `Signed via mobile app by ${matched.role}`,
        approvalDate: new Date(),
      },
    },
  };

  const updated = await Quotation.findOneAndUpdate(
    { quotationRef },
    updateFields,
    { new: true }
  );
  if (!updated)
    throw { status: 500, message: 'Failed to update Quotation record' };

  // ── Notifications ──────────────────────────────────────────────────────────

  // 1. Override — notify OFFICE_HERO once per unsigned person above
  if (override && unsignedAbove.length > 0) {
    for (const above of unsignedAbove) {
      const title = `Action Required — Quotation ${quotationRef} override signed`;
      const description = `${matched.role} has signed Quotation ${quotationRef} out of order. ${above.role} signature is still required.`;

      await notify(
        {
          title,
          description,
          priority: 'high',
          sourceId: 'quotation_approval',
          navigateTo: `/(signature)/${roleScreenMap(above.role, isMD)}/${quotationRef}`,
          navigateText: 'View and Sign',
          navigteToId: quotationRef,
          hasButton: true,
        },
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description
      );
    }
  }

  // 2. Normal next-step notification (only when signing in order)
  if (!override || unsignedAbove.length === 0) {
    const nextNotif = buildNextStepNotif(matched.role, quotationRef, updated);
    if (nextNotif) {
      await notify(
        {
          title: nextNotif.title,
          description: nextNotif.description,
          priority: 'high',
          sourceId: nextNotif.sourceId,
          navigateTo: nextNotif.navigateTo,
          navigateText: nextNotif.navigateText,
          navigteToId: quotationRef,
          hasButton: true,
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
    const title = `Quotation Signed & Ready — ${quotationRef}`;
    const description = `All 4 signatures complete on Quotation ${quotationRef}. Items can now be procured.`;

    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: 'manager_approval',
        navigateTo: `/(workflow)/quotation/${quotationRef}`,
        navigateText: 'View the item required',
        navigteToId: quotationRef,
        hasButton: true,
      },
      JSON.parse(process.env.OFFICE_MAIN),
      title,
      description
    );
  }

  return {
    status: 200,
    message: `${matched.role} signature recorded successfully`,
    data: updated,
    role: matched.role,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all Quotation records sorted by creation date descending.
 * @returns {Promise<object[]>}
 */
const getAllQuotations = async () => {
  try {
    return await Quotation.find({}).sort({ createdAt: -1 });
  } catch (error) {
    throw new Error(`[QuotationService] getAllQuotations:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Returns a single Quotation by its reference number.
 * @param {string} refNo
 * @returns {Promise<object>}
 */
const getQuotationByRef = async (refNo) => {
  try {
    console.log('refNo', refNo);
    const quotation = await Quotation.findOne({ quotationRef: refNo });
    if (!quotation) throw new Error('Quotation not found');
    return quotation;
  } catch (error) {
    throw new Error(`[QuotationService] getQuotationByRef:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Returns all Quotations where the calling user has not yet signed
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
          managerSigned: { $ne: true },
          workflowStatus: { $in: ['quotation_uploaded', 'quotation_amended'] },
        },
      },
      {
        // PM signs after Manager
        envKey: process.env.PURCHASE_MANAGER,
        query: {
          managerSigned: true,
          pmSigned: { $ne: true },
          workflowStatus: { $in: ['manager_approved'] },
        },
      },
      {
        // Workshop Manager also signs at step 2 — same field as PM
        envKey: process.env.WORKSHOP_MANAGER,
        query: {
          managerSigned: true,
          pmSigned: { $ne: true },
          workflowStatus: { $in: ['manager_approved'] },
        },
      },
      {
        // Accounts signs after Manager + PM
        envKey: process.env.ACCOUNTS,
        query: {
          managerSigned: true,
          pmSigned: true,
          accountsSigned: { $ne: true },
          workflowStatus: { $in: ['purchase_approved'] },
        },
      },
      {
        // CEO signs after all three above
        envKey: process.env.CEO,
        query: {
          managerSigned: true,
          pmSigned: true,
          accountsSigned: true,
          ceoSigned: { $ne: true },
          workflowStatus: { $in: ['accounts_approved'] },
          'signatures.authorizedSignatoryTitle': {
            $nin: ['MANAGING DIRECTOR'],
          },
        },
      },
      {
        // MD signs after all three above
        envKey: process.env.MD,
        query: {
          managerSigned: true,
          pmSigned: true,
          accountsSigned: true,
          ceoSigned: { $ne: true },
          workflowStatus: { $in: ['accounts_approved'] },
          'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR',
        },
      },
    ];

    const matched = roleMap.find((r) => r.envKey === uniqueCode);
    if (!matched) return [];

    return await Quotation.find(matched.query)
      .select(
        'quotationRef date company equipments totalAmount workflowStatus pmSigned managerSigned ceoSigned accountsSigned signatures'
      )
      .sort({ createdAt: -1 })
      .lean();
  } catch (error) {
    console.error('[QuotationService] getPendingSignatures:', error);
    throw new Error(
      `Error fetching pending Quotation signatures: ${error.message}`
    );
  }
};

/**
 * Returns all Quotations where the calling user has already signed their role field.
 * @param {string} uniqueCode
 * @returns {Promise<object[]>}
 */
const getSignedByUser = async (uniqueCode) => {
  try {
    const roleMap = [
      {
        envKey: process.env.PURCHASE_MANAGER,
        query: { pmSigned: true },
      },
      {
        envKey: process.env.WORKSHOP_MANAGER,
        query: { pmSigned: true },
      },
      {
        envKey: process.env.MANAGER,
        query: { managerSigned: true },
      },
      {
        envKey: process.env.CEO,
        query: {
          ceoSigned: true,
          'signatures.authorizedSignatoryTitle': {
            $nin: ['MANAGING DIRECTOR'],
          },
        },
      },
      {
        envKey: process.env.MD,
        query: {
          ceoSigned: true,
          'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR',
        },
      },
      {
        envKey: process.env.ACCOUNTS,
        query: { accountsSigned: true },
      },
    ];

    const matched = roleMap.find((r) => r.envKey === uniqueCode);
    if (!matched) return [];

    return await Quotation.find(matched.query)
      .select(
        'quotationRef date company equipments totalAmount workflowStatus pmSigned managerSigned ceoSigned accountsSigned signatures'
      )
      .sort({ createdAt: -1 })
      .lean();
  } catch (error) {
    throw new Error(`[QuotationService] getSignedByUser:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Returns a summary of company/vendor details from all Quotations.
 * @returns {Promise<object[]>}
 */
const getAllCompanyDetails = async () => {
  try {
    const quotations = await Quotation.find({}, 'company quotationRef date');
    return quotations.map((quotation) => ({
      quotationRef: quotation.quotationRef,
      date: quotation.date,
      vendor: quotation.company.vendor,
      attention: quotation.company.attention,
      designation: quotation.company.designation,
    }));
  } catch (error) {
    throw new Error(
      `[QuotationService] getAllCompanyDetails:${error.message}`,
      { cause: error }
    );
  }
};

/**
 * Returns the numeric portion of the latest Quotation reference string.
 * @returns {Promise<string|null>}
 */
const getLatestQuotationRef = async () => {
  try {
    const latestQuotation = await Quotation.findOne({})
      .sort({ createdAt: -1 })
      .select('quotationRef');
    if (!latestQuotation?.quotationRef) return null;

    const match = latestQuotation.quotationRef.match(/^ATE(\d+)\/SP/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('[QuotationService] getLatestQuotationRef:', error);
    throw new Error(
      `Error fetching latest Quotation reference: ${error.message}`
    );
  }
};

/**
 * Returns the most recently created Quotation document.
 * @returns {Promise<object>}
 */
const getLatestQuotation = async () => {
  try {
    return await Quotation.findOne({}).sort({ createdAt: -1 });
  } catch (error) {
    throw new Error(`[QuotationService] getLatestQuotation:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Returns the next available Quotation counter value.
 * @returns {Promise<number>}
 */
const getNextQuotationCounter = async () => {
  try {
    const latestQuotation = await Quotation.findOne({})
      .sort({ quotationCounter: -1 })
      .select('quotationCounter');
    return latestQuotation ? latestQuotation.quotationCounter + 1 : 1;
  } catch (error) {
    throw new Error(
      `[QuotationService] getNextQuotationCounter:${error.message}`,
      { cause: error }
    );
  }
};

/**
 * Returns all Quotations created within a date range.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<object[]>}
 */
const getQuotationsByDateRange = async (startDate, endDate) => {
  try {
    return await Quotation.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[QuotationService] getQuotationsByDateRange:', error);
    throw new Error(
      `Error fetching Quotations by date range: ${error.message}`
    );
  }
};

/**
 * Returns all Quotations matching a vendor name (case-insensitive).
 * @param {string} vendorName
 * @returns {Promise<object[]>}
 */
const getQuotationsByCompany = async (vendorName) => {
  try {
    return await Quotation.find({
      'company.vendor': { $regex: vendorName, $options: 'i' },
    }).sort({ createdAt: -1 });
  } catch (error) {
    throw new Error(
      `[QuotationService] getQuotationsByCompany:${error.message}`,
      { cause: error }
    );
  }
};

/**
 * Returns all Quotations where any equipment entry starts with the given registration number.
 * @param {string} regNo
 * @returns {Promise<object[]>}
 */
const getQuotationsByRegNo = async (regNo) => {
  try {
    const regex = new RegExp(`^${regNo}\\s*–`, 'i');
    return await Quotation.find({
      equipments: { $elemMatch: { $regex: regex } },
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[QuotationService] getQuotationsByRegNo:', error);
    throw new Error(
      `Error fetching Quotations by registration number: ${error.message}`
    );
  }
};

/**
 * Returns all Quotations created for stock.
 * @returns {Promise<object[]>}
 */
const getQuotationsForStock = async () => {
  try {
    return await Quotation.find({ equipment: { $regex: /^For Stock$/i } }).sort(
      { createdAt: -1 }
    );
  } catch (error) {
    throw new Error(
      `[QuotationService] getQuotationsForStock:${error.message}`,
      { cause: error }
    );
  }
};

/**
 * Returns all Quotations created for all equipment.
 * @returns {Promise<object[]>}
 */
const getQuotationsForAllEquipments = async () => {
  try {
    return await Quotation.find({
      equipment: { $regex: /^For all equipment$/i },
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[QuotationService] getQuotationsForAllEquipments:', error);
    throw new Error(
      `Error fetching all equipment Quotations: ${error.message}`
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  createQuotation,
  uploadQuotation,
  updateQuotation,
  deleteQuotation,
  saveVendorEmail,
  purchaseApproval,
  managerApproval,
  ceoApproval,
  accountsApproval,
  markItemsAvailable,
  signQuotation,
  getAllQuotations,
  getQuotationByRef,
  getPendingSignatures,
  getSignedByUser,
  getAllCompanyDetails,
  getLatestQuotationRef,
  getLatestQuotation,
  getNextQuotationCounter,
  getQuotationsByDateRange,
  getQuotationsByCompany,
  getQuotationsByRegNo,
  getQuotationsForStock,
  getQuotationsForAllEquipments,
};
