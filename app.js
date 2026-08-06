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
const notFoundHandler = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/errorHandler.middleware');
const requestLogger = require('./shared/logger/request.middleware');

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
const { searchRouter: sharedSearchRouter } = require('./shared/search');
const { uploadRouter } = require('./shared/file-handling');

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
app.use(requestLogger);

// ── Health check ───────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.send('Server is running!'));

// ─────────────────────────────────────────────────────────────────────────────
// Route Mounting
// ─────────────────────────────────────────────────────────────────────────────

// ── Public routes (no auth required) ──────────────────────────────────────────
app.use('/api/v1/ztech', ztechRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/otp', otpRouter);
app.use('/api/v1/equipments', equipmentRouter);
app.use('/api/v1/service-report', serviceReportRouter);
app.use('/api/v1/stocks', stocksRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/mechanics', mechanicsRouter);
app.use('/api/v1/operators', operatorRouter);
app.use('/api/v1/oauth', oauthRouter);
app.use('/api/v1/fuels', fuelsRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/backcharge', backchargeRouter);
app.use('/api/v1/webpush', webPushRouter);

// ── Protected routes (auth required) ──────────────────────────────────────────
app.use('/api/v1/service-history', authMiddleware, serviceHistoryRouter);
app.use('/api/v1/dashboard', authMiddleware,dashboardRouter);
app.use('/api/v1/complaints', authMiddleware,complaintsRouter);
app.use('/api/v1/toolkits', authMiddleware, toolkitsRouter);
app.use('/api/v1/notification', authMiddleware, notificationRouter);
app.use('/api/v1/lpo', authMiddleware, lpoRouter);
app.use('/api/v1/hire-order', authMiddleware, hireOrderRouter);
app.use('/api/v1/s3', s3Router);
app.use('/api/v1/chat', authMiddleware, chatRouter);
app.use('/api/v1/explorer', authMiddleware, explorerRouter);
app.use('/api/v1/search', sharedSearchRouter);
app.use('/api/v1/uploads', authMiddleware, uploadRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { app, server };
