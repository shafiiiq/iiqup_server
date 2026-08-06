const mobilizationModel = require('./mobilizations.model');
const mobilizationGmail = require('./mobilization.gmail');

module.exports = {
  mobilizationModel,
  ...mobilizationGmail,
};
