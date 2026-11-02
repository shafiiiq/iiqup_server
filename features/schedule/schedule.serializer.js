const serializeSchedule = (schedule, actorByCode) => {
  const actor = schedule.assigneeCode ? actorByCode.get(schedule.assigneeCode) : null;
  const assigneeName = actor?.name || schedule.assigneeName;

  return {
    id: String(schedule._id),
    title: schedule.title,
    remarks: schedule.remarks || '',
    date: schedule.date,
    time: schedule.time,
    assignee: assigneeName
      ? {
          uniqueCode: schedule.assigneeCode || null,
          name: assigneeName,
          profilePicPath: actor?.profilePicPath || null,
        }
      : null,
  };
};

module.exports = { serializeSchedule };