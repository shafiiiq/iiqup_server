const searchRegistry = {
  attendances: {
    model: require('../../features/attendance/attendance.model'),
    searchableFields: ['pin', 'empName', 'punchTime', 'punchType', 'state', 'workCode', 'photo', 'location', 'dateOnly', 'timeOnly'],
    defaultFields: ['empName', 'pin', 'location', 'punchTime'],
  },
  backcharges: {
    model: require('../../features/backcharge/backcharge.model'),
    searchableFields: ['reportNo', 'refNo', 'date', 'workDate', 'equipmentType', 'plateNo', 'model', 'supplierName', 'supplierMail', 'supplierCode', 'description', 'comments'],
    defaultFields: ['reportNo', 'plateNo', 'supplierName', 'description'],
  },
  chats: {
    model: require('../../features/chat/chats.model'),
    searchableFields: ['type', 'teamType', 'name', 'avatar', 'lastMessage', 'lastMessageType'],
    defaultFields: ['name', 'lastMessage', 'type'],
  },
  messages: {
    model: require('../../features/chat/message/messages.model'),
    searchableFields: ['senderType', 'senderName', 'senderAvatar', 'messageType', 'content', 'fileName', 'thumbnail', 'caption', 'status'],
    defaultFields: ['senderName', 'content', 'status'],
  },
  complaints: {
    model: require('../../features/complaint/complaint.model'),
    searchableFields: ['uniqueCode', 'complaintId', 'regNo', 'brand', 'machine', 'name', 'remarks', 'rectificationRemarks', 'workflowStatus', 'status'],
    defaultFields: ['complaintId', 'regNo', 'machine', 'status'],
  },
  documents: {
    model: require('../../features/document/document.model'),
    searchableFields: ['SourceId', 'documentType', 'category', 'regNo', 'description'],
    defaultFields: ['regNo', 'documentType', 'category', 'description'],
  },
  equipments: {
    model: require('../../features/equipment/equipment.model'),
    searchableFields: ['machine', 'regNo', 'brand', 'company', 'coc', 'istimaraExpiry', 'insuranceExpiry', 'tpcExpiry', 'hiredFrom', 'location', 'status'],
    defaultFields: ['machine', 'regNo', 'brand', 'location'],
  },
  servicehistories: {
    model: require('../../features/equipment/history/history.model'),
    searchableFields: ['regNo', 'serviceType', 'date', 'equipment', 'location', 'operator', 'mechanics', 'remarks', 'serviceHrs', 'nextServiceHrs'],
    defaultFields: ['regNo', 'serviceType', 'equipment', 'remarks'],
  },
  equipmenthandovers: {
    model: require('../../features/equipment/images/images.model'),
    searchableFields: ['equipmentName', 'equipmentNo', 'path', 'label'],
    defaultFields: ['equipmentName', 'equipmentNo'],
  },
  mobilizations: {
    model: require('../../features/equipment/mobilization/mobilizations.model'),
    searchableFields: ['regNo', 'machine', 'action', 'previousStatus', 'newStatus', 'status', 'deployType', 'clientCompany', 'site', 'time', 'demobRemarks', 'operator', 'operatorName'],
    defaultFields: ['regNo', 'machine', 'status', 'site'],
  },
  replacements: {
    model: require('../../features/equipment/replacement/replacement.model'),
    searchableFields: ['regNo', 'machine', 'type', 'status', 'time', 'currentOperator', 'currentOperatorId', 'outgoingOperator', 'outgoingOperatorId', 'incomingOperator', 'incomingOperatorId', 'replacedOperator', 'replacedOperatorId', 'shiftName', 'shiftStart', 'shiftEnd'],
    defaultFields: ['regNo', 'machine', 'status', 'time'],
  },
  servicereports: {
    model: require('../../features/equipment/report/report.model'),
    searchableFields: ['regNo', 'machine', 'date', 'serviceType', 'serviceHrs', 'nextServiceHrs', 'location', 'mechanics', 'operatorName', 'remarks', 'description', 'status'],
    defaultFields: ['regNo', 'machine', 'serviceType', 'remarks'],
  },
  explorers: {
    model: require('../../features/explorer/explorer.model'),
    searchableFields: ['headline', 'description', 'videoUrl', 'videoFileName', 'videoMimeType', 'uploadStatus', 'releaseVersion'],
    defaultFields: ['headline', 'releaseVersion', 'uploadStatus'],
  },
  fuels: {
    model: require('../../features/fuel/fuel.model'),
    searchableFields: ['financialAccountNumber', 'financialAccountName', 'customerName', 'customerNumber', 'beneficiaryName', 'beneficiaryNumber', 'stationName', 'licensePlate', 'productName'],
    defaultFields: ['customerName', 'beneficiaryName', 'stationName', 'productName'],
  },
  hireorders: {
    model: require('../../features/hro/hro.model'),
    searchableFields: ['hireOrderRef', 'date', 'complaintId', 'company.vendor', 'company.attention', 'company.designation', 'quoteNo', 'requestText', 'note', 'signatures.accountsDept', 'comments', 'action', 'approvedBy'],
    defaultFields: ['hireOrderRef', 'complaintId', 'company.vendor', 'quoteNo'],
  },
  lpos: {
    model: require('../../features/lpo/lpo.model'),
    searchableFields: ['lpoRef', 'date', 'complaintId', 'workingHrs', 'runningKm', 'quoteNo', 'requestText', 'company.vendor', 'company.attention', 'company.designation', 'description', 'approvedBy', 'comments', 'action'],
    defaultFields: ['lpoRef', 'complaintId', 'company.vendor', 'quoteNo'],
  },
  mechanics: {
    model: require('../../features/mechanic/mechanic.model'),
    searchableFields: ['name', 'type', 'toolkitId', 'toolkitName', 'variantId', 'size', 'color', 'status', 'assignedDate', 'reason', 'email', 'authMail', 'password', 'uniqueCode', 'userType'],
    defaultFields: ['name', 'uniqueCode', 'userType', 'email'],
  },
  notifications: {
    model: require('../../features/notification/notification.model'),
    searchableFields: ['title', 'priority', 'navigateText', 'navigateTo', 'navigteToId', 'sourceId', 'type', 'category', 'approvalPort'],
    defaultFields: ['title', 'category', 'type', 'priority'],
  },
  oauths: {
    model: require('../../features/oauth/oauth.model'),
    searchableFields: ['service', 'encryptedRefreshToken', 'encryptedAccessToken', 'clientId', 'encryptedClientSecret'],
    defaultFields: ['service', 'clientId'],
  },
  operators: {
    model: require('../../features/operator/operator.model'),
    searchableFields: ['name', 'type', 'toolkitId', 'toolkitName', 'variantId', 'size', 'color', 'status', 'assignedDate', 'reason', 'fileName', 'originalName', 'filePath', 'mimeType', 'url', 'token', 'platform', 'name', 'uniqueCode', 'userType', 'qatarId', 'nationality', 'sponsorship', 'workingIn', 'contactNo', 'passportNo', 'licenceType'],
    defaultFields: ['name', 'uniqueCode', 'userType', 'contactNo'],
  },
  otps: {
    model: require('../../features/otp/otp.model'),
    searchableFields: ['email', 'otp'],
    defaultFields: ['email', 'otp'],
  },
  quotations: {
    model: null,
    searchableFields: [],
    defaultFields: [],
  },
  stocks: {
    model: require('../../features/stock/stock.model'),
    searchableFields: ['product', 'serialNumber', 'type', 'description', 'category', 'subCategory', 'status', 'unit', 'location', 'warehouse', 'reason', 'notes', 'equipmentName', 'equipmentNumber', 'mechanicName', 'mechanicEmployeeId'],
    defaultFields: ['product', 'serialNumber', 'location', 'status'],
  },
  toolkits: {
    model: require('../../features/toolkit/toolkit.model'),
    searchableFields: ['action', 'reason', 'updatedBy', 'person', 'personId', 'size', 'color', 'status', 'name', 'type', 'overallStatus'],
    defaultFields: ['name', 'type', 'overallStatus'],
  },
  users: {
    model: require('../../features/user/user.model'),
    searchableFields: ['name', 'email', 'uniqueCode', 'currentPassword', 'password', 'authMail', 'docAuthPasw', 'role', 'userType', 'tag', 'department', 'token', 'platform', 'purpose', 'location', 'userAgent', 'browserInfo', 'signType', 'activationKey', 'deviceId', 'model', 'osVersion'],
    defaultFields: ['name', 'email', 'uniqueCode', 'role'],
  },
};

module.exports = { searchRegistry };
