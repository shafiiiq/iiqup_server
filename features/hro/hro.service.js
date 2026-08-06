const HTTP = require('../../shared/constants/httpStatus.constant.js');
const HireOrder = require('./hro.model');
const { paginationUtil: { paginate } } = require('../../shared/pagination');

const calculateTotal = (items, showDiscountInTotal, discount) => {
  let total = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  if (showDiscountInTotal && discount) total -= discount;
  return total;
};

const buildSignatures = (signatures) => ({
  accountsDept: signatures?.accountsDept || 'ROSHAN SHA',
  purchasingManager: signatures?.purchasingManager || 'ABDUL MALIK',
  operationsManager: signatures?.operationsManager || 'SURESHKANTH',
  authorizedSignatory: signatures?.authorizedSignatory || 'AHAMMED KAMAL',
  authorizedSignatoryTitle: signatures?.authorizedSignatoryTitle || 'CEO',
});

const createHireOrder = async (hireOrderData) => {
  try {
    const totalAmount = calculateTotal(
      hireOrderData.items || [],
      hireOrderData.showDiscountInTotal,
      hireOrderData.discount
    );
    const signatures = buildSignatures(hireOrderData.signatures);

    const hireOrder = new HireOrder({
      ...hireOrderData,
      totalAmount,
      signatures,
      isAmendmented: false,
      amendments: [],
    });

    return await hireOrder.save();
  } catch (error) {
    throw new Error(`Error creating hire order: ${error.message}`);
  }
};

const getPendingSignatures = async (uniqueCode) => {
  try {
    const roleMap = [
      {
        envKey: process.env.MANAGER,
        query: {
          managerSigned: { $ne: true },
          workflowStatus: {
            $in: ['hire_order_uploaded', 'hire_order_amended'],
          },
        },
      },
      {
        envKey: process.env.PURCHASE_MANAGER,
        query: {
          managerSigned: true,
          pmSigned: { $ne: true },
          workflowStatus: { $in: ['manager_approved'] },
        },
      },
      {
        envKey: process.env.ACCOUNTS,
        query: {
          managerSigned: true,
          pmSigned: true,
          accountsSigned: { $ne: true },
          workflowStatus: { $in: ['purchase_approved', 'accounts_approved'] },
        },
      },
      {
        envKey: process.env.CEO,
        query: {
          managerSigned: true,
          pmSigned: true,
          accountsSigned: true,
          ceoSigned: { $ne: true },
          workflowStatus: { $in: ['accounts_approved', 'ceo_approved'] },
        },
      },
      {
        envKey: process.env.MD,
        query: {
          managerSigned: true,
          pmSigned: true,
          accountsSigned: true,
          ceoSigned: { $ne: true },
          workflowStatus: { $in: ['accounts_approved', 'md_approved'] },
        },
      },
    ];

    const matched = roleMap.find((entry) => entry.envKey === uniqueCode);
    if (!matched) return [];

    return HireOrder.find(matched.query).sort({ createdAt: -1 });
  } catch (error) {
    throw new Error(`Error fetching pending signatures: ${error.message}`);
  }
};

const getSignedByUser = async (uniqueCode) => {
  try {
    const roleMap = [
      { envKey: process.env.MANAGER, query: { managerSigned: true } },
      { envKey: process.env.PURCHASE_MANAGER, query: { pmSigned: true } },
      { envKey: process.env.ACCOUNTS, query: { accountsSigned: true } },
      { envKey: process.env.CEO, query: { ceoSigned: true } },
      { envKey: process.env.MD, query: { ceoSigned: true } },
    ];

    const matched = roleMap.find((entry) => entry.envKey === uniqueCode);
    if (!matched) return [];

    return HireOrder.find(matched.query).sort({ createdAt: -1 });
  } catch (error) {
    throw new Error(`Error fetching signed records: ${error.message}`);
  }
};

