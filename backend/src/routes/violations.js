const express = require('express');
const router = express.Router();
const Violation = require('../models/Violation');
const Session = require('../models/Session');
const { authMiddleware } = require('../middleware/auth');

// Log a violation
router.post('/', authMiddleware, (req, res) => {
  try {
    const { sessionId, type, duration, metadata } = req.body;

    if (!sessionId || !type) {
      return res.status(400).json({
        error: 'sessionId and type are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Verify session exists
    const session = Session.getById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Session is not active',
        code: 'SESSION_NOT_ACTIVE'
      });
    }

    const violation = Violation.create(sessionId, type, duration || 0, metadata || {});
    res.status(201).json(violation);
  } catch (error) {
    console.error('Error logging violation:', error);
    res.status(500).json({
      error: 'Failed to log violation',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get violations for a session
router.get('/:sessionId', authMiddleware, (req, res) => {
  try {
    const session = Session.getById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'NOT_FOUND'
      });
    }

    const violations = Violation.getBySessionId(req.params.sessionId);
    res.json(violations);
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({
      error: 'Failed to fetch violations',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get violation count for a session
router.get('/:sessionId/count', authMiddleware, (req, res) => {
  try {
    const count = Violation.getCountBySessionId(req.params.sessionId);
    res.json({ count });
  } catch (error) {
    console.error('Error counting violations:', error);
    res.status(500).json({
      error: 'Failed to count violations',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get violations by type
router.get('/:sessionId/type/:type', authMiddleware, (req, res) => {
  try {
    const violations = Violation.getByType(req.params.sessionId, req.params.type);
    res.json(violations);
  } catch (error) {
    console.error('Error fetching violations by type:', error);
    res.status(500).json({
      error: 'Failed to fetch violations',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;