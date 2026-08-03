const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// ── Middleware ─────────────────────────────────────────────────────────────────
const { authMiddleware } = require('./middlewares/jwt.middleware');

// ── WebSocket ──────────────────────────────────────────────────────────────────
const websocket = require('./socket/socket');
const setupWebSocket = websocket.default.setupWebSocket;

// ── Routes ─────────────────────────────────────────────────────────────────────
const equipmentRouter = require('./features/equipment/equipment.router');
const serviceReportRouter = require('./features/equipment/report/report.router');
const userRouter = require('./features/user/user.router');
const serviceHistoryRouter = require('./features/equipment/history/history.router');
const stocksRouter = require('./features/stock/stock.router');
const documentsRouter = require('./features/document/document.router');
const dashboardRouter = require('./features/dashboard/dashboard.router');
const toolkitsRouter = require('./features/toolkit/toolkit.router');
const mechanicsRouter = require('./features/mechanic/mechanic.router');
const otpRouter = require('./features/otp/otp.router');
const notificationRouter = require('./features/notification/notification.router');
const lpoRouter = require('./features/lpo/lpo.router');
const hireOrderRouter = require('./features/hro/hro.router');
const operatorRouter = require('./features/operator/operator.router');
const complaintsRouter = require('./features/complaint/complaint.router');
const oauthRouter = require('./features/oauth/oauth.router');
const s3Router = require('./features/s3/s3.router');
const fuelsRouter = require('./features/fuel/fuel.router');
const ztechRouter = require('./features/attendance/hardware/ztech.router');
const attendanceRouter = require('./features/attendance/attendance.router');
const backchargeRouter = require('./features/backcharge/backcharge.router');
const chatRouter = require('./features/chat/chat.router');
const explorerRouter = require('./features/explorer/explorer.router');
const webPushRouter = require('./features/notification/webpush/webpush.router');

// ─────────────────────────────────────────────────────────────────────────────
// App Initialisation
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// ── Database connection ────────────────────────────────────────────────────────

require('./config/db/ansarigroup.db');

// ── Background Workers ─────────────────────────────────────────────────────────

require('./config/db/workers/backup.worker'); 


// ── CORS configuration ─────────────────────────────────────────────────────────

const corsOptions = {
  origin: [
    'https://iiqup.vercel.app',
    'https://ansarigroup.online',
    'https://www.ansarigroup.online',
    'http://192.168.100.248:3000',
  ],
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

// ── Socket.IO setup ────────────────────────────────────────────────────────────

const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
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
app.use('/ztech', ztechRouter);
app.use('/users', userRouter);
app.use('/otp', otpRouter);
app.use('/equipments', equipmentRouter);
app.use('/service-report', serviceReportRouter);
app.use('/stocks', stocksRouter);
app.use('/documents', documentsRouter);
app.use('/mechanics', mechanicsRouter);
app.use('/operators', operatorRouter);
app.use('/complaints', complaintsRouter);
app.use('/oauth', oauthRouter);
app.use('/fuels', fuelsRouter);
app.use('/attendance', attendanceRouter);
app.use('/backcharge', backchargeRouter);
app.use('/webpush', webPushRouter);

// ── Protected routes (auth required) ──────────────────────────────────────────
app.use('/service-history', authMiddleware, serviceHistoryRouter);
app.use('/dashboard', dashboardRouter);
app.use('/toolkits', authMiddleware, toolkitsRouter);
app.use('/notification', authMiddleware, notificationRouter);
app.use('/lpo', authMiddleware, lpoRouter);
app.use('/hire-order', authMiddleware, hireOrderRouter);
app.use('/s3', s3Router);
app.use('/chat', authMiddleware, chatRouter);
app.use('/explorer', authMiddleware, explorerRouter);

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File is too large. Please try a smaller file or contact support.',
    });
  }
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong. Please try again.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { app, server };
