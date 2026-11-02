const HTTP = require('#shared/response/response.status');
const { handleScheduleRoute } = require('./schedule.route.handler');
const scheduleService = require('./schedule.service');

const listSchedules = handleScheduleRoute('listSchedules', async (req) => ({
  status: HTTP.OK,
  message: 'Schedules retrieved',
  data: await scheduleService.listSchedules({ uniqueCode: req.user.uniqueCode, date: req.query.date }),
}));

const countSchedules = handleScheduleRoute('countSchedules', async (req) => ({
  status: HTTP.OK,
  message: 'Schedule counts retrieved',
  data: await scheduleService.countSchedulesByDate({
    uniqueCode: req.user.uniqueCode,
    from: req.query.from,
    to: req.query.to,
  }),
}));

const createSchedule = handleScheduleRoute('createSchedule', async (req) => ({
  status: HTTP.CREATED,
  message: 'Schedule created',
  data: await scheduleService.createSchedule({
    uniqueCode: req.user.uniqueCode,
    title: req.body.title,
    remarks: req.body.remarks,
    date: req.body.date,
    time: req.body.time,
    assigneeCode: req.body.assigneeCode,
    assigneeName: req.body.assigneeName,
  }),
}));

const searchAssignees = handleScheduleRoute('searchAssignees', async (req) => ({
  status: HTTP.OK,
  message: 'Assignees retrieved',
  data: await scheduleService.searchAssignees({ term: req.query.q }),
}));

module.exports = { listSchedules, countSchedules, createSchedule, searchAssignees };