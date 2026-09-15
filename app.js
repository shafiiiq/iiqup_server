const express = require('express');
const http = require('http');
require('dotenv').config();

require('./config/db.config');
require('./workers/backup.worker');

const registerMiddlewares = require('./config/middlewares.config');
const registerRoutes = require('./config/routes.config');
const initializeSocket = require('./core/socket/socket.init');
const { notFoundHandler, errorHandler } = require('#middlewares/error.middleware');

const app = express();
const server = http.createServer(app);

app.set('io', initializeSocket(server));

registerMiddlewares(app);
registerRoutes(app);

app.get('/', (req, res) => res.send('Server is running!'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app, server };