const toReceiptUser = (actor, at = null) => ({
  uniqueCode: actor.uniqueCode,
  name: actor.name,
  designation: actor.designation || '',
  profilePicPath: actor.profilePicPath || '',
  at,
});

const toEntryMap = (entries, recipientSet) => {
  const entryByCode = new Map();
  entries
    .filter((entry) => recipientSet.has(entry.uniqueCode))
    .forEach((entry) => entryByCode.set(entry.uniqueCode, entry));
  return entryByCode;
};

const buildReceiptEntries = ({ recipientCodes, deliveredEntries, readEntries }) => {
  const recipientSet = new Set(recipientCodes);
  const readByCode = toEntryMap(readEntries, recipientSet);
  const deliveredByCode = toEntryMap(deliveredEntries, recipientSet);
  readByCode.forEach((entry, uniqueCode) => {
    if (!deliveredByCode.has(uniqueCode)) deliveredByCode.set(uniqueCode, entry);
  });
  return {
    recipientCount: recipientSet.size,
    delivered: [...deliveredByCode.values()],
    read: [...readByCode.values()],
  };
};

module.exports = { toReceiptUser, buildReceiptEntries };