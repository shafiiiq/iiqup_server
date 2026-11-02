require('dotenv').config();
const mongoose = require('mongoose');
const Maintenance = require('./maintenance.model');

const HISTORY_COLLECTION_NAME = 'servicehistories';
const REPORT_COLLECTION_NAME = 'servicereports';

const pickFirstFilled = (...values) => {
  const found = values.find((value) => value !== undefined && value !== null && value !== '');
  return found === undefined ? null : found;
};

const buildMaintenanceFields = ({ history = {}, report = {} }) => ({
  regNo: String(pickFirstFilled(history.regNo, report.regNo)),
  serviceType: pickFirstFilled(history.serviceType, report.serviceType),
  date: pickFirstFilled(history.date, report.date),
  equipment: pickFirstFilled(history.equipment, report.machine),
  location: pickFirstFilled(report.location, history.location),
  operator: pickFirstFilled(history.operator, report.operatorName),
  mechanics: pickFirstFilled(history.mechanics, report.mechanics),
  remarks: pickFirstFilled(report.remarks, history.remarks),
  serviceHrs: pickFirstFilled(report.serviceHrs, history.serviceHrs, history.runningHours),
  nextServiceHrs: pickFirstFilled(report.nextServiceHrs, history.nextServiceHrs),
  fullService: Boolean(history.fullService),
  oil: pickFirstFilled(history.oil),
  oilFilter: pickFirstFilled(history.oilFilter),
  fuelFilter: pickFirstFilled(history.fuelFilter),
  acFilter: pickFirstFilled(history.acFilter),
  waterSeparator: pickFirstFilled(history.waterSeparator),
  airFilter: pickFirstFilled(history.airFilter),
  tyreModel: pickFirstFilled(history.tyreModel),
  tyreNumber: pickFirstFilled(history.tyreNumber),
  batteryModel: pickFirstFilled(history.batteryModel),
  checklistItems: report.checklistItems || [],
  attachments: [],
  complaintId: pickFirstFilled(report.complaintId),
});

const buildHistoryBasedOperation = ({ history, report }) => {
  const fields = buildMaintenanceFields({ history, report });
  return {
    updateOne: {
      filter: { regNo: fields.regNo, serviceType: fields.serviceType, date: fields.date },
      update: {
        $set: fields,
        $setOnInsert: {
          _id: history._id,
          createdAt: history.createdAt || new Date(),
          updatedAt: history.updatedAt || new Date(),
        },
      },
      upsert: true,
    },
  };
};

const buildReportOnlyOperation = (report) => {
  const fields = buildMaintenanceFields({ report });
  return {
    updateOne: {
      filter: { regNo: fields.regNo, serviceType: fields.serviceType, date: fields.date },
      update: {
        $setOnInsert: {
          _id: report._id,
          ...fields,
          createdAt: report.createdAt || new Date(),
          updatedAt: report.updatedAt || new Date(),
        },
      },
      upsert: true,
    },
  };
};

const runMigration = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Maintenance.init();

  const { db } = mongoose.connection;
  const histories = await db.collection(HISTORY_COLLECTION_NAME).find({}).toArray();
  const reports = await db.collection(REPORT_COLLECTION_NAME).find({}).toArray();

  const reportsById = new Map(reports.map((report) => [String(report._id), report]));
  const reportsByHistoryId = new Map(
    reports.filter((report) => report.historyId).map((report) => [String(report.historyId), report])
  );
  const mergedReportIds = new Set();

  const historyOperations = histories.map((history) => {
    const report =
      (history.reportId && reportsById.get(String(history.reportId))) ||
      reportsByHistoryId.get(String(history._id)) ||
      null;
    if (report) mergedReportIds.add(String(report._id));
    return buildHistoryBasedOperation({ history, report: report || {} });
  });

  const reportOnlyOperations = reports
    .filter((report) => !mergedReportIds.has(String(report._id)))
    .map(buildReportOnlyOperation);

  const operations = [...historyOperations, ...reportOnlyOperations];

  if (operations.length) {
    const result = await Maintenance.collection.bulkWrite(operations, { ordered: false });
    console.log('Upserted:', result.upsertedCount, 'Modified:', result.modifiedCount);
  }

  console.log('Histories:', histories.length);
  console.log('Reports:', reports.length);
  console.log('Merged pairs:', mergedReportIds.size);
  console.log('Reports without history:', reportOnlyOperations.length);
  console.log('Maintenance documents:', await Maintenance.countDocuments());

  await mongoose.disconnect();
};

runMigration().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});