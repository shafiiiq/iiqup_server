const corsOptions = {
  origin: [
    'https://iiqup.vercel.app',
    'https://ansarigroup.online',
    'https://www.ansarigroup.online',
    'http://localhost:3000',
    'http://192.168.100.78:3000'
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

module.exports = corsOptions;