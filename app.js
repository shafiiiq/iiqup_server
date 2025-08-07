var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var http = require('http');
var socketIo = require('socket.io');
require('dotenv').config();

// auth middle ware to secure 
const { authMiddleware } = require('./utils/jwt');

// Import the cron jobs and middleware
const setupCronJobs = require('./utils/cron-jobs');
const { overtimeCleanupMiddleware } = require('./middleware/cleanup-middleware');
const { istimaraExpiryMiddleware } = require('./middleware/istimara-expiry-middleware');

// Import WebSocket handler
const { setupWebSocket } = require('./utils/websocket');

// Start the cron jobs
const cronJobs = setupCronJobs();
cronJobs.start();

// Import routes
var equipementRouter = require('./routes/equipments');
var serviceReport = require('./routes/service-report');
var userRouter = require('./routes/users');
var serviceHistory = require('./routes/service-history');
var stocksRouter = require('./routes/stocks');
var documentsRouter = require('./routes/documents');
var dashboardRouter = require('./routes/dashboard');
var toolkitsRouter = require('./routes/toolkits');
var mechanicsRouter = require('./routes/mechanic');
var otpRouter = require('./routes/otp');
var teamTracking = require('./routes/team-traking');
var notificationRouter = require('./routes/notification');
var lpoRouter = require('./routes/lpo');
var operatorRouter = require('./routes/operator');
var complaintsRouter = require('./routes/compalints');
var applicationRouter = require('./routes/applications');
var securityRouter = require('./routes/security');
var _0authRouter = require('./routes/0auth');
const { autoBackup } = require('./utils/backup-data');

var app = express();

// Create HTTP server
var server = http.createServer(app);

// Setup Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Configure this properly for production
    methods: ["GET", "POST"]
  }
});

// Setup WebSocket handlers
setupWebSocket(io);

// Make io available globally for sending notifications
global.io = io;

require('./utils/db');
app.use(autoBackup());

// Middleware setup
app.use(logger('dev'));
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '50gb' }));
app.use(express.urlencoded({ extended: true, limit: '50gb' }));
app.use(cookieParser());

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/users', userRouter);
app.use('/otp', otpRouter);
app.use('/equipments', authMiddleware, equipementRouter);
app.use('/service-report', authMiddleware, serviceReport);
app.use('/service-history', authMiddleware, serviceHistory);
app.use('/stocks', authMiddleware, stocksRouter);
app.use('/documents', documentsRouter);
app.use('/dashboard', authMiddleware, dashboardRouter);
app.use('/toolkits', authMiddleware, toolkitsRouter);
app.use('/mechanics', mechanicsRouter);
app.use('/team-tracking', teamTracking);
app.use('/notification', authMiddleware, notificationRouter);
app.use('/lpo', authMiddleware, lpoRouter);
app.use('/operators', operatorRouter);
app.use('/complaints', authMiddleware, complaintsRouter);
app.use('/applications', authMiddleware, applicationRouter);
app.use('/hunter-eye', securityRouter);
app.use('/0auth', _0authRouter);

// Overtime auto deleter after 2 months
app.use(overtimeCleanupMiddleware);

// Export both app and server
module.exports = { app, server };