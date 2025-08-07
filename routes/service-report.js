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





router.get('/add-that', async (req, res) => {
  try {
    // Update all documents to set updatedAt = createdAt
    const result = await TyreModel.updateMany(
      {}, // Empty filter to match all documents
      [
        {
          $set: {
            updatedAt: "$createdAt" // Copy createdAt value to updatedAt
          }
        }
      ],
      { 
        timestamps: false // Disable automatic timestamp updates
      }
    );

    const processedCount = result.modifiedCount;
    
    console.log(`Updated ${processedCount} documents successfully`);
    res.status(200).json({
      success: true,
      message: `Updated ${processedCount} documents successfully`,
      modifiedCount: processedCount,
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



// router.get('/add-that', async (req, res) => {
//     try {
//         // Fetch all battery data
//         const batteryData = await BatteryModel.find({});

//         // Process each battery record
//         const serviceReports = batteryData.map(battery => {
//             return {
//                 serviceHrs: battery.runningHours  || " ", // Leave empty as not in battery data
//                 regNo: battery.equipmentNo  || "", // Use equipmentNo as regNo
//                 nextServiceHrs: " ", // Leave empty
//                 machine: battery.equipment || "", // Use equipment as machine
//                 mechanics: " ", // Leave empty
//                 location: battery.location || " ",
//                 date: battery.date ? new Date(battery.date).toISOString().split('T')[0] : "", // Format date
//                 operatorName: battery.operator || " ", // Use operator as operatorName
//                 remarks: "Tyre changed", // Fixed remark
//                 serviceType: "tyre", // Fixed service type
//                 checklistItems: [
//                     { id: 1, description: "Change Engine oil & Filter", status: "" },
//                     { id: 2, description: "Change Fuel Filter", status: "" },
//                     { id: 3, description: "Check/Clean Air Filter", status: "" },
//                     { id: 4, description: "Check Transmission Filter", status: "" },
//                     { id: 5, description: "Check Power Steering Oil", status: "" },
//                     { id: 6, description: "Check Hydraulic Oil", status: "" },
//                     { id: 7, description: "Check Brake", status: "" },
//                     { id: 8, description: "Check Tyre Air Pressure", status: "" },
//                     { id: 9, description: "Check Oil Leak", status: "" },
//                     { id: 10, description: "Check Battery Condition", status: "" }, // Only this one checked
//                     { id: 11, description: "Check Wiper & Water", status: "" },
//                     { id: 12, description: "Check All Lights", status: "" },
//                     { id: 13, description: "Check All Horns", status: "" },
//                     { id: 14, description: "Check Parking Brake", status: "" },
//                     { id: 15, description: "Check Differential Oil", status: "" },
//                     { id: 16, description: "Check Rod Water & Hoses", status: "" },
//                     { id: 17, description: "Lubricants All Points", status: "" },
//                     { id: 18, description: "Check Gear Shift System", status: "" },
//                     { id: 19, description: "Check Clutch System", status: "" },
//                     { id: 20, description: "Check Wheel Nut", status: "" },
//                     { id: 21, description: "Check Starter & Alternator", status: "" },
//                     { id: 22, description: "Check Number Plate both", status: "" },
//                     { id: 23, description: "Check Paint", status: "" },
//                     { id: 24, description: "Check Tires", status: "✓" },
//                     { id: 25, description: "Check Silencer", status: "" },
//                     { id: 26, description: "Replace Hydraulic Oil- Filter", status: "" },
//                     { id: 27, description: "Replace Transmission Oil", status: "" },
//                     { id: 28, description: "Replace Differential Oil", status: "" },
//                     { id: 29, description: "Replace Steering Box Oil", status: "" },
//                     { id: 30, description: "Check Engine Valve Clearence", status: "" },
//                     { id: 31, description: "Replace clutch fluid", status: "" },
//                     { id: 32, description: "Check Brake Lining", status: "" },
//                     { id: 33, description: "Change Drive Belt", status: "" }
//                 ],
//                 createdAt: new Date(),
//                 updatedAt: new Date()
//             };
//         });

//         // Insert all processed reports
//         const result = await serviceReportModel.insertMany(serviceReports);

//         res.status(200).json({
//             success: true,
//             message: `Processed ${result.length} battery records into service reports`,
//             data: result
//         });
//     } catch (error) {
//         console.error('Error processing battery data:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to process battery data',
//             error: error.message
//         });
//     }
// });


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