const mongoose = require('mongoose');

const featureLinkSchema = new mongoose.Schema(
  {
    featureKey: String,
    label: String,
    identifier: String,
    reference: String,
    title: String,
    subtitle: String,
    screenKey: String,
    modelKey: String,
    pdfPath: String,
    pdfVersion: { type: String, default: null },
  },
  { _id: false }
);

module.exports = { featureLinkSchema };