const signHireOrder = async (refNo, signData) => {
  try {
    const { uniqueCode, signedDate, signedFrom } = signData;
    const roleMap = {
      MANAGER: {
        envKey: process.env.MANAGER,
        field: 'managerSigned',
        role: 'MANAGER',
      },
      PURCHASE_MANAGER: {
        envKey: process.env.PURCHASE_MANAGER,
        field: 'pmSigned',
        role: 'PURCHASE_MANAGER',
      },
      ACCOUNTS: {
        envKey: process.env.ACCOUNTS,
        field: 'accountsSigned',
        role: 'ACCOUNTS',
      },
      CEO: { envKey: process.env.CEO, field: 'ceoSigned', role: 'CEO' },
      MANAGING_DIRECTOR: {
        envKey: process.env.MD,
        field: 'ceoSigned',
        role: 'MANAGING_DIRECTOR',
      },
    };

    const matched = Object.values(roleMap).find(
      (entry) => entry.envKey === uniqueCode
    );
    if (!matched)
      throw Object.assign(
        new Error(
          'Unauthorised: your account is not recognised as an authorised signatory for hire order documents'
        ),
        { status: HTTP.FORBIDDEN }
      );

    const hireOrder = await HireOrder.findOne({ hireOrderRef: refNo.trim() });
    if (!hireOrder)
      throw Object.assign(new Error('Hire order not found'), { status: HTTP.NOT_FOUND });
    if (hireOrder.workflowStatus === 'hire_order_created')
      throw Object.assign(new Error('HIRE_ORDER_NOT_UPLOADED'), {
        status: HTTP.FORBIDDEN,
      });
    if (hireOrder[matched.field] === true)
      throw Object.assign(
        new Error('The authorized signatory role has already been signed'),
        { status: HTTP.CONFLICT }
      );

    const updateFields = {
      [matched.field]: true,
      workflowStatus:
        matched.role === 'MANAGER'
          ? 'manager_approved'
          : matched.role === 'PURCHASE_MANAGER'
            ? 'purchase_approved'
            : matched.role === 'ACCOUNTS'
              ? 'accounts_approved'
              : 'ceo_approved',
      $push: {
        approvalTrail: {
          approvedBy: uniqueCode,
          role: matched.role,
          action: 'signed',
          comments: `Signed via system by ${matched.role}`,
          approvalDate: new Date(),
        },
      },
    };

    if (matched.role === 'MANAGER')
      updateFields['signatures.operationsManager'] = signedFrom || 'System';
    if (matched.role === 'PURCHASE_MANAGER')
      updateFields['signatures.purchasingManager'] = signedFrom || 'System';
    if (matched.role === 'ACCOUNTS')
      updateFields['signatures.accountsDept'] = signedFrom || 'System';
    if (matched.role === 'CEO' || matched.role === 'MANAGING_DIRECTOR')
      updateFields['signatures.authorizedSignatory'] = signedFrom || 'System';

    const updated = await HireOrder.findOneAndUpdate(
      { hireOrderRef: refNo.trim() },
      updateFields,
      { new: true, runValidators: true }
    );
    return {
      status: HTTP.OK,
      message: `${matched.role} signature recorded successfully`,
      data: updated,
    };
  } catch (error) {
    throw error;
  }
};

const getAllHireOrders = async (pagination) =>
  paginate(HireOrder, {}, pagination, { sort: { createdAt: -1 } });

const getHireOrderByRef = async (refNo) => {
  const hireOrder = await HireOrder.findOne({ hireOrderRef: refNo.trim() });
  if (!hireOrder) throw new Error('Hire order not found');
  return hireOrder;
};

const getLatestHireOrderRef = async () => {
  const latest = await HireOrder.findOne()
    .sort({ createdAt: -1 })
    .select('hireOrderRef');
  return latest?.hireOrderRef || null;
};

const updateHireOrder = async (refNo, updateData) => {
  try {
    const existingHireOrder = await HireOrder.findOne({
      hireOrderRef: refNo.trim(),
    });
    if (!existingHireOrder) throw new Error('Hire order not found');

    if (updateData.items?.length > 0) {
      updateData.totalAmount = updateData.items.reduce(
        (sum, item) => sum + (item.totalPrice || 0),
        0
      );
    }

    if (updateData.showDiscountInTotal && updateData.discount) {
      updateData.totalAmount =
        (updateData.totalAmount || 0) - (updateData.discount || 0);
    }

    return await HireOrder.findOneAndUpdate(
      { hireOrderRef: refNo.trim() },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error updating hire order: ${error.message}`);
  }
};

const deleteHireOrder = async (refNo) => {
  const hireOrder = await HireOrder.findOneAndDelete({ hireOrderRef: refNo });
  if (!hireOrder) throw new Error('Hire order not found');
  return hireOrder;
};

const uploadHireOrder = async (hireOrderRef, uploadedBy, description) => {
  const hireOrder = await HireOrder.findOne({ hireOrderRef });
  if (!hireOrder) throw new Error('Hire order not found');

  const updated = await HireOrder.findOneAndUpdate(
    { hireOrderRef },
    {
      $set: { workflowStatus: 'hire_order_uploaded', updatedAt: new Date() },
      $push: {
        approvalTrail: {
          approvedBy: uploadedBy,
          role: 'WORKSHOP_MANAGER',
          approvalDate: new Date(),
          comments:
            description || `Hire order document uploaded: ${hireOrderRef}`,
          action: 'uploaded',
        },
      },
    },
    { new: true, runValidators: true }
  );

  return updated;
};

module.exports = {
  createHireOrder,
  getPendingSignatures,
  getSignedByUser,
  signHireOrder,
  getAllHireOrders,
  getHireOrderByRef,
  getLatestHireOrderRef,
  updateHireOrder,
  deleteHireOrder,
  uploadHireOrder,
};
