const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data', 'proctor.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

// Initialize database
async function initializeDatabase() {
  const SQL = await initSqlJs();

  // Try to load existing database
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_id TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT DEFAULT 'active',
      metadata TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS violations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration INTEGER DEFAULT 0,
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS screenshots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_path TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      exam_id TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      similarity_score REAL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // Create indexes
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_violations_session ON violations(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_screenshots_session ON screenshots(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_hash ON submissions(content_hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_exam ON submissions(exam_id)`);
  } catch (e) {
    // Index might already exist
  }

  saveDatabase();
  console.log('Database initialized successfully');
}

// Save database to file
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Wrapper for db operations with auto-save
const dbWrapper = {
  run: (sql, params = []) => {
    db.run(sql, params);
    saveDatabase();
  },

  get: (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  all: (sql, params = []) => {
    const results = [];
    const stmt = db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  prepare: (sql) => {
    return {
      run: (...params) => {
        db.run(sql, params);
        saveDatabase();
      },
      get: (...params) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all: (...params) => {
        const results = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }
};

module.exports = {
  get db() { return dbWrapper; },
  initializeDatabase,
  saveDatabase
};