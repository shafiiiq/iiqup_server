var express = require('express');
var router = express.Router();
const userController = require('../controllers/service-report.controllers.js')
const UserModel = require('../models/user.model.js');
const BatteryModel = require('../models/batery.model.js');
const serviceReportModel = require('../models/service-report.model.js');
const TyreModel = require('../models/tyre.model.js');
const serviceHistoryModel = require('../models/service-history.model.js');
const MaintananceModel = require('../models/maintanance-history.model.js');
const Equipment = require('../models/equip.model.js');
const Handover = require('../models/equip-hand-over-stock.model.js');
const Toolkit = require('../models/toolkit.model.js');
const Stokcs = require('../models/stocks.model.js');
const mongoose = require('mongoose');
const Mechanic = require('../models/mechanic.model.js');
const User = require('../models/user.model.js');
const { ObjectId } = require('mongoose').Types;
const bcrypt = require('bcrypt');

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





router.get('/add-encrypted-password', async (req, res) => {
  try {

    const mail = 'shafeek@ansarigroup.in'
    const password = '643902'

    const salt = await bcrypt.genSalt(10);
    const encPasw = await bcrypt.hash(password, salt);

    const result = await User.updateOne(
      { email: mail },
      { $set: { docAuthPasw: encPasw } }
    );
    console.log(`Updated ${result.docAuthPasw} documents successfully`);
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


// router.post('/fix-updated-at', async (req, res) => {
//   var Model
//   if (req.body.type === 'tyre') {
//     Model = TyreModel
//   } else if (req.body.type === 'equipments') {
//     Model = Equipment
//   } else if (req.body.type === 'reports') {
//     Model = serviceReportModel
//   } else if (req.body.type === 'histories') {
//     Model = serviceHistoryModel
//   } else if (req.body.type === 'maintanance') {
//     Model = MaintananceModel
//   }else if (req.body.type === 'handover') {
//     Model = Handover
//   }else if (req.body.type === 'toolkit') {
//     Model = Toolkit
//   }else if (req.body.type === 'stocks') {
//     Model = Stokcs
//   }
//   try {
//     const result = await Model.updateMany(
//       { updatedAt: { $type: "string" } },
//       [
//         {
//           $set: {
//             updatedAt: { $dateFromString: { dateString: "$updatedAt" } }
//           }
//         }
//       ],
//       { timestamps: false }
//     );

//     console.log(`Updated ${result.modifiedCount} documents successfully`);
//     res.status(200).json({
//       success: true,
//       message: `Updated ${result.modifiedCount} documents successfully`,
//       modifiedCount: result.modifiedCount,
//       processedAt: new Date().toISOString()
//     });

//   } catch (error) {
//     console.error('Error updating documents:', error);
//     res.status(500).json({
//       success: false,
//       message: 'An error occurred while updating documents',
//       error: error.message
//     });
//   }
// });

// router.post('/fix-id', async (req, res) => {
//   try {
//     var Modell;

//     // Select the appropriate model based on request type
//     if (req.body.type === 'tyre') {
//       Modell = TyreModel;
//     } else if (req.body.type === 'equipments') {
//       Modell = Equipment;
//     } else if (req.body.type === 'reports') {
//       Modell = serviceReportModel;
//     } else if (req.body.type === 'histories') {
//       Modell = serviceHistoryModel;
//     } else if (req.body.type === 'maintanance') {
//       Modell = MaintananceModel;
//     } else if (req.body.type === 'handover') {
//       Modell = Handover;
//     } else if (req.body.type === 'toolkit') {
//       Modell = Toolkit;
//     } else if (req.body.type === 'stocks') {
//       Modell = Stokcs;
//     } else if (req.body.type === 'battery') {
//       Modell = BatteryModel;
//     }  else if (req.body.type === 'mec') {
//       Modell = Mechanic;
//     }else {
//       return res.status(400).json({ error: 'Invalid type specified' });
//     }

//     // Check initial state
//     const stringIdCount = await Modell.find({ _id: { $type: "string" } }).countDocuments();
//     const objectIdCount = await Modell.find({ _id: { $type: "objectId" } }).countDocuments();

//     console.log(`Initial state - String IDs: ${stringIdCount}, ObjectIDs: ${objectIdCount}`);

//     if (stringIdCount === 0) {
//       return res.json({
//         success: true,
//         message: "No string IDs found. All documents already have proper ObjectIDs.",
//         initialStringIds: stringIdCount,
//         initialObjectIds: objectIdCount
//       });
//     }

//     // Get the MongoDB collection directly
//     const collection = Modell.collection;

//     // Find all documents with string type _id using raw MongoDB query
//     const docs = await collection.find({ _id: { $type: "string" } }).toArray();
//     let processedCount = 0;
//     let convertedCount = 0;

//     console.log(`Found ${docs.length} documents with string IDs`);

//     for (const doc of docs) {
//       try {
//         const oldStringId = doc._id;
//         const newObjectId = new mongoose.Types.ObjectId(oldStringId);

//         console.log(`Processing: ${oldStringId} -> ${newObjectId}`);
//         console.log(`Document before conversion:`, JSON.stringify({ _id: doc._id, name: doc.name }));

//         // Create new document with ObjectId
//         const newDoc = { ...doc };
//         newDoc._id = newObjectId;

//         // Method 1: Try using bulkWrite for atomic operation
//         try {
//           const bulkOps = [
//             {
//               deleteOne: {
//                 filter: { _id: oldStringId }
//               }
//             },
//             {
//               insertOne: {
//                 document: newDoc
//               }
//             }
//           ];

//           const result = await collection.bulkWrite(bulkOps, { ordered: true });

//           if (result.deletedCount === 1 && result.insertedCount === 1) {
//             convertedCount++;
//             console.log(`✅ BulkWrite success: ${oldStringId} -> ${newObjectId}`);
//             console.log(`Result:`, result.deletedCount, 'deleted,', result.insertedCount, 'inserted');
//           } else {
//             console.log(`❌ BulkWrite partial success: deleted ${result.deletedCount}, inserted ${result.insertedCount}`);
//           }

//         } catch (bulkError) {
//           console.log(`❌ BulkWrite failed for ${oldStringId}: ${bulkError.message}`);

//           // Method 2: Manual delete and insert
//           try {
//             console.log(`Trying manual delete/insert for ${oldStringId}`);

//             // First verify the document exists
//             const existingDoc = await collection.findOne({ _id: oldStringId });
//             if (!existingDoc) {
//               console.log(`❌ Document ${oldStringId} not found`);
//               continue;
//             }

//             // Delete the old document
//             const deleteResult = await collection.deleteOne({ _id: oldStringId });
//             console.log(`Delete result for ${oldStringId}:`, deleteResult.deletedCount);

//             if (deleteResult.deletedCount === 1) {
//               // Insert the new document
//               const insertResult = await collection.insertOne(newDoc);
//               console.log(`Insert result:`, insertResult.insertedId);

//               if (insertResult.insertedId) {
//                 convertedCount++;
//                 console.log(`✅ Manual conversion success: ${oldStringId} -> ${newObjectId}`);
//               } else {
//                 console.log(`❌ Insert failed for ${oldStringId}`);
//               }
//             } else {
//               console.log(`❌ Delete failed for ${oldStringId}`);
//             }

//           } catch (manualError) {
//             console.log(`❌ Manual method failed for ${oldStringId}: ${manualError.message}`);
//           }
//         }

//         processedCount++;

//       } catch (error) {
//         console.log(`❌ Error processing document ${doc._id}: ${error.message}`);
//       }
//     }

//     // Wait a moment for operations to complete
//     await new Promise(resolve => setTimeout(resolve, 1000));

//     // Check final state
//     const finalStringIdCount = await Modell.find({ _id: { $type: "string" } }).countDocuments();
//     const finalObjectIdCount = await Modell.find({ _id: { $type: "objectId" } }).countDocuments();

//     console.log(`Final state - String IDs: ${finalStringIdCount}, ObjectIDs: ${finalObjectIdCount}`);

//     // Verify with raw collection query too
//     const rawStringCount = await collection.countDocuments({ _id: { $type: "string" } });
//     const rawObjectCount = await collection.countDocuments({ _id: { $type: "objectId" } });
//     console.log(`Raw collection final state - String IDs: ${rawStringCount}, ObjectIDs: ${rawObjectCount}`);

//     // Send success response with detailed information
//     res.json({
//       success: true,
//       totalProcessed: processedCount,
//       converted: convertedCount,
//       beforeConversion: {
//         stringIds: stringIdCount,
//         objectIds: objectIdCount
//       },
//       afterConversion: {
//         stringIds: finalStringIdCount,
//         objectIds: finalObjectIdCount,
//         rawStringIds: rawStringCount,
//         rawObjectIds: rawObjectCount
//       },
//       message: `Successfully processed ${processedCount} documents. ${convertedCount} converted from string to ObjectId. Final result: ${finalObjectIdCount} documents with proper ObjectIDs, ${finalStringIdCount} remaining string IDs.`
//     });

//   } catch (error) {
//     console.error('Fix-ID Route Error:', error);
//     res.status(500).json({
//       error: error.message,
//       success: false
//     });
//   }
// });

// router.get('/fix-variant-ids', async (req, res) => {
//   try {
//     const Modell = Toolkit;

//     // Get the MongoDB collection directly
//     const collection = Modell.collection;

//     // Find all documents that have variants with string IDs
//     const docs = await collection.find({
//       "variants._id": { $type: "string" }
//     }).toArray();

//     let processedDocuments = 0;
//     let convertedVariantIds = 0;
//     let convertedHistoryIds = 0;

//     console.log(`Found ${docs.length} documents with string variant IDs`);

//     if (docs.length === 0) {
//       return res.json({ 
//         success: true, 
//         message: "No string variant IDs found. All variant IDs are already ObjectIds.",
//         documentsProcessed: 0,
//         variantIdsConverted: 0,
//         historyIdsConverted: 0
//       });
//     }

//     for (const doc of docs) {
//       try {
//         console.log(`Processing document: ${doc._id}`);
//         let documentModified = false;

//         // Process variants
//         if (doc.variants && Array.isArray(doc.variants)) {
//           doc.variants = doc.variants.map(variant => {
//             const updatedVariant = { ...variant };

//             // Convert variant._id if it's a string
//             if (updatedVariant._id && typeof updatedVariant._id === 'string') {
//               try {
//                 const oldVariantId = updatedVariant._id;
//                 updatedVariant._id = new mongoose.Types.ObjectId(oldVariantId);
//                 convertedVariantIds++;
//                 documentModified = true;
//                 console.log(`  ✅ Converted variant ID: ${oldVariantId} -> ${updatedVariant._id}`);
//               } catch (variantIdError) {
//                 console.log(`  ❌ Failed to convert variant ID: ${updatedVariant._id} - ${variantIdError.message}`);
//               }
//             }

//             // Convert stockHistory item IDs if they're strings
//             if (updatedVariant.stockHistory && Array.isArray(updatedVariant.stockHistory)) {
//               updatedVariant.stockHistory = updatedVariant.stockHistory.map(historyItem => {
//                 const updatedHistoryItem = { ...historyItem };

//                 if (updatedHistoryItem._id && typeof updatedHistoryItem._id === 'string') {
//                   try {
//                     const oldHistoryId = updatedHistoryItem._id;
//                     updatedHistoryItem._id = new mongoose.Types.ObjectId(oldHistoryId);
//                     convertedHistoryIds++;
//                     documentModified = true;
//                     console.log(`    ✅ Converted history ID: ${oldHistoryId} -> ${updatedHistoryItem._id}`);
//                   } catch (historyIdError) {
//                     console.log(`    ❌ Failed to convert history ID: ${updatedHistoryItem._id} - ${historyIdError.message}`);
//                   }
//                 }

//                 return updatedHistoryItem;
//               });
//             }

//             return updatedVariant;
//           });
//         }

//         // Update the document if it was modified
//         if (documentModified) {
//           const updateResult = await collection.replaceOne(
//             { _id: doc._id },
//             doc
//           );

//           if (updateResult.modifiedCount === 1) {
//             processedDocuments++;
//             console.log(`✅ Successfully updated document: ${doc._id}`);
//           } else {
//             console.log(`❌ Failed to update document: ${doc._id}`);
//           }
//         }

//       } catch (error) {
//         console.log(`❌ Error processing document ${doc._id}: ${error.message}`);
//       }
//     }

//     // Wait a moment for operations to complete
//     await new Promise(resolve => setTimeout(resolve, 500));

//     // Check final state
//     const finalDocsWithStringVariantIds = await collection.countDocuments({
//       "variants._id": { $type: "string" }
//     });

//     const finalDocsWithObjectIdVariantIds = await collection.countDocuments({
//       "variants._id": { $type: "objectId" }
//     });

//     const finalDocsWithStringHistoryIds = await collection.countDocuments({
//       "variants.stockHistory._id": { $type: "string" }
//     });

//     console.log(`Final state - Documents with string variant IDs: ${finalDocsWithStringVariantIds}`);
//     console.log(`Final state - Documents with ObjectId variant IDs: ${finalDocsWithObjectIdVariantIds}`);
//     console.log(`Final state - Documents with string history IDs: ${finalDocsWithStringHistoryIds}`);

//     // Send success response with detailed information
//     res.json({ 
//       success: true, 
//       documentsProcessed: processedDocuments,
//       variantIdsConverted: convertedVariantIds,
//       historyIdsConverted: convertedHistoryIds,
//       finalState: {
//         docsWithStringVariantIds: finalDocsWithStringVariantIds,
//         docsWithObjectIdVariantIds: finalDocsWithObjectIdVariantIds,
//         docsWithStringHistoryIds: finalDocsWithStringHistoryIds
//       },
//       message: `Successfully processed ${processedDocuments} documents. Converted ${convertedVariantIds} variant IDs and ${convertedHistoryIds} history IDs from string to ObjectId.`
//     });

//   } catch (error) {
//     console.error('Fix-Variant-IDs Route Error:', error);
//     res.status(500).json({ 
//       error: error.message,
//       success: false 
//     });
//   }
// });

module.exports = router;