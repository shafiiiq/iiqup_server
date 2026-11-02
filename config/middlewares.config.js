const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morganLogger = require('morgan');
const cors = require('cors');

const corsOptions = require('./cors.config');
const loggerMiddleware = require('#middlewares/logger.middleware');
const { clientContextMiddleware } = require('#shared/request/request.client.context');

const registerMiddlewares = (app) => {
  app.use(morganLogger('dev'));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(loggerMiddleware);
  app.use(clientContextMiddleware);
};

module.exports = registerMiddlewares;