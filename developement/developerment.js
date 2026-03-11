// development.js  —  run with: node development.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const UserModel = require('../models/user.model.js');
const BatteryModel = require('../models/battery.model.js');
const serviceReportModel = require('../models/report.model.js');
const TyreModel = require('../models/tyre.model.js');
const serviceHistoryModel = require('../models/history.model.js');
const MaintananceModel = require('../models/maintenance.model.js');
const Equipment = require('../models/equipment.model.js');
const Images = require('../models/images.model.js');
const Toolkit = require('../models/toolkit.model.js');
const Stokcs = require('../models/stock.model.js');
const Mechanic = require('../models/mechanic.model.js');
const DocumentModel = require('../models/document.model.js');
const Backcharge = require('../models/backcharge.model.js');
const LPO = require('../models/lpo.model.js');
const Fuels = require('../models/fuel.model.js');
const User = require('../models/user.model.js');
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
  const email = 'firoz@ansarigroup.co';   // <-- fill in
  const activationKey = '10348904692716570342';   // <-- fill in

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

// ─────────────────────────────────────────────────────────────────────────────
// Runner  —  change the function call here to run what you need
// ─────────────────────────────────────────────────────────────────────────────

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🟢 DB connected\n');

  // ↓ swap this line to call whichever function you need
  await addActivationKey();
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
};



run()
  .then(() => { console.log('\n✅ Done'); process.exit(0); })
  .catch((err) => { console.error('\n❌ Error:', err.message); process.exit(1); });