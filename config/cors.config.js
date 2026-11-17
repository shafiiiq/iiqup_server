const corsOptions = {
  origin: [
    'https://alansariconnect.vercel.app',
    'https://ansarigroup.online',
    'https://www.ansarigroup.online',  
    'https://www.ansarigroup.online',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Client-Type',
    'X-Session-Token',
    'x-signature-device-token'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = corsOptions;