const { DOCUMENT_ACTOR_ROLE } = require('./document.activity.constant');

const WITHOUT_TIMESTAMP_UPDATE = { timestamps: false };

const toUniqueCodes = (codes = []) => [...new Set(codes.filter(Boolean).map(String))];

const buildDocumentActors = ({ ownerCode, participantCodes }) => {
  const addedAt = new Date();
  const participants = toUniqueCodes(participantCodes).filter((code) => code !== ownerCode);
  return [
    { uniqueCode: ownerCode, role: DOCUMENT_ACTOR_ROLE.OWNER, addedAt },
    ...participants.map((uniqueCode) => ({ uniqueCode, role: DOCUMENT_ACTOR_ROLE.PARTICIPANT, addedAt })),
  ];
};

const ensureDocumentActors = async ({ definition, document, codes }) => {
  const knownCodes = (document.actors || []).map((actor) => actor.uniqueCode);
  const missingCodes = toUniqueCodes(codes).filter((code) => !knownCodes.includes(code));
  if (missingCodes.length === 0) return knownCodes;

  const additions = missingCodes.map((uniqueCode) => ({
    uniqueCode,
    role: DOCUMENT_ACTOR_ROLE.PARTICIPANT,
    addedAt: new Date(),
  }));
  await definition.model.updateOne(
    { _id: document._id },
    { $push: { actors: { $each: additions } } },
    WITHOUT_TIMESTAMP_UPDATE
  );
  return [...knownCodes, ...missingCodes];
};

module.exports = { buildDocumentActors, ensureDocumentActors };