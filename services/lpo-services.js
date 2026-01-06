const LPO = require('../models/lpo.model');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

class LPOService {
  // Create a new LPO
  async createLPO(lpoData) {
    try {
      // Calculate total amount from items
      let totalAmount = lpoData.items.reduce((sum, item) => sum + item.totalPrice, 0);

      // Apply discount if provided and showDiscountInTotal is true
      if (lpoData.showDiscountInTotal && lpoData.discount) {
        totalAmount -= lpoData.discount;
      }

      // Ensure signatures object exists with proper structure
      if (!lpoData.signatures) {
        lpoData.signatures = {
          accountsDept: 'ROSHAN SHA',
          purchasingManager: 'ABDUL MALIK',
          operationsManager: 'SURESHKANTH',
          authorizedSignatory: 'AHAMMED KAMAL',
          authorizedSignatoryTitle: 'CEO'
        };
      } else {
        lpoData.signatures = {
          accountsDept: lpoData.signatures.accountsDept || 'ROSHAN SHA',
          purchasingManager: lpoData.signatures.purchasingManager || 'ABDUL MALIK',
          operationsManager: lpoData.signatures.operationsManager || 'SURESHKANTH',
          authorizedSignatory: lpoData.signatures.authorizedSignatory || 'AHAMMED KAMAL',
          authorizedSignatoryTitle: lpoData.signatures.authorizedSignatoryTitle || 'CEO'
        };
      }

      // Initialize amendment fields for new LPO
      const lpoWithTotal = {
        ...lpoData,
        totalAmount,
        isAmendmented: false,
        amendments: []
      };

      const lpo = new LPO(lpoWithTotal);

      if (lpoData.normalLPO) {
        const notification = await createNotification({
          title: `LPO ${lpo.lpoRef} Created`,
          description: `LPO: ${lpoData.lpoRef} for ${lpoData.company.vendor} : ${lpoData.equipments}, Await until lpo is uploaded`,
          priority: "high",
          sourceId: 'lpo_approval',
          recipient: JSON.parse(process.env.OFFICE_MAIN),
          time: new Date(),
        });

        await PushNotificationService.sendGeneralNotification(
          JSON.parse(process.env.OFFICE_MAIN),
          `LPO ${lpo.lpoRef} Created`,
          `LPO: ${lpoData.lpoRef} for ${lpoData.company.vendor} for ${lpoData.equipments}, Await until lpo is uploaded`,
          'high',
          'normal',
          notification.data._id.toString()
        );
      }

      return await lpo.save();
    } catch (error) {
      throw new Error(`Error creating LPO: ${error.message}`);
    }
  }

