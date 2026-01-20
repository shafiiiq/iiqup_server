const express = require('express');
const router = express.Router();
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
const Fuels = require('../models/fuels.model.js');
const User = require('../models/user.model.js');
const equipModel = require('../models/equip.model.js');
const PushNotificationService = require('../utils/push-notification-jobs');
const { createNotification } = require('../utils/notification-jobs');


router.get('/put-the-item', async (req, res) => {
  try {
    // Update all mechanics to set status as "available"
    const result = await Mechanic.updateMany(
      {}, // empty filter means all documents
      { status: "available" }
    );

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} mechanics to available status`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating mechanic status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mechanic status',
      error: error.message
    });
  }
});

// GET /api/fuels/equipment-consumption - Get fuel consumption for all equipment
router.get('/match-and-store', async (req, res) => {
  try {
    const bulkOperations = equipmentsData.map(equipData => ({
      updateOne: {
        filter: { regNo: equipData.regNo },
        update: {
          $addToSet: { certificationBody: equipData.operator },
          $set: { updatedAt: new Date() }
        }
      }
    }));

    const result = await Equipment.bulkWrite(bulkOperations);

    res.status(200).json({
      success: true,
      message: 'Equipment operators updated successfully',
      result: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        total: equipmentsData.length
      }
    });

  } catch (error) {
    console.error('Error updating equipment operators:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating equipment operators',
      error: error.message
    });
  }
});

router.get('/match-and-store', async (req, res) => {
  try {
    const bulkOperations = equipmentsData.map(equipData => ({
      updateOne: {
        filter: { regNo: equipData.regNo },
        update: {
          $addToSet: { certificationBody: equipData.operator },
          $set: { updatedAt: new Date() }
        }
      }
    }));

    const result = await Equipment.bulkWrite(bulkOperations);

    res.status(200).json({
      success: true,
      message: 'Equipment operators updated successfully',
      result: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        total: equipmentsData.length
      }
    });

  } catch (error) {
    console.error('Error updating equipment operators:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating equipment operators',
      error: error.message
    });
  }
});

router.get('/activate-equipment', async (req, res) => {
  try {
    const regNumbers = equipmentsData.map(equipData => equipData.regNo);

    const result = await Equipment.updateMany(
      {
        regNo: { $in: regNumbers },
        status: { $ne: "active" }
      },
      {
        $set: {
          status: "active",
          updatedAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Equipment status updated to active',
      result: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        total: equipmentsData.length
      }
    });

  } catch (error) {
    console.error('Error updating equipment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating equipment status',
      error: error.message
    });
  }
});


router.get('/update-sites', async (req, res) => {
  try {
    const bulkOperations = equipmentsData.map(equipData => ({
      updateOne: {
        filter: { regNo: equipData.regNo },
        update: {
          $addToSet: { site: equipData.site },
          $set: { updatedAt: new Date() }
        }
      }
    }));

    const result = await Equipment.bulkWrite(bulkOperations);

    res.status(200).json({
      success: true,
      message: 'Equipment sites updated successfully',
      result: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        total: equipmentsData.length
      }
    });

  } catch (error) {
    console.error('Error updating equipment sites:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating equipment sites',
      error: error.message
    });
  }
});


const bcrypt = require('bcrypt');

router.post('/add-activation-key', async (req, res) => {
  try {
    const { userId, activationKey } = req.body;

    // Validate
    if (!userId || !activationKey) {
      return res.status(400).json({
        success: false,
        message: 'userId and activationKey are required'
      });
    }

    if (activationKey.length !== 20) {
      return res.status(400).json({
        success: false,
        message: 'Activation key must be exactly 20 digits '
      });
    }

    // Hash the activation key
    const hashedKey = await bcrypt.hash(activationKey, 10);

    // Update user with all signature types using same key
    const result = await User.updateOne(
      { _id: userId },
      {
        $set: {
          signatureActivation: [
            {
              signType: 'pm',
              activationKey: hashedKey,
              trustedDevices: [],
              isActivated: false
            },
            {
              signType: 'accounts',
              activationKey: hashedKey,
              trustedDevices: [],
              isActivated: false
            },
            {
              signType: 'manager',
              activationKey: hashedKey,
              trustedDevices: [],
              isActivated: false
            },
            {
              signType: 'authorized',
              activationKey: hashedKey,
              trustedDevices: [],
              isActivated: false
            },
            {
              signType: 'seal',
              activationKey: hashedKey,
              trustedDevices: [],
              isActivated: false
            }
          ],
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Activation key added successfully',
      userId: userId,
      activationKey: activationKey
    });

  } catch (error) {
    console.error('Error adding activation key:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding activation key',
      error: error.message
    });
  }
});


router.post('/push-test', async (req, res) => {
  const user = await User.findOne({ email: req.body.email })

  console.log(user.uniqueCode);

  const result = await PushNotificationService.sendGeneralNotification(
    user.uniqueCode,
    `This is a test! Please confirm you received it.`,
    `This is message is for testing purpose. please be quit. nothing action required`,
    'high',
    'normal',
  );

  console.log(result); 

  res.json({
    status: 200,
    message: "success",
    result: result
  })
});

router.get('/add-assignedDate-field', async (req, res) => {
  try {
    const toolkits = await Toolkit.find({}).lean(); // Use lean() to get raw data

    let updatedCount = 0;
    let totalHistoryRecords = 0;

    for (const toolkit of toolkits) {
      const bulkOps = [];

      for (let vIndex = 0; vIndex < toolkit.variants.length; vIndex++) {
        const variant = toolkit.variants[vIndex];

        for (let hIndex = 0; hIndex < variant.stockHistory.length; hIndex++) {
          const history = variant.stockHistory[hIndex];
          totalHistoryRecords++;

          // Check if assignedDate actually exists in the document
          if (!history.hasOwnProperty('assignedDate')) {
            const dateToSet = history.timestamp || new Date();

            bulkOps.push({
              updateOne: {
                filter: {
                  _id: toolkit._id,
                  [`variants.${vIndex}.stockHistory.${hIndex}._id`]: history._id
                },
                update: {
                  $set: {
                    [`variants.${vIndex}.stockHistory.${hIndex}.assignedDate`]: dateToSet
                  }
                }
              }
            });

            updatedCount++;
          }
        }
      }

      // Execute bulk operations for this toolkit
      if (bulkOps.length > 0) {
        await Toolkit.bulkWrite(bulkOps);
      }
    }

    res.status(200).json({
      success: true,
      message: 'assignedDate field added to stock history records',
      data: {
        totalToolkits: toolkits.length,
        totalHistoryRecords: totalHistoryRecords,
        updatedRecords: updatedCount
      }
    });

  } catch (error) {
    console.error('Error adding assignedDate field:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add assignedDate field',
      error: error.message
    });
  }
});


module.exports = router;

// router.get('/add-encrypted-password', async (req, res) => {
//   try {

//     const mail = 'shafeek@ansarigroup.in'
//     const password = '643902'

//     const salt = await bcrypt.genSalt(10);
//     const encPasw = await bcrypt.hash(password, salt);

//     const result = await User.updateOne(
//       { email: mail },
//       { $set: { docAuthPasw: encPasw } }
//     );
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



router.get('/data-to-mongo', async (req, res) => {
 Mechanic
})




const fs = require('fs').promises;
const path = require('path');

router.get('/get-data-and-store', async (req, res) => {
  const baseUrl = process.env.ATTENDANCE_URL;
  const username = process.env.ATTENDANCE_SYSTEM_UNAME;
  const password = process.env.ATTENDANCE_SYSTEM_PASS;
  
  let cookieJar = new Map();
  let allData = [];
  
  try {
    console.log('🔐 Starting login process...');
    
    // Step 1: Get CSRF token
    const loginPageResponse = await fetch(`${baseUrl}/login/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    // Parse cookies from response
    const setCookies = loginPageResponse.headers.get('set-cookie');
    if (setCookies) {
      const cookieStrings = setCookies.split(/,(?=\s*[a-zA-Z])/);
      cookieStrings.forEach(cookieString => {
        const parts = cookieString.split(';');
        const [nameValue] = parts;
        if (nameValue && nameValue.includes('=')) {
          const [name, ...valueParts] = nameValue.split('=');
          const value = valueParts.join('=');
          if (name && value) {
            cookieJar.set(name.trim(), value.trim());
          }
        }
      });
    }

    // Extract CSRF token from HTML
    const html = await loginPageResponse.text();
    const patterns = [
      /name=["|']csrfmiddlewaretoken["|']\s+value=["|']([^"']+)["|']/,
      /value=["|']([^"']+)["|']\s+name=["|']csrfmiddlewaretoken["|']/,
      /<input[^>]*name=["|']csrfmiddlewaretoken["|'][^>]*value=["|']([^"']+)["|']/
    ];

    let csrfToken = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        csrfToken = match[1];
        break;
      }
    }

    if (!csrfToken) {
      throw new Error('Could not obtain CSRF token');
    }

    if (!cookieJar.has('csrftoken') && csrfToken) {
      cookieJar.set('csrftoken', csrfToken);
    }

    console.log('✅ CSRF token obtained');

    // Step 2: Login
    const formData = new URLSearchParams();
    formData.append('csrfmiddlewaretoken', csrfToken);
    formData.append('username', username);
    formData.append('password', password);
    formData.append('captcha', '');
    formData.append('template10', '');
    formData.append('login_type', 'pwd');

    const cookieString = Array.from(cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    const loginResponse = await fetch(`${baseUrl}/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': cookieJar.get('csrftoken'),
        'Cookie': cookieString,
        'Referer': `${baseUrl}/login/`,
        'Origin': baseUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData,
      redirect: 'manual'
    });

    // Update cookies after login
    const newCookies = loginResponse.headers.get('set-cookie');
    if (newCookies) {
      const cookieStrings = newCookies.split(/,(?=\s*[a-zA-Z])/);
      cookieStrings.forEach(cookieString => {
        const parts = cookieString.split(';');
        const [nameValue] = parts;
        if (nameValue && nameValue.includes('=')) {
          const [name, ...valueParts] = nameValue.split('=');
          const value = valueParts.join('=');
          if (name && value) {
            cookieJar.set(name.trim(), value.trim());
          }
        }
      });
    }

    if (!(loginResponse.status === 302 || loginResponse.status === 301 || loginResponse.ok)) {
      return res.status(400).json({
        success: false,
        error: 'Login failed',
        message: 'Unable to authenticate with attendance system'
      });
    }

    console.log('✅ Login successful');

    // Step 3: Fetch all attendance data with pagination
    const finalCookieString = Array.from(cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    let currentPage = 1;
    let hasNextPage = true;
    let totalCount = 0;

    console.log('📊 Starting data fetch process...');

    while (hasNextPage) {
      console.log(`📄 Fetching page ${currentPage}...`);
      
      const apiUrl = `http://127.0.0.1:8081/iclock/api/transactions/?page=${currentPage}`;
      
      const dataResponse = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cookie': finalCookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `${baseUrl}/login/`
        }
      });

      if (!dataResponse.ok) {
        return res.status(500).json({
          success: false,
          error: `HTTP ${dataResponse.status} on page ${currentPage}`,
          partialData: allData.length > 0 ? { count: allData.length, data: allData } : null
        });
      }

      const content = await dataResponse.text();
      
      // Check if we got redirected to login page
      if (content.includes('SIGN IN TO YOUR ACCOUNT')) {
        return res.status(401).json({
          success: false,
          error: 'Session expired during data fetch',
          partialData: allData.length > 0 ? { count: allData.length, data: allData } : null
        });
      }

      const pageData = JSON.parse(content);
      
      if (currentPage === 1) {
        totalCount = pageData.count;
        console.log(`📈 Total records to fetch: ${totalCount}`);
      }

      if (pageData.data && Array.isArray(pageData.data)) {
        allData = allData.concat(pageData.data);
        console.log(`✅ Page ${currentPage} fetched: ${pageData.data.length} records (Total: ${allData.length}/${totalCount})`);
      }

      // Check if there's a next page
      hasNextPage = !!pageData.next;
      currentPage++;

      // Small delay to avoid overwhelming the server
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`🎉 All data fetched successfully: ${allData.length} total records`);

    // Step 4: Save to file
    const outputData = {
      totalRecords: allData.length,
      fetchedAt: new Date().toISOString(),
      data: allData
    };

    const filePath = path.join(process.cwd(), 'attendance-all-data.json');
    await fs.writeFile(filePath, JSON.stringify(outputData, null, 2), 'utf8');
    
    console.log(`💾 Data saved to: ${filePath}`);
    console.log(`📊 Summary: ${allData.length} attendance records saved`);

    // Return success response with all data
    res.json({
      success: true,
      message: 'All attendance data fetched and saved successfully',
      totalRecords: allData.length,
      filePath: 'attendance-all-data.json',
      fetchedAt: new Date().toISOString(),
      summary: {
        totalPages: currentPage - 1,
        recordsPerPage: Math.ceil(allData.length / (currentPage - 1)),
        firstRecord: allData[0] || null,
        lastRecord: allData[allData.length - 1] || null
      },
      data: allData
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch attendance data',
      partialData: allData.length > 0 ? { count: allData.length, data: allData } : null
    });
  }
});














