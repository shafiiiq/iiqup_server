const { resolveActorsByUniqueCodes } = require('#features/notification/notification.actor.resolver');

const USER_TYPE_BY_MODEL = { User: 'staff', Operator: 'operator', Mechanic: 'mechanic' };

const resolveParticipants = async (references, { adminCodes = [] } = {}) => {
  const uniqueCodes = [...new Set(references.map((reference) => reference?.uniqueCode).filter(Boolean))];
  const actors = await resolveActorsByUniqueCodes(uniqueCodes);
  const actorByCode = new Map(actors.map((actor) => [actor.uniqueCode, actor]));

  return uniqueCodes
    .filter((uniqueCode) => actorByCode.has(uniqueCode))
    .map((uniqueCode) => {
      const actor = actorByCode.get(uniqueCode);
      return {
        userId: actor.id,
        userType: USER_TYPE_BY_MODEL[actor.model],
        uniqueCode,
        name: actor.name,
        isAdmin: adminCodes.includes(uniqueCode),
      };
    });
};

module.exports = { resolveParticipants };