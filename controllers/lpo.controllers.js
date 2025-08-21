const lpoService = require('../services/lpo-services');

class LPOController {
  // Add new LPO
  async addLPO(req, res) {
    try {
      const lpoData = req.body;

      // Validate required fields
      if (!lpoData.lpoRef || !lpoData.date || !lpoData.equipments || !lpoData.quoteNo) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: lpoRef, date, equipment, workingHrs, Quotation number'
        });
      }

      if (!lpoData.company || !lpoData.company.vendor || !lpoData.company.attention || !lpoData.company.designation) {
        return res.status(400).json({
          success: false,
          message: 'Missing required company fields: vendor, attention, designation'
        });
      }

      if (!lpoData.items || !Array.isArray(lpoData.items) || lpoData.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items array is required and cannot be empty'
        });
      }

      // Get next LPO counter if not provided
      if (!lpoData.lpoCounter) {
        lpoData.lpoCounter = await lpoService.getNextLPOCounter();
      }

      // Map paymentTerms to termsAndConditions if they exist
      if (lpoData.paymentTerms && Array.isArray(lpoData.paymentTerms)) {
        // Filter out empty terms and ensure "Terms & Conditions" is first
        const filteredTerms = lpoData.paymentTerms.filter(term => term.trim() !== '');
        lpoData.termsAndConditions = ['Terms & Conditions', ...filteredTerms];
      } else {
        // Default terms if paymentTerms not provided
        lpoData.termsAndConditions = [
          'Terms & Conditions',
          'Payment will be made within 90 days from the day of submission of invoice'
        ];
      }

      // Handle signatures - use provided signatures or defaults
      if (!lpoData.signatures) {
        lpoData.signatures = {
          accountsDept: 'ROSHAN SHA',
          purchasingManager: 'ABDUL MALIK',
          operationsManager: 'SURESHKANTH',
          authorizedSignatory: 'AHAMMED KAMAL', // Default to CEO
          authorizedSignatoryTitle: 'CEO'
        };
      }

      const lpo = await lpoService.createLPO(lpoData);

      res.status(201).json({
        success: true,
        message: 'LPO created successfully',
        data: lpo
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        success: false,
        message: error.message
      });
    }
  }

  // Get all LPOs
  async getAllLPOs(req, res) {
    try {
      const lpos = await lpoService.getAllLPOs();

      res.status(200).json({
        success: true,
        message: 'LPOs retrieved successfully',
        data: lpos,
        count: lpos.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get LPO by reference number
  async getLPOByRef(req, res) {
    try {
      const refNo = req.params[0]; // Access the wildcard match

      if (!refNo) {
        return res.status(400).json({
          success: false,
          message: 'Reference number is required'
        });
      }

      const lpo = await lpoService.getLPOByRef(refNo);

      res.status(200).json({
        success: true,
        message: 'LPO retrieved successfully',
        data: lpo
      });
    } catch (error) {
      const statusCode = error.message === 'LPO not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get all company details
  async getCompanyDetails(req, res) {
    try {
      const companyDetails = await lpoService.getAllCompanyDetails();

      res.status(200).json({
        success: true,
        message: 'Company details retrieved successfully',
        data: companyDetails,
        count: companyDetails.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get latest LPO reference
  async getLatestLPORef(req, res) {
    try {
      
      const latestRef = await lpoService.getLatestLPORef();

      res.status(200).json({
        success: true,
        message: 'Latest LPO reference retrieved successfully',
        data: {
          latestRef: latestRef || 'No LPO found'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get latest LPO
  async getLatestLPO(req, res) {
    try {
      const latestLPO = await lpoService.getLatestLPO();

      console.log(latestLPO);
      

      res.status(200).json({
        success: true,
        message: 'Latest LPO retrieved successfully',
        data: latestLPO || null
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update LPO
  async updateLPO(req, res) {
    try {
      const { refNo } = req.params;
      const updateData = req.body;

      if (!refNo) {
        return res.status(400).json({
          success: false,
          message: 'Reference number is required'
        });
      }

      const lpo = await lpoService.updateLPO(refNo, updateData);

      res.status(200).json({
        success: true,
        message: 'LPO updated successfully',
        data: lpo
      });
    } catch (error) {
      const statusCode = error.message === 'LPO not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete LPO
  async deleteLPO(req, res) {
    try {
      const { refNo } = req.params;

      if (!refNo) {
        return res.status(400).json({
          success: false,
          message: 'Reference number is required'
        });
      }

      const lpo = await lpoService.deleteLPO(refNo);

      res.status(200).json({
        success: true,
        message: 'LPO deleted successfully',
        data: lpo
      });
    } catch (error) {
      const statusCode = error.message === 'LPO not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get LPOs by date range
  async getLPOsByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const lpos = await lpoService.getLPOsByDateRange(startDate, endDate);

      res.status(200).json({
        success: true,
        message: 'LPOs retrieved successfully',
        data: lpos,
        count: lpos.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get LPOs by company
  async getLPOsByCompany(req, res) {
    try {
      const { vendorName } = req.params;

      if (!vendorName) {
        return res.status(400).json({
          success: false,
          message: 'Vendor name is required'
        });
      }

      const lpos = await lpoService.getLPOsByCompany(vendorName);

      res.status(200).json({
        success: true,
        message: 'LPOs retrieved successfully',
        data: lpos,
        count: lpos.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get LPOs by registration number
  async getLposByRegNo(req, res) {
    try {
      const { regNo } = req.params;
      if (!regNo) {
        return res.status(400).json({
          success: false,
          message: 'Registration number is required'
        });
      }

      const lpos = await lpoService.getLposByRegNo(regNo);
      res.status(200).json({
        success: true,
        data: lpos,
        message: `LPOs for registration number ${regNo} retrieved successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving LPOs by registration number',
        error: error.message
      });
    }
  }

  // Get LPOs for stock
  async getLposForStock(req, res) {
    try {
      const lpos = await lpoService.getLposForStock();
      res.status(200).json({
        success: true,
        data: lpos,
        message: 'Stock LPOs retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving stock LPOs',
        error: error.message
      });
    }
  }

  // Get LPOs for all equipments
  async getLposForAllEquipments(req, res) {
    try {
      const lpos = await lpoService.getLposForAllEquipments();
      res.status(200).json({
        success: true,
        data: lpos,
        message: 'All equipment LPOs retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving all equipment LPOs',
        error: error.message
      });
    }
  }
}

module.exports = new LPOController();