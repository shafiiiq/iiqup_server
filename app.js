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
const { autoBackup } = require('./utils/backup-data');

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
var notificationRouter = require('./routes/notification');
var lpoRouter = require('./routes/lpo');
var operatorRouter = require('./routes/operator');
var complaintsRouter = require('./routes/compalints');
var applicationRouter = require('./routes/applications');
var securityRouter = require('./routes/security');
var _0authRouter = require('./routes/0auth');
var s3Config = require('./routes/s3Config');

var app = express();

// Create HTTP server
var server = http.createServer(app);

// CORS configuration for Express
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (React Native app)
    if (!origin) return callback(null, true);

    // whitelist of allowed domains for web
    const whitelist = [
      'https://iiqup.netlify.app',
      'https://ansarigroup.online',
      'https://www.ansarigroup.online',
      "http://localhost:3000"
    ];

    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true); // allow
    } else {
      callback(new Error('Not allowed by CORS')); // block
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Socket.IO CORS (same logic)
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const whitelist = [
        'https://iiqup.netlify.app',
        'https://ansarigroup.online',
        'https://www.ansarigroup.online',
      ];
      if (whitelist.indexOf(origin) !== -1) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Setup WebSocket handlers
setupWebSocket(io);

// Make io available globally for sending notifications
global.io = io;

require('./utils/db');
app.use(autoBackup());

// Middleware setup
app.use(logger('dev'));

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight requests

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
app.use('/service-report', serviceReport);
app.use('/service-history', authMiddleware, serviceHistory);
app.use('/stocks', stocksRouter);
app.use('/documents', documentsRouter);
app.use('/dashboard', authMiddleware, dashboardRouter);
app.use('/toolkits', authMiddleware, toolkitsRouter);
app.use('/mechanics', mechanicsRouter);
app.use('/notification', authMiddleware, notificationRouter);
app.use('/lpo', authMiddleware, lpoRouter);
app.use('/operators', operatorRouter);
app.use('/complaints', complaintsRouter);
app.use('/applications', authMiddleware, applicationRouter);
app.use('/hunter-eye', securityRouter);
app.use('/0auth', _0authRouter);
app.use('/s3Config', s3Config);

// Overtime auto deleter after 2 months
app.use(overtimeCleanupMiddleware);

// Export both app and server
module.exports = { app, server };