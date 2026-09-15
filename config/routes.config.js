const { authMiddleware } = require('#middlewares/jwt.middleware');

const ztechRouter = require('#features/attendance/hardware/ztech.router');
const staffRouter = require('#features/user/staff/staff.router');
const otpRouter = require('#features/otp/otp.router');
const equipmentRouter = require('#features/equipment/equipment.router');
const reportRouter = require('#features/equipment/report/report.router');
const partsRouter = require('#features/stock/parts/parts.router');
const documentRouter = require('#features/document/document.router');
const mechanicRouter = require('#features/user/mechanic/mechanic.router');
const operatorRouter = require('#features/user/operator/operator.router');
const authNRouter = require('#core/authN/authN.router');
const authZRouter = require('#core/authZ/authZ.router');
const fuelRouter = require('#features/fuel/fuel.router');
const attendanceRouter = require('#features/attendance/attendance.router');
const backchargeRouter = require('#features/backcharge/backcharge.router');
const webPushRouter = require('#core/notification/webpush/webpush.router');

const historyRouter = require('#features/equipment/history/history.router');
const dashboardRouter = require('#features/dashboard/dashboard.router');
const complaintRouter = require('#features/complaint/complaint.router');
const toolkitRouter = require('#features/stock/toolkit/toolkit.router');
const notificationRouter = require('#core/notification/notification.router');
const purchaseOrderRouter = require('#features/order/purchase/purchase.router');
const hireOrderRouter = require('#features/order/hire/hire.router');
const quotationRouter = require('#features/quotation/quotation.router');
const chatRouter = require('#features/chat/chat.router');
const explorerRouter = require('#features/explorer/explorer.router');
const uploadRouter = require('#core/upload/upload.router');
const s3Router = require('#core/s3/s3.router');
const searchRouter = require('#core/search/search.router');
const pdfRouter = require('#core/pdf/pdf.router');

const publicRoutes = [
  { path: '/api/v1/ztech', router: ztechRouter },
  { path: '/api/v1/users/staff', router: staffRouter },
  { path: '/api/v1/otp', router: otpRouter },
  { path: '/api/v1/equipments', router: equipmentRouter },
  { path: '/api/v1/maintenance/report', router: reportRouter },
  { path: '/api/v1/stocks', router: partsRouter },
  { path: '/api/v1/documents', router: documentRouter },
  { path: '/api/v1/users/mechanics', router: mechanicRouter },
  { path: '/api/v1/users/operators', router: operatorRouter },
  { path: '/api/v1/authn', router: authNRouter },
  { path: '/api/v1/fuels', router: fuelRouter },
  { path: '/api/v1/attendance', router: attendanceRouter },
  { path: '/api/v1/backcharge', router: backchargeRouter },
  { path: '/api/v1/webpush', router: webPushRouter },
];

const privateRoutes = [
  { path: '/api/v1/maintenance/history', router: historyRouter },
  { path: '/api/v1/dashboard', router: dashboardRouter },
  { path: '/api/v1/complaints', router: complaintRouter },
  { path: '/api/v1/toolkits', router: toolkitRouter },
  { path: '/api/v1/notification', router: notificationRouter },
  { path: '/api/v1/order/purchase', router: purchaseOrderRouter },
  { path: '/api/v1/order/hire', router: hireOrderRouter },
  { path: '/api/v1/quotation', router: quotationRouter },
  { path: '/api/v1/chat', router: chatRouter },
  { path: '/api/v1/explorer', router: explorerRouter },
  { path: '/api/v1/uploads', router: uploadRouter },
  { path: '/api/v1/s3', router: s3Router },
  { path: '/api/v1/search', router: searchRouter },
  { path: '/api/v1/authz', router: authZRouter },
  { path: '/api/v1/pdf', router: pdfRouter },
];

const registerRoutes = (app) => {
  publicRoutes.forEach(({ path, router }) => app.use(path, router));
  privateRoutes.forEach(({ path, router }) =>
    app.use(path, authMiddleware, router)
  );
};

module.exports = registerRoutes;
