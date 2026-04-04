// development.js  —  run with: node development.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs      = require('fs');
const path    = require('path');
const { Types: { ObjectId } } = require('mongoose');

const serviceHistoryModel     = require('../models/history.model.js');
const serviceReportModel      = require('../models/report.model.js');
const maintananceHistoryModel = require('../models/maintenance.model.js');
const tyreModel               = require('../models/tyre.model.js');
const batteryModel            = require('../models/battery.model.js');
const stocksModel             = require('../models/stock.model.js');
const equipmentModel          = require('../models/equipment.model.js');
const toolkitModel            = require('../models/toolkit.model.js');
const complaintModel          = require('../models/complaint.model.js');
const mobilizationModel       = require('../models/mobilizations.model.js');
const replacementModel        = require('../models/replacements.model.js');
const lpoModel                = require('../models/lpo.model.js');
const backchargeModel         = require('../models/backcharge.model.js');
const documentModel           = require('../models/document.model.js');
const User           = require('../models/user.model.js');

const bcrypt = require('bcrypt');
const { getAuthorizationUrl, exchangeCodeForTokens } = require('../gmail/backcharge.gmail.js');

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
const { equipments } = require('./data/equipments.js');


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const toDateString = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

const now = () => new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// Functions
// ─────────────────────────────────────────────────────────────────────────────

