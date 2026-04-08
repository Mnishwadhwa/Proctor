const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initializeDatabase } = require('./utils/db');

// Import routes
const sessionsRouter = require('./routes/sessions');
const violationsRouter = require('./routes/violations');
const screenshotsRouter = require('./routes/screenshots');
const plagiarismRouter = require('./routes/plagiarism');

// Create Express app
const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), config.uploadDir)));

// API routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/violations', violationsRouter);
app.use('/api/screenshots', screenshotsRouter);
app.use('/api/plagiarism', plagiarismRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum size is 10MB.',
      code: 'FILE_TOO_LARGE'
    });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: err.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════╗
║       Proctor Backend Server               ║
║       Running on port ${config.port}                    ║
║       Environment: ${config.nodeEnv.padEnd(20)}║
╚════════════════════════════════════════════╝

API Endpoints:
  POST   /api/sessions              - Create new session
  GET    /api/sessions/:id          - Get session details
  PUT    /api/sessions/:id/end      - End session
  GET    /api/sessions/:id/report   - Get session report

  POST   /api/violations            - Log violation
  GET   /api/violations/:sessionId  - Get violations

  POST   /api/screenshots           - Upload screenshot
  GET   /api/screenshots/:sessionId - Get screenshots

  POST   /api/plagiarism/check      - Check for plagiarism
  GET   /api/plagiarism/report/:id  - Get plagiarism report

  GET    /api/health                - Health check
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;