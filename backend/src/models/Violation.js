const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');

class Violation {
  static create(sessionId, type, duration = 0, metadata = {}) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO violations (id, session_id, type, duration, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, sessionId, type, duration, JSON.stringify(metadata));
    return this.getById(id);
  }

  static getById(id) {
    const stmt = db.prepare('SELECT * FROM violations WHERE id = ?');
    const violation = stmt.get(id);
    if (violation) {
      violation.metadata = JSON.parse(violation.metadata || '{}');
    }
    return violation;
  }

  static getBySessionId(sessionId) {
    const stmt = db.prepare('SELECT * FROM violations WHERE session_id = ? ORDER BY timestamp ASC');
    return stmt.all(sessionId).map(v => ({
      ...v,
      metadata: JSON.parse(v.metadata || '{}')
    }));
  }

  static getCountBySessionId(sessionId) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM violations WHERE session_id = ?');
    return stmt.get(sessionId).count;
  }

  static getByType(sessionId, type) {
    const stmt = db.prepare('SELECT * FROM violations WHERE session_id = ? AND type = ? ORDER BY timestamp ASC');
    return stmt.all(sessionId, type).map(v => ({
      ...v,
      metadata: JSON.parse(v.metadata || '{}')
    }));
  }
}

module.exports = Violation;