const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { paginate } = require('#shared/pagination/pagination');
const Complaint = require('./complaint.model');
const wsUtils = require('#core/socket/socket.io');
const Equipment = require('../equipment/equipment.model');
const MobilizationModel = require('../mobilization/mobilization.model');
const { buildMobilizationRecord } = require('./complaint.helper');
const {
  COMPLAINT_STATUS,
  COMPLAINT_WORKFLOW_STATUS,
  EQUIPMENT_STATUS,
  COMPLAINT_SOCKET_EVENT,
} = require('./complaint.constant');

const emitComplaintUpdate = (complaint) =>
  wsUtils.dispatchBroadcastWebSocketEvent(COMPLAINT_SOCKET_EVENT, {
    complaintId: String(complaint._id),
    regNo: complaint.regNo,
    workflowStatus: complaint.workflowStatus,
  });
const generateComplaintId = async () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);

  let hours = now.getHours();
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const formattedHours = String(hours).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todayCount = await Complaint.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  return `${day}${month}${year}${formattedHours}${minutes}${meridiem}CP${todayCount + 1}`;
};

const resolvePreviousEquipmentStatus = async (equipment) => {
  if (equipment.status !== EQUIPMENT_STATUS.MAINTENANCE) return equipment.status;

  const oldestPendingComplaint = await Complaint.findOne({
    regNo: equipment.regNo,
    status: COMPLAINT_STATUS.PENDING,
  }).sort({ createdAt: 1 });

  return oldestPendingComplaint?.previousEquipmentStatus || EQUIPMENT_STATUS.ACTIVE;
};

const resolveRestoredEquipmentStatus = (previousEquipmentStatus) =>
  previousEquipmentStatus && previousEquipmentStatus !== EQUIPMENT_STATUS.MAINTENANCE
    ? previousEquipmentStatus
    : EQUIPMENT_STATUS.ACTIVE;

const createComplaint = async (complaintInput) => {
  try {
    const equipment = await Equipment.findOne({ regNo: complaintInput.regNo });
    if (!equipment) {
      throw {
        status: HTTP.NOT_FOUND,
        message: `Equipment with regNo ${complaintInput.regNo} not found`,
      };
    }

    const previousStatus = equipment.status;
    const previousEquipmentStatus = await resolvePreviousEquipmentStatus(equipment);
    const complaintId = await generateComplaintId();

    const complaint = await new Complaint({
      ...complaintInput,
      complaintId,
      brand: equipment.brand,
      machine: equipment.machine,
      workflowStatus: COMPLAINT_WORKFLOW_STATUS.REGISTERED,
      status: COMPLAINT_STATUS.PENDING,
      previousEquipmentStatus,
    }).save();

    if (previousStatus !== EQUIPMENT_STATUS.MAINTENANCE) {
      await Equipment.findOneAndUpdate(
        { regNo: complaintInput.regNo },
        { status: EQUIPMENT_STATUS.MAINTENANCE },
        { new: true }
      );

      await MobilizationModel.create(
        buildMobilizationRecord(
          equipment,
          previousStatus,
          EQUIPMENT_STATUS.MAINTENANCE,
          `Equipment moved to maintenance due to complaint registration. Complaint ID: ${complaint.complaintId}. Remarks: ${complaintInput.remarks || 'No remarks provided'}`
        )
      );
    }

    emitComplaintUpdate(complaint);
    return complaint;
  } catch (error) {
    logger.error('[ComplaintService] createComplaint:', error);
    throw error;
  }
};

const addSolutionToComplaint = async (complaintId, solutionFiles, mechanicName, remarks = '') => {
  try {
    const existing = await Complaint.findById(complaintId);
    if (!existing) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };
    if (existing.status === COMPLAINT_STATUS.RESOLVED) {
      throw { status: HTTP.BAD_REQUEST, message: 'Work already completed' };
    }

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        $push: { solutions: { $each: solutionFiles } },
        $set: {
          status: COMPLAINT_STATUS.RESOLVED,
          workflowStatus: COMPLAINT_WORKFLOW_STATUS.COMPLETED,
          rectificationRemarks: remarks,
          rectifiedBy: mechanicName,
          rectifiedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    const remainingPendingCount = await Complaint.countDocuments({
      regNo: complaint.regNo,
      status: COMPLAINT_STATUS.PENDING,
      _id: { $ne: complaint._id },
    });

    if (remainingPendingCount === 0) {
      const equipment = await Equipment.findOne({ regNo: complaint.regNo });
      if (equipment) {
        const restoredStatus = resolveRestoredEquipmentStatus(existing.previousEquipmentStatus);

        await Equipment.findOneAndUpdate(
          { regNo: complaint.regNo },
          { status: restoredStatus },
          { new: true }
        );

        await MobilizationModel.create(
          buildMobilizationRecord(
            equipment,
            EQUIPMENT_STATUS.MAINTENANCE,
            restoredStatus,
            `Work completed by ${mechanicName}. Equipment status changed to ${restoredStatus}. Complaint ID: ${existing.complaintId}. ${remarks || 'Equipment ready for operation.'}`
          )
        );
      }
    }

    emitComplaintUpdate(complaint);
    return {
      status: HTTP.OK,
      message: 'Work completed successfully',
      data: complaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] addSolutionToComplaint:', error);
    throw error;
  }
};

const getComplaintsByUser = async (uniqueCode, pagination) => {
  try {
    return await paginate(Complaint, { uniqueCode }, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[ComplaintService] getComplaintsByUser:', error);
    throw error;
  }
};

const getComplaintsByRegNo = async (regNo, pagination) => {
  try {
    return await paginate(Complaint, { regNo }, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[ComplaintService] getComplaintsByRegNo:', error);
    throw error;
  }
};

const getComplaintById = async (id) => {
  try {
    return await Complaint.findById(id);
  } catch (error) {
    logger.error('[ComplaintService] getComplaintById:', error);
    throw error;
  }
};

const getFullComplaints = async (pagination) => {
  try {
    return await paginate(Complaint, {}, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[ComplaintService] getFullComplaints:', error);
    throw error;
  }
};

const getEquipmentLatestComplaints = async ({ page = 1, limit = 20, skip = 0 }) => {
  try {
    const [result] = await Complaint.aggregate([
      { $match: { regNo: { $nin: [null, ''] } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$regNo',
          latestComplaint: { $first: '$$ROOT' },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.PENDING] }, 1, 0] },
          },
        },
      },
      { $sort: { 'latestComplaint.createdAt': -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'equipments',
                localField: '_id',
                foreignField: 'regNo',
                as: 'equipment',
              },
            },
            {
              $project: {
                _id: 0,
                regNo: '$_id',
                machine: {
                  $ifNull: [{ $arrayElemAt: ['$equipment.machine', 0] }, '$latestComplaint.machine'],
                },
                pendingCount: 1,
                latestComplaint: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const items = result?.items || [];
    const totalCount = result?.total?.[0]?.count || 0;

    return {
      data: items,
      pagination: {
        currentPage: page,
        hasMore: skip + items.length < totalCount,
        totalCount,
        limit,
      },
    };
  } catch (error) {
    logger.error('[ComplaintService] getEquipmentLatestComplaints:', error);
    throw error;
  }
};

module.exports = {
  createComplaint,
  addSolutionToComplaint,
  getComplaintsByUser,
  getComplaintsByRegNo,
  getComplaintById,
  getFullComplaints,
  getEquipmentLatestComplaints,
};