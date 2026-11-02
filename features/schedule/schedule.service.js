const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const {
  resolveActorByUniqueCode,
  resolveActorsByUniqueCodes,
  searchActorsByName,
} = require('#features/notification/notification.actor.resolver');
const Schedule = require('./schedule.model');
const { serializeSchedule } = require('./schedule.serializer');
const {
  SCHEDULE_DATE_PATTERN,
  SCHEDULE_TIME_PATTERN,
  MAX_SCHEDULE_TITLE_LENGTH,
  MAX_SCHEDULE_REMARKS_LENGTH,
  MAX_ASSIGNEE_NAME_LENGTH,
  SCHEDULE_ASSIGNEE_SEARCH_LIMIT,
} = require('./schedule.constant');

const assertValidDate = (date) => {
  if (!SCHEDULE_DATE_PATTERN.test(String(date || ''))) throw new AppError('Invalid date', HTTP.BAD_REQUEST);
};

const serializeWithAssignees = async (schedules) => {
  const assigneeCodes = [...new Set(schedules.map((schedule) => schedule.assigneeCode).filter(Boolean))];
  const actors = await resolveActorsByUniqueCodes(assigneeCodes);
  const actorByCode = new Map(actors.map((actor) => [actor.uniqueCode, actor]));
  return schedules.map((schedule) => serializeSchedule(schedule, actorByCode));
};

const resolveAssignee = async ({ assigneeCode, assigneeName }) => {
  if (assigneeCode) {
    const actor = await resolveActorByUniqueCode(String(assigneeCode));
    if (!actor) throw new AppError('Assignee not found', HTTP.BAD_REQUEST);
    return { code: actor.uniqueCode, name: actor.name };
  }
  const name = String(assigneeName || '').trim();
  if (name.length > MAX_ASSIGNEE_NAME_LENGTH) throw new AppError('Assignee name is too long', HTTP.BAD_REQUEST);
  return { code: null, name };
};

const listSchedules = async ({ uniqueCode, date }) => {
  assertValidDate(date);
  const schedules = await Schedule.find({
    date,
    $or: [{ createdByCode: uniqueCode }, { assigneeCode: uniqueCode }],
  })
    .sort({ time: 1, _id: 1 })
    .lean();
  return serializeWithAssignees(schedules);
};

const countSchedulesByDate = async ({ uniqueCode, from, to }) => {
  assertValidDate(from);
  assertValidDate(to);
  const groups = await Schedule.aggregate([
    {
      $match: {
        date: { $gte: from, $lte: to },
        $or: [{ createdByCode: uniqueCode }, { assigneeCode: uniqueCode }],
      },
    },
    { $group: { _id: '$date', count: { $sum: 1 } } },
  ]);
  return groups.map((group) => ({ date: group._id, count: group.count }));
};

const createSchedule = async ({ uniqueCode, title, remarks, date, time, assigneeCode, assigneeName }) => {
  const trimmedTitle = String(title || '').trim();
  const trimmedRemarks = String(remarks || '').trim();

  assertValidDate(date);
  if (!trimmedTitle || trimmedTitle.length > MAX_SCHEDULE_TITLE_LENGTH) {
    throw new AppError('Invalid subject', HTTP.BAD_REQUEST);
  }
  if (trimmedRemarks.length > MAX_SCHEDULE_REMARKS_LENGTH) throw new AppError('Remarks are too long', HTTP.BAD_REQUEST);
  if (!SCHEDULE_TIME_PATTERN.test(String(time || ''))) throw new AppError('Invalid time', HTTP.BAD_REQUEST);

  const assignee = await resolveAssignee({ assigneeCode, assigneeName });
  const schedule = await Schedule.create({
    title: trimmedTitle,
    remarks: trimmedRemarks,
    date,
    time,
    assigneeCode: assignee.code,
    assigneeName: assignee.name,
    createdByCode: uniqueCode,
  });

  const [serialized] = await serializeWithAssignees([schedule.toObject()]);
  return serialized;
};

const searchAssignees = async ({ term }) => {
  const trimmedTerm = String(term || '').trim();
  if (!trimmedTerm) return [];
  const actors = await searchActorsByName({
    term: trimmedTerm,
    excludeUniqueCode: '',
    limit: SCHEDULE_ASSIGNEE_SEARCH_LIMIT,
  });
  return actors.map(({ uniqueCode, name, designation, profilePicPath }) => ({
    uniqueCode,
    name,
    designation,
    profilePicPath: profilePicPath || null,
  }));
};

module.exports = { listSchedules, countSchedulesByDate, createSchedule, searchAssignees };