  async uploadLPO(lpoFileData, uploadedBy, lpoRef, description, isAmendment = false) {
    try {
      const LpoData = await LPO.findOne({ lpoRef: lpoRef });

      if (!LpoData) {
        const error = new Error('Complaint not found');
        error.status = 404;
        throw error;
      }

      // For amendment, allow from various approved statuses
      const validStatuses = isAmendment
        ? ['lpo_uploaded', 'purchase_approved', 'accounts_approved', 'manager_approved', 'ceo_approved', 'md_approved', 'items_available']
        : ['lpo_created'];

      if (!validStatuses.includes(LpoData.workflowStatus)) {
        const error = new Error(`Invalid workflow status for LPO ${isAmendment ? 'amendment' : 'upload'}`);
        error.status = 400;
        throw error;
      }

      const updateData = {
        workflowStatus: isAmendment ? 'lpo_amended' : 'lpo_uploaded',
        updatedAt: new Date()
      };

      updateData['lpoDetails.lpoFile'] = lpoFileData;
      updateData['lpoDetails.lpoRef'] = lpoRef;
      updateData['lpoDetails.description'] = description || '';
      updateData['lpoDetails.uploadedBy'] = uploadedBy;
      updateData['lpoDetails.uploadedDate'] = new Date();
      updateData['lpoDetails.status'] = 'uploaded';

      // Set amendment fields
      if (isAmendment) {
        updateData['lpoDetails.isAmendment'] = true;
        updateData['lpoDetails.amendmentDate'] = new Date().toLocaleDateString('en-GB');

        // Reset all approval flags for re-signing
        updateData['lpoDetails.PMRsigned'] = false;
        updateData['lpoDetails.PMRauthorised'] = false;
        updateData['lpoDetails.MANAGERsigned'] = false;
        updateData['lpoDetails.MANAGERauthorised'] = false;
        updateData['lpoDetails.ACCOUNTSsigned'] = false;
        updateData['lpoDetails.ACCOUNTSauthorised'] = false;
        updateData['lpoDetails.CEOsigned'] = false;
        updateData['lpoDetails.CEOauthorised'] = false;
        updateData['lpoDetails.MDsigned'] = false;
        updateData['lpoDetails.MDauthorised'] = false;
        updateData['lpoDetails.status'] = 'amended';
      }

      const approvalEntry = {
        approvedBy: uploadedBy,
        role: 'WORKSHOP_MANAGER',
        approvalDate: new Date(),
        comments: isAmendment
          ? `LPO amendment uploaded: ${lpoRef}`
          : `LPO document uploaded: ${lpoRef}`,
        action: 'uploaded'
      };

      updateData.$push = {
        approvalTrail: approvalEntry
      };

      const lpoUpdated = await LPO.findOneAndUpdate(
        { lpoRef: lpoRef },
        updateData,
        { new: true, runValidators: true }
      );

      // Notify relevant parties
      const notificationTitle = isAmendment
        ? `LPO Amendment Approval Needed - ${lpoRef}`
        : `LPO Approval Needed - ${lpoRef}`;

      const notificationDescription = isAmendment
        ? `LPO has been amended. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve the amendment.`
        : `New LPO created. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve.`;

      const notification = await createNotification({
        title: notificationTitle,
        description: notificationDescription,
        priority: "high",
        sourceId: 'lpo_approval',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/purchaseManagerSign/${lpoRef}`,
        navigateText: `View and Sign`,
        navigteToId: lpoRef,
        hasButton: true
      });


      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        notificationTitle,
        notificationDescription,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 202,
        message: isAmendment
          ? 'LPO amendment uploaded successfully and sent for re-approval'
          : 'LPO uploaded successfully and sent to PURCHASE_MANAGER for approval',
        data: lpoUpdated
      };
    } catch (error) {
      console.error('Error in uploadLPOForComplaint service:', error);
      throw error;
    }
  }

  // After purchaseApproval
  async purchaseApproval(lpoRef, approvalData) {
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
        approvedLocation
      } = approvalData;

      const lpo = await LPO.findOne({ lpoRef: lpoRef });

      if (!lpo) {
        throw { status: 404, message: 'LPO not found' };
      }

      const validStatuses = ['lpo_uploaded', 'lpo_amended'];
      if (!validStatuses.includes(lpo.workflowStatus)) {
        throw {
          status: 400,
          message: `Invalid workflow status. Expected 'lpo_uploaded' or 'lpo_amended', got '${lpo.workflowStatus}'`
        };
      }

      const updateFields = {
        'lpoDetails.purchaseApprovalDate': new Date(),
        'lpoDetails.status': 'purchase_approved',
        workflowStatus: 'purchase_approved',
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: 'PURCHASE_MANAGER',
            action: 'approved',
            comments: comments || 'Purchase approved'
          }
        }
      };

      if (signed) {
        updateFields['lpoDetails.PMRsigned'] = true;
        updateFields['lpoDetails.PMRauthorised'] = authorised;
        updateFields['lpoDetails.PMRapprovedBy'] = approvedBy;
        updateFields['lpoDetails.PMRapprovedDate'] = approvedDate || new Date().toISOString();

        if (approvedFrom) updateFields['lpoDetails.PMRapprovedFrom'] = approvedFrom;
        if (approvedIP) updateFields['lpoDetails.PMRapprovedIP'] = approvedIP;
        if (approvedBDevice) updateFields['lpoDetails.PMRapprovedBDevice'] = approvedBDevice;
        if (approvedLocation) updateFields['lpoDetails.PMRapprovedLocation'] = approvedLocation;
      }

      const lpoUpdated = await LPO.findOneAndUpdate(
        { lpoRef: lpoRef },
        updateFields,
        { new: true },
        { pmSigned: true }
      );

      if (!lpoUpdated) {
        throw { status: 404, message: 'Failed to update lpo' };
      }

      let title, description

      if (lpoUpdated.isAmendmented) {
        title = `Amendment! MANAGER Approval Needed - LPO ${lpoRef}`
        description = `Purchace Manager signed and approved amendment LPO. Manager approval needed.`
      } else {
        title = `MANAGER Approval Needed - LPO ${lpoRef}`
        description = `Purchace Manager signed and approved LPO. Manager approval needed.`
      }

      const notification = await createNotification({
        title: title,
        description: title,
        priority: "high",
        sourceId: 'accounts_approval',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/managerSign/${lpoRef}`,
        navigateText: `View and Sign`,
        navigteToId: lpoRef,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: `Purchase Manager approval ${signed ? 'and signing ' : ''}completed successfully`,
        data: lpoUpdated,
        signed: signed,
        authorised: authorised
      };
    } catch (error) {
      console.error('Error in purchase approval:', error);
      throw error;
    }
  }

  // After managerApproval
  async managerApproval(lpoRef, approvedBy, comments = '', approvedCreds) {
    try {
      const updateFields = {
        'lpoDetails.managerApprovalDate': new Date(),
        'lpoDetails.status': 'manager_approved',
        'workflowStatus': 'manager_approved',
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: 'MANAGER',
            action: 'approved',
            comments: comments || 'MANAGER approved'
          }
        }
      };

      if (approvedCreds && approvedCreds.signed) {
        updateFields['lpoDetails.MANAGERsigned'] = true;
        updateFields['lpoDetails.MANAGERauthorised'] = approvedCreds.authorised;
        updateFields['lpoDetails.MANAGERapprovedBy'] = approvedCreds.approvedBy;
        updateFields['lpoDetails.MANAGERapprovedDate'] = approvedCreds.approvedDate || new Date().toISOString();

        if (approvedCreds.approvedFrom) updateFields['lpoDetails.MANAGERapprovedFrom'] = approvedCreds.approvedFrom;
        if (approvedCreds.approvedIP) updateFields['lpoDetails.MANAGERapprovedIP'] = approvedCreds.approvedIP;
        if (approvedCreds.approvedBDevice) updateFields['lpoDetails.MANAGERapprovedBDevice'] = approvedCreds.approvedBDevice;
        if (approvedCreds.approvedLocation) updateFields['lpoDetails.MANAGERapprovedLocation'] = approvedCreds.approvedLocation;
      }

      const lpoUpdated = await LPO.findOneAndUpdate(
        {lpoRef},
        updateFields,
        { managerSigned: true },
        { new: true }
      );

      if (!lpoUpdated) {
        throw { status: 404, message: 'Complaint not found' };
      }

      let target, screen, title, description, source

      if (lpoUpdated) {
        if (lpoUpdated.signatures.authorizedSignatoryTitle === 'CEO' && !lpoUpdated.isAmendmented) {
          target = process.env.CEO
          screen = `/(screens)/ceoSign/${lpoRef}`
          title = `CEO Approval Needed - LPO ${lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO. CEO approval needed.`
          source = 'ceo_approval'

        } else if (lpoUpdated.signatures.authorizedSignatoryTitle === 'MANAGING DIRECTOR' && !lpoUpdated.isAmendmented) {
          target = process.env.MD
          screen = `/(screens)/mdSign/${lpoRef}`
          title = `MD Approval Needed - LPO ${lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO. MD approval needed.`
          source = 'md_approval'

        } else if (lpoUpdated.signatures.authorizedSignatoryTitle === 'CEO' && lpoUpdated.isAmendmented) {
          target = process.env.CEO
          screen = `/(screens)/ceoSign/${lpoRef}`
          title = `Amendment! CEO Approval Needed - LPO ${lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved amendment LPO. CEO approval needed.`
          source = 'ceo_approval'

        } else if (lpoUpdated.signatures.authorizedSignatoryTitle === 'MANAGING DIRECTOR' && lpoUpdated.isAmendmented) {
          target = process.env.MD
          screen = `/(screens)/mdSign/${lpoRef}`
          title = `Amendment! MD Approval Needed - LPO ${lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved amendment LPO. MD approval needed.`
          source = 'md_approval'

        } else {
          // Only throw if it's neither CEO nor MANAGING DIRECTOR
          throw { status: 404, message: 'Invalid auth position' }
        }
      }

      const notification = await createNotification({
        title: title,
        description: description,
        priority: "high",
        sourceId: source,
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: screen,
        navigateText: `View and Sign`,
        navigteToId: lpoRef,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'MANAGER approval completed',
        data: lpoUpdated
      };
    } catch (error) {
      console.error('Error in MANAGER approval:', error);
      throw error;
    }
  }

