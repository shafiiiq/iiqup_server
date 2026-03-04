// ─────────────────────────────────────────────────────────────────────────────
// Equipment Helpers
// Pure functions — no side effects, no DB calls, no external dependencies.
// ─────────────────────────────────────────────────────────────────────────────

const { HIRED_FILTER, INVALID_OPERATOR_VALUES } = require('../constants/equipment.constants');

// ─────────────────────────────────────────────────────────────────────────────
// Query Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a hired/own filter clause for equipment queries.
 * @param {string|null} hiredFilter - 'hired' | 'own' | null
 * @returns {object}
 */
const buildHiredQuery = (hiredFilter) => {
  if (hiredFilter === HIRED_FILTER.HIRED) return { hired: true  };
  if (hiredFilter === HIRED_FILTER.OWN)   return { hired: false };
  return {};
};

/**
 * Builds a case-insensitive exact-match status query.
 * @param {string} status
 * @returns {object}
 */
const buildStatusQuery = (status) => ({
  status: { $regex: new RegExp(`^${status}$`, 'i') }
});

/**
 * Builds a date range query for mobilization/replacement records.
 * @param {Date} startDateTime
 * @param {Date} endDateTime
 * @returns {object}
 */
const buildDateRangeQuery = (startDateTime, endDateTime) => ({
  date: { $gte: startDateTime, $lte: endDateTime }
});

/**
 * Builds the search query for equipment text search across multiple fields.
 * @param {string}      searchTerm
 * @param {string}      searchField - 'all' | 'site' | specific field name
 * @returns {object}
 */
const buildSearchQuery = (searchTerm, searchField) => {
  if (searchField === 'site') {
    return { site: { $regex: searchTerm, $options: 'i' } };
  }

  if (searchField !== 'all') {
    return { [searchField]: { $regex: searchTerm, $options: 'i' } };
  }

  const orClauses = [
    { machine:                          { $regex: searchTerm, $options: 'i' } },
    { regNo:                            { $regex: searchTerm, $options: 'i' } },
    { brand:                            { $regex: searchTerm, $options: 'i' } },
    { company:                          { $regex: searchTerm, $options: 'i' } },
    { status:                           { $regex: searchTerm, $options: 'i' } },
    { site:                             { $regex: searchTerm, $options: 'i' } },
    { coc:                              { $regex: searchTerm, $options: 'i' } },
    { 'certificationBody.operatorName': { $regex: searchTerm, $options: 'i' } },
    { 'certificationBody.operatorId':   { $regex: searchTerm, $options: 'i' } }
  ];

  if (!isNaN(searchTerm)) {
    orClauses.push({ year: parseInt(searchTerm) });
  }

  return { $or: orClauses };
};

/**
 * Resolves the date range for mobilization/replacement filter types.
 * Supports: daily, yesterday, weekly, monthly, yearly, months, single, custom.
 * @param {string}      filterType
 * @param {string|null} startDate  - DD-MM-YYYY
 * @param {string|null} endDate    - DD-MM-YYYY
 * @param {number|null} months
 * @returns {{ startDateTime: Date, endDateTime: Date }}
 */
