const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const userService = require('./staff.service')
const { ROLE_ENV_KEYS } = require('./staff.constant.js')

const addUsers = async (req, res) => {
  try {
    const result = await userService.insertUser(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[staff.controller] addUsers', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const result = await userService.fetchUsers(req.pagination);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[staff.controller] getUsers', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const result = await userService.fetchUserById(req.params.id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[staff.controller] getUserById', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const getUserRoles = (req, res) => {
  const roles = Object.fromEntries(
    ROLE_ENV_KEYS
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]])
  );

  sendSuccess(res, {
    roles,
  });
};

const getTutorials = async (req, res) => {
  try {
    const result = await userService.getTutorialsSeen(req.user.id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[staff.controller] getTutorials', error);
    sendError(res, { success: false, message: error.message });
  }
};

const completeTutorial = async (req, res) => {
  try {
    const { tutorialId } = req.body;
    if (!tutorialId) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'tutorialId is required' });
    }
    const result = await userService.completeTutorial(req.user.id, tutorialId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[staff.controller] completeTutorial', error);
    sendError(res, { success: false, message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'User ID is required' });

    const result = await userService.userUpdate(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[staff.controller] updateUser', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'User ID is required' });

    const result = await userService.userDelete(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[staff.controller] deleteUser', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

module.exports = {
  addUsers,
  getUsers,
  getUserById,
  getUserRoles,
  getTutorials,
  completeTutorial,
  updateUser,
  deleteUser,
};