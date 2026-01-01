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





// const equipmentsData = [
//   {
//     "regNo": "77373",
//     "operator": "Ishwor Ghimire",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "74991",
//     "operator": "Manjur alam Nuri",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "69557",
//     "operator": "Jaman SIngh",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "30931",
//     "operator": "Major Singh Darshan Singh",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "197300",
//     "operator": "Anarulla",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78784",
//     "operator": "Darmendra Saday",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "75012",
//     "operator": "Ajmal Hussain",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "194159",
//     "operator": "Ganesh Bahadhur",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "69862",
//     "operator": "Intiaj",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "62137",
//     "operator": "Richard",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "79445",
//     "operator": "Mohammed Yashik Kunduparambil Yahu",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78392",
//     "operator": "MD Shahid",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "14651",
//     "operator": "Rasheed Puthen peedila",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "224483",
//     "operator": "Jageshor Bandari.",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78324",
//     "operator": "Suneesh",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "72204",
//     "operator": "Siyaj",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78357",
//     "operator": "Santosh",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "69861",
//     "operator": "MD Nayim",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "281603",
//     "operator": "HOP Ibrahim Khan",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "105113",
//     "operator": "HOP Abid Ulla Jan",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "139575",
//     "operator": "HOP Mahinder Singh",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "-",
//     "operator": "Shyam Krishna Chimoriya",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "278405",
//     "operator": "Ram Kumar",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78971",
//     "operator": "Muhammad Ikram Jamroz Khan",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78862",
//     "operator": "Indika",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78863",
//     "operator": "Muhammad Safdar",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "19610",
//     "operator": "Binaram Bhulon",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "290418",
//     "operator": "HOP Sher ur Rehman.",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "78554",
//     "operator": "HOP Shehar yar",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "138773",
//     "operator": "Yashik",
//     "site": "Samsung -C & T"
//   },
//   {
//     "regNo": "77371",
//     "operator": "MD Safikula",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "27160",
//     "operator": "Amit Pandey",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "69558",
//     "operator": "Duminda",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "74992",
//     "operator": "Sanjib Kumar Mandal",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "63438",
//     "operator": "Eddis Ali Murad",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "71763",
//     "operator": "Jasvir Kumar",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "77452",
//     "operator": "Mujammel Hoque",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "78445",
//     "operator": "Tej",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "78393",
//     "operator": "Kshetri Tej Bahadur",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "78391",
//     "operator": "Abdul Manan.",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "72202",
//     "operator": "HOP Sukhmanjit Singh",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "237737",
//     "operator": "Nawaraj Subedi.",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "70124",
//     "operator": "Aseez",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "72203",
//     "operator": "Shahid Raja",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "45541",
//     "operator": "Jabir Miya",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "195653",
//     "operator": "Sanjarul Nath",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "68979",
//     "operator": "Hasintha",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "78356",
//     "operator": "Jayakaran",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "77451",
//     "operator": "Mahesh Kumar Das",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "75392",
//     "operator": "Meraj Kawari",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "45542",
//     "operator": "Sanjay Thapa Magar",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "138815",
//     "operator": "HOP Balwinder Singh",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "282062",
//     "operator": "HOP Mandeep Singh",
//     "site": "Gulf Asia Contracting-NFS"
//   },
//   {
//     "regNo": "66777",
//     "operator": "Tiwari Dav Raj",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "66775",
//     "operator": "HOP Naka Satya",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "68731",
//     "operator": "Bikas",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "72129",
//     "operator": "HOP Gurinder Singh",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "21702",
//     "operator": "MD Israful Khan",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "62458",
//     "operator": "Dasuram",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70893",
//     "operator": "Ramesh Thing",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "327738",
//     "operator": "Subramaniyan",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "63259",
//     "operator": "Jaiju Puthoor Lonappan",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70669",
//     "operator": "Jahir",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70892",
//     "operator": "Lal Bahadhur",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "44177",
//     "operator": "Jubaid",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "77269",
//     "operator": "Muktha Bahadhur",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70671",
//     "operator": "MD Hakim",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "65701",
//     "operator": "Avi Tamang",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "68732",
//     "operator": "Yadav",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "68729",
//     "operator": "Rupinder Singh",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "68115",
//     "operator": "Govinda Mahat",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "68766",
//     "operator": "Suhag",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "66564",
//     "operator": "Arsath Aboobakkar Abdul Samadu",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "78132",
//     "operator": "Lil Bahadhur",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "78133",
//     "operator": "Miran Miah",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "76011",
//     "operator": "Muhammad Shah Mir Bangash",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "78325",
//     "operator": "Inderjit Singh Manjit Singh",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "78325",
//     "operator": "Jatinder Singh.",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "74875",
//     "operator": "Mozaher Alam",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "74875",
//     "operator": "Bhim",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "76116",
//     "operator": "Gam Bahadur Gurung",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70374",
//     "operator": "Tarek",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70836",
//     "operator": "Sofikul",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70893",
//     "operator": "Ramesh Thing",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70892",
//     "operator": "BK Lal Bahadur",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "71118",
//     "operator": "Mansab Khan",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "75866",
//     "operator": "HOP Sukhwinder Singh",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "71169",
//     "operator": "Muhammad Akram Mohammad Yaqoob",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "79268",
//     "operator": "MD Sarafat miya",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "75013",
//     "operator": "Avi Tamang",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "76374",
//     "operator": "Sabir",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "76023",
//     "operator": "Fakhrul Islam",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "67973",
//     "operator": "HOP Malkit Singh",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "67822",
//     "operator": "HOP Akram Khan",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "70750",
//     "operator": "Numan uddin",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "63447",
//     "operator": "Gurprit Singh.",
//     "site": "Gulf Asia Contracting-RLPP 02"
//   },
//   {
//     "regNo": "73366",
//     "operator": "Dinesh Kumar Shah",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "43998",
//     "operator": "HOP Varinder Singh Gurdev Singh",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "72097",
//     "operator": "Keshav",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "68733",
//     "operator": "Loka Nath Pandey",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "70487",
//     "operator": "Fazal Moeen",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "47526",
//     "operator": "Arafath",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "79135",
//     "operator": "Opi Das Tatma",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "76272",
//     "operator": "HOP Baljit Singh",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "76273",
//     "operator": "Rangej Singh",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "70155",
//     "operator": "Muhammad Gul Gul",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "78129",
//     "operator": "Salim Ahmed",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "74199",
//     "operator": "Khet Bahadhur",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "79267",
//     "operator": "Ranjeet Singh",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "78447",
//     "operator": "Irsath",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "74919",
//     "operator": "Kalam",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "77075",
//     "operator": "Mandeep Kumar",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "75864",
//     "operator": "HOP Jagroop Singh.",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "79136",
//     "operator": "Bal Bahadhur Saru Magar.",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "79269",
//     "operator": "Sharban KC",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "36699",
//     "operator": "Mahara Laxman Bahadur",
//     "site": "Gulf Asia Contracting-RLPP 01"
//   },
//   {
//     "regNo": "73582",
//     "operator": "Mahara Laxman Bahadur",
//     "site": "Gulf Asia Contracting-RLPP 01 ESP"
//   },
//   {
//     "regNo": "67973",
//     "operator": "HOP Malkit Singh",
//     "site": "Gulf Asia Contracting  NFE"
//   },
//   {
//     "regNo": "",
//     "operator": "Shahin Miah",
//     "site": "Gulf Asia Contracting  NFE"
//   },
//   {
//     "regNo": "",
//     "operator": "Khagendra Prasad",
//     "site": "Gulf Asia Contracting  NFE"
//   },
//   {
//     "regNo": "76199",
//     "operator": "Mallesh Basakonda",
//     "site": "Gulf Asia Contracting  NFE"
//   },
//   {
//     "regNo": "74733",
//     "operator": "Dambar Bahadur Kunwar",
//     "site": "Gulf Asia Contracting-RO"
//   },
//   {
//     "regNo": "72377",
//     "operator": "HOP Gursharan singh",
//     "site": "Gulf Asia Contracting-Umbrika Yard"
//   },
//   {
//     "regNo": "62529",
//     "operator": "MD Pharamud Rain",
//     "site": "Gulf Asia Contracting-Umbrika Yard"
//   },
//   {
//     "regNo": "72615",
//     "operator": "yeasin",
//     "site": "Gulf Asia Contracting-Umbrika Yard"
//   },
//   {
//     "regNo": "68728",
//     "operator": "HOP Sharam Singh",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "71051",
//     "operator": "Bhim Bahadhur Paudel",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "70670",
//     "operator": "Emamul Hossain",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "66776",
//     "operator": "Siraj Miya",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "77393",
//     "operator": "Slim Mia",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "78523",
//     "operator": "Nishan Singh",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "78523",
//     "operator": "DHRUP KESH AHIR YADAV.",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "61979",
//     "operator": "Ajijurrehman",
//     "site": "Draieh Contracting (Ask)  QBEC"
//   },
//   {
//     "regNo": "61979",
//     "operator": "Keshab Sunar",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "72484",
//     "operator": "MD Kaphir Miya",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "43711",
//     "operator": "Without Operator",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "46941",
//     "operator": "HOP Pawandeep Singh",
//     "site": "Draieh Contracting (Ask)"
//   },
//   {
//     "regNo": "72201",
//     "operator": "Ghulam Ali",
//     "site": "New Alfa Trading & Contracting (Ask)"
//   },
//   {
//     "regNo": "70758",
//     "operator": "Rajeshwar Nyayavanandi",
//     "site": "CCC"
//   },
//   {
//     "regNo": "75865",
//     "operator": "Sukhjinder  Singh",
//     "site": "CCC"
//   },
//   {
//     "regNo": "78516",
//     "operator": "satpal singh",
//     "site": "Captains Solutions"
//   },
//   {
//     "regNo": "47326",
//     "operator": "HOP Baljit Singh Gurmej Singh",
//     "site": "Hyundai Lusail Plaza Tower"
//   },
//   {
//     "regNo": "43095",
//     "operator": "HOP Amit Chaudary",
//     "site": "Hyundai Lusail Plaza Tower"
//   },
//   {
//     "regNo": "72871",
//     "operator": "HOP Sawinder Singh",
//     "site": "Hyundai Lusail Plaza Tower"
//   },
//   {
//     "regNo": "78443",
//     "operator": "HOP PRABHDEEP SINGH",
//     "site": "Inco International"
//   },
//   {
//     "regNo": "61188",
//     "operator": "Mofid Rain",
//     "site": "Inco International"
//   },
//   {
//     "regNo": "72871",
//     "operator": "Mofid Rain",
//     "site": "Inco International"
//   },
//   {
//     "regNo": "61188",
//     "operator": "Mofid Rain",
//     "site": "Inco International"
//   },
//   {
//     "regNo": "67340",
//     "operator": "Mohamed Husni",
//     "site": "Medgulf"
//   },
//   {
//     "regNo": "67339",
//     "operator": "Abdul Hadi",
//     "site": "Medgulf"
//   },
//   {
//     "regNo": "310773",
//     "operator": "HOP Lovedeep Singh",
//     "site": "Qcon"
//   },
//   {
//     "regNo": "281998",
//     "operator": "Bishnu",
//     "site": "Qcon"
//   },
//   {
//     "regNo": "138773",
//     "operator": "Binu Alathi Velayudhan",
//     "site": "Qcon"
//   },
//   {
//     "regNo": "282171",
//     "operator": "Jithin Madathingal Jayan",
//     "site": "Qcon"
//   },
//   {
//     "regNo": "44182",
//     "operator": "Roshan Gurung",
//     "site": "Q Reliance"
//   },
//   {
//     "regNo": "71056",
//     "operator": "HOP Taz Mohammed",
//     "site": "AL Bahiya / Tractors Trading"
//   },
//   {
//     "regNo": "71056",
//     "operator": "Mohammed Rijath",
//     "site": "UCC PMV"
//   },
//   {
//     "regNo": "72738",
//     "operator": "Manoj Chathuranga",
//     "site": "UCC PMV"
//   },
//   {
//     "regNo": "72738",
//     "operator": "Rajesh Lodh",
//     "site": "UCC PMV Muaither"
//   },
//   {
//     "regNo": "70125",
//     "operator": "Prajosh Cheradi Appunni",
//     "site": "UCC PMV"
//   },
//   {
//     "regNo": "54470",
//     "operator": "Tiwari Dav Raj",
//     "site": "UCC PMV"
//   },
//   {
//     "regNo": "70125",
//     "operator": "Riyas Kalandar Adambawa",
//     "site": "UCC PMV"
//   },
//   {
//     "regNo": "46942",
//     "operator": "Prem Bahadhur",
//     "site": "UCC PMV"
//   },
//   {
//     "regNo": "66774",
//     "operator": "Hinas, Ajahar Sheikh",
//     "site": "QNCC"
//   },
//   {
//     "regNo": "73292",
//     "operator": "Ghulam Ali",
//     "site": "QNCC"
//   },
//   {
//     "regNo": "68154",
//     "operator": "HOP Sandeep Singh",
//     "site": "Hydroserv"
//   },
//   {
//     "regNo": "198331",
//     "operator": "Ajahar Sekh",
//     "site": "QD-SBG"
//   },
//   {
//     "regNo": "198331",
//     "operator": "HOP Chinta Mani sapkota",
//     "site": "QD-SBG"
//   },
//   {
//     "regNo": "45838",
//     "operator": "Rahim Mohamad Miya",
//     "site": "Baldo Tech Trading and Contracting"
//   },
//   {
//     "regNo": "76272",
//     "operator": "HOP Baljit Singh",
//     "site": "Baldo Tech Trading and Contracting"
//   }
// ]
