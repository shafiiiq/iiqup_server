const LPO = require('../models/lpo.model');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

class LPOService {
  // Create a new LPO
  async createLPO(lpoData) {
    try {
      // Calculate total amount from items
      const totalAmount = lpoData.items.reduce((sum, item) => sum + item.totalPrice, 0);

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
        // Ensure all required signature fields exist
        lpoData.signatures = {
          accountsDept: lpoData.signatures.accountsDept || 'ROSHAN SHA',
          purchasingManager: lpoData.signatures.purchasingManager || 'ABDUL MALIK',
          operationsManager: lpoData.signatures.operationsManager || 'SURESHKANTH',
          authorizedSignatory: lpoData.signatures.authorizedSignatory || 'AHAMMED KAMAL',
          authorizedSignatoryTitle: lpoData.signatures.authorizedSignatoryTitle || 'CEO'
        };
      }

      const lpoWithTotal = {
        ...lpoData,
        totalAmount
      };

      const lpo = new LPO(lpoWithTotal);

      console.log(lpoData);
      

      await createNotification({
        title: `New LPO`,
        description: `LPO: ${lpoData.lpoRef} for ${lpoData.company.vendor} for ${lpoData.equipments}`,
        priority: "high",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null, // broadcast to all users
        `New LPO`, //title
        `LPO: ${lpoData.lpoRef} for ${lpoData.company.vendor} for ${lpoData.equipments}`, //decription
        'high', //priority
        'normal' // type
      );

      return await lpo.save();
    } catch (error) {
      throw new Error(`Error creating LPO: ${error.message}`);
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
      // Recalculate total amount if items are updated
      if (updateData.items) {
        updateData.totalAmount = updateData.items.reduce((sum, item) => sum + item.totalPrice, 0);
      }

      const lpo = await LPO.findOneAndUpdate(
        { lpoRef: refNo },
        updateData,
        { new: true, runValidators: true }
      );

      if (!lpo) {
        throw new Error('LPO not found');
      }

      return lpo;
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