  // After ceoApproval
  async ceoApproval(lpoRef, approvedBy, comments = '', approvedCreds, authUser) {
    try {
      // Determine if it's MD or CEO
      const approverType = authUser === 'MD' ? 'MD' : 'CEO';
      const approvalStatus = `${approverType.toLowerCase()}_approved`;

      const updateFields = {
        [`lpoDetails.${approverType.toLowerCase()}ApprovalDate`]: new Date(),
        'lpoDetails.status': approvalStatus,
        'workflowStatus': approvalStatus,
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: approverType,
            action: 'approved',
            comments: comments || `${approverType} approved`
          }
        }
      };

      if (approvedCreds && approvedCreds.signed) {
        updateFields[`lpoDetails.${approverType}signed`] = true;
        updateFields[`lpoDetails.${approverType}authorised`] = approvedCreds.authorised;
        updateFields[`lpoDetails.${approverType}approvedBy`] = approvedCreds.approvedBy;
        updateFields[`lpoDetails.${approverType}approvedDate`] = approvedCreds.approvedDate || new Date().toISOString();

        if (approvedCreds.approvedFrom) updateFields[`lpoDetails.${approverType}approvedFrom`] = approvedCreds.approvedFrom;
        if (approvedCreds.approvedIP) updateFields[`lpoDetails.${approverType}approvedIP`] = approvedCreds.approvedIP;
        if (approvedCreds.approvedBDevice) updateFields[`lpoDetails.${approverType}approvedBDevice`] = approvedCreds.approvedBDevice;
        if (approvedCreds.approvedLocation) updateFields[`lpoDetails.${approverType}approvedLocation`] = approvedCreds.approvedLocation;
      }

