const express       = require('express');
const path          = require('path');
const cookieParser  = require('cookie-parser');
const logger        = require('morgan');
const cors          = require('cors');
const http          = require('http');
const socketIo      = require('socket.io');
require('dotenv').config();

// ── Middleware ─────────────────────────────────────────────────────────────────
const { authMiddleware }            = require('./utils/jwt.utils');

// ── WebSocket ──────────────────────────────────────────────────────────────────
const websocket      = require('./sockets/websocket');
const setupWebSocket = websocket.default.setupWebSocket;

// ── Routes ─────────────────────────────────────────────────────────────────────
const equipmentRouter      = require('./routes/equipment.router');
const serviceReportRouter  = require('./routes/report.router');
const userRouter           = require('./routes/user.router');
const serviceHistoryRouter = require('./routes/history.router.');
const stocksRouter         = require('./routes/stock.router');
const documentsRouter      = require('./routes/document.router');
const dashboardRouter      = require('./routes/dashboard.router');
const toolkitsRouter       = require('./routes/toolkit.router');
const mechanicsRouter      = require('./routes/mechanic.router');
const otpRouter            = require('./routes/otp.router');
const notificationRouter   = require('./routes/notification.router');
const lpoRouter            = require('./routes/lpo.router.');
const operatorRouter       = require('./routes/operator.router');
const complaintsRouter     = require('./routes/complaint.router');
const oauthRouter          = require('./routes/oauth.router');
const s3Router             = require('./routes/s3.router');
const fuelsRouter          = require('./routes/fuel.router');
const ztechRouter          = require('./routes/ztech.router');
const attendanceRouter     = require('./routes/attendance.router');
const backchargeRouter     = require('./routes/backcharge.router');
const chatRouter           = require('./routes/chat.router');
const explorerRouter       = require('./routes/explorer.router');

// ─────────────────────────────────────────────────────────────────────────────
// App Initialisation
// ─────────────────────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

// ── Database connection ────────────────────────────────────────────────────────

require('./db/ansarigroup.db');

// ── CORS configuration ─────────────────────────────────────────────────────────

const corsOptions = {
  origin: [
    'https://iiqup.vercel.app',
    'https://ansarigroup.online',
    'https://www.ansarigroup.online',
    'http://192.168.100.53:3000',
    'http://localhost:3000',
  ],
  methods:          ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders:   ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control'],
  credentials:      true,
  optionsSuccessStatus: 200,
};

// ── Socket.IO setup ────────────────────────────────────────────────────────────

const io = socketIo(server, {
  cors:       { origin: '*', methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  allowEIO3:  true,
});

setupWebSocket(io);
global.io = io;

// ── Express middleware stack ───────────────────────────────────────────────────

app.use(logger('dev'));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50gb' }));
app.use(express.urlencoded({ extended: true, limit: '50gb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); 

// ── Health check ───────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.send('Server is running!'));

// ─────────────────────────────────────────────────────────────────────────────
// Route Mounting
// ─────────────────────────────────────────────────────────────────────────────

// ── Public routes (no auth required) ──────────────────────────────────────────
app.use('/ztech',          ztechRouter);
app.use('/users',          userRouter);
app.use('/otp',            otpRouter);
app.use('/equipments',     equipmentRouter);
app.use('/service-report', serviceReportRouter);
app.use('/stocks',         stocksRouter);
app.use('/documents',      documentsRouter);
app.use('/mechanics',      mechanicsRouter);
app.use('/operators',      operatorRouter);
app.use('/complaints',     complaintsRouter);
app.use('/oauth',          oauthRouter);
app.use('/fuels',          fuelsRouter);
app.use('/attendance',     attendanceRouter);
app.use('/backcharge',     backchargeRouter);

// ── Protected routes (auth required) ──────────────────────────────────────────
app.use('/service-history', authMiddleware, serviceHistoryRouter);
app.use('/dashboard',       authMiddleware, dashboardRouter);
app.use('/toolkits',        authMiddleware, toolkitsRouter);
app.use('/notification',    authMiddleware, notificationRouter);
app.use('/lpo',             authMiddleware, lpoRouter);
app.use('/s3',              authMiddleware, s3Router);
app.use('/chat',            authMiddleware, chatRouter);
app.use('/explorer',        authMiddleware, explorerRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { app, server };