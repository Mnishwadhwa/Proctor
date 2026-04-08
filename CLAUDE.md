# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based exam proctoring system with two components:
- **frontend/** - Framework-agnostic JavaScript library (proctor-js) for browser-side monitoring
- **backend/** - Node.js/Express REST API for session management, violation logging, and screenshot storage

## Commands

### Backend (from `backend/` directory)
```bash
npm install          # Install dependencies
npm start            # Run server (port 3000)
npm run dev          # Run with --watch for development
```

### Frontend (from `frontend/` directory)
```bash
npm install          # Install dependencies
npm run build        # Build all outputs (UMD, ESM, minified) via Rollup
npm run dev          # Build with watch mode (-w flag)
```

## Architecture

### Frontend (`frontend/src/`)

**Entry point:** `index.js` exports the `Proctor` class as default

**Core files:**
- `proctor.js` - Main `Proctor` class orchestrating all modules, handles session lifecycle
- `config/defaults.js` - Default configuration values for features and intervals
- `utils/eventEmitter.js` - Base class for module event handling
- `utils/apiClient.js` - HTTP client for backend communication
- `utils/textSimilarity.js` - Local text comparison using Levenshtein distance

**Modules (`modules/`):** Each extends EventEmitter and implements `start()`, `stop()`, and status methods:
- `tabMonitor.js` - visibilitychange/blur events, tracks tab switches with duration
- `inputTracker.js` - keyboard/mouse listeners, detects copy/paste and suspicious shortcuts
- `webcam.js` - getUserMedia + canvas capture, periodic screenshots
- `screenMonitor.js` - getDisplayMedia for screen recording/capture
- `plagiarism.js` - Delegates to API client for server-side comparison

**Build:** Rollup produces `dist/proctor.umd.js` (browser global), `dist/proctor.esm.js` (ES modules), `dist/proctor.min.js` (minified)

### Backend (`backend/src/`)

**Entry point:** `index.js` - Express app setup, middleware, route mounting, error handling

**Structure:**
- `config/index.js` - Environment config (PORT, API_KEY, NODE_ENV, CORS_ORIGIN)
- `routes/` - Express routers for each resource (sessions, violations, screenshots, plagiarism)
- `models/` - Simple data classes with static methods for CRUD operations
- `utils/db.js` - sql.js wrapper: SQLite in-memory with file persistence to `data/proctor.db`
- `middleware/auth.js` - X-API-Key header validation

**Database:** Auto-initialized on startup. Tables: `sessions`, `violations`, `screenshots`, `submissions`. Each write triggers file save.

**File storage:** Screenshots saved to `uploads/` directory (relative to cwd), served via `/uploads` static route.

### API Endpoints

```
POST /api/sessions           - Create session (userId, examId, metadata)
GET  /api/sessions/:id       - Get session details
PUT  /api/sessions/:id/end   - End session
GET  /api/sessions/:id/report - Get full report (session, violations, screenshots)

POST /api/violations         - Log violation (sessionId, type, duration, metadata)
GET  /api/violations/:sessionId - List violations for session

POST /api/screenshots        - Upload screenshot (FormData: sessionId, type, file)
GET  /api/screenshots/:sessionId - List screenshots for session

POST /api/plagiarism/check   - Check content (sessionId, userId, examId, content)
GET  /api/plagiarism/report/:id - Get plagiarism report

GET  /api/health             - Health check endpoint
```

## Configuration

Backend environment variables (see `backend/.env.example`):
- `PORT` - Server port (default 3000)
- `API_KEY` - Authentication key (default: 'dev-api-key')
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - CORS origin (default '*')

Frontend Proctor constructor options:
```javascript
{
  apiUrl, apiKey, userId, examId,
  features: {
    webcam: { enabled, interval },
    screenMonitor: { enabled, interval },
    tabSwitch: { enabled, maxWarnings },
    inputTracking: { enabled }
  },
  onViolation, onError, onStart, onStop, onReady
}
```

## Key Patterns

- **Event-driven modules:** All frontend modules extend EventEmitter, emit `violation`, `capture`, `error` events. Proctor class listens and forwards to callbacks.
- **Violation flow:** Module detects → emits event → Proctor logs to server via apiClient → calls user callback
- **Database:** sql.js runs SQLite in-memory; `dbWrapper` auto-saves to file after each write operation
- **No tests:** Project has no test framework configured