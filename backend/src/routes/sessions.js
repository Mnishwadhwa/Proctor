const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const { authMiddleware } = require('../middleware/auth');

// Create a new proctoring session
router.post('/', authMiddleware, (req, res) => {
  try {
    const { userId, examId, metadata } = req.body;

    if (!userId || !examId) {
      return res.status(400).json({
        error: 'userId and examId are required',
        code: 'MISSING_FIELDS'
      });
    }

    const session = Session.create(userId, examId, metadata);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get session by ID
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const session = Session.getById(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'NOT_FOUND'
      });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch session',
      code: 'INTERNAL_ERROR'
    });
  }
});

// End a session and get full report
router.put('/:id/end', authMiddleware, (req, res) => {
  try {
    const session = Session.getById(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'NOT_FOUND'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Session is already ended',
        code: 'SESSION_ENDED'
      });
    }

    const report = Session.end(req.params.id);
    const fullReport = Session.getReport(req.params.id);
    res.json(fullReport);
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      error: 'Failed to end session',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get session report
router.get('/:id/report', authMiddleware, (req, res) => {
  try {
    const report = Session.getReport(req.params.id);

    if (!report) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'NOT_FOUND'
      });
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      error: 'Failed to fetch report',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;