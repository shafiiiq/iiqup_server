const User = require('#features/user/staff/staff.model');
const Operator = require('#features/user/operator/operator.model');
const Mechanic = require('#features/user/mechanic/mechanic.model');

const ACTOR_SOURCES = [
  { actorModel: 'User', Model: User },
  { actorModel: 'Operator', Model: Operator },
  { actorModel: 'Mechanic', Model: Mechanic },
];

const ACTOR_PROJECTION = 'uniqueCode name designation profilePic';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildActor = (actorModel, document) => ({
  model: actorModel,
  id: document._id,
  uniqueCode: document.uniqueCode,
  name: document.name || '',
  designation: document.designation || '',
  profilePicPath: document.profilePic?.filePath || '',
});

const resolveActorByUniqueCode = async (uniqueCode) => {
  for (const { actorModel, Model } of ACTOR_SOURCES) {
    const document = await Model.findOne({ uniqueCode }).select(ACTOR_PROJECTION).lean();
    if (document) return buildActor(actorModel, document);
  }
  return null;
};

const resolveActorsByUniqueCodes = async (uniqueCodes) => {
  if (!uniqueCodes.length) return [];
  const groups = await Promise.all(
    ACTOR_SOURCES.map(async ({ actorModel, Model }) => {
      const documents = await Model.find({ uniqueCode: { $in: uniqueCodes } }).select(ACTOR_PROJECTION).lean();
      return documents.map((document) => buildActor(actorModel, document));
    })
  );
  return groups.flat();
};

const searchActorsByName = async ({ term, excludeUniqueCode, limit }) => {
  const nameMatch = { name: { $regex: escapeRegex(term), $options: 'i' }, uniqueCode: { $ne: excludeUniqueCode } };
  const groups = await Promise.all(
    ACTOR_SOURCES.map(async ({ actorModel, Model }) => {
      const documents = await Model.find(nameMatch).select(ACTOR_PROJECTION).limit(limit).lean();
      return documents.map((document) => buildActor(actorModel, document));
    })
  );
  return groups.flat().slice(0, limit);
};

module.exports = { resolveActorByUniqueCode, resolveActorsByUniqueCodes, searchActorsByName };