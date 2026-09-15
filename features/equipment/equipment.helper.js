const logger = require('#shared/logger/logger');

const HIRED_FILTER = {
  HIRED: 'hired',
  OWN: 'own',
};

const buildHiredQuery = (hiredFilter) => {
  if (hiredFilter === HIRED_FILTER.HIRED) return { hired: true };
  if (hiredFilter === HIRED_FILTER.OWN) return { hired: false };
  return {};
};

const buildStatusQuery = (status) => ({
  status: { $regex: new RegExp(`^${status}$`, 'i') },
});

const buildSiteQuery = (site) => ({
  $expr: { $eq: [{ $arrayElemAt: ['$site', -1] }, site] },
});

const buildSearchQuery = (searchTerm, searchField) => {
  if (searchField === 'site') {
    return { site: { $regex: searchTerm, $options: 'i' } };
  }

  if (searchField !== 'all') {
    return { [searchField]: { $regex: searchTerm, $options: 'i' } };
  }

  const orClauses = [
    { machine: { $regex: searchTerm, $options: 'i' } },
    { regNo: { $regex: searchTerm, $options: 'i' } },
    { brand: { $regex: searchTerm, $options: 'i' } },
    { company: { $regex: searchTerm, $options: 'i' } },
    { status: { $regex: searchTerm, $options: 'i' } },
    { site: { $regex: searchTerm, $options: 'i' } },
    { coc: { $regex: searchTerm, $options: 'i' } },
    { 'certificationBody.operatorName': { $regex: searchTerm, $options: 'i' } },
    { 'certificationBody.operatorId': { $regex: searchTerm, $options: 'i' } },
  ];

  if (!isNaN(searchTerm)) {
    orClauses.push({ year: parseInt(searchTerm, 10) });
  }

  return { $or: orClauses };
};

const normaliseCertificationBody = (certificationBody) => {
  if (!certificationBody) return [];

  if (typeof certificationBody === 'string') {
    if (!certificationBody.trim() || certificationBody === 'No Operator') return [];
    return [
      {
        operatorName: certificationBody,
        operatorId: 'Not Assigned',
        assignedAt: new Date(),
      },
    ];
  }

  if (Array.isArray(certificationBody)) {
    return certificationBody.map((item) =>
      typeof item === 'string'
        ? { operatorName: item, operatorId: '', assignedAt: new Date() }
        : item
    );
  }

  return [];
};

const normaliseSite = (site) => {
  if (!site) return [];
  if (typeof site === 'string') return site.trim() ? [site] : [];
  if (Array.isArray(site)) return site;
  return [];
};

const buildOperatorUpdateData = (cleanData) => {
  const updateData = { ...cleanData };
  let newOperatorId = null;

  if (cleanData.operator && cleanData.operatorId) {
    updateData.$push = {
      certificationBody: {
        operatorName: cleanData.operator,
        operatorId: cleanData.operatorId,
        assignedAt: new Date(),
      },
    };
    newOperatorId = cleanData.operatorId;
    delete updateData.operator;
    delete updateData.operatorId;
  } else if (cleanData.operator) {
    logger.warn('Operator provided without operatorId — this is deprecated');
    updateData.$push = {
      certificationBody: {
        operatorName: cleanData.operator,
        operatorId: '',
        assignedAt: new Date(),
      },
    };
    delete updateData.operator;
  }

  return { updateData, newOperatorId };
};

const extractEquipmentChanges = (original, updated, updatedData) => {
  const changes = [];

  if (updatedData.status && original.status !== updatedData.status) {
    changes.push(`status changed from ${original.status} to ${updatedData.status}`);
  }

  if (updatedData.site && JSON.stringify(original.site) !== JSON.stringify(updatedData.site)) {
    const siteText = Array.isArray(updatedData.site)
      ? updatedData.site.join(', ')
      : String(updatedData.site);
    changes.push(`site is: ${siteText}`);
  }

  if (updatedData.hiredFrom && original.hiredFrom !== updatedData.hiredFrom) {
    changes.push(`hired from: ${updatedData.hiredFrom}`);
  }

  const originalCertBody = JSON.stringify(original.certificationBody);
  const updatedCertBody = JSON.stringify(updated.certificationBody);
  if (updated.certificationBody && originalCertBody !== updatedCertBody) {
    const last = updated.certificationBody[updated.certificationBody.length - 1];
    const name = last?.operatorName || String(last);
    if (name && typeof name === 'string') changes.push(`operator is: ${name}`);
  }

  return changes;
};

const getCurrentDateTime = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    time: now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  };
};

module.exports = {
  buildHiredQuery,
  buildStatusQuery,
  buildSiteQuery,
  buildSearchQuery,
  normaliseCertificationBody,
  normaliseSite,
  buildOperatorUpdateData,
  extractEquipmentChanges,
  getCurrentDateTime,
};