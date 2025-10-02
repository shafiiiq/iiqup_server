const mongoose = require('mongoose');

let devDB = null;

const connectDevDB = async () => {
  try {
    if (devDB) {
      return devDB;
    }

    devDB = mongoose.createConnection(process.env.DEV_MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    devDB.on('connected', () => {
      console.log('Dev MongoDB connected successfully');
    });

    devDB.on('error', (err) => {
      console.error('Dev MongoDB connection error:', err);
    });

    devDB.on('disconnected', () => {
      console.log('Dev MongoDB disconnected');
    });

    return devDB;
  } catch (error) {
    console.error('Dev MongoDB connection error:', error);
    throw error;
  }
};

const getDevDB = () => {
  if (!devDB) {
    throw new Error('Dev database connection not established. Call connectDevDB first.');
  }
  return devDB;
};

module.exports = { connectDevDB, getDevDB };