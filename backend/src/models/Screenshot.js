const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');
const path = require('path');

class Screenshot {
  static create(sessionId, type, filePath, metadata = {}) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO screenshots (id, session_id, type, file_path, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, sessionId, type, filePath, JSON.stringify(metadata));
    return this.getById(id);
  }

  static getById(id) {
    const stmt = db.prepare('SELECT * FROM screenshots WHERE id = ?');
    const screenshot = stmt.get(id);
    if (screenshot) {
      screenshot.metadata = JSON.parse(screenshot.metadata || '{}');
    }
    return screenshot;
  }

  static getBySessionId(sessionId) {
    const stmt = db.prepare('SELECT * FROM screenshots WHERE session_id = ? ORDER BY timestamp ASC');
    return stmt.all(sessionId).map(s => ({
      ...s,
      metadata: JSON.parse(s.metadata || '{}')
    }));
  }

  static getByType(sessionId, type) {
    const stmt = db.prepare('SELECT * FROM screenshots WHERE session_id = ? AND type = ? ORDER BY timestamp ASC');
    return stmt.all(sessionId, type).map(s => ({
      ...s,
      metadata: JSON.parse(s.metadata || '{}')
    }));
  }

  static deleteBySessionId(sessionId) {
    const screenshots = this.getBySessionId(sessionId);
    const fs = require('fs');

    screenshots.forEach(s => {
      const fullPath = path.join(process.cwd(), s.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    const stmt = db.prepare('DELETE FROM screenshots WHERE session_id = ?');
    stmt.run(sessionId);
  }
}

module.exports = Screenshot;