// development.js  —  run with: node development.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

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

const bcrypt = require('bcrypt');
const { getAuthorizationUrl, exchangeCodeForTokens } = require('../gmail/backcharge.gmail.js');

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
const { equipments } = require('./data/equipments.js');

// ─────────────────────────────────────────────────────────────────────────────
// Functions
// ─────────────────────────────────────────────────────────────────────────────

const addActivationKey = async () => {
  const email = '';   // <-- fill in
  const activationKey = '';   // <-- fill in

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
  await analyzeDashboardData();
};



run()
  .then(() => { console.log('\n✅ Done'); process.exit(0); })
  .catch((err) => { console.error('\n❌ Error:', err.message); process.exit(1); });