require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  apiKey: process.env.API_KEY || 'dev-api-key',
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadDir: 'uploads',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  }
};