const resolveDateRange = (filterType, startDate = null, endDate = null, months = null) => {
  const startOfDay = (d) => { d.setHours(0,  0,  0,   0); return d; };
  const endOfDay   = (d) => { d.setHours(23, 59, 59, 999); return d; };
  const today      = ()  => new Date();

  const parseDMY = (str) => {
    const [d, m, y] = str.split('-');
    return new Date(y, m - 1, d);
  };

  switch (filterType) {
    case 'daily':
      return { startDateTime: startOfDay(today()), endDateTime: endOfDay(today()) };

    case 'yesterday': {
      const yd = today();
      yd.setDate(yd.getDate() - 1);
      return { startDateTime: startOfDay(new Date(yd)), endDateTime: endOfDay(new Date(yd)) };
    }

    case 'weekly': {
      const s = today();
      s.setDate(s.getDate() - 7);
      return { startDateTime: startOfDay(s), endDateTime: endOfDay(today()) };
    }

    case 'monthly': {
      const s = today();
      s.setDate(s.getDate() - 30);
      return { startDateTime: startOfDay(s), endDateTime: endOfDay(today()) };
    }

    case 'yearly': {
      const s = today();
      s.setDate(s.getDate() - 365);
      return { startDateTime: startOfDay(s), endDateTime: endOfDay(today()) };
    }

    case 'months': {
      const m = parseInt(months) || 1;
      const s = today();
      s.setMonth(s.getMonth() - m);
      return { startDateTime: startOfDay(s), endDateTime: endOfDay(today()) };
    }

    case 'single': {
      if (!startDate) throw new Error('Date is required for single date filter');
      const d = parseDMY(startDate);
      return { startDateTime: startOfDay(new Date(d)), endDateTime: endOfDay(new Date(d)) };
    }

    case 'custom': {
      if (!startDate || !endDate) throw new Error('Start date and end date are required for custom range');
      return {
        startDateTime: startOfDay(parseDMY(startDate)),
        endDateTime:   endOfDay(parseDMY(endDate))
      };
    }

    default: {
      const s = today();
      s.setDate(s.getDate() - 30);
      return { startDateTime: startOfDay(s), endDateTime: endOfDay(today()) };
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Transformers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalises an image path by stripping the leading `public` segment
 * and converting backslashes to forward slashes.
 * @param {string} rawPath
 * @returns {string}  URL-ready path starting with /
 */
const normaliseImagePath = (rawPath) => {
  let path = rawPath;

  if      (path.startsWith('public/'))   path = path.substring(7);
  else if (path.startsWith('/public/'))  path = path.substring(8);
  else if (path.startsWith('public\\'))  path = path.substring(7);
  else if (path.startsWith('\\public\\')) path = path.substring(8);

  return `/${path.replace(/\\/g, '/')}`;
};

/**
 * Maps a raw image document array into url-enriched image objects.
 * @param {object[]} images
 * @returns {object[]}
 */
const normaliseImages = (images = []) =>
  images.map(image => ({ ...image, url: normaliseImagePath(image.path) }));

/**
 * Coerces certificationBody into the canonical array-of-objects format.
 * Handles: undefined → [], string → object, array of strings → array of objects.
 * @param {*} certificationBody
 * @returns {object[]}
 */
const normaliseCertificationBody = (certificationBody) => {
  if (!certificationBody) return [];

  if (typeof certificationBody === 'string') {
    if (!certificationBody.trim() || certificationBody === 'No Operator') return [];
    return [{ operatorName: certificationBody, operatorId: 'Not Assigned', assignedAt: new Date() }];
  }

  if (Array.isArray(certificationBody)) {
    return certificationBody.map(item =>
      typeof item === 'string'
        ? { operatorName: item, operatorId: '', assignedAt: new Date() }
        : item
    );
  }

  return [];
};

/**
 * Coerces site into a clean string array.
 * @param {*} site
 * @returns {string[]}
 */
const normaliseSite = (site) => {
  if (!site) return [];
  if (typeof site === 'string') return site.trim() ? [site] : [];
  if (Array.isArray(site))     return site;
  return [];
};

/**
 * Builds the $push / $set update operation for adding an operator during equipment update.
 * Returns the update object and the resolved new operator ID (or null).
 * @param {object} cleanData  - updatedData minus protected fields
 * @returns {{ updateData: object, newOperatorId: string|null }}
 */
const buildOperatorUpdateData = (cleanData) => {
  const updateData     = { ...cleanData };
  let   newOperatorId  = null;

  if (cleanData.operator && cleanData.operatorId) {
    updateData.$push = {
      certificationBody: {
        operatorName: cleanData.operator,
        operatorId:   cleanData.operatorId,
        assignedAt:   new Date()
      }
    };
    newOperatorId = cleanData.operatorId;
    delete updateData.operator;
    delete updateData.operatorId;

  } else if (cleanData.operator) {
    console.warn('Operator provided without operatorId - this is deprecated');
    updateData.$push = {
      certificationBody: {
        operatorName: cleanData.operator,
        operatorId:   '',
        assignedAt:   new Date()
      }
    };
    delete updateData.operator;
  }

  return { updateData, newOperatorId };
};

/**
 * Extracts a human-readable change summary between the original and updated equipment.
 * @param {object} original
 * @param {object} updated     - merged result from DB
 * @param {object} updatedData - raw update payload
 * @returns {string[]}
 */
const extractEquipmentChanges = (original, updated, updatedData) => {
  const changes = [];

  if (updatedData.status && original.status !== updatedData.status) {
    changes.push(`status changed from ${original.status} to ${updatedData.status}`);
  }

  if (updatedData.site && JSON.stringify(original.site) !== JSON.stringify(updatedData.site)) {
    const siteText = Array.isArray(updatedData.site) ? updatedData.site.join(', ') : String(updatedData.site);
    changes.push(`site is: ${siteText}`);
  }

  if (updatedData.hiredFrom && original.hiredFrom !== updatedData.hiredFrom) {
    changes.push(`hired from: ${updatedData.hiredFrom}`);
  }

  if (
    updated.certificationBody &&
    JSON.stringify(original.certificationBody) !== JSON.stringify(updated.certificationBody)
  ) {
    const last = updated.certificationBody[updated.certificationBody.length - 1];
    const name = last?.operatorName || String(last);
    if (name && typeof name === 'string') changes.push(`operator is: ${name}`);
  }

  return changes;
};

// ─────────────────────────────────────────────────────────────────────────────
// Misc Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns whether a given operatorId value is considered valid for DB lookups.
 * @param {*} operatorId
 * @returns {boolean}
 */
const isValidOperatorId = (operatorId) => !INVALID_OPERATOR_VALUES.has(operatorId);

/**
 * Returns the current month, year, and formatted time string.
 * @returns {{ month: number, year: number, time: string }}
 */
const getCurrentDateTime = () => {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const time  = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { month, year, time };
};

/**
 * Calculates pagination metadata.
 * @param {number} totalCount
 * @param {number} page
 * @param {number} limit
 * @returns {{ totalPages: number, hasNextPage: boolean }}
 */
const getPaginationMeta = (totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);
  return { totalPages, hasNextPage: page < totalPages };
};

module.exports = {
  // Query builders
  buildHiredQuery,
  buildStatusQuery,
  buildDateRangeQuery,
  buildSearchQuery,
  resolveDateRange,
  // Data transformers
  normaliseImagePath,
  normaliseImages,
  normaliseCertificationBody,
  normaliseSite,
  buildOperatorUpdateData,
  extractEquipmentChanges,
  // Misc
  isValidOperatorId,
  getCurrentDateTime,
  getPaginationMeta
};