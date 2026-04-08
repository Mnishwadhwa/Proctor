const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Session = require('../models/Session');
const { authMiddleware } = require('../middleware/auth');

// Check text for plagiarism
router.post('/check', authMiddleware, (req, res) => {
  try {
    const { sessionId, userId, examId, content } = req.body;

    if (!sessionId || !userId || !examId || !content) {
      return res.status(400).json({
        error: 'sessionId, userId, examId, and content are required',
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

    // Store the submission
    const submission = Submission.create(sessionId, userId, examId, content);

    // Check for similar submissions
    const result = Submission.findSimilar(examId, content, userId);

    // Update similarity score
    if (result.similarityScore > 0) {
      Submission.updateSimilarityScore(submission.id, result.similarityScore);
    }

    res.json({
      submissionId: submission.id,
      contentHash: submission.content_hash,
      similarityScore: result.similarityScore,
      exactMatches: result.exactMatches,
      matches: result.matches,
      isPlagiarized: result.similarityScore > 0.7 || result.exactMatches > 0
    });
  } catch (error) {
    console.error('Error checking plagiarism:', error);
    res.status(500).json({
      error: 'Failed to check plagiarism',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get plagiarism report for a submission
router.get('/report/:id', authMiddleware, (req, res) => {
  try {
    const submission = Submission.getById(req.params.id);
    if (!submission) {
      return res.status(404).json({
        error: 'Submission not found',
        code: 'NOT_FOUND'
      });
    }

    // Re-run similarity check to get fresh results
    const result = Submission.findSimilar(
      submission.exam_id,
      submission.content,
      submission.user_id
    );

    res.json({
      submission: {
        id: submission.id,
        sessionId: submission.session_id,
        userId: submission.user_id,
        examId: submission.exam_id,
        submittedAt: submission.submitted_at,
        similarityScore: submission.similarity_score
      },
      analysis: result
    });
  } catch (error) {
    console.error('Error fetching plagiarism report:', error);
    res.status(500).json({
      error: 'Failed to fetch plagiarism report',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get all submissions for an exam
router.get('/submissions/:examId', authMiddleware, (req, res) => {
  try {
    const { db } = require('../utils/db');
    const stmt = db.prepare(`
      SELECT id, session_id, user_id, exam_id, submitted_at, similarity_score
      FROM submissions
      WHERE exam_id = ?
      ORDER BY submitted_at DESC
    `);
    const submissions = stmt.all(req.params.examId);
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      error: 'Failed to fetch submissions',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;