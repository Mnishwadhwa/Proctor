const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Screenshot = require('../models/Screenshot');
const Session = require('../models/Session');
const { authMiddleware } = require('../middleware/auth');
const config = require('../config');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), config.uploadDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${req.body.sessionId}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, and WebP are allowed.'));
    }
  }
});

// Upload a screenshot
router.post('/', authMiddleware, upload.single('screenshot'), (req, res) => {
  try {
    const { sessionId, type, metadata } = req.body;

    if (!sessionId || !req.file) {
      return res.status(400).json({
        error: 'sessionId and screenshot file are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Verify session exists
    const session = Session.getById(sessionId);
    if (!session) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    if (session.status !== 'active') {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Session is not active',
        code: 'SESSION_NOT_ACTIVE'
      });
    }

    const screenshot = Screenshot.create(
      sessionId,
      type || 'webcam',
      req.file.path,
      metadata ? JSON.parse(metadata) : {}
    );

    res.status(201).json({
      ...screenshot,
      url: `/api/screenshots/file/${screenshot.id}`
    });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: 'Failed to upload screenshot',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get screenshots for a session
router.get('/:sessionId', authMiddleware, (req, res) => {
  try {
    const session = Session.getById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'NOT_FOUND'
      });
    }

    const screenshots = Screenshot.getBySessionId(req.params.sessionId);
    res.json(screenshots.map(s => ({
      ...s,
      url: `/api/screenshots/file/${s.id}`
    })));
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    res.status(500).json({
      error: 'Failed to fetch screenshots',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get screenshots by type
router.get('/:sessionId/type/:type', authMiddleware, (req, res) => {
  try {
    const screenshots = Screenshot.getByType(req.params.sessionId, req.params.type);
    res.json(screenshots.map(s => ({
      ...s,
      url: `/api/screenshots/file/${s.id}`
    })));
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    res.status(500).json({
      error: 'Failed to fetch screenshots',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Serve screenshot file
router.get('/file/:id', authMiddleware, (req, res) => {
  try {
    const screenshot = Screenshot.getById(req.params.id);
    if (!screenshot) {
      return res.status(404).json({
        error: 'Screenshot not found',
        code: 'NOT_FOUND'
      });
    }

    if (!fs.existsSync(screenshot.file_path)) {
      return res.status(404).json({
        error: 'Screenshot file not found',
        code: 'FILE_NOT_FOUND'
      });
    }

    res.sendFile(path.resolve(screenshot.file_path));
  } catch (error) {
    console.error('Error serving screenshot:', error);
    res.status(500).json({
      error: 'Failed to serve screenshot',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;