router.get('/check-missing-dates', async (req, res) => {
  try {
    // Get total document count
    const totalDocuments = await Fuels.countDocuments();

    if (totalDocuments === 0) {
      return res.json({ success: true, message: 'No data found' });
    }

    // Get ALL transaction dates
    const allDates = await Fuels.find({}, { transactionDate: 1, _id: 0 }).lean();
    
    if (allDates.length === 0) {
      throw new Error('No transaction dates found');
    }

    // Convert and validate dates
    const validDates = [];
    const invalidDates = [];
    
    allDates.forEach((doc, index) => {
      try {
        if (!doc.transactionDate) {
          invalidDates.push({ index, reason: 'null/undefined', value: doc.transactionDate });
          return;
        }
        
        const dateObj = new Date(doc.transactionDate);
        if (isNaN(dateObj.getTime())) {
          invalidDates.push({ index, reason: 'invalid date', value: doc.transactionDate });
          return;
        }
        
        validDates.push({
          original: doc.transactionDate,
          date: dateObj,
          year: dateObj.getFullYear(),
          month: dateObj.getMonth() + 1,
          day: dateObj.getDate()
        });
      } catch (error) {
        invalidDates.push({ index, reason: error.message, value: doc.transactionDate });
      }
    });
    
    if (validDates.length === 0) {
      throw new Error('No valid transaction dates found');
    }

    // Group by year-month and collect all days
    const yearMonthGroups = {};
    
    validDates.forEach(dateInfo => {
      const yearMonth = `${dateInfo.year}-${dateInfo.month.toString().padStart(2, '0')}`;
      
      if (!yearMonthGroups[yearMonth]) {
        yearMonthGroups[yearMonth] = {
          year: dateInfo.year,
          month: dateInfo.month,
          count: 0,
          days: new Set()
        };
      }
      
      yearMonthGroups[yearMonth].count++;
      yearMonthGroups[yearMonth].days.add(dateInfo.day);
    });

    // Function to get days in month
    const getDaysInMonth = (year, month) => {
      return new Date(year, month, 0).getDate();
    };

    // Function to get month name
    const getMonthName = (month) => {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return monthNames[month - 1];
    };

    // Function to find missing date ranges
    const findMissingRanges = (existingDays, totalDays) => {
      const sortedDays = Array.from(existingDays).sort((a, b) => a - b);
      const missingRanges = [];
      let rangeStart = null;
      
      for (let day = 1; day <= totalDays; day++) {
        if (!existingDays.has(day)) {
          if (rangeStart === null) {
            rangeStart = day;
          }
        } else {
          if (rangeStart !== null) {
            if (rangeStart === day - 1) {
              missingRanges.push(`${rangeStart}`);
            } else {
              missingRanges.push(`${rangeStart}-${day - 1}`);
            }
            rangeStart = null;
          }
        }
      }
      
      // Handle case where missing range extends to end of month
      if (rangeStart !== null) {
        if (rangeStart === totalDays) {
          missingRanges.push(`${rangeStart}`);
        } else {
          missingRanges.push(`${rangeStart}-${totalDays}`);
        }
      }
      
      return missingRanges;
    };

    // Helper function for ordinal suffix
    function getOrdinalSuffix(day) {
      const num = parseInt(day);
      if (num >= 11 && num <= 13) return 'th';
      switch (num % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }

    // Analyze each month for missing dates
    const monthAnalysis = [];
    
    Object.values(yearMonthGroups).forEach(group => {
      const daysInMonth = getDaysInMonth(group.year, group.month);
      const existingDays = group.days;
      const missingRanges = findMissingRanges(existingDays, daysInMonth);
      const isComplete = missingRanges.length === 0;
      
      const monthData = {
        year: group.year,
        month: group.month,
        monthName: getMonthName(group.month),
        totalDaysInMonth: daysInMonth,
        daysWithData: existingDays.size,
        missingDaysCount: daysInMonth - existingDays.size,
        transactionCount: group.count,
        isComplete: isComplete,
        missingDateRanges: missingRanges,
        existingDays: Array.from(existingDays).sort((a, b) => a - b),
        firstDay: Math.min(...existingDays),
        lastDay: Math.max(...existingDays)
      };
      
      monthAnalysis.push(monthData);
    });

    // Sort analysis by year and month
    monthAnalysis.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // Separate complete and incomplete months
    const completeMonths = monthAnalysis.filter(month => month.isComplete);
    const incompleteMonths = monthAnalysis.filter(month => !month.isComplete);

    // Find date range
    const sortedDates = validDates.sort((a, b) => a.date - b.date);
    const minDate = sortedDates[0].date;
    const maxDate = sortedDates[sortedDates.length - 1].date;

    // Generate summary for easy understanding
    const summary = {
      totalMonthsAnalyzed: monthAnalysis.length,
      completeMonthsCount: completeMonths.length,
      incompleteMonthsCount: incompleteMonths.length,
      totalMissingDays: incompleteMonths.reduce((sum, month) => sum + month.missingDaysCount, 0)
    };

    // Create easy-to-read missing data report
    const missingDataReport = incompleteMonths.map(month => {
      const ranges = month.missingDateRanges.map(range => {
        if (range.includes('-')) {
          const [start, end] = range.split('-');
          return `${start}${getOrdinalSuffix(start)} to ${end}${getOrdinalSuffix(end)}`;
        } else {
          return `${range}${getOrdinalSuffix(range)}`;
        }
      });
      
      return {
        month: `${month.monthName} ${month.year}`,
        missingDays: month.missingDaysCount,
        missingDateRanges: ranges.join(', ')
      };
    });

    const responseObj = {
      success: true,
      totalDocuments,
      validDatesCount: validDates.length,
      invalidDatesCount: invalidDates.length,
      dateRange: {
        minDate: minDate.toISOString().split('T')[0],
        maxDate: maxDate.toISOString().split('T')[0],
        daysDifference: Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24))
      },
      summary,
      completeMonths: completeMonths.map(month => ({
        month: `${month.monthName} ${month.year}`,
        transactionCount: month.transactionCount
      })),
      incompleteMonths: missingDataReport,
      detailedAnalysis: monthAnalysis,
      quickSummary: {
        message: `Found ${incompleteMonths.length} months with missing data out of ${monthAnalysis.length} total months.`,
        totalMissingDays: summary.totalMissingDays,
        completionRate: `${((completeMonths.length / monthAnalysis.length) * 100).toFixed(1)}%`
      }
    };

    res.json(responseObj);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: typeof error,
      step: 'Error occurred during missing dates analysis'
    });
  }
});