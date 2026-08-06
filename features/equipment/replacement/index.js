const replacementModel = require('./replacement.model');
const replacementGmail = require('./replacement.gmail');

module.exports = {
  replacementModel,
  ...replacementGmail,
};
