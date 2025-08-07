const mongoose = require('mongoose');
const serviceReportSchema = require('../models/service-report.model');

const ServiceHistorySchema = new mongoose.Schema({
  regNo: {
    type: Number,
    required: true
  },
  date: {
    type: String, // or Date if you prefer actual date object
    required: true
  },
  oil: {
    type: String,
    required: true
  },
  oilFilter: {
    type: String,
    required: true
  },
  fuelFilter: {
    type: String,
    required: true
  },
  acFilter: {
    type: String,
    required: true
  },
  waterSeparator: {
    type: String,
    required: true
  },
  airFilter: {
    type: String,
    required: true
  },
  serviceHrs: {
    type: String,
    required: true
  },
  nextServiceHrs: {
    type: String,
    required: true
  },
  serviceReport:[],
  fullService: {
    type:Boolean
  }
});

module.exports = mongoose.model('ServiceHistory', ServiceHistorySchema);