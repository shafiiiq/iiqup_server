var express = require('express');
var router = express.Router();
const userController = require('../controllers/service-report.controllers.js')
const UserModel = require('../models/user.model.js');
const BatteryModel = require('../models/batery.model.js');
const serviceReportModel = require('../models/service-report.model.js');
const TyreModel = require('../models/tyre.model.js');


// Add service report
router.post('/add-service-report', userController.addServiceReport)
router.get('/getwith/:id', userController.getServiceReportWithId)
router.put('/updatewith/:id', userController.updateServiceReportWithId)
router.delete('/deletewith/:id', userController.removeServiceReportWithId)

// Better route structure - group related routes
// All service histories (no filtering)
router.get('/histories/:regNo', userController.getAllServiceHistories)

// Service type filtering
router.get('/histories/:regNo/oil', userController.getAllOilServices)
router.get('/histories/:regNo/maintenance', userController.getAllMaintenanceServices)
router.get('/histories/:regNo/tyre', userController.getAllTyreServices)
router.get('/histories/:regNo/battery', userController.getAllBatteryServices)

// Date filtering
router.get('/histories/:regNo/date-range/:startDate/:endDate', userController.getServicesByDateRange)
router.get('/histories/:regNo/last-months/:monthsCount', userController.getServicesByLastMonths)

// Single service report by regNo and date
router.get('/:regNo/:date', userController.getServiceReport)

// Update and delete
router.put('/updateuser/:id', userController.updateServiceReport)
router.delete('/deleteuser/:id', userController.deleteServiceReport)





router.get('/fix-it', async (req, res) => {
  try {
    const result = await BatteryModel.updateMany(
      { createdAt: { $type: "string" } },
      [
        {
          $set: {
            createdAt: { $dateFromString: { dateString: "$createdAt" } }
          }
        }
      ],
      { timestamps: false }
    );
    
    console.log(`Updated ${result.modifiedCount} documents successfully`);
    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} documents successfully`,
      modifiedCount: result.modifiedCount,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error updating documents:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating documents',
      error: error.message
    });
  }
});


router.get('/fix-updated-at', async (req, res) => {
  try {
    const result = await BatteryModel.updateMany(
      { updatedAt: { $type: "string" } },
      [
        {
          $set: {
            updatedAt: { $dateFromString: { dateString: "$updatedAt" } }
          }
        }
      ],
      { timestamps: false }
    );
    
    console.log(`Updated ${result.modifiedCount} documents successfully`);
    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} documents successfully`,
      modifiedCount: result.modifiedCount,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error updating documents:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating documents',
      error: error.message
    });
  }
});




module.exports = router;






























// router.get('/add-that', async (req, res) => {
//   try {
//     const result = await serviceReportModel.updateMany(
//       { serviceType: { $exists: false } }, // only update documents without phoneNumber
//       {
//         $set: {
//           serviceType:
//             'oil'
//         }
//       } // default value, change as needed
//     );

//     console.log(`Updated ${result.modifiedCount} documents successfully`);
//     res.status(200).send(`Updated ${result.modifiedCount} documents successfully`);
//   } catch (error) {
//     console.error('Error updating documents:', error);
//     res.status(500).send('An error occurred while updating documents');
//   }
// });