      const lpoUpdateField = approverType === 'MD' ? { mdSigned: true } : { ceoSigned: true };
      const lpoUpdated = await LPO.findOneAndUpdate(
        {lpoRef},
        updateFields,
        lpoUpdateField,
        { new: true }
      );

      if (!lpoUpdated) {
        throw { status: 404, message: 'Complaint not found' };
      }

      let title, description

      const isAmendment = lpoUpdated.isAmendmented
      const isCEO = lpoUpdated.signatures.authorizedSignatoryTitle === 'CEO'
      const signatoryTitle = isCEO ? 'CEO' : 'MD'

      const prefix = isAmendment ? 'Amendment! ' : ''
      title = `${prefix}ACCOUNTS Approval Needed - LPO ${lpoRef}`
      description = `${signatoryTitle} signed and approved ${isAmendment ? 'amendment ' : ''}. Accounts approval needed.`

      const notification = await createNotification({
        title: title,
        description: description,
        priority: "high",
        sourceId: 'final_approval',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/accountsSign/${lpoRef}`,
        navigateText: `View and Sign`,
        navigteToId: lpoRef,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: `${approverType} approval completed`,
        data: lpoUpdated
      };
    } catch (error) {
      console.error(`Error in ${authUser || 'CEO'} approval:`, error);
      throw error;
    }
  }

  // After accountsApproval
  async accountsApproval(lpoRef, approvedBy, comments = '', approvedCreds) {
    try {
      const updateFields = {
        'lpoDetails.accountsApprovalDate': new Date(),
        'lpoDetails.status': 'accounts_approved',
        'workflowStatus': 'accounts_approved',
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: 'ACCOUNTS',
            action: 'approved',
            comments: comments || 'ACCOUNTS approved'
          }
        }
      };

      if (approvedCreds && approvedCreds.signed) {
        updateFields['lpoDetails.ACCOUNTSsigned'] = true;
        updateFields['lpoDetails.ACCOUNTSauthorised'] = approvedCreds.authorised;
        updateFields['lpoDetails.ACCOUNTSapprovedBy'] = approvedCreds.approvedBy;
        updateFields['lpoDetails.ACCOUNTSapprovedDate'] = approvedCreds.approvedDate || new Date().toISOString();

        if (approvedCreds.approvedFrom) updateFields['lpoDetails.ACCOUNTSapprovedFrom'] = approvedCreds.approvedFrom;
        if (approvedCreds.approvedIP) updateFields['lpoDetails.ACCOUNTSapprovedIP'] = approvedCreds.approvedIP;
        if (approvedCreds.approvedBDevice) updateFields['lpoDetails.ACCOUNTSapprovedBDevice'] = approvedCreds.approvedBDevice;
        if (approvedCreds.approvedLocation) updateFields['lpoDetails.ACCOUNTSapprovedLocation'] = approvedCreds.approvedLocation;
      }

      const lpoUpdated = await LPO.findOneAndUpdate(
        {lpoRef},
        updateFields,
        { accountsSigned: true },
        { new: true }
      );

      if (!lpoUpdated) {
        throw { status: 404, message: 'Complaint not found' };
      }

      let title, description

      if (lpoUpdated.isAmendmented) {
        title = `Amendment! Approved - LPO ${lpoRef}`
        description = `Accounts approved amendment LPO for complaint. Items can now be procured.`
      } else {
        title = `Approved - LPO ${lpoRef}`
        description = `Accounts approved LPO. Items can now be procured.`
      }

      const notification = await createNotification({
        title: title,
        description: description,
        priority: "high",
        sourceId: 'manager_approval',
        recipient: JSON.parse(process.env.OFFICE_MAIN),
        time: new Date(),
        navigateTo: `/(screens)/signedLpo/${lpoRef}`,
        navigateText: `View the item required`,
        navigteToId: lpoRef,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_MAIN),
        title,
        description,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'ACCOUNTS approval completed',
        data: lpoUpdated
      };
    } catch (error) {
      console.error('Error in ACCOUNTS approval:', error);
      throw error;
    }
  }

  // Step 8: Mark items as available (by JALEEL_KA or MAINTENANCE_HEAD)
  async markItemsAvailable(lpoRef, markedBy) {
    try {
      const lpoUpdated = await LPO.findOneAndUpdate(
        {lpoRef},
        {
          'lpoDetails.status': 'items_procured',
          workflowStatus: 'items_available',
          $push: {
            approvalTrail: {
              approvedBy: markedBy,
              role: 'PROCUREMENT',
              action: 'approved',
              comments: 'Items procured and available'
            }
          }
        },
        { new: true }
      );

      if (!lpoUpdated) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Notify mechanic that items are ready
      const notification = await createNotification({
        title: `LPO Approved - ${lpoRef}`,
        description: `All requested items are can be procured`,
        priority: "high",
        sourceId: 'items_ready',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        `LPO Approved - ${lpoRef}`,
        `All requested items are can be procured`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'Items marked as available',
        data: lpoUpdated
      };
    } catch (error) {
      console.error('Error marking items available:', error);
      throw error;
    }
  }

  // Get all LPOs
  async getAllLPOs() {
    try {
      return await LPO.find({}).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching LPOs: ${error.message}`);
    }
  }

  // Get LPO by reference number
  async getLPOByRef(refNo) {
    try {
      const lpo = await LPO.findOne({ lpoRef: refNo });
      if (!lpo) {
        throw new Error('LPO not found');
      }
      return lpo;
    } catch (error) {
      throw new Error(`Error fetching LPO: ${error.message}`);
    }
  }

  // Get all company details from all LPOs
  async getAllCompanyDetails() {
    try {
      const lpos = await LPO.find({}, 'company lpoRef date');
      return lpos.map(lpo => ({
        lpoRef: lpo.lpoRef,
        date: lpo.date,
        vendor: lpo.company.vendor,
        attention: lpo.company.attention,
        designation: lpo.company.designation
      }));
    } catch (error) {
      throw new Error(`Error fetching company details: ${error.message}`);
    }
  }

  // Get latest LPO reference
  async getLatestLPORef() {
    try {
      const latestLPO = await LPO.findOne({}).sort({ createdAt: -1 }).select('lpoRef');
      if (!latestLPO || !latestLPO.lpoRef) return null;

      // Extract the number between ATE and /SP
      const match = latestLPO.lpoRef.match(/^ATE(\d+)\/SP/);
      return match ? match[1] : null;
    } catch (error) {
      throw new Error(`Error fetching latest LPO reference: ${error.message}`);
    }
  }

  // Get latest LPO
  async getLatestLPO() {
    try {
      const latestLPO = await LPO.findOne({}).sort({ createdAt: -1 });
      return latestLPO;
    } catch (error) {
      throw new Error(`Error fetching latest LPO: ${error.message}`);
    }
  }

  // Get next LPO counter
  async getNextLPOCounter() {
    try {
      const latestLPO = await LPO.findOne({}).sort({ lpoCounter: -1 }).select('lpoCounter');
      return latestLPO ? latestLPO.lpoCounter + 1 : 1;
    } catch (error) {
      throw new Error(`Error fetching next LPO counter: ${error.message}`);
    }
  }

  // Update LPO
  async updateLPO(refNo, updateData) {
    try {
      // Find the existing LPO first
      const existingLPO = await LPO.findOne({ lpoRef: refNo.trim() });

      if (!existingLPO) {
        throw new Error('LPO not found');
      }

      // Check if this is an amendment
      if (updateData.isAmendmented === true) {
        // Create amendment record
        const amendment = {
          amendmentDate: new Date(),
          amendedBy: updateData.amendedBy || 'System',
          reason: updateData.amendmentReason || 'Amendment requested'
        };

        // Add amended items if provided
        if (updateData.items && updateData.items.length > 0) {
          amendment.amendedItems = updateData.items;

          // Calculate amended total amount
          amendment.amendedTotalAmount = updateData.items.reduce(
            (sum, item) => sum + (item.totalPrice || 0),
            0
          );

          // Apply discount if needed
          if (updateData.showDiscountInTotal && updateData.discount) {
            amendment.amendedTotalAmount -= updateData.discount;
            amendment.amendedDiscount = updateData.discount;
          }
        }

        // Add other amended fields if provided
        if (updateData.company) {
          amendment.amendedCompany = updateData.company;
        }

        if (updateData.equipments) {
          amendment.amendedEquipments = updateData.equipments;
        }

        if (updateData.quoteNo) {
          amendment.amendedQuoteNo = updateData.quoteNo;
        }

        if (updateData.requestText) {
          amendment.amendedRequestText = updateData.requestText;
        }

        if (updateData.termsAndConditions) {
          amendment.amendedTermsAndConditions = updateData.termsAndConditions;
        }

        console.log("refNo", refNo);


        // Update the LPO with amendment
        const lpo = await LPO.findOneAndUpdate(
          { lpoRef: refNo.trim() },
          {
            $set: {
              isAmendmented: true,
              // Reset signature flags for amendment
              pmSigned: false,
              accountsSigned: false,
              managerSigned: false,
              ceoSigned: false
            },
            $push: { amendments: amendment }
          },
          { new: true, runValidators: true }
        );

        return lpo;

      } else {
        // Regular update (not an amendment)
        // Recalculate total amount if items are updated
        if (updateData.items && updateData.items.length > 0) {
          updateData.totalAmount = updateData.items.reduce(
            (sum, item) => sum + (item.totalPrice || 0),
            0
          );
        }

        // If discount is being applied and showDiscountInTotal is true
        if (updateData.showDiscountInTotal && updateData.discount) {
          updateData.totalAmount = (updateData.totalAmount || 0) - (updateData.discount || 0);
        }

        // Remove amendment-specific fields from regular update
        delete updateData.amendedBy;
        delete updateData.amendmentReason;

        // Find and update with trimmed ref
        const lpo = await LPO.findOneAndUpdate(
          { lpoRef: refNo.trim() },
          { $set: updateData },
          { new: true, runValidators: true }
        );

        return lpo;
      }
    } catch (error) {
      throw new Error(`Error updating LPO: ${error.message}`);
    }
  }

  // Delete LPO
  async deleteLPO(refNo) {
    try {
      const lpo = await LPO.findOneAndDelete({ lpoRef: refNo });
      if (!lpo) {
        throw new Error('LPO not found');
      }
      return lpo;
    } catch (error) {
      throw new Error(`Error deleting LPO: ${error.message}`);
    }
  }

  // Get LPOs by date range
  async getLPOsByDateRange(startDate, endDate) {
    try {
      return await LPO.find({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching LPOs by date range: ${error.message}`);
    }
  }

  // Get LPOs by company
  async getLPOsByCompany(vendorName) {
    try {
      return await LPO.find({
        'company.vendor': { $regex: vendorName, $options: 'i' }
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching LPOs by company: ${error.message}`);
    }
  }

  async getLposByRegNo(regNo) {
    try {
      // Using regex to match regNo at the beginning of any equipment item
      // This will match items like "77269 – 10 Ton Forklift" when regNo is "77269"
      const regex = new RegExp(`^${regNo}\\s*–`, 'i');
      return await LPO.find({
        equipments: { $elemMatch: { $regex: regex } }
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching LPOs by registration number: ${error.message}`);
    }
  }

  // Get LPOs for stock (equipment field equals "For Stock")
  async getLposForStock() {
    try {
      return await LPO.find({
        equipment: { $regex: /^For Stock$/i }
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching stock LPOs: ${error.message}`);
    }
  }

  // Get LPOs for all equipments (equipment field equals "For all equipment")
  async getLposForAllEquipments() {
    try {
      return await LPO.find({
        equipment: { $regex: /^For all equipment$/i }
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching all equipment LPOs: ${error.message}`);
    }
  }
}

module.exports = new LPOService();