const addActivationKey = async () => {
  const email = 'suresh@ansarigroup.co';   // <-- fill in
  const activationKey = '64013481056173921048';   // <-- fill in

  if (!email || !activationKey) throw new Error('userId and activationKey are required');
  if (activationKey.length !== 20) throw new Error('Activation key must be exactly 20 digits');

  const hashedKey = await bcrypt.hash(activationKey, 10);

  const result = await User.updateOne(
    { email: email },
    {
      $set: {
        signatureActivation: [
          { signType: 'pm', activationKey: hashedKey, trustedDevices: [], isActivated: false },
          { signType: 'accounts', activationKey: hashedKey, trustedDevices: [], isActivated: false },
          { signType: 'manager', activationKey: hashedKey, trustedDevices: [], isActivated: false },
          { signType: 'authorized', activationKey: hashedKey, trustedDevices: [], isActivated: false },
          { signType: 'seal', activationKey: hashedKey, trustedDevices: [], isActivated: false },
          { signType: 'wm', activationKey: hashedKey, trustedDevices: [], isActivated: false },
        ],
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) throw new Error('User not found');

  console.log('✅ Activation key added:', { email, activationKey });
};

// ─────────────────────────────────────────────────────────────────────────────

const addCodeInSameSupplier = async () => {
  const all = await Backcharge.find({}).select('_id supplierName').lean();

  const supplierCodeMap = {};
  let codeCounter = 1;

  all.forEach((record) => {
    const name = record.supplierName?.trim().toLowerCase();
    if (!name) return;
    if (!supplierCodeMap[name]) {
      supplierCodeMap[name] = `SUP-${String(codeCounter++).padStart(3, '0')}`;
    }
  });

  const bulkOps = all
    .filter(r => r.supplierName)
    .map((record) => ({
      updateOne: {
        filter: { _id: record._id },
        update: { $set: { supplierCode: supplierCodeMap[record.supplierName.trim().toLowerCase()] } },
      },
    }));

  const result = await Backcharge.bulkWrite(bulkOps);

  console.log('✅ Supplier codes assigned:', {
    uniqueSuppliers: Object.keys(supplierCodeMap).length,
    recordsUpdated: result.modifiedCount,
    supplierCodeMap,
  });
};

// ─────────────────────────────────────────────────────────────────────────────

const addCodeInSameVendor = async () => {
  const all = await LPO.find({}).select('_id company.vendor').lean();

  const vendorCodeMap = {};
  let codeCounter = 1;

  all.forEach((record) => {
    const name = record.company?.vendor?.trim().toLowerCase();
    if (!name) return;
    if (!vendorCodeMap[name]) {
      vendorCodeMap[name] = `VEN-${String(codeCounter++).padStart(3, '0')}`;
    }
  });

  const bulkOps = all
    .filter(r => r.company?.vendor)
    .map((record) => ({
      updateOne: {
        filter: { _id: record._id },
        update: { $set: { vendorCode: vendorCodeMap[record.company.vendor.trim().toLowerCase()] } },
      },
    }));

  const result = await LPO.bulkWrite(bulkOps);

  console.log('✅ Vendor codes assigned:', {
    uniqueVendors: Object.keys(vendorCodeMap).length,
    recordsUpdated: result.modifiedCount,
    vendorCodeMap,
  });
};

// ─────────────────────────────────────────────────────────────────────────────

const setupOAuth = async () => {
  const authUrl = await getAuthorizationUrl();
  console.log('🔗 Open this URL in your browser:\n', authUrl);

  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });

  await new Promise((resolve, reject) => {
    readline.question('\nPaste the authorization code here: ', async (code) => {
      readline.close();
      try {
        const tokens = await exchangeCodeForTokens(code.trim());
        console.log('✅ Tokens received:', tokens);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

const syncEquipmentsFromData = async () => {
  const stats = {
    total:     equipments.length,
    updated:   0,
    hired:     0,
    notHired:  0,
    notFound:  0,
    notFoundRegNos: [],
  };

  for (const eq of equipments) {
    const isHiredExternal = eq.hired !== 'Ansari' && eq.hired !== 'ASK';

    const updatePayload = {
      $push: {
        site: eq.site,
        certificationBody: {
          operatorName: eq.operator,
          operatorId:   '',
          assignedAt:   new Date(),
        },
      },
      $set: {
        hired:     isHiredExternal ? true : false,
        hiredFrom: isHiredExternal ? eq.hired : '',
      },
    };

    const result = await Equipment.updateOne({ regNo: eq.regNo }, updatePayload);

    if (result.matchedCount === 0) {
      stats.notFound++;
      stats.notFoundRegNos.push(eq.regNo);
    } else {
      stats.updated++;
      if (isHiredExternal) stats.hired++;
      else stats.notHired++;
    }
  }

  console.log('─────────────────────────────────');
  console.log('📊 Sync Statistics:');
  console.log('  Total in data    :', stats.total);
  console.log('  Updated in DB    :', stats.updated);
  console.log('  Hired (external) :', stats.hired);
  console.log('  Not hired        :', stats.notHired);
  console.log('  Not found in DB  :', stats.notFound);
  if (stats.notFoundRegNos.length > 0) {
    console.log('  Missing regNos   :', stats.notFoundRegNos.join(', '));
  }
  console.log('─────────────────────────────────');
};

const checkEquipmentsCount = () => {
  const total = equipments.length;

  const ansari = equipments.filter(e => e.hired === 'Ansari').length;
  const ask    = equipments.filter(e => e.hired === 'ASK').length;
  const others = equipments.filter(e => e.hired !== 'Ansari' && e.hired !== 'ASK').length;

  console.log('Total equipments:', total);
  console.log('Ansari:', ansari);
  console.log('ASK:', ask);
  console.log('Others:', others);
};

const addMissingHiredEquipments = async () => {
  const missingRegNos = [
    '77393','77910','77910','76959','76959','74875','78443','11637',
    '76374','76199','73582','79639','70487','77566','73366','77075',
    '62529','79229','71763','79637','76484','79932','76960','70155',
    '75452','79919','80105','290418','78554','70295','71285','79415',
    '74318','68982'
  ].filter(r => r.trim() !== ''); // remove empty strings

  // get unique only
  const uniqueMissing = [...new Set(missingRegNos)];

  // filter equipments data: only missing regNos AND hired is external
  const toInsert = equipments.filter(eq =>
    uniqueMissing.includes(eq.regNo) &&
    eq.hired !== 'Ansari' &&
    eq.hired !== 'ASK'
  );

  const skipped = uniqueMissing.filter(regNo => {
    const eq = equipments.find(e => e.regNo === regNo);
    if (!eq) return true;                                      // not in data at all
    if (eq.hired === 'Ansari' || eq.hired === 'ASK') return true; // not external hired
    return false;
  });

  // get next id (max id + 1)
  const lastEquipment = await Equipment.findOne({}).sort({ id: -1 }).select('id').lean();
  let nextId = (lastEquipment?.id ?? 0) + 1;

  const docs = toInsert.map(eq => ({
    id:       nextId++,
    machine:  eq.machine,
    regNo:    eq.regNo,
    brand:    'Unknown',          // dummy
    year:     2000,               // dummy
    company:  'ATE',              // default
    hired:    true,
    hiredFrom: eq.hired,
    outside:  false,
    site:     eq.site ? [eq.site] : [],
    status:   'active',           // dummy
    certificationBody: eq.operator
      ? [{ operatorName: eq.operator, operatorId: '', assignedAt: new Date() }]
      : [],
  }));

  let inserted = 0;
  const failedInserts = [];

  for (const doc of docs) {
    try {
      await Equipment.create(doc);
      inserted++;
    } catch (err) {
      failedInserts.push({ regNo: doc.regNo, error: err.message });
    }
  }

  console.log('─────────────────────────────────');
  console.log('📊 Add Missing Hired Equipments:');
  console.log('  Unique missing regNos :', uniqueMissing.length);
  console.log('  Eligible to insert    :', toInsert.length);
  console.log('  Inserted              :', inserted);
  console.log('  Skipped (Ansari/ASK/not in data):', skipped.length);
  if (skipped.length > 0) console.log('  Skipped regNos        :', skipped.join(', '));
  if (failedInserts.length > 0) console.log('  Failed inserts        :', failedInserts);
  console.log('─────────────────────────────────');
};

const addTwoMissingEquipments = async () => {
  const lastEquipment = await Equipment.findOne({}).sort({ id: -1 }).select('id').lean();
  let nextId = (lastEquipment?.id ?? 0) + 1;

  const twoMissing = [
    {
      "regNo": "76959",
      "machine": "10 Ton Forklift",
      "site": "Draieh ( ATE )",
      "operator": "Rijath",
    },
    {
      "regNo": "79932",
      "machine": "18 Ton Forklift",
      "site": "GULF ASIA NFS",
      "operator": "Israful",
    },
  ];

  for (const eq of twoMissing) {
    try {
      await Equipment.create({
        id:        nextId++,
        machine:   eq.machine,
        regNo:     eq.regNo,
        brand:     'Unknown',
        year:      2000,
        company:   'ATE',
        hired:     true,
        hiredFrom: 'Al Awaidha',
        outside:   false,
        site:      [eq.site],
        status:    'active',
        certificationBody: [{ operatorName: eq.operator, operatorId: '', assignedAt: new Date() }],
      });
      console.log(`✅ Inserted: ${eq.regNo} - ${eq.machine}`);
    } catch (err) {
      console.log(`❌ Failed: ${eq.regNo} -`, err.message);
    }
  }

  console.log('\n✅ Done adding two missing equipments');
};

const syncEquipmentStatus = async () => {
  const activeRegNos = equipments.map(e => e.regNo).filter(r => r?.trim() !== '');

  const activeResult = await Equipment.updateMany(
    { regNo: { $in: activeRegNos } },
    { $set: { status: 'active' } }
  );

  const idleResult = await Equipment.updateMany(
    { regNo: { $nin: activeRegNos } },
    { $set: { status: 'idle' } }
  );

  console.log('─────────────────────────────────');
  console.log('📊 Status Sync:');
  console.log('  Set to active :', activeResult.modifiedCount);
  console.log('  Set to idle   :', idleResult.modifiedCount);
  console.log('─────────────────────────────────');
};

const analyzeIdleEquipments = async () => {
  const activeRegNos = equipments.map(e => e.regNo).filter(r => r?.trim() !== '');

  const idleEquipments = await Equipment.find(
    { regNo: { $nin: activeRegNos } }
  ).select('regNo machine status hired hiredFrom').lean();

  const skipKeywords = [
    'plate compactor',
    'lexus', 'prado', 'rav4', 'hiace', 'innova', 'rush', 'corolla',
    'range rover', 'mercedes', 'kia', 'eicher', 'bus',
    'pickup', 'cabin', 'double cabin',
  ];

  const isSmallOrCar = (machine) => {
    const m = machine.toLowerCase();
    return skipKeywords.some(k => m.includes(k));
  };

  const equipmentOnly = idleEquipments.filter(eq => !isSmallOrCar(eq.machine));

  console.log('─────────────────────────────────');
  console.log('📊 Idle Equipment Only (no cars/small):');
  console.log('  Total           :', idleEquipments.length);
  console.log('  After filter    :', equipmentOnly.length);
  console.log('');
  equipmentOnly.forEach((eq, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}. ${eq.regNo} | ${eq.machine}`);
  });
  console.log('─────────────────────────────────');
};

const setCarsSiteToOffice = async () => {
  const activeRegNos = equipments.map(e => e.regNo).filter(r => r?.trim() !== '');

  const skipKeywords = [
    'plate compactor',
    'lexus', 'prado', 'rav4', 'hiace', 'innova', 'rush', 'corolla',
    'range rover', 'mercedes', 'kia', 'eicher', 'bus',
    'pickup', 'cabin', 'double cabin',
  ];

  const isSmallOrCar = (machine) => {
    const m = machine.toLowerCase();
    return skipKeywords.some(k => m.includes(k));
  };

  const idleEquipments = await Equipment.find(
    { regNo: { $nin: activeRegNos } }
  ).select('regNo machine').lean();

  const cars = idleEquipments.filter(eq => isSmallOrCar(eq.machine));
  const carRegNos = cars.map(c => c.regNo);

  const result = await Equipment.updateMany(
    { regNo: { $in: carRegNos } },
    { $push: { site: 'Office' } }
  );

  console.log('─────────────────────────────────');
  console.log('📊 Cars Site → Office:');
  console.log('  Cars found    :', cars.length);
  console.log('  Updated       :', result.modifiedCount);
  cars.forEach((c, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}. ${c.regNo} | ${c.machine}`);
  });
  console.log('─────────────────────────────────');
};

const fixCarsAndIdleSites = async () => {
  const activeRegNos = equipments.map(e => e.regNo).filter(r => r?.trim() !== '');

  const skipKeywords = [
    'lexus', 'prado', 'rav4', 'hiace', 'innova', 'rush', 'corolla',
    'range rover', 'mercedes', 'kia', 'eicher', 'bus',
    'pickup', 'cabin', 'double cabin',
  ];

  const isSmallOrCar = (machine) => {
    const m = machine.toLowerCase();
    return skipKeywords.some(k => m.includes(k));
  };

  const idleEquipments = await Equipment.find(
    { regNo: { $nin: activeRegNos } }
  ).select('regNo machine').lean();

  const cars        = idleEquipments.filter(eq => isSmallOrCar(eq.machine));
  const nonCars     = idleEquipments.filter(eq => !isSmallOrCar(eq.machine));
  const carRegNos   = cars.map(c => c.regNo);
  const nonCarRegNos = nonCars.map(c => c.regNo);

  // Cars → site: 'Ansari Office', status: active
  const carsResult = await Equipment.updateMany(
    { regNo: { $in: carRegNos } },
    {
      $push: { site: 'Ansari Office' },
      $set:  { status: 'active' },
    }
  );

  // Non-cars (idle equipment) → site: 'Unassigned'
  const idleResult = await Equipment.updateMany(
    { regNo: { $in: nonCarRegNos } },
    { $push: { site: 'Unassigned' } }
  );

  console.log('─────────────────────────────────');
  console.log('📊 Fix Cars & Idle Sites:');
  console.log('  Cars → Ansari Office + active :', carsResult.modifiedCount);
  console.log('  Idle → Unassigned             :', idleResult.modifiedCount);
  console.log('');
  console.log('  Cars:');
  cars.forEach((c, i) => console.log(`    ${String(i+1).padStart(2,'0')}. ${c.regNo} | ${c.machine}`));
  console.log('  Idle Equipment:');
  nonCars.forEach((c, i) => console.log(`    ${String(i+1).padStart(2,'0')}. ${c.regNo} | ${c.machine}`));
  console.log('─────────────────────────────────');
};

const syncEquipmentLocations = async () => {
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const eq of equipments) {
    if (!eq.location) { skipped++; continue; }

    const result = await Equipment.updateOne(
      { regNo: eq.regNo },
      { $push: { location: eq.location } }
    );

    if (result.matchedCount === 0) notFound++;
    else updated++;
  }

  console.log('─────────────────────────────────');
  console.log('📊 Sync Equipment Locations:');
  console.log('  Updated  :', updated);
  console.log('  Skipped  :', skipped);
  console.log('  Not found:', notFound);
  console.log('─────────────────────────────────');
};

const migrateEquipmentSchema = async () => {
  const all = await Equipment.find({}).lean();

  let updated = 0;
  let skipped = 0;

  for (const eq of all) {
    const updateOp = { $set: {}, $unset: {} };
    let hasChanges = false;

    // ── site ──────────────────────────────────────────────────────────────────
    if (Array.isArray(eq.site) && eq.site.length > 0) {
      const currentSite  = eq.site[eq.site.length - 1];
      const historySites = eq.site.slice(0, -1);
      updateOp.$set.site     = [currentSite];
      updateOp.$set.lastSite = historySites;
      hasChanges = true;
    }

    // ── certificationBody ─────────────────────────────────────────────────────
    if (Array.isArray(eq.certificationBody) && eq.certificationBody.length > 0) {
      const last    = eq.certificationBody[eq.certificationBody.length - 1];
      const history = eq.certificationBody.slice(0, -1);

      const currentCert = typeof last === 'string'
        ? { operatorName: last, operatorId: '', assignedAt: new Date() }
        : last;

      const historyCerts = history.map(item =>
        typeof item === 'string'
          ? { operatorName: item, operatorId: '', assignedAt: new Date() }
          : item
      );

      updateOp.$set.certificationBody     = [currentCert];
      updateOp.$set.lastCertificationBody = historyCerts;
      hasChanges = true;
    }

    // ── location ──────────────────────────────────────────────────────────────
    if (Array.isArray(eq.location) && eq.location.length > 0) {
      const currentLocation  = eq.location[eq.location.length - 1];
      const historyLocations = eq.location.slice(0, -1);
      updateOp.$set.location     = currentLocation;
      updateOp.$set.lastLocation = historyLocations;
      hasChanges = true;
    }

    if (!hasChanges) { skipped++; continue; }

    delete updateOp.$unset;
    await Equipment.updateOne({ _id: eq._id }, updateOp);
    updated++;
  }

  console.log('─────────────────────────────────');
  console.log('📊 Equipment Schema Migration:');
  console.log('  Total     :', all.length);
  console.log('  Updated   :', updated);
  console.log('  Skipped   :', skipped);
  console.log('─────────────────────────────────');
};

const resetAllStocksToZero = async () => {
  const allStocks = await Stokcs.find({ isDeleted: { $ne: true } }).lean()

  const stats = {
    total:        allStocks.length,
    alreadyZero:  0,
    reset:        0,
    failed:       0,
  }

  const now     = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  for (const stock of allStocks) {
    if (stock.stockCount === 0) {
      stats.alreadyZero++
      continue
    }

    const resetMovement = {
      date:               new Date(`${dateStr}T00:00:00.000Z`),
      time:               timeStr,
      type:               'deduct',
      quantity:           stock.stockCount,
      previousQuantity:   stock.stockCount,
      newQuantity:        0,
      reduceType:         'stock',
      subUnitAmount:      0,
      equipmentName:      'Reseting',
      equipmentNumber:    'Reseting',
      mechanicName:       'Reseting',
      mechanicEmployeeId: '1',
      reason:             'Stock deduct',
      notes:              '',
      createdAt:          now,
    }

    try {
      await Stokcs.findByIdAndUpdate(
        stock._id,
        {
          $set:  {
            stockCount:       0,
            subUnitRemaining: 0,
            status:           'out_of_stock',
            updatedAt:        now,
          },
          $push: { movements: resetMovement },
        }
      )
      stats.reset++
    } catch (err) {
      console.error(`  ❌ Failed to reset ${stock.product} (${stock.serialNumber}):`, err.message)
      stats.failed++
    }
  }

  console.log('─────────────────────────────────────────────')
  console.log('📊 Reset All Stocks To Zero:')
  console.log('  Total stocks found  :', stats.total)
  console.log('  Already at zero     :', stats.alreadyZero)
  console.log('  Successfully reset  :', stats.reset)
  console.log('  Failed              :', stats.failed)
  console.log('─────────────────────────────────────────────')
}

const analyzeDashboardData = async () => {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 DASHBOARD DATA ANALYSIS & VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const now       = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo    = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const monthAgo   = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
  const yearAgo    = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1);

  const dateRangeQuery = (start, end = null) => ({
    $or: [
      { createdAt: end ? { $gte: start, $lte: end } : { $gte: start } },
      { updatedAt: end ? { $gte: start, $lte: end } : { $gte: start } },
    ],
  });

  const models = [
    { model: serviceHistoryModel,     name: 'Service History'      },
    { model: serviceReportModel,      name: 'Service Reports'      },
    { model: maintananceHistoryModel, name: 'Maintenance History'  },
    { model: tyreModel,               name: 'Tyre History'         },
    { model: batteryModel,            name: 'Battery History'      },
    { model: stocksModel,             name: 'Stocks'               },
    { model: equipmentModel,          name: 'Equipment'            },
    { model: toolkitModel,            name: 'Toolkit'              },
    { model: complaintModel,          name: 'Complaints'           },
    { model: mobilizationModel,       name: 'Mobilization'         },
    { model: replacementModel,        name: 'Replacement'          },
    { model: lpoModel,                name: 'LPO'                  },
    { model: backchargeModel,         name: 'Backcharge'           },
    { model: documentModel,           name: 'Documents'            },
  ];

  // ─── 1. TOTAL COUNTS (all time) ──────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log('1️⃣  TOTAL RECORDS (ALL TIME)');
  console.log('─────────────────────────────────────────────────────────────');

  let grandTotal = 0;
  const allTimeCounts = {};

  for (const { model, name } of models) {
    const count = await model.countDocuments();
    allTimeCounts[name] = count;
    grandTotal += count;
    console.log(`   ${name.padEnd(22)}: ${String(count).padStart(6)}`);
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   ${'GRAND TOTAL'.padEnd(22)}: ${String(grandTotal).padStart(6)}`);

  // ─── 2. PERIOD COUNTS ────────────────────────────────────────────────────
  const periods = [
    { label: 'TODAY',        query: dateRangeQuery(todayStart)  },
    { label: 'LAST 7 DAYS',  query: dateRangeQuery(weekAgo)     },
    { label: 'LAST 30 DAYS', query: dateRangeQuery(monthAgo)    },
    { label: 'LAST 365 DAYS',query: dateRangeQuery(yearAgo)     },
  ];

  for (const { label, query } of periods) {
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log(`2️⃣  ${label}`);
    console.log('─────────────────────────────────────────────────────────────');

    let periodTotal = 0;
    for (const { model, name } of models) {
      const count = await model.countDocuments(query);
      periodTotal += count;
      if (count > 0) console.log(`   ${name.padEnd(22)}: ${String(count).padStart(6)}`);
    }
    console.log(`   ${'PERIOD TOTAL'.padEnd(22)}: ${String(periodTotal).padStart(6)}`);
  }

  // ─── 3. EQUIPMENT STATS ──────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('3️⃣  EQUIPMENT STATS (StatusBar source)');
  console.log('─────────────────────────────────────────────────────────────');

  const [totalEq, activeEq, idleEq, maintenanceEq] = await Promise.all([
    equipmentModel.countDocuments(),
    equipmentModel.countDocuments({ status: 'active' }),
    equipmentModel.countDocuments({ status: 'idle' }),
    equipmentModel.countDocuments({ status: 'maintenance' }),
  ]);

  const otherEq = totalEq - activeEq - idleEq - maintenanceEq;

  console.log(`   Total Equipment     : ${totalEq}`);
  console.log(`   Active              : ${activeEq}`);
  console.log(`   Idle                : ${idleEq}`);
  console.log(`   In Maintenance      : ${maintenanceEq}`);
  console.log(`   Other statuses      : ${otherEq}`);
  console.log(`   ✅ Sum check        : ${activeEq + idleEq + maintenanceEq + otherEq} (should equal ${totalEq})`);

  // ─── 4. COMPLAINTS / PENDING MAINTENANCE ─────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('4️⃣  COMPLAINTS BREAKDOWN');
  console.log('─────────────────────────────────────────────────────────────');

  const allComplaints     = await complaintModel.countDocuments();
  const pendingComplaints = await complaintModel.countDocuments({ status: 'pending' });
  const resolvedComplaints= await complaintModel.countDocuments({ status: 'resolved' });
  const otherComplaints   = allComplaints - pendingComplaints - resolvedComplaints;
  const criticalAlerts    = Math.round(pendingComplaints * 0.3);

  console.log(`   Total Complaints    : ${allComplaints}`);
  console.log(`   Pending             : ${pendingComplaints}`);
  console.log(`   Resolved            : ${resolvedComplaints}`);
  console.log(`   Other               : ${otherComplaints}`);
  console.log(`   Critical Alerts     : ${criticalAlerts}  (pending × 0.3)`);

  // ─── 5. STOCK HEALTH ─────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('5️⃣  STOCK HEALTH');
  console.log('─────────────────────────────────────────────────────────────');

  const allStocks    = await stocksModel.find().select('product serialNumber stockCount minThreshold status').lean();
  const inStock      = allStocks.filter(s => s.status === 'in_stock').length;
  const lowStock     = allStocks.filter(s => s.status === 'low_stock').length;
  const outOfStock   = allStocks.filter(s => s.status === 'out_of_stock').length;
  const totalValue   = allStocks.reduce((t, s) => t + (s.totalValue || 0), 0);

  console.log(`   Total Stock Items   : ${allStocks.length}`);
  console.log(`   In Stock            : ${inStock}`);
  console.log(`   Low Stock           : ${lowStock}`);
  console.log(`   Out of Stock        : ${outOfStock}`);
  console.log(`   Total Value         : ${totalValue.toLocaleString()}`);
  console.log('\n   Top 5 low/out stocks:');
  allStocks
    .filter(s => s.status === 'low_stock' || s.status === 'out_of_stock')
    .slice(0, 5)
    .forEach(s => console.log(`     - ${s.product} (${s.serialNumber}) | count: ${s.stockCount} | min: ${s.minThreshold} | ${s.status}`));

  // ─── 6. TOOLKIT HEALTH ───────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('6️⃣  TOOLKIT HEALTH');
  console.log('─────────────────────────────────────────────────────────────');

  const allToolkits  = await toolkitModel.find().select('name totalStock overallStatus variants').lean();
  const tkAvailable  = allToolkits.filter(t => t.overallStatus === 'available').length;
  const tkLow        = allToolkits.filter(t => t.overallStatus === 'low').length;
  const tkOut        = allToolkits.filter(t => t.overallStatus === 'out').length;
  const tkVariants   = allToolkits.reduce((t, tk) => t + (tk.variants?.length || 0), 0);

  console.log(`   Total Toolkits      : ${allToolkits.length}`);
  console.log(`   Available           : ${tkAvailable}`);
  console.log(`   Low                 : ${tkLow}`);
  console.log(`   Out                 : ${tkOut}`);
  console.log(`   Total Variants      : ${tkVariants}`);

  // ─── 7. FLEET EFFICIENCY ─────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('7️⃣  FLEET EFFICIENCY (as computed by dashboard)');
  console.log('─────────────────────────────────────────────────────────────');

  const todayCounts  = await Promise.all(
    models.map(({ model }) => model.countDocuments(dateRangeQuery(todayStart)))
  );
  const todayTotal   = todayCounts.reduce((a, b) => a + b, 0);
  const efficiency   = todayTotal > 0
    ? Math.round(((todayTotal - pendingComplaints) / todayTotal) * 100)
    : 95;

  console.log(`   Today's total ops   : ${todayTotal}`);
  console.log(`   Pending complaints  : ${pendingComplaints}`);
  console.log(`   Fleet Efficiency    : ${efficiency}%`);
  console.log(`   Formula             : ((${todayTotal} - ${pendingComplaints}) / ${todayTotal}) × 100`);

  // ─── 8. LAST 5 DAYS COMPARISON ───────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('8️⃣  LAST 5 DAYS COMPARISON');
  console.log('─────────────────────────────────────────────────────────────');

  for (let i = 4; i >= 0; i--) {
    const dayStart = new Date(now); dayStart.setDate(now.getDate() - i); dayStart.setHours(0,0,0,0);
    const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
    const q        = dateRangeQuery(dayStart, dayEnd);

    const counts = await Promise.all(models.map(({ model }) => model.countDocuments(q)));
    const total  = counts.reduce((a, b) => a + b, 0);
    const label  = dayStart.toISOString().split('T')[0];
    console.log(`   ${label}  total: ${String(total).padStart(4)}  |  ${models.map((m, idx) => `${m.name.split(' ')[0]}:${counts[idx]}`).join('  ')}`);
  }

  // ─── 9. LAST 5 MONTHS COMPARISON ─────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('9️⃣  LAST 5 MONTHS COMPARISON');
  console.log('─────────────────────────────────────────────────────────────');

  for (let i = 4; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const q      = dateRangeQuery(mStart, mEnd);

    const counts = await Promise.all(models.map(({ model }) => model.countDocuments(q)));
    const total  = counts.reduce((a, b) => a + b, 0);
    const label  = mStart.toLocaleString('default', { month: 'long', year: 'numeric' });
    console.log(`   ${label.padEnd(18)}  total: ${String(total).padStart(4)}`);
  }

  // ─── 10. DATA QUALITY SCORE ──────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🔟  DATA QUALITY (% filled fields, sample 100 docs each)');
  console.log('─────────────────────────────────────────────────────────────');

  for (const { model, name } of models) {
    const sample = await model.find().sort({ createdAt: -1 }).limit(100).lean();
    if (!sample.length) { console.log(`   ${name.padEnd(22)}: no data`); continue; }

    const fields = Object.keys(model.schema.paths).filter(p => !['__v', '_id', 'createdAt', 'updatedAt'].includes(p));
    let filled = 0, total = 0;

    sample.forEach(doc => {
      fields.forEach(f => {
        total++;
        if (doc[f] != null && doc[f] !== '') filled++;
      });
    });

    const score = total ? ((filled / total) * 100).toFixed(1) : 0;
    const bar   = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    console.log(`   ${name.padEnd(22)}: ${bar} ${score}%  (${sample.length} docs sampled)`);
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ VERIFICATION SUMMARY — match these numbers in the frontend');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Total Equipment     : ${totalEq}`);
  console.log(`   Active Equipment    : ${activeEq}`);
  console.log(`   Idle Equipment      : ${idleEq}`);
  console.log(`   In Maintenance      : ${maintenanceEq}`);
  console.log(`   Pending Complaints  : ${pendingComplaints}`);
  console.log(`   Critical Alerts     : ${criticalAlerts}`);
  console.log(`   Total Stock Items   : ${allStocks.length}`);
  console.log(`   Low Stock Alerts    : ${lowStock}`);
  console.log(`   Fleet Efficiency    : ${efficiency}%`);
  console.log(`   Grand Total Records : ${grandTotal}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
};

const auditServiceHistoryData = async () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SERVICE HISTORY DATA AUDIT — PRE-MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─────────────────────────────────────────────────────────────────────────
  // 1. TOTAL COUNTS PER COLLECTION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log('1️⃣  TOTAL RECORDS PER COLLECTION');
  console.log('─────────────────────────────────────────────────────────────');

  const [
    totalServiceHistory,
    totalMaintenance,
    totalTyre,
    totalBattery,
    totalReports,
  ] = await Promise.all([
    serviceHistoryModel.countDocuments(),
    maintananceHistoryModel.countDocuments(),
    tyreModel.countDocuments(),
    batteryModel.countDocuments(),
    serviceReportModel.countDocuments(),
  ]);

  const totalHistories = totalServiceHistory + totalMaintenance + totalTyre + totalBattery;

  console.log(`   Service History (oil/normal) : ${String(totalServiceHistory).padStart(6)}`);
  console.log(`   Maintenance History          : ${String(totalMaintenance).padStart(6)}`);
  console.log(`   Tyre History                 : ${String(totalTyre).padStart(6)}`);
  console.log(`   Battery History              : ${String(totalBattery).padStart(6)}`);
  console.log('   ─────────────────────────────────────────');
  console.log(`   Total History Records        : ${String(totalHistories).padStart(6)}`);
  console.log(`   Total Service Reports        : ${String(totalReports).padStart(6)}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. OIL vs NORMAL BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('2️⃣  SERVICE HISTORY — OIL vs NORMAL BREAKDOWN');
  console.log('─────────────────────────────────────────────────────────────');

  const [oilCount, normalCount, noTypeCount] = await Promise.all([
    serviceHistoryModel.countDocuments({ serviceType: 'oil' }),
    serviceHistoryModel.countDocuments({ serviceType: 'normal' }),
    serviceHistoryModel.countDocuments({
      $or: [{ serviceType: null }, { serviceType: '' }, { serviceType: { $exists: false } }]
    }),
  ]);

  const otherTypeCount = totalServiceHistory - oilCount - normalCount - noTypeCount;

  console.log(`   serviceType = 'oil'          : ${String(oilCount).padStart(6)}`);
  console.log(`   serviceType = 'normal'       : ${String(normalCount).padStart(6)}`);
  console.log(`   serviceType = null/missing   : ${String(noTypeCount).padStart(6)}`);
  console.log(`   serviceType = other value    : ${String(otherTypeCount).padStart(6)}`);

  if (otherTypeCount > 0) {
    const otherTypes = await serviceHistoryModel.aggregate([
      { $match: { serviceType: { $nin: ['oil', 'normal', null, ''] } } },
      { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    console.log('   Other serviceType values found:');
    otherTypes.forEach(t => console.log(`     → "${t._id}" : ${t.count}`));
  }

  if (noTypeCount > 0) {
    console.log(`\n   ⚠️  ${noTypeCount} records have no serviceType — will be migrated as 'oil' (default)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. REPORT LINKAGE (HISTORY SIDE) — reportId field
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('3️⃣  REPORT LINKAGE (HISTORY SIDE) — reportId field');
  console.log('─────────────────────────────────────────────────────────────');

  const [
    serviceWithReportId,
    serviceWithoutReportId,
    maintenanceWithReportId,
    maintenanceWithoutReportId,
    tyreWithReportId,
    tyreWithoutReportId,
    batteryWithReportId,
    batteryWithoutReportId,
  ] = await Promise.all([
    serviceHistoryModel.countDocuments({ reportId: { $nin: [null, '', undefined] } }),
    serviceHistoryModel.countDocuments({ $or: [{ reportId: null }, { reportId: '' }, { reportId: { $exists: false } }] }),
    maintananceHistoryModel.countDocuments({ reportId: { $nin: [null, '', undefined] } }),
    maintananceHistoryModel.countDocuments({ $or: [{ reportId: null }, { reportId: '' }, { reportId: { $exists: false } }] }),
    tyreModel.countDocuments({ reportId: { $nin: [null, '', undefined] } }),
    tyreModel.countDocuments({ $or: [{ reportId: null }, { reportId: '' }, { reportId: { $exists: false } }] }),
    batteryModel.countDocuments({ reportId: { $nin: [null, '', undefined] } }),
    batteryModel.countDocuments({ $or: [{ reportId: null }, { reportId: '' }, { reportId: { $exists: false } }] }),
  ]);

  const totalWithReportId    = serviceWithReportId + maintenanceWithReportId + tyreWithReportId + batteryWithReportId;
  const totalWithoutReportId = serviceWithoutReportId + maintenanceWithoutReportId + tyreWithoutReportId + batteryWithoutReportId;

  console.log('');
  console.log('   Collection              Has reportId   No reportId');
  console.log('   ──────────────────────────────────────────────────────');
  console.log(`   Service (oil/normal)    ${String(serviceWithReportId).padStart(12)}   ${String(serviceWithoutReportId).padStart(11)}`);
  console.log(`   Maintenance             ${String(maintenanceWithReportId).padStart(12)}   ${String(maintenanceWithoutReportId).padStart(11)}`);
  console.log(`   Tyre                    ${String(tyreWithReportId).padStart(12)}   ${String(tyreWithoutReportId).padStart(11)}`);
  console.log(`   Battery                 ${String(batteryWithReportId).padStart(12)}   ${String(batteryWithoutReportId).padStart(11)}`);
  console.log('   ──────────────────────────────────────────────────────');
  console.log(`   TOTAL                   ${String(totalWithReportId).padStart(12)}   ${String(totalWithoutReportId).padStart(11)}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. REPORT LINKAGE (REPORT SIDE) — historyId field vs old method
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('4️⃣  REPORT LINKAGE (REPORT SIDE) — historyId vs old method');
  console.log('─────────────────────────────────────────────────────────────');

  const reportsWithHistoryId = await serviceReportModel.countDocuments({
    historyId: { $nin: [null, '', undefined] }
  });
  const reportsWithoutHistoryId = await serviceReportModel.countDocuments({
    $or: [{ historyId: null }, { historyId: '' }, { historyId: { $exists: false } }]
  });

  console.log(`   Reports WITH  historyId (new method) : ${String(reportsWithHistoryId).padStart(6)}`);
  console.log(`   Reports WITHOUT historyId (old method): ${String(reportsWithoutHistoryId).padStart(6)}`);
  console.log(`   Total reports                         : ${String(totalReports).padStart(6)}`);

  // ── For old-method reports, check if they resolve via regNo + date + serviceType ──
  console.log('\n   Checking old-method reports (no historyId) — can they resolve via regNo + date + type?');
  console.log('   This may take a moment...\n');

  const oldMethodReports = await serviceReportModel.find(
    { $or: [{ historyId: null }, { historyId: '' }, { historyId: { $exists: false } }] },
    { _id: 1, regNo: 1, date: 1, serviceType: 1 }
  ).lean();

  let oldMethodResolvable   = 0;
  let oldMethodUnresolvable = 0;
  const oldMethodUnresolvableByType = {};
  const oldMethodResolvableByType   = {};

  for (const report of oldMethodReports) {
    const type = report.serviceType || 'unknown';

    // Pick the correct old collection to check against
    let histModel = serviceHistoryModel; // oil | normal | unknown
    if (type === 'tyre')                              histModel = tyreModel;
    else if (type === 'battery')                      histModel = batteryModel;
    else if (type === 'maintenance' || type === 'major') histModel = maintananceHistoryModel;

    // Build the match query — tyre and battery use equipmentNo, others use regNo
    const isTyreOrBattery = (type === 'tyre' || type === 'battery');
    const matchQuery = isTyreOrBattery
      ? { equipmentNo: String(report.regNo), date: report.date }
      : { regNo: report.regNo,               date: report.date };

    const historyExists = await histModel.exists(matchQuery);

    if (historyExists) {
      oldMethodResolvable++;
      oldMethodResolvableByType[type] = (oldMethodResolvableByType[type] || 0) + 1;
    } else {
      oldMethodUnresolvable++;
      oldMethodUnresolvableByType[type] = (oldMethodUnresolvableByType[type] || 0) + 1;
    }
  }

  console.log(`   Old-method reports resolvable via regNo+date+type   : ${oldMethodResolvable}`);
  console.log(`   Old-method reports UNRESOLVABLE (no matching history): ${oldMethodUnresolvable}`);

  console.log('\n   Resolvable breakdown by type:');
  Object.entries(oldMethodResolvableByType).sort((a,b) => b[1]-a[1]).forEach(([type, count]) => {
    console.log(`     → '${type}': ${count}`);
  });

  if (oldMethodUnresolvable > 0) {
    console.log('\n   ⚠️  Unresolvable breakdown by type:');
    Object.entries(oldMethodUnresolvableByType).sort((a,b) => b[1]-a[1]).forEach(([type, count]) => {
      console.log(`     → '${type}': ${count}`);
    });
  }

  // ── Full picture: combine both methods ────────────────────────────────────
  const totalEffectivelyLinked   = reportsWithHistoryId + oldMethodResolvable;
  const totalEffectivelyUnlinked = totalReports - totalEffectivelyLinked;

  console.log('\n   ── COMBINED LINKAGE PICTURE ─────────────────────────────');
  console.log(`   Linked via historyId (new)      : ${String(reportsWithHistoryId).padStart(6)}`);
  console.log(`   Linked via regNo+date+type (old): ${String(oldMethodResolvable).padStart(6)}`);
  console.log(`   ─────────────────────────────────────────────────────────`);
  console.log(`   Total effectively linked        : ${String(totalEffectivelyLinked).padStart(6)}`);
  console.log(`   Truly unlinked (orphan reports) : ${String(totalEffectivelyUnlinked).padStart(6)}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SERVICE REPORT BREAKDOWN BY TYPE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('5️⃣  SERVICE REPORTS — BREAKDOWN BY serviceType');
  console.log('─────────────────────────────────────────────────────────────');

  const reportsByType = await serviceReportModel.aggregate([
    {
      $group: {
        _id:   { $ifNull: ['$serviceType', 'null/missing'] },
        count: { $sum: 1 },
      }
    },
    { $sort: { count: -1 } },
  ]);

  reportsByType.forEach(t => {
    console.log(`   serviceType = '${String(t._id).padEnd(14)}' : ${String(t.count).padStart(6)}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. DANGLING REFERENCES — reportId points to non-existent report
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('6️⃣  DANGLING REFERENCES — reportId points to non-existent report');
  console.log('─────────────────────────────────────────────────────────────');

  const checkDangling = async (model, label) => {
    const withReportId = await model.find(
      { reportId: { $nin: [null, '', undefined] } },
      { _id: 1, reportId: 1 }
    ).lean();

    let dangling = 0;
    for (const doc of withReportId) {
      const exists = await serviceReportModel.exists({ _id: doc.reportId });
      if (!exists) dangling++;
    }
    console.log(`   ${label.padEnd(28)}: ${dangling} dangling  (of ${withReportId.length} linked)`);
    return dangling;
  };

  const d1 = await checkDangling(serviceHistoryModel,     'Service History');
  const d2 = await checkDangling(maintananceHistoryModel, 'Maintenance History');
  const d3 = await checkDangling(tyreModel,               'Tyre History');
  const d4 = await checkDangling(batteryModel,            'Battery History');

  const totalDangling = d1 + d2 + d3 + d4;
  if (totalDangling === 0) {
    console.log('\n   ✅ No dangling reportId references found');
  } else {
    console.log(`\n   ⚠️  ${totalDangling} total dangling reportId references`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. DANGLING REFERENCES — historyId points to non-existent history (new-method only)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('7️⃣  DANGLING REFERENCES — historyId points to non-existent history');
  console.log('─────────────────────────────────────────────────────────────');

  const reportsWithHistoryIdDocs = await serviceReportModel.find(
    { historyId: { $nin: [null, '', undefined] } },
    { _id: 1, historyId: 1, serviceType: 1 }
  ).lean();

  let danglingReports = 0;
  const danglingByType = {};

  for (const report of reportsWithHistoryIdDocs) {
    const type = report.serviceType || 'unknown';

    let histModel = serviceHistoryModel;
    if (type === 'tyre')                                 histModel = tyreModel;
    else if (type === 'battery')                         histModel = batteryModel;
    else if (type === 'maintenance' || type === 'major') histModel = maintananceHistoryModel;

    const exists = await histModel.exists({ _id: report.historyId });
    if (!exists) {
      danglingReports++;
      danglingByType[type] = (danglingByType[type] || 0) + 1;
    }
  }

  if (danglingReports === 0) {
    console.log('   ✅ No dangling historyId references found');
  } else {
    console.log(`   ⚠️  ${danglingReports} new-method reports point to a non-existent history`);
    Object.entries(danglingByType).forEach(([type, count]) => {
      console.log(`     → type '${type}': ${count}`);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. DUPLICATE CHECK
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('8️⃣  DUPLICATE CHECK — same regNo + date in same collection');
  console.log('─────────────────────────────────────────────────────────────');

  const findDuplicates = async (model, label, groupFields) => {
    const duplicates = await model.aggregate([
      { $group: { _id: groupFields, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort:  { count: -1 } },
      { $limit: 5 },
    ]);

    if (duplicates.length === 0) {
      console.log(`   ${label.padEnd(28)}: ✅ No duplicates`);
    } else {
      console.log(`   ${label.padEnd(28)}: ⚠️  ${duplicates.length} duplicate groups (top 5):`);
      duplicates.forEach(d => {
        const key = Object.values(d._id).join(' | ');
        console.log(`     → ${key}  ×${d.count}`);
      });
    }
    return duplicates.length;
  };

  await findDuplicates(serviceHistoryModel,     'Service History',  { regNo: '$regNo', date: '$date' });
  await findDuplicates(maintananceHistoryModel, 'Maintenance',      { regNo: '$regNo', date: '$date' });
  await findDuplicates(tyreModel,               'Tyre',             { equipmentNo: '$equipmentNo', date: '$date' });
  await findDuplicates(batteryModel,            'Battery',          { equipmentNo: '$equipmentNo', date: '$date' });
  await findDuplicates(serviceReportModel,      'Service Reports',  { regNo: '$regNo', date: '$date', serviceType: '$serviceType' });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. DATE FORMAT CONSISTENCY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('9️⃣  DATE FORMAT CONSISTENCY (sample 200 records each)');
  console.log('─────────────────────────────────────────────────────────────');

  const checkDateFormats = async (model, label) => {
    const sample = await model.find({}, { date: 1 }).limit(200).lean();
    const formats = { iso: 0, dmy: 0, other: 0, empty: 0 };

    sample.forEach(doc => {
      const d = doc.date;
      if (!d)                                  formats.empty++;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) formats.iso++;
      else if (/^\d{2}-\d{2}-\d{4}$/.test(d)) formats.dmy++;
      else                                     formats.other++;
    });

    const warning = (formats.other > 0 || formats.dmy > 0) ? ' ⚠️' : ' ✅';
    console.log(`   ${label.padEnd(28)}: ISO: ${formats.iso}  DD-MM-YYYY: ${formats.dmy}  other: ${formats.other}  empty: ${formats.empty}${warning}`);
    return formats;
  };

  await checkDateFormats(serviceHistoryModel,     'Service History');
  await checkDateFormats(maintananceHistoryModel, 'Maintenance');
  const tyreDateFormats    = await checkDateFormats(tyreModel,    'Tyre');
  const batteryDateFormats = await checkDateFormats(batteryModel, 'Battery');
  await checkDateFormats(serviceReportModel,      'Service Reports');

  if (tyreDateFormats.other > 0 || batteryDateFormats.other > 0) {
    console.log('\n   ℹ️  Tyre and Battery store date as Date object (not string) — migration');
    console.log('      will convert to YYYY-MM-DD string via .toISOString().split(\'T\')[0]');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. TOP 10 MOST ACTIVE EQUIPMENT
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🔟  TOP 10 MOST ACTIVE EQUIPMENT (service history records)');
  console.log('─────────────────────────────────────────────────────────────');

  const topEquipments = await serviceHistoryModel.aggregate([
    { $group: { _id: '$regNo', count: { $sum: 1 } } },
    { $sort:  { count: -1 } },
    { $limit: 10 },
  ]);

  topEquipments.forEach((eq, i) => {
    console.log(`   ${String(i + 1).padStart(2)}. regNo ${String(eq._id).padEnd(10)} : ${eq.count} records`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 11. DATE RANGE — OLDEST AND NEWEST
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('1️⃣1️⃣  DATE RANGE — OLDEST → NEWEST RECORD');
  console.log('─────────────────────────────────────────────────────────────');

  const getDateRange = async (model, label) => {
    const [oldest, newest] = await Promise.all([
      model.findOne({}).sort({ createdAt:  1 }).select('createdAt date').lean(),
      model.findOne({}).sort({ createdAt: -1 }).select('createdAt date').lean(),
    ]);
    const oldDate = oldest?.createdAt?.toISOString().split('T')[0] ?? 'N/A';
    const newDate = newest?.createdAt?.toISOString().split('T')[0] ?? 'N/A';
    console.log(`   ${label.padEnd(28)}: ${oldDate}  →  ${newDate}`);
  };

  await getDateRange(serviceHistoryModel,     'Service History');
  await getDateRange(maintananceHistoryModel, 'Maintenance');
  await getDateRange(tyreModel,               'Tyre');
  await getDateRange(batteryModel,            'Battery');
  await getDateRange(serviceReportModel,      'Service Reports');

  // ─────────────────────────────────────────────────────────────────────────
  // 12. FIELD COMPLETENESS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('1️⃣2️⃣  FIELD COMPLETENESS — KEY FIELDS');
  console.log('─────────────────────────────────────────────────────────────');

  const checkField = async (model, field, label) => {
    const total  = await model.countDocuments();
    const filled = await model.countDocuments({
      [field]: { $exists: true, $nin: [null, '', undefined] }
    });
    const pct  = total ? ((filled / total) * 100).toFixed(1) : '0.0';
    const warn = (filled < total) ? ' ⚠️' : ' ✅';
    console.log(`   ${label.padEnd(38)}: ${String(filled).padStart(5)} / ${String(total).padStart(5)}  (${pct}%)${warn}`);
  };

  console.log('\n   Service History (oil/normal):');
  await checkField(serviceHistoryModel, 'regNo',          '     regNo');
  await checkField(serviceHistoryModel, 'date',           '     date');
  await checkField(serviceHistoryModel, 'serviceHrs',     '     serviceHrs');
  await checkField(serviceHistoryModel, 'nextServiceHrs', '     nextServiceHrs');
  await checkField(serviceHistoryModel, 'oil',            '     oil');
  await checkField(serviceHistoryModel, 'oilFilter',      '     oilFilter');
  await checkField(serviceHistoryModel, 'reportId',       '     reportId (new-method link)');

  console.log('\n   Maintenance:');
  await checkField(maintananceHistoryModel, 'regNo',       '     regNo');
  await checkField(maintananceHistoryModel, 'date',        '     date');
  await checkField(maintananceHistoryModel, 'mechanics',   '     mechanics');
  await checkField(maintananceHistoryModel, 'workRemarks', '     workRemarks');
  await checkField(maintananceHistoryModel, 'reportId',    '     reportId (new-method link)');

  console.log('\n   Tyre:');
  await checkField(tyreModel, 'equipmentNo',  '     equipmentNo');
  await checkField(tyreModel, 'date',         '     date');
  await checkField(tyreModel, 'tyreModel',    '     tyreModel');
  await checkField(tyreModel, 'tyreNumber',   '     tyreNumber');
  await checkField(tyreModel, 'runningHours', '     runningHours');
  await checkField(tyreModel, 'reportId',     '     reportId (new-method link)');

  console.log('\n   Battery:');
  await checkField(batteryModel, 'equipmentNo',  '     equipmentNo');
  await checkField(batteryModel, 'date',         '     date');
  await checkField(batteryModel, 'batteryModel', '     batteryModel');
  await checkField(batteryModel, 'reportId',     '     reportId (new-method link)');

  // ─────────────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ AUDIT SUMMARY — REVIEW BEFORE MIGRATING');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Service History records           : ${totalServiceHistory}  (oil: ${oilCount}  normal: ${normalCount}  no-type: ${noTypeCount})`);
  console.log(`   Maintenance records               : ${totalMaintenance}`);
  console.log(`   Tyre records                      : ${totalTyre}`);
  console.log(`   Battery records                   : ${totalBattery}`);
  console.log('   ──────────────────────────────────────────────────────────');
  console.log(`   Total histories to migrate        : ${totalHistories}`);
  console.log(`   Total reports                     : ${totalReports}`);
  console.log('   ──────────────────────────────────────────────────────────');
  console.log(`   Reports linked via historyId      : ${reportsWithHistoryId}  (new method)`);
  console.log(`   Reports linked via regNo+date+type: ${oldMethodResolvable}  (old method — resolvable)`);
  console.log(`   Reports with NO linkage at all    : ${totalEffectivelyUnlinked}  (orphans)`);
  console.log('   ──────────────────────────────────────────────────────────');
  console.log(`   Dangling reportId refs            : ${totalDangling}`);
  console.log(`   Dangling historyId refs           : ${danglingReports}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
};

const restoreFromBackup = async () => {
  const { exec } = require('child_process');
  const path = require('path');

  const backupPath = path.resolve(__dirname, 'data/2026-03-31_09-49');
  const newMongoURI = process.env.MONGO_URI; // your new cluster URI

  console.log('🔄 Restoring from backup...');
  console.log('📂 Backup path:', backupPath);

  const command = `mongorestore --uri="${newMongoURI}" --dir="${backupPath}" --drop`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Restore failed:', error.message);
      return;
    }
    console.log(stdout);
    console.log(stderr);
    console.log('✅ Restore complete!');
  });
};

const exportToolkitsToJson = async () => {
  const fs = require('fs');
  const path = require('path');

  const toolkits = await toolkitModel.find({}).lean();

  const outputPath = path.resolve(__dirname, 'data/toolkits_export.json');
  fs.writeFileSync(outputPath, JSON.stringify(toolkits, null, 2));

  console.log(`✅ Exported ${toolkits.length} toolkits to ${outputPath}`);
};

const auditVariantIds = async () => {
  const toolkits = await toolkitModel.find({}).lean();

  let totalToolkits = toolkits.length;
  let totalVariants = 0;
  let variantsWithId = 0;
  let variantsWithoutId = 0;

  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 TOOLKIT VARIANT _ID AUDIT');
  console.log('═══════════════════════════════════════════════\n');

  for (const toolkit of toolkits) {
    const variants = toolkit.variants || [];
    const withId = variants.filter(v => v._id).length;
    const withoutId = variants.filter(v => !v._id).length;

    totalVariants += variants.length;
    variantsWithId += withId;
    variantsWithoutId += withoutId;

    console.log(`📦 ${toolkit.name}`);
    console.log(`   Total variants   : ${variants.length}`);
    console.log(`   Has _id          : ${withId}`);
    console.log(`   Missing _id      : ${withoutId}`);

    if (withoutId > 0) {
      variants.forEach((v, i) => {
        if (!v._id) {
          console.log(`   ⚠️  Variant ${i + 1}: size=${v.size || 'N/A'} color=${v.color || 'N/A'} — NO _id`);
        }
      });
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════');
  console.log(`   Total Toolkits         : ${totalToolkits}`);
  console.log(`   Total Variants         : ${totalVariants}`);
  console.log(`   Variants WITH _id      : ${variantsWithId}`);
  console.log(`   Variants WITHOUT _id   : ${variantsWithoutId}`);
  console.log('═══════════════════════════════════════════════\n');
};

const fixMissingVariantIds = async () => {
  const db = mongoose.connection.db;
  const collection = db.collection('toolkits');

  const toolkits = await collection.find({}).toArray();

  let totalFixed = 0;

  for (const toolkit of toolkits) {
    let changed = false;

    const updatedVariants = toolkit.variants.map(variant => {
      if (!variant._id) {
        changed = true;
        totalFixed++;
        return { ...variant, _id: new mongoose.Types.ObjectId() };
      }
      return variant;
    });

    if (changed) {
      await collection.updateOne(
        { _id: toolkit._id },
        { $set: { variants: updatedVariants } }
      );
      console.log(`✅ Fixed: ${toolkit.name}`);
    }
  }

  console.log(`\n✅ Total variants fixed: ${totalFixed}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 1 — generateMigrationFiles
// Reads all 4 old collections + reports, builds unified JSON files,
// resolves all cross-links, deduplicates, and writes two files:
//   /developement/migration/histories.json
//   /developement/migration/reports.json
// ─────────────────────────────────────────────────────────────────────────────

const generateMigrationFiles = async () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔄 GENERATING MIGRATION FILES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const outputDir = path.resolve(__dirname, 'migration');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // ── Fetch all source data ──────────────────────────────────────────────────
  console.log('📥 Fetching source data from all collections...');

  const [
    rawServiceHistory,
    rawMaintenance,
    rawTyre,
    rawBattery,
    rawReports,
  ] = await Promise.all([
    serviceHistoryModel.find({}).lean(),
    maintananceHistoryModel.find({}).lean(),
    tyreModel.find({}).lean(),
    batteryModel.find({}).lean(),
    serviceReportModel.find({}).lean(),
  ]);

  console.log(`   Fetched: ${rawServiceHistory.length} service, ${rawMaintenance.length} maintenance, ${rawTyre.length} tyre, ${rawBattery.length} battery, ${rawReports.length} reports\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — BUILD UNIFIED HISTORY DOCUMENTS
  // Each gets a brand-new ObjectId so we can link reports to them cleanly.
  // We also build a lookup map: oldId → newId, and regNo+date+type → newId
  // for resolving old-method report links.
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('⚙️  Step 1: Building unified history documents...');

  const histories      = [];            // final array for histories.json
  const skippedHistory = [];            // duplicates skipped

  // Maps for cross-linking reports
  const oldIdToNewId  = new Map();      // oldMongoId (string) → new ObjectId (string)
  const keyToNewId    = new Map();      // "regNo|date|type" → new ObjectId (string)

  // ── Track seen keys for deduplication ──────────────────────────────────────
  // Key: "regNo|date|serviceType" — same key the new unique index enforces
  const seenHistoryKeys = new Map();    // key → { newId, createdAt }

  const addHistory = (doc, skipDupe = true) => {
    const key = `${doc.regNo}|${doc.date}|${doc.serviceType}`;

    if (skipDupe && seenHistoryKeys.has(key)) {
      const existing = seenHistoryKeys.get(key);
      // Keep newest createdAt
      if (!doc.createdAt || new Date(doc.createdAt) <= new Date(existing.createdAt)) {
        skippedHistory.push({ reason: 'duplicate', key, oldId: doc._id?.toString() });
        return null;
      }
      // This one is newer — remove old from histories array
      const oldIdx = histories.findIndex(h => h._id === existing.newId);
      if (oldIdx !== -1) {
        skippedHistory.push({ reason: 'duplicate-replaced', key, oldId: histories[oldIdx]._id });
        histories.splice(oldIdx, 1);
      }
      seenHistoryKeys.delete(key);
    }

    const newId = new ObjectId().toString();
    oldIdToNewId.set(doc._id?.toString(), newId);
    seenHistoryKeys.set(key, { newId, createdAt: doc.createdAt || new Date(0) });

    return newId;
  };

  // ── 1a. Service History (oil / normal) ─────────────────────────────────────
  for (const r of rawServiceHistory) {
    const type    = r.serviceType || 'oil';   // 1505 nulls → 'oil'
    const dateStr = toDateString(r.date);
    const regNo   = String(r.regNo);

    const newId = addHistory({ _id: r._id, regNo, date: dateStr, serviceType: type, createdAt: r.createdAt });
    if (!newId) continue;

    const doc = {
      _id:            newId,
      regNo,
      serviceType:    type,
      date:           dateStr,
      equipment:      null,
      location:       null,
      operator:       null,
      mechanics:      null,
      remarks:        null,
      serviceHrs:     r.serviceHrs     || null,
      nextServiceHrs: r.nextServiceHrs || null,
      fullService:    r.fullService    || false,
      oil:            r.oil            || 'Check',
      oilFilter:      r.oilFilter      || 'Check',
      fuelFilter:     r.fuelFilter     || 'Check',
      acFilter:       r.acFilter       || 'Clean',
      waterSeparator: r.waterSeparator || 'Check',
      airFilter:      r.airFilter      || 'Clean',
      tyreModel:      null,
      tyreNumber:     null,
      runningHours:   null,
      batteryModel:   null,
      reportId:       null,            // filled in Step 3
      createdAt:      r.createdAt     || now(),
      updatedAt:      r.updatedAt     || now(),
    };

    // Register regNo+date+type key for old-method report resolution
    keyToNewId.set(`${regNo}|${dateStr}|${type}`, newId);
    // oil type also registers under old 'oil' and any alias
    if (type === 'oil') keyToNewId.set(`${regNo}|${dateStr}|oil`, newId);
    if (type === 'normal') keyToNewId.set(`${regNo}|${dateStr}|normal`, newId);

    histories.push(doc);
  }

  // ── 1b. Maintenance → major ────────────────────────────────────────────────
  for (const r of rawMaintenance) {
    const dateStr = toDateString(r.date);
    const regNo   = String(r.regNo);

    const newId = addHistory({ _id: r._id, regNo, date: dateStr, serviceType: 'major', createdAt: r.createdAt });
    if (!newId) continue;

    const doc = {
      _id:            newId,
      regNo,
      serviceType:    'major',
      date:           dateStr,
      equipment:      r.equipment    || null,
      location:       null,
      operator:       null,
      mechanics:      r.mechanics    || null,
      remarks:        r.workRemarks  || null,
      serviceHrs:     null,
      nextServiceHrs: null,
      fullService:    false,
      oil:            null,
      oilFilter:      null,
      fuelFilter:     null,
      acFilter:       null,
      waterSeparator: null,
      airFilter:      null,
      tyreModel:      null,
      tyreNumber:     null,
      runningHours:   null,
      batteryModel:   null,
      reportId:       null,
      createdAt:      r.createdAt || now(),
      updatedAt:      r.updatedAt || now(),
    };

    // Old reports stored 'maintenance' type — register both keys
    keyToNewId.set(`${regNo}|${dateStr}|major`,       newId);
    keyToNewId.set(`${regNo}|${dateStr}|maintenance`, newId);

    histories.push(doc);
  }

  // ── 1c. Tyre ───────────────────────────────────────────────────────────────
  for (const r of rawTyre) {
    const dateStr   = toDateString(r.date);
    const regNo     = String(r.equipmentNo || r.regNo);

    const newId = addHistory({ _id: r._id, regNo, date: dateStr, serviceType: 'tyre', createdAt: r.createdAt });
    if (!newId) continue;

    const doc = {
      _id:            newId,
      regNo,
      serviceType:    'tyre',
      date:           dateStr,
      equipment:      r.equipment    || null,
      location:       r.location     || null,
      operator:       r.operator     || null,
      mechanics:      null,
      remarks:        null,
      serviceHrs:     null,
      nextServiceHrs: null,
      fullService:    false,
      oil:            null,
      oilFilter:      null,
      fuelFilter:     null,
      acFilter:       null,
      waterSeparator: null,
      airFilter:      null,
      tyreModel:      r.tyreModel    || null,
      tyreNumber:     r.tyreNumber   || null,
      runningHours:   r.runningHours || null,
      batteryModel:   null,
      reportId:       null,
      createdAt:      r.createdAt || now(),
      updatedAt:      r.updatedAt || now(),
    };

    keyToNewId.set(`${regNo}|${dateStr}|tyre`, newId);
    histories.push(doc);
  }

  // ── 1d. Battery ────────────────────────────────────────────────────────────
  for (const r of rawBattery) {
    const dateStr = toDateString(r.date);
    const regNo   = String(r.equipmentNo || r.regNo);

    const newId = addHistory({ _id: r._id, regNo, date: dateStr, serviceType: 'battery', createdAt: r.createdAt });
    if (!newId) continue;

    const doc = {
      _id:            newId,
      regNo,
      serviceType:    'battery',
      date:           dateStr,
      equipment:      r.equipment    || null,
      location:       r.location     || null,
      operator:       r.operator     || null,
      mechanics:      null,
      remarks:        null,
      serviceHrs:     null,
      nextServiceHrs: null,
      fullService:    false,
      oil:            null,
      oilFilter:      null,
      fuelFilter:     null,
      acFilter:       null,
      waterSeparator: null,
      airFilter:      null,
      tyreModel:      null,
      tyreNumber:     null,
      runningHours:   null,
      batteryModel:   r.batteryModel || null,
      reportId:       null,
      createdAt:      r.createdAt || now(),
      updatedAt:      r.updatedAt || now(),
    };

    keyToNewId.set(`${regNo}|${dateStr}|battery`, newId);
    histories.push(doc);
  }

  console.log(`   ✅ Built ${histories.length} history documents (skipped ${skippedHistory.length} duplicates)\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — BUILD REPORT DOCUMENTS WITH RESOLVED historyId
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('⚙️  Step 2: Building report documents and resolving links...');

  const reports        = [];
  const skippedReports = [];
  const orphanReports  = [];
  const seenReportKeys = new Map();   // "regNo|date|type" → newest createdAt

  let linkedViaHistoryId  = 0;
  let linkedViaKey        = 0;
  let linkedOrphan        = 0;

  for (const r of rawReports) {
    const type    = r.serviceType === 'maintenance' ? 'major' : (r.serviceType || 'oil');
    const dateStr = toDateString(r.date);
    const regNo   = String(r.regNo);

    // ── Deduplication ─────────────────────────────────────────────────────────
    const reportKey = `${regNo}|${dateStr}|${type}`;
    if (seenReportKeys.has(reportKey)) {
      const existingCreatedAt = seenReportKeys.get(reportKey).createdAt;
      if (!r.createdAt || new Date(r.createdAt) <= new Date(existingCreatedAt)) {
        skippedReports.push({ reason: 'duplicate', key: reportKey, oldId: r._id?.toString() });
        continue;
      }
      // This one is newer — replace
      const oldIdx = reports.findIndex(rep => rep._id === seenReportKeys.get(reportKey).newId);
      if (oldIdx !== -1) {
        skippedReports.push({ reason: 'duplicate-replaced', key: reportKey, oldId: reports[oldIdx]._id });
        reports.splice(oldIdx, 1);
      }
      seenReportKeys.delete(reportKey);
    }

    // ── Resolve historyId ─────────────────────────────────────────────────────
    let resolvedHistoryId = null;
    let linkMethod        = 'orphan';

    if (r.historyId) {
      // New-method: report already has historyId — remap to new ObjectId
      const mappedId = oldIdToNewId.get(r.historyId.toString());
      if (mappedId) {
        resolvedHistoryId = mappedId;
        linkMethod        = 'historyId';
        linkedViaHistoryId++;
      } else {
        // Dangling historyId (the 1 broken one from audit) — treat as orphan
        orphanReports.push({ oldId: r._id?.toString(), reason: 'dangling-historyId', regNo, date: dateStr, type });
        linkMethod = 'orphan';
        linkedOrphan++;
      }
    } else {
      // Old-method: resolve via regNo + date + type
      const lookupKey = `${regNo}|${dateStr}|${type}`;
      const foundId   = keyToNewId.get(lookupKey);
      if (foundId) {
        resolvedHistoryId = foundId;
        linkMethod        = 'regNo+date+type';
        linkedViaKey++;
      } else {
        orphanReports.push({ oldId: r._id?.toString(), reason: 'no-matching-history', regNo, date: dateStr, type });
        linkMethod = 'orphan';
        linkedOrphan++;
      }
    }

    const newReportId = new ObjectId().toString();
    seenReportKeys.set(reportKey, { newId: newReportId, createdAt: r.createdAt || new Date(0) });

    const doc = {
      _id:            newReportId,
      regNo,
      machine:        r.machine        || '',
      date:           dateStr,
      serviceType:    type,
      serviceHrs:     r.serviceHrs     || null,
      nextServiceHrs: r.nextServiceHrs || null,
      location:       r.location       || null,
      mechanics:      r.mechanics      || null,
      operatorName:   r.operatorName   || null,
      remarks:        r.remarks        || null,
      checklistItems: r.checklistItems || [],
      historyId:      resolvedHistoryId,
      _linkMethod:    linkMethod,       // strip before importing — useful for verification
      createdAt:      r.createdAt || now(),
      updatedAt:      r.updatedAt || now(),
    };

    reports.push(doc);
  }

  console.log(`   ✅ Built ${reports.length} report documents`);
  console.log(`      Linked via historyId      : ${linkedViaHistoryId}`);
  console.log(`      Linked via regNo+date+type: ${linkedViaKey}`);
  console.log(`      Orphans (historyId=null)  : ${linkedOrphan}`);
  console.log(`      Skipped duplicates        : ${skippedReports.length}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — BACK-FILL reportId onto history documents
  // For every report that has a resolved historyId, find its history doc
  // and set reportId = report._id
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('⚙️  Step 3: Back-filling reportId onto history documents...');

  const historyById = new Map(histories.map(h => [h._id, h]));
  let backfilled    = 0;

  for (const report of reports) {
    if (!report.historyId) continue;
    const histDoc = historyById.get(report.historyId);
    if (histDoc) {
      histDoc.reportId = report._id;
      backfilled++;
    }
  }

  console.log(`   ✅ Back-filled reportId on ${backfilled} history documents\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — WRITE JSON FILES
  // Strip internal _linkMethod field from reports before writing
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('💾 Step 4: Writing JSON files...');

  const cleanReports = reports.map(({ _linkMethod, ...rest }) => rest);

  const historiesPath = path.join(outputDir, 'histories.json');
  const reportsPath   = path.join(outputDir, 'reports.json');
  const logPath       = path.join(outputDir, 'migration-log.json');

  fs.writeFileSync(historiesPath, JSON.stringify(histories,   null, 2), 'utf8');
  fs.writeFileSync(reportsPath,   JSON.stringify(cleanReports, null, 2), 'utf8');

  // Write a log file with all skipped/orphan details
  const migrationLog = {
    generatedAt:          new Date().toISOString(),
    summary: {
      historiesGenerated: histories.length,
      reportsGenerated:   cleanReports.length,
      historiesSkipped:   skippedHistory.length,
      reportsSkipped:     skippedReports.length,
      orphanReports:      orphanReports.length,
      reportLinks: {
        viaHistoryId:     linkedViaHistoryId,
        viaRegNoDateType: linkedViaKey,
        unlinked:         linkedOrphan,
      },
    },
    skippedHistories: skippedHistory,
    skippedReports,
    orphanReports,
  };

  fs.writeFileSync(logPath, JSON.stringify(migrationLog, null, 2), 'utf8');

  console.log(`   ✅ histories.json  — ${histories.length} documents`);
  console.log(`   ✅ reports.json    — ${cleanReports.length} documents`);
  console.log(`   ✅ migration-log.json written`);

  // ─── Final summary ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 GENERATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Histories generated        : ${histories.length}   (expected ~2925 minus dupes)`);
  console.log(`   Histories skipped (dupes)  : ${skippedHistory.length}`);
  console.log(`   Reports generated          : ${cleanReports.length}   (expected ~2568 minus dupes)`);
  console.log(`   Reports skipped (dupes)    : ${skippedReports.length}`);
  console.log(`   Orphan reports (no history): ${orphanReports.length}   (historyId will be null)`);
  console.log(`   reportId back-filled       : ${backfilled}`);
  console.log(`\n   Files written to: ${outputDir}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 2 — verifyMigrationFiles
// Reads histories.json and reports.json and runs full integrity checks:
//   - Count verification
//   - Cross-link integrity (every historyId in reports exists in histories)
//   - Back-link integrity (every reportId in histories exists in reports)
//   - Duplicate detection in output files
//   - Orphan summary
//   - Type breakdown
//   - Field completeness spot-check
// ─────────────────────────────────────────────────────────────────────────────

const verifyMigrationFiles = () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFYING MIGRATION FILES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const outputDir     = path.resolve(__dirname, 'migration');
  const historiesPath = path.join(outputDir, 'histories.json');
  const reportsPath   = path.join(outputDir, 'reports.json');
  const logPath       = path.join(outputDir, 'migration-log.json');

  if (!fs.existsSync(historiesPath) || !fs.existsSync(reportsPath)) {
    console.error('❌ Migration files not found — run generateMigrationFiles() first');
    return;
  }

  const histories = JSON.parse(fs.readFileSync(historiesPath, 'utf8'));
  const reports   = JSON.parse(fs.readFileSync(reportsPath,   'utf8'));
  const log       = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : null;

  let passed = 0;
  let failed = 0;
  const issues = [];

  const check = (label, condition, detail = '') => {
    if (condition) {
      console.log(`   ✅ ${label}`);
      passed++;
    } else {
      console.log(`   ❌ ${label}${detail ? ' — ' + detail : ''}`);
      failed++;
      issues.push(label + (detail ? ': ' + detail : ''));
    }
  };

  // ── 1. Count checks ────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log('1️⃣  COUNT VERIFICATION');
  console.log('─────────────────────────────────────────────────────────────');

  console.log(`   Histories : ${histories.length}`);
  console.log(`   Reports   : ${reports.length}`);

  if (log) {
    check('History count matches generation summary',
      histories.length === log.summary.historiesGenerated,
      `file: ${histories.length}, log: ${log.summary.historiesGenerated}`
    );
    check('Report count matches generation summary',
      reports.length === log.summary.reportsGenerated,
      `file: ${reports.length}, log: ${log.summary.reportsGenerated}`
    );
  }

  // ── 2. Duplicate _id check ─────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('2️⃣  DUPLICATE _id CHECK');
  console.log('─────────────────────────────────────────────────────────────');

  const histIds   = histories.map(h => h._id);
  const reportIds = reports.map(r => r._id);

  const dupHistIds   = histIds.filter((id, i) => histIds.indexOf(id) !== i);
  const dupReportIds = reportIds.filter((id, i) => reportIds.indexOf(id) !== i);

  check('No duplicate _id in histories.json',   dupHistIds.length   === 0, `${dupHistIds.length} duplicates`);
  check('No duplicate _id in reports.json',     dupReportIds.length === 0, `${dupReportIds.length} duplicates`);

  // ── 3. Duplicate regNo+date+type check ────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('3️⃣  DUPLICATE regNo+date+type CHECK (unique index key)');
  console.log('─────────────────────────────────────────────────────────────');

  const histKeys    = histories.map(h => `${h.regNo}|${h.date}|${h.serviceType}`);
  const dupHistKeys = histKeys.filter((k, i) => histKeys.indexOf(k) !== i);
  const uniqueDupHistKeys = [...new Set(dupHistKeys)];

  check('No duplicate regNo+date+type in histories.json', uniqueDupHistKeys.length === 0,
    `${uniqueDupHistKeys.length} duplicate key groups`
  );

  if (uniqueDupHistKeys.length > 0) {
    console.log('   Duplicate keys (first 5):');
    uniqueDupHistKeys.slice(0, 5).forEach(k => console.log(`     → ${k}`));
  }

  const repKeys    = reports.map(r => `${r.regNo}|${r.date}|${r.serviceType}`);
  const dupRepKeys = repKeys.filter((k, i) => repKeys.indexOf(k) !== i);
  const uniqueDupRepKeys = [...new Set(dupRepKeys)];

  check('No duplicate regNo+date+type in reports.json', uniqueDupRepKeys.length === 0,
    `${uniqueDupRepKeys.length} duplicate key groups`
  );

  if (uniqueDupRepKeys.length > 0) {
    console.log('   Duplicate report keys (first 5):');
    uniqueDupRepKeys.slice(0, 5).forEach(k => console.log(`     → ${k}`));
  }

  // ── 4. Cross-link integrity: reports → histories ───────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('4️⃣  CROSS-LINK: reports.historyId → histories._id');
  console.log('─────────────────────────────────────────────────────────────');

  const histIdSet         = new Set(histIds);
  const reportsWithLink   = reports.filter(r => r.historyId);
  const reportsWithoutLink = reports.filter(r => !r.historyId);
  const danglingHistoryId = reportsWithLink.filter(r => !histIdSet.has(r.historyId));

  console.log(`   Reports with    historyId   : ${reportsWithLink.length}`);
  console.log(`   Reports without historyId   : ${reportsWithoutLink.length}  (orphans — expected ~${log?.summary?.orphanReports ?? '?'})`);

  check('All report historyId values point to a real history',
    danglingHistoryId.length === 0,
    `${danglingHistoryId.length} dangling`
  );

  if (danglingHistoryId.length > 0) {
    console.log('   Dangling historyIds (first 5):');
    danglingHistoryId.slice(0, 5).forEach(r =>
      console.log(`     → report._id: ${r._id}  historyId: ${r.historyId}  (${r.regNo} | ${r.date} | ${r.serviceType})`)
    );
  }

  // ── 5. Back-link integrity: histories → reports ────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('5️⃣  BACK-LINK: histories.reportId → reports._id');
  console.log('─────────────────────────────────────────────────────────────');

  const reportIdSet           = new Set(reportIds);
  const historiesWithReport   = histories.filter(h => h.reportId);
  const historiesWithoutReport = histories.filter(h => !h.reportId);
  const danglingReportId      = historiesWithReport.filter(h => !reportIdSet.has(h.reportId));

  console.log(`   Histories with    reportId   : ${historiesWithReport.length}`);
  console.log(`   Histories without reportId   : ${historiesWithoutReport.length}`);

  check('All history reportId values point to a real report',
    danglingReportId.length === 0,
    `${danglingReportId.length} dangling`
  );

  if (danglingReportId.length > 0) {
    console.log('   Dangling reportIds (first 5):');
    danglingReportId.slice(0, 5).forEach(h =>
      console.log(`     → history._id: ${h._id}  reportId: ${h.reportId}  (${h.regNo} | ${h.date} | ${h.serviceType})`)
    );
  }

  // ── 6. Bidirectional link symmetry ────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('6️⃣  BIDIRECTIONAL SYMMETRY CHECK');
  console.log('─────────────────────────────────────────────────────────────');

  const reportToHistory = new Map(reportsWithLink.map(r => [r._id, r.historyId]));
  const historyToReport = new Map(historiesWithReport.map(h => [h._id, h.reportId]));

  let asymmetric = 0;
  for (const [reportId, historyId] of reportToHistory) {
    const backRef = historyToReport.get(historyId);
    if (backRef !== reportId) asymmetric++;
  }

  check('All linked report↔history pairs are symmetric', asymmetric === 0,
    `${asymmetric} asymmetric pairs`
  );

  // ── 7. Type breakdown ──────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('7️⃣  TYPE BREAKDOWN');
  console.log('─────────────────────────────────────────────────────────────');

  const histByType   = {};
  const reportByType = {};
  const validTypes   = ['oil', 'normal', 'tyre', 'battery', 'major'];

  histories.forEach(h => { histByType[h.serviceType]   = (histByType[h.serviceType]   || 0) + 1; });
  reports.forEach(r   => { reportByType[r.serviceType] = (reportByType[r.serviceType] || 0) + 1; });

  console.log('\n   Type         Histories   Reports');
  console.log('   ──────────────────────────────────');
  validTypes.forEach(t => {
    const h = histByType[t]   || 0;
    const r = reportByType[t] || 0;
    console.log(`   ${t.padEnd(12)} ${String(h).padStart(9)}   ${String(r).padStart(7)}`);
  });

  const unknownHistTypes   = Object.keys(histByType).filter(t => !validTypes.includes(t));
  const unknownReportTypes = Object.keys(reportByType).filter(t => !validTypes.includes(t));

  check('No invalid serviceType values in histories', unknownHistTypes.length === 0,
    unknownHistTypes.length > 0 ? `Found: ${unknownHistTypes.join(', ')}` : ''
  );
  check('No invalid serviceType values in reports', unknownReportTypes.length === 0,
    unknownReportTypes.length > 0 ? `Found: ${unknownReportTypes.join(', ')}` : ''
  );
  check("No 'maintenance' type remains (should be 'major')",
    !histByType['maintenance'] && !reportByType['maintenance'],
    `histories: ${histByType['maintenance'] || 0}, reports: ${reportByType['maintenance'] || 0}`
  );

  // ── 8. Required field completeness ────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('8️⃣  REQUIRED FIELD COMPLETENESS');
  console.log('─────────────────────────────────────────────────────────────');

  const countMissing = (arr, field) =>
    arr.filter(d => d[field] === null || d[field] === undefined || d[field] === '').length;

  const hMissingRegNo      = countMissing(histories, 'regNo');
  const hMissingDate       = countMissing(histories, 'date');
  const hMissingType       = countMissing(histories, 'serviceType');
  const rMissingRegNo      = countMissing(reports,   'regNo');
  const rMissingDate       = countMissing(reports,   'date');
  const rMissingType       = countMissing(reports,   'serviceType');
  const rMissingMachine    = countMissing(reports,   'machine');

  check('histories: no missing regNo',       hMissingRegNo  === 0, `${hMissingRegNo} missing`);
  check('histories: no missing date',        hMissingDate   === 0, `${hMissingDate} missing`);
  check('histories: no missing serviceType', hMissingType   === 0, `${hMissingType} missing`);
  check('reports: no missing regNo',         rMissingRegNo  === 0, `${rMissingRegNo} missing`);
  check('reports: no missing date',          rMissingDate   === 0, `${rMissingDate} missing`);
  check('reports: no missing serviceType',   rMissingType   === 0, `${rMissingType} missing`);
  check('reports: no missing machine',       rMissingMachine === 0, `${rMissingMachine} missing`);

  // ── 9. Date format consistency ─────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('9️⃣  DATE FORMAT CONSISTENCY (all records)');
  console.log('─────────────────────────────────────────────────────────────');

  const isoRegex  = /^\d{4}-\d{2}-\d{2}$/;
  const badHistDates   = histories.filter(h => !h.date || !isoRegex.test(h.date));
  const badReportDates = reports.filter(r   => !r.date || !isoRegex.test(r.date));

  check('All history dates are YYYY-MM-DD',  badHistDates.length   === 0, `${badHistDates.length} bad`);
  check('All report dates are YYYY-MM-DD',   badReportDates.length === 0, `${badReportDates.length} bad`);

  if (badHistDates.length > 0) {
    console.log('   Bad history dates (first 5):');
    badHistDates.slice(0, 5).forEach(h => console.log(`     → ${h._id}: "${h.date}"`));
  }

  // ── 10. Orphan summary ─────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🔟  ORPHAN REPORT SUMMARY');
  console.log('─────────────────────────────────────────────────────────────');

  console.log(`   Total orphan reports (historyId=null) : ${reportsWithoutLink.length}`);
  if (reportsWithoutLink.length > 0) {
    const orphanByType = {};
    reportsWithoutLink.forEach(r => {
      orphanByType[r.serviceType] = (orphanByType[r.serviceType] || 0) + 1;
    });
    console.log('   Orphan breakdown by type:');
    Object.entries(orphanByType).forEach(([t, c]) => console.log(`     → ${t}: ${c}`));
    console.log('\n   First 5 orphan reports:');
    reportsWithoutLink.slice(0, 5).forEach(r =>
      console.log(`     → _id: ${r._id}  regNo: ${r.regNo}  date: ${r.date}  type: ${r.serviceType}`)
    );
  }

  // ── Final verdict ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ VERIFICATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Checks passed : ${passed}`);
  console.log(`   Checks failed : ${failed}`);

  if (failed === 0) {
    console.log('\n   🟢 Files are clean — safe to import into MongoDB Compass');
    console.log('      Import order: histories.json first, then reports.json');
  } else {
    console.log('\n   🔴 Issues found — fix before importing:');
    issues.forEach(i => console.log(`     → ${i}`));
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
};

const findMissingInWaiting = () => {
  const waitingDir   = path.resolve(__dirname, 'waiting');
  const migrationDir = path.resolve(__dirname, 'migration');
  const missingDir   = path.resolve(__dirname, 'missing');

  if (!fs.existsSync(missingDir)) fs.mkdirSync(missingDir, { recursive: true });

  const CUTOFF = new Date('2026-03-30T00:00:00.000Z');

  const isAfterCutoff = (doc) => {
    const d = new Date(doc.createdAt);
    return !isNaN(d.getTime()) && d >= CUTOFF;
  };

  // ── Load all 4 files ──────────────────────────────────────────────────────
  const waitingHistories  = JSON.parse(fs.readFileSync(path.join(waitingDir,   'histories.json'), 'utf8'));
  const waitingReports    = JSON.parse(fs.readFileSync(path.join(waitingDir,   'reports.json'),   'utf8'));
  const migrationHistories= JSON.parse(fs.readFileSync(path.join(migrationDir, 'histories.json'), 'utf8'));
  const migrationReports  = JSON.parse(fs.readFileSync(path.join(migrationDir, 'reports.json'),   'utf8'));

  // ── Build lookup sets from waiting (by regNo|date|serviceType key) ─────────
  // We compare by business key, not _id, because IDs are regenerated each run
  const waitingHistKeys  = new Set(waitingHistories.map(h => `${h.regNo}|${h.date}|${h.serviceType}`));
  const waitingReportKeys= new Set(waitingReports.map(r   => `${r.regNo}|${r.date}|${r.serviceType}`));

  // ── Find migration records that are:
  //    1. createdAt >= 2026-03-30
  //    2. NOT present in waiting (by business key)
  const missingHistories = migrationHistories.filter(h =>
    isAfterCutoff(h) && !waitingHistKeys.has(`${h.regNo}|${h.date}|${h.serviceType}`)
  );

  const missingReports = migrationReports.filter(r =>
    isAfterCutoff(r) && !waitingReportKeys.has(`${r.regNo}|${r.date}|${r.serviceType}`)
  );

  // ── Write output files ────────────────────────────────────────────────────
  fs.writeFileSync(path.join(missingDir, 'histories.json'), JSON.stringify(missingHistories, null, 2), 'utf8');
  fs.writeFileSync(path.join(missingDir, 'reports.json'),   JSON.stringify(missingReports,   null, 2), 'utf8');

  // ── Stats ─────────────────────────────────────────────────────────────────
  const afterCutoffInMigrationH = migrationHistories.filter(isAfterCutoff).length;
  const afterCutoffInMigrationR = migrationReports.filter(isAfterCutoff).length;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 MISSING RECORDS FINDER  (cutoff: 2026-03-30)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n  HISTORIES');
  console.log(`    waiting total              : ${waitingHistories.length}`);
  console.log(`    migration total            : ${migrationHistories.length}`);
  console.log(`    migration >= 2026-03-30    : ${afterCutoffInMigrationH}`);
  console.log(`    missing (new, not waiting) : ${missingHistories.length}  ← written`);
  console.log('\n  REPORTS');
  console.log(`    waiting total              : ${waitingReports.length}`);
  console.log(`    migration total            : ${migrationReports.length}`);
  console.log(`    migration >= 2026-03-30    : ${afterCutoffInMigrationR}`);
  console.log(`    missing (new, not waiting) : ${missingReports.length}  ← written`);

  if (missingHistories.length > 0) {
    console.log('\n  Sample missing histories (first 5):');
    missingHistories.slice(0, 5).forEach(h =>
      console.log(`    → ${h.regNo} | ${h.date} | ${h.serviceType} | createdAt: ${h.createdAt}`)
    );
  }
  if (missingReports.length > 0) {
    console.log('\n  Sample missing reports (first 5):');
    missingReports.slice(0, 5).forEach(r =>
      console.log(`    → ${r.regNo} | ${r.date} | ${r.serviceType} | createdAt: ${r.createdAt}`)
    );
  }

  console.log(`\n  Files written to: ${missingDir}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
};

const linkAllUnlinkedRecords = () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔗 LINKING ALL UNLINKED RECORDS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const finalDir = path.resolve(__dirname, 'final');
  const historiesPath = path.join(finalDir, 'histories.json');
  const reportsPath = path.join(finalDir, 'reports.json');

  if (!fs.existsSync(historiesPath) || !fs.existsSync(reportsPath)) {
    console.error('❌ Final files not found');
    return;
  }

  const histories = JSON.parse(fs.readFileSync(historiesPath, 'utf8'));
  const reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));

  console.log(`📥 Loaded: ${histories.length} histories, ${reports.length} reports\n`);

  // ── Build lookup maps ──────────────────────────────────────────────────────
  console.log('🗂️  Building lookup indexes...');

  // Map: regNo|date|type → history object
  const historyByKey = new Map();
  histories.forEach(h => {
    const key = `${h.regNo}|${h.date}|${h.serviceType}`;
    historyByKey.set(key, h);
  });

  // Map: regNo|date|type → report object
  const reportByKey = new Map();
  reports.forEach(r => {
    const key = `${r.regNo}|${r.date}|${r.serviceType}`;
    reportByKey.set(key, r);
  });

  // Map: _id → object (for quick lookup)
  const historyById = new Map(histories.map(h => [h._id, h]));
  const reportById = new Map(reports.map(r => [r._id, r]));

  console.log(`   ✅ Indexed ${historyByKey.size} unique history keys`);
  console.log(`   ✅ Indexed ${reportByKey.size} unique report keys\n`);

  // ── Count current state ────────────────────────────────────────────────────
  let historiesWithReport = histories.filter(h => h.reportId).length;
  let historiesWithoutReport = histories.filter(h => !h.reportId).length;
  let reportsWithHistory = reports.filter(r => r.historyId).length;
  let reportsWithoutHistory = reports.filter(r => !r.historyId).length;

  console.log('📊 BEFORE LINKING:');
  console.log(`   Histories WITH reportId    : ${historiesWithReport}`);
  console.log(`   Histories WITHOUT reportId : ${historiesWithoutReport}`);
  console.log(`   Reports WITH historyId     : ${reportsWithHistory}`);
  console.log(`   Reports WITHOUT historyId  : ${reportsWithoutHistory}\n`);

  // ── Linking statistics ─────────────────────────────────────────────────────
  let newlyLinkedHistories = 0;
  let newlyLinkedReports = 0;
  let unresolvedHistories = [];
  let unresolvedReports = [];

  // ── STEP 1: Link histories → reports ───────────────────────────────────────
  console.log('🔗 STEP 1: Linking histories → reports...');

  for (const history of histories) {
    if (history.reportId) continue; // Already linked

    const key = `${history.regNo}|${history.date}|${history.serviceType}`;
    const matchingReport = reportByKey.get(key);

    if (matchingReport) {
      history.reportId = matchingReport._id;
      newlyLinkedHistories++;
    } else {
      unresolvedHistories.push({
        _id: history._id,
        regNo: history.regNo,
        date: history.date,
        type: history.serviceType,
        reason: 'No matching report found'
      });
    }
  }

  console.log(`   ✅ Newly linked: ${newlyLinkedHistories} histories`);
  console.log(`   ⚠️  Unresolved: ${unresolvedHistories.length} histories\n`);

  // ── STEP 2: Link reports → histories ───────────────────────────────────────
  console.log('🔗 STEP 2: Linking reports → histories...');

  for (const report of reports) {
    if (report.historyId) continue; // Already linked

    const key = `${report.regNo}|${report.date}|${report.serviceType}`;
    const matchingHistory = historyByKey.get(key);

    if (matchingHistory) {
      report.historyId = matchingHistory._id;
      newlyLinkedReports++;
    } else {
      unresolvedReports.push({
        _id: report._id,
        regNo: report.regNo,
        date: report.date,
        type: report.serviceType,
        reason: 'No matching history found'
      });
    }
  }

  console.log(`   ✅ Newly linked: ${newlyLinkedReports} reports`);
  console.log(`   ⚠️  Unresolved: ${unresolvedReports.length} reports\n`);

  // ── STEP 3: Verify bidirectional symmetry ──────────────────────────────────
  console.log('🔍 STEP 3: Verifying bidirectional symmetry...');

  let asymmetricPairs = 0;
  const asymmetricDetails = [];

  for (const history of histories) {
    if (!history.reportId) continue;

    const linkedReport = reportById.get(history.reportId);
    if (!linkedReport) {
      asymmetricPairs++;
      asymmetricDetails.push({
        historyId: history._id,
        reportId: history.reportId,
        issue: 'History points to non-existent report'
      });
      continue;
    }

    if (linkedReport.historyId !== history._id) {
      asymmetricPairs++;
      asymmetricDetails.push({
        historyId: history._id,
        reportId: history.reportId,
        reportBackRef: linkedReport.historyId,
        issue: 'Report does not point back to history'
      });
    }
  }

  console.log(`   Asymmetric pairs found: ${asymmetricPairs}`);
  if (asymmetricPairs > 0) {
    console.log('   ⚠️  WARNING: Some links are not bidirectional!\n');
    console.log('   First 5 asymmetric pairs:');
    asymmetricDetails.slice(0, 5).forEach(d => {
      console.log(`     → ${JSON.stringify(d)}`);
    });
  } else {
    console.log('   ✅ All linked pairs are bidirectional\n');
  }

  // ── Final counts ───────────────────────────────────────────────────────────
  historiesWithReport = histories.filter(h => h.reportId).length;
  historiesWithoutReport = histories.filter(h => !h.reportId).length;
  reportsWithHistory = reports.filter(r => r.historyId).length;
  reportsWithoutHistory = reports.filter(r => !r.historyId).length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 AFTER LINKING:');
  console.log(`   Histories WITH reportId    : ${historiesWithReport}   (was ${historiesWithReport - newlyLinkedHistories})`);
  console.log(`   Histories WITHOUT reportId : ${historiesWithoutReport}`);
  console.log(`   Reports WITH historyId     : ${reportsWithHistory}   (was ${reportsWithHistory - newlyLinkedReports})`);
  console.log(`   Reports WITHOUT historyId  : ${reportsWithoutHistory}\n`);

  console.log('📈 SUMMARY:');
  console.log(`   Newly linked histories     : ${newlyLinkedHistories}`);
  console.log(`   Newly linked reports       : ${newlyLinkedReports}`);
  console.log(`   Unresolved histories       : ${unresolvedHistories.length}`);
  console.log(`   Unresolved reports         : ${unresolvedReports.length}`);
  console.log(`   Asymmetric pairs           : ${asymmetricPairs}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Write updated files ────────────────────────────────────────────────────
  console.log('💾 Writing updated files...');

  const backupDir = path.join(finalDir, 'backup_before_linking');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Backup originals
  fs.copyFileSync(historiesPath, path.join(backupDir, 'histories.json'));
  fs.copyFileSync(reportsPath, path.join(backupDir, 'reports.json'));
  console.log(`   ✅ Backup created in: ${backupDir}`);

  // Write updated files
  fs.writeFileSync(historiesPath, JSON.stringify(histories, null, 2), 'utf8');
  fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2), 'utf8');
  console.log(`   ✅ Updated histories.json (${histories.length} records)`);
  console.log(`   ✅ Updated reports.json (${reports.length} records)`);

  // Write unresolved report
  const unresolvedPath = path.join(finalDir, 'unresolved-links.json');
  fs.writeFileSync(unresolvedPath, JSON.stringify({
    unresolvedHistories,
    unresolvedReports,
    asymmetricPairs: asymmetricDetails
  }, null, 2), 'utf8');
  console.log(`   ✅ Unresolved records saved to: unresolved-links.json\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ LINKING COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION: compareFinalWithLiveDB
// Compares the final JSON files with live database to find any missing records
// ─────────────────────────────────────────────────────────────────────────────

const compareFinalWithLiveDB = async () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 COMPARING FINAL DATA WITH LIVE DATABASE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const finalDir = path.resolve(__dirname, 'final');
  const historiesPath = path.join(finalDir, 'histories.json');
  const reportsPath = path.join(finalDir, 'reports.json');

  const finalHistories = JSON.parse(fs.readFileSync(historiesPath, 'utf8'));
  const finalReports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));

  console.log(`📥 Loaded final data: ${finalHistories.length} histories, ${finalReports.length} reports\n`);

  // ── Fetch all live DB data ─────────────────────────────────────────────────
  console.log('📡 Fetching live database data...');

  const [
    liveServiceHistory,
    liveMaintenance,
    liveTyre,
    liveBattery,
    liveReports,
  ] = await Promise.all([
    serviceHistoryModel.find({}).lean(),
    maintananceHistoryModel.find({}).lean(),
    tyreModel.find({}).lean(),
    batteryModel.find({}).lean(),
    serviceReportModel.find({}).lean(),
  ]);

  const totalLiveHistories = liveServiceHistory.length + liveMaintenance.length + liveTyre.length + liveBattery.length;

  console.log(`   ✅ Live DB: ${totalLiveHistories} total histories, ${liveReports.length} reports\n`);

  // ── Build key sets from final data ─────────────────────────────────────────
  const finalHistoryKeys = new Set(
    finalHistories.map(h => `${h.regNo}|${h.date}|${h.serviceType}`)
  );
  const finalReportKeys = new Set(
    finalReports.map(r => `${r.regNo}|${r.date}|${r.serviceType}`)
  );

  // ── Check for missing histories ────────────────────────────────────────────
  console.log('🔍 Checking for missing histories...');

  const missingHistories = [];

  // Service History (oil/normal)
  for (const r of liveServiceHistory) {
    const type = r.serviceType || 'oil';
    const dateStr = toDateString(r.date);
    const key = `${r.regNo}|${dateStr}|${type}`;
    if (!finalHistoryKeys.has(key)) {
      missingHistories.push({ collection: 'serviceHistory', key, doc: r });
    }
  }

  // Maintenance
  for (const r of liveMaintenance) {
    const dateStr = toDateString(r.date);
    const key = `${r.regNo}|${dateStr}|major`;
    if (!finalHistoryKeys.has(key)) {
      missingHistories.push({ collection: 'maintenance', key, doc: r });
    }
  }

  // Tyre
  for (const r of liveTyre) {
    const dateStr = toDateString(r.date);
    const regNo = String(r.equipmentNo || r.regNo);
    const key = `${regNo}|${dateStr}|tyre`;
    if (!finalHistoryKeys.has(key)) {
      missingHistories.push({ collection: 'tyre', key, doc: r });
    }
  }

  // Battery
  for (const r of liveBattery) {
    const dateStr = toDateString(r.date);
    const regNo = String(r.equipmentNo || r.regNo);
    const key = `${regNo}|${dateStr}|battery`;
    if (!finalHistoryKeys.has(key)) {
      missingHistories.push({ collection: 'battery', key, doc: r });
    }
  }

  console.log(`   Missing histories: ${missingHistories.length}\n`);

  // ── Check for missing reports ──────────────────────────────────────────────
  console.log('🔍 Checking for missing reports...');

  const missingReports = [];

  for (const r of liveReports) {
    const type = r.serviceType === 'maintenance' ? 'major' : (r.serviceType || 'oil');
    const dateStr = toDateString(r.date);
    const key = `${r.regNo}|${dateStr}|${type}`;
    if (!finalReportKeys.has(key)) {
      missingReports.push({ key, doc: r });
    }
  }

  console.log(`   Missing reports: ${missingReports.length}\n`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 COMPARISON SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nLIVE DATABASE:');
  console.log(`   Service History (oil/normal) : ${liveServiceHistory.length}`);
  console.log(`   Maintenance                  : ${liveMaintenance.length}`);
  console.log(`   Tyre                         : ${liveTyre.length}`);
  console.log(`   Battery                      : ${liveBattery.length}`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   Total Histories              : ${totalLiveHistories}`);
  console.log(`   Total Reports                : ${liveReports.length}`);

  console.log('\nFINAL DATA:');
  console.log(`   Histories                    : ${finalHistories.length}`);
  console.log(`   Reports                      : ${finalReports.length}`);

  console.log('\nMISSING FROM FINAL:');
  console.log(`   Histories                    : ${missingHistories.length}`);
  console.log(`   Reports                      : ${missingReports.length}`);

  if (missingHistories.length === 0 && missingReports.length === 0) {
    console.log('\n✅ PERFECT MATCH — No records missing from final data');
  } else {
    console.log('\n⚠️  DISCREPANCY FOUND — Some records are missing');

    if (missingHistories.length > 0) {
      console.log('\n   Missing histories by collection:');
      const byCollection = {};
      missingHistories.forEach(m => {
        byCollection[m.collection] = (byCollection[m.collection] || 0) + 1;
      });
      Object.entries(byCollection).forEach(([coll, count]) => {
        console.log(`     → ${coll}: ${count}`);
      });

      console.log('\n   First 5 missing histories:');
      missingHistories.slice(0, 5).forEach(m => {
        console.log(`     → ${m.key}  (collection: ${m.collection})`);
      });
    }

    if (missingReports.length > 0) {
      console.log('\n   First 5 missing reports:');
      missingReports.slice(0, 5).forEach(m => {
        console.log(`     → ${m.key}`);
      });
    }

    // Write missing records to file
    const missingPath = path.join(finalDir, 'missing-from-final.json');
    fs.writeFileSync(missingPath, JSON.stringify({
      missingHistories,
      missingReports
    }, null, 2), 'utf8');
    console.log(`\n   📝 Missing records written to: missing-from-final.json`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION: fullAuditReport
// Generates a comprehensive audit of the final data
// ─────────────────────────────────────────────────────────────────────────────

const fullAuditReport = () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 FULL AUDIT REPORT — FINAL DATA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const finalDir = path.resolve(__dirname, 'final');
  const histories = JSON.parse(fs.readFileSync(path.join(finalDir, 'histories.json'), 'utf8'));
  const reports = JSON.parse(fs.readFileSync(path.join(finalDir, 'reports.json'), 'utf8'));

  // ── 1. Total counts ────────────────────────────────────────────────────────
  console.log('1️⃣  TOTAL COUNTS');
  console.log(`   Histories : ${histories.length}`);
  console.log(`   Reports   : ${reports.length}\n`);

  // ── 2. Link status ─────────────────────────────────────────────────────────
  const historiesWithReport = histories.filter(h => h.reportId);
  const historiesWithoutReport = histories.filter(h => !h.reportId);
  const reportsWithHistory = reports.filter(r => r.historyId);
  const reportsWithoutHistory = reports.filter(r => !r.historyId);

  console.log('2️⃣  LINK STATUS');
  console.log(`   Histories WITH reportId    : ${historiesWithReport.length}   (${((historiesWithReport.length/histories.length)*100).toFixed(1)}%)`);
  console.log(`   Histories WITHOUT reportId : ${historiesWithoutReport.length}   (${((historiesWithoutReport.length/histories.length)*100).toFixed(1)}%)`);
  console.log(`   Reports WITH historyId     : ${reportsWithHistory.length}   (${((reportsWithHistory.length/reports.length)*100).toFixed(1)}%)`);
  console.log(`   Reports WITHOUT historyId  : ${reportsWithoutHistory.length}   (${((reportsWithoutHistory.length/reports.length)*100).toFixed(1)}%)\n`);

  // ── 3. Type breakdown ──────────────────────────────────────────────────────
  console.log('3️⃣  TYPE BREAKDOWN');
  const histByType = {};
  const reportByType = {};

  histories.forEach(h => { histByType[h.serviceType] = (histByType[h.serviceType] || 0) + 1; });
  reports.forEach(r => { reportByType[r.serviceType] = (reportByType[r.serviceType] || 0) + 1; });

  console.log('\n   Type         Histories   Reports');
  console.log('   ──────────────────────────────────');
  ['oil', 'normal', 'tyre', 'battery', 'major'].forEach(t => {
    const h = histByType[t] || 0;
    const r = reportByType[t] || 0;
    console.log(`   ${t.padEnd(12)} ${String(h).padStart(9)}   ${String(r).padStart(7)}`);
  });

  // ── 4. Bidirectional verification ─────────────────────────────────────────
  console.log('\n4️⃣  BIDIRECTIONAL LINK VERIFICATION');

  const historyById = new Map(histories.map(h => [h._id, h]));
  const reportById = new Map(reports.map(r => [r._id, r]));

  let symmetricPairs = 0;
  let asymmetricPairs = 0;

  for (const history of historiesWithReport) {
    const linkedReport = reportById.get(history.reportId);
    if (linkedReport && linkedReport.historyId === history._id) {
      symmetricPairs++;
    } else {
      asymmetricPairs++;
    }
  }

  console.log(`   Symmetric pairs (bidirectional)  : ${symmetricPairs}`);
  console.log(`   Asymmetric pairs (broken links)  : ${asymmetricPairs}`);

  const linkageHealth = symmetricPairs / (symmetricPairs + asymmetricPairs) * 100;
  console.log(`   Link health score                : ${linkageHealth.toFixed(1)}%\n`);

  // ── 5. Data quality ────────────────────────────────────────────────────────
  console.log('5️⃣  DATA QUALITY CHECKS');

  const missingRegNo = histories.filter(h => !h.regNo || h.regNo === '').length;
  const missingDate = histories.filter(h => !h.date || h.date === '').length;
  const missingType = histories.filter(h => !h.serviceType || h.serviceType === '').length;

  console.log(`   Histories missing regNo      : ${missingRegNo}`);
  console.log(`   Histories missing date       : ${missingDate}`);
  console.log(`   Histories missing serviceType: ${missingType}\n`);

  // ── Final verdict ──────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ AUDIT COMPLETE');

  const allLinked = (historiesWithoutReport.length === 0 && reportsWithoutHistory.length === 0);
  const noAsymmetric = (asymmetricPairs === 0);
  const noMissing = (missingRegNo === 0 && missingDate === 0 && missingType === 0);

  if (allLinked && noAsymmetric && noMissing) {
    console.log('🟢 STATUS: PERFECT — All records linked, no issues found');
  } else {
    console.log('🟡 STATUS: NEEDS ATTENTION — Issues detected:');
    if (!allLinked) console.log('   ⚠️  Some records are not linked');
    if (!noAsymmetric) console.log('   ⚠️  Some links are asymmetric');
    if (!noMissing) console.log('   ⚠️  Some records have missing required fields');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// Runner  —  change the function call here to run what you need
// ─────────────────────────────────────────────────────────────────────────────

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🟢 DB connected\n');

  // ↓ swap this line to call whichever function you need
  // await addActivationKey();
  // await addCodeInSameSupplier();
  // await addCodeInSameVendor();
  // await setupOAuth();
  // await syncEquipmentsFromData();
  // checkEquipmentsCount()
  // await addMissingHiredEquipments();
  // await addTwoMissingEquipments();
  // await syncEquipmentStatus();
  // await analyzeIdleEquipments();
  // await setCarsSiteToOffice();
  // await fixCarsAndIdleSites();
  // await syncEquipmentLocations();
  // await migrateEquipmentSchema();
  // await resetAllStocksToZero()
  // await analyzeDashboardData();
  // await restoreFromBackup();
  // await exportToolkitsToJson();
  //  await auditVariantIds();
  // await fixMissingVariantIds();
  // await auditServiceHistoryData();
  // await generateMigrationFiles();
  // verifyMigrationFiles()
  // findMissingInWaiting()
  linkAllUnlinkedRecords();
  await compareFinalWithLiveDB();
  fullAuditReport();
};



run()
  .then(() => { console.log('\n✅ Done'); process.exit(0); })
  .catch((err) => { console.error('\n❌ Error:', err.message); process.exit(1); });