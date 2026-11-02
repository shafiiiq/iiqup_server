const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const Notification = require('./notification.model');
const { resolveActorsByUniqueCodes } = require('./notification.actor.resolver');
const {
  CALENDAR_TIMEZONE,
  CALENDAR_UTC_OFFSET_HOURS,
  CALENDAR_DAY_ACTOR_LIMIT,
} = require('./notification.constant');

const MIN_CALENDAR_YEAR = 2000;
const MAX_CALENDAR_YEAR = 2100;

const assertValidMonth = (year, month) => {
  const isValidYear = Number.isInteger(year) && year >= MIN_CALENDAR_YEAR && year <= MAX_CALENDAR_YEAR;
  const isValidMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  if (!isValidYear || !isValidMonth) throw new AppError('Invalid year or month', HTTP.BAD_REQUEST);
};

const resolveMonthRange = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1, -CALENDAR_UTC_OFFSET_HOURS)),
  end: new Date(Date.UTC(year, month, 1, -CALENDAR_UTC_OFFSET_HOURS)),
});

const toCalendarActor = (actor) => ({
  uniqueCode: actor.uniqueCode,
  name: actor.name,
  profilePicPath: actor.profilePicPath || null,
});

const listMonthActivity = async ({ uniqueCode, year, month }) => {
  assertValidMonth(year, month);
  const { start, end } = resolveMonthRange(year, month);

  const days = await Notification.aggregate([
    {
      $match: {
        audience: uniqueCode,
        createdAt: { $gte: start, $lt: end },
        'actor.uniqueCode': { $ne: null },
      },
    },
    {
      $group: {
        _id: { $dayOfMonth: { date: '$createdAt', timezone: CALENDAR_TIMEZONE } },
        actorCodes: { $addToSet: '$actor.uniqueCode' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const allCodes = [...new Set(days.flatMap((day) => day.actorCodes.slice(0, CALENDAR_DAY_ACTOR_LIMIT)))];
  const actors = await resolveActorsByUniqueCodes(allCodes);
  const actorByCode = new Map(actors.map((actor) => [actor.uniqueCode, actor]));

  return days.map((day) => ({
    day: day._id,
    actorCount: day.actorCodes.length,
    actors: day.actorCodes
      .slice(0, CALENDAR_DAY_ACTOR_LIMIT)
      .map((code) => actorByCode.get(code))
      .filter(Boolean)
      .map(toCalendarActor),
  }));
};

module.exports = { listMonthActivity };