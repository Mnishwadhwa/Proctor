const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');

class Session {
  static create(userId, examId, metadata = {}) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO sessions (id, user_id, exam_id, status, metadata)
      VALUES (?, ?, ?, 'active', ?)
    `);
    stmt.run(id, userId, examId, JSON.stringify(metadata));
    return this.getById(id);
  }

  static getById(id) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const session = stmt.get(id);
    if (session) {
      session.metadata = JSON.parse(session.metadata || '{}');
    }
    return session;
  }

  static end(id) {
    const stmt = db.prepare(`
      UPDATE sessions
      SET status = 'completed', ended_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
    return this.getById(id);
  }

  static getReport(sessionId) {
    const session = this.getById(sessionId);
    if (!session) return null;

    // Get violations
    const violationsStmt = db.prepare('SELECT * FROM violations WHERE session_id = ?');
    const violations = violationsStmt.all(sessionId).map(v => ({
      ...v,
      metadata: JSON.parse(v.metadata || '{}')
    }));

    // Get screenshots
    const screenshotsStmt = db.prepare('SELECT * FROM screenshots WHERE session_id = ?');
    const screenshots = screenshotsStmt.all(sessionId).map(s => ({
      ...s,
      metadata: JSON.parse(s.metadata || '{}')
    }));

    // Calculate summary
    const summary = {
      totalViolations: violations.length,
      violationsByType: {},
      totalDuration: 0,
      sessionDuration: session.ended_at
        ? new Date(session.ended_at) - new Date(session.started_at)
        : Date.now() - new Date(session.started_at)
    };

    violations.forEach(v => {
      if (!summary.violationsByType[v.type]) {
        summary.violationsByType[v.type] = 0;
      }
      summary.violationsByType[v.type]++;
      summary.totalDuration += v.duration || 0;
    });

    return {
      session,
      violations,
      screenshots,
      summary
    };
  }
}

module.exports = Session;