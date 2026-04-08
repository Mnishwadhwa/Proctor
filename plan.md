# Proctoring System - Implementation Plan

## Context
Build a browser-based proctoring system that can be easily integrated with any SaaS platform (React, Node.js, Python, etc.). The system includes:
- **Frontend**: Framework-agnostic JavaScript library
- **Backend**: Node.js/Express API for storing violations and proctoring data

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           Proctor.js (Framework-agnostic)               ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   ││
│  │  │ Webcam   │ │ TabMon   │ │ Input    │ │ Screen   │   ││
│  │  │ Monitor  │ │ itor     │ │ Tracker  │ │ Monitor  │   ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                  │
│                    REST API Calls                           │
└──────────────────────────│──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Express.js REST API                         ││
│  │  • POST /api/violations     - Log violations             ││
│  │  • POST /api/screenshots   - Upload screenshots          ││
│  │  • GET  /api/sessions/:id  - Get session report          ││
│  │  • POST /api/plagiarism    - Check plagiarism            ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                  │
│                    Database (SQLite/PostgreSQL)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
D:\Proctor-new\
├── frontend/                          # Framework-agnostic JS library
│   ├── src/
│   │   ├── index.js                   # Main entry point
│   │   ├── proctor.js                 # Core Proctor class
│   │   ├── modules/
│   │   │   ├── webcam.js              # Webcam monitoring
│   │   │   ├── tabMonitor.js          # Tab switch detection
│   │   │   ├── inputTracker.js        # Keystroke/mouse tracking
│   │   │   ├── screenMonitor.js       # Screen monitoring
│   │   │   └── plagiarism.js          # Plagiarism checker
│   │   ├── utils/
│   │   │   ├── eventEmitter.js        # Custom event system
│   │   │   ├── apiClient.js           # Backend API communication
│   │   │   ├── storage.js             # Local storage utilities
│   │   │   ├── textSimilarity.js      # Text comparison algorithms
│   │   │   └── logger.js              # Logging utility
│   │   └── config/
│   │       └── defaults.js            # Default configuration
│   ├── dist/                          # Bundled output (UMD + ESM)
│   ├── package.json
│   └── rollup.config.js
│
├── backend/                           # Node.js API Server
│   ├── src/
│   │   ├── index.js                   # Server entry point
│   │   ├── routes/
│   │   │   ├── violations.js          # Violation routes
│   │   │   ├── sessions.js            # Session routes
│   │   │   ├── screenshots.js         # Screenshot upload routes
│   │   │   └── plagiarism.js          # Plagiarism check routes
│   │   ├── models/
│   │   │   ├── Violation.js           # Violation model
│   │   │   ├── Session.js             # Session model
│   │   │   └── Screenshot.js          # Screenshot model
│   │   ├── middleware/
│   │   │   └── auth.js                # API key authentication
│   │   ├── utils/
│   │   │   └── db.js                  # Database connection
│   │   └── config/
│   │       └── index.js               # Server configuration
│   ├── uploads/                       # Screenshot storage
│   ├── package.json
│   └── .env.example
│
├── examples/
│   └── basic.html                     # Demo page
│
└── README.md
```

---

## Feature Details

### 1. Webcam Monitoring
**Frontend:** `navigator.mediaDevices.getUserMedia()` API
- Request camera permissions
- Live video preview
- Configurable screenshot intervals (default: 30 seconds)
- Upload screenshots to backend
- Face detection placeholder (future enhancement)

**Backend:**
- Store screenshots in `/uploads` directory
- Associate with session ID
- Return screenshot URLs

### 2. Tab-Switch Detection
**Frontend:** `visibilitychange` + `blur` events
- Detect tab switches and window blur
- Track duration of each switch
- Count violations
- Send to backend in real-time or batch

**Backend:**
- Store violations with timestamp, duration, type
- Provide violation summary per session

### 3. Keystroke/Mouse Tracking
**Frontend:** Keyboard and mouse events
- Track keystroke patterns (not actual keys for privacy)
- Track mouse movement frequency
- Detect copy/paste attempts
- Detect suspicious shortcuts (Alt+Tab, etc.)
- Configurable privacy levels

**Backend:**
- Store activity metrics
- Flag suspicious patterns

### 4. Plagiarism Checker (Post-Submission)
**Frontend:** Text comparison utilities
- Basic local comparison (Jaccard similarity)
- Send submission to backend for full check

**Backend:**
- Store previous submissions
- Compare new submissions against database
- Return similarity score and matches
- Optional: Integrate with external APIs (Turnitin, etc.)

### 5. Screen Monitoring
**Frontend:** `navigator.mediaDevices.getDisplayMedia()` API
- Request screen share permission
- Capture screen screenshots
- Detect multiple displays
- Upload to backend

**Backend:**
- Store screen captures
- Associate with session

---

## API Endpoints

```
POST   /api/sessions                 - Create new proctoring session
GET    /api/sessions/:id             - Get session details
PUT    /api/sessions/:id/end         - End session and get report

POST   /api/violations               - Log a violation
GET    /api/violations/:sessionId    - Get violations for session

POST   /api/screenshots              - Upload screenshot
GET    /api/screenshots/:sessionId   - Get screenshots for session

POST   /api/plagiarism/check         - Check text for plagiarism
GET    /api/plagiarism/report/:id    - Get plagiarism report
```

---

## Database Schema

### sessions
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Session ID |
| user_id | String | User identifier |
| exam_id | String | Exam identifier |
| started_at | DateTime | Session start |
| ended_at | DateTime | Session end |
| status | String | active/completed/terminated |

### violations
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Violation ID |
| session_id | UUID | Session reference |
| type | String | tab_switch/face_not_detected/etc |
| timestamp | DateTime | When it occurred |
| duration | Integer | Duration in seconds |
| metadata | JSON | Additional details |

### screenshots
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Screenshot ID |
| session_id | UUID | Session reference |
| type | String | webcam/screen |
| timestamp | DateTime | When captured |
| file_path | String | Storage path |

---

## Core API Usage

```javascript
// Frontend Usage
const proctor = new Proctor({
  apiUrl: 'http://localhost:3000/',
  apiKey: 'your-api-key',
  userId: 'user-123',
  examId: 'exam-456',

  features: {
    webcam: { enabled: true, interval: 30000 },
    screenMonitor: { enabled: true, interval: 60000 },
    tabSwitch: { enabled: true },
    inputTracking: { enabled: true }
  },

  onViolation: (type, data) => {
    console.log('Violation detected:', type, data);
  },

  onError: (error) => {
    console.error('Proctoring error:', error);
  }
});

// Start session
const session = await proctor.start();

// ... exam in progress ...

// End session and get full report
const report = await proctor.stop();
```

---

## Implementation Order

### Phase 1: Backend Foundation
1. Setup Express.js server
2. Database setup (SQLite for simplicity)
3. API routes for sessions and violations
4. Screenshot upload endpoint

### Phase 2: Frontend Core
1. Event emitter utility
2. API client for backend communication
3. Tab monitor module
4. Input tracker module

### Phase 3: Media Modules
1. Webcam monitor module
2. Screen monitor module
3. Screenshot capture and upload

### Phase 4: Plagiarism Checker
1. Text similarity algorithms
2. Backend plagiarism routes
3. Frontend plagiarism module

### Phase 5: Integration
1. Main Proctor class
2. Build configuration
3. Example page
4. Documentation

---

## Verification
1. Start backend: `cd backend && npm install && npm start`
2. Build frontend: `cd frontend && npm install && npm run build`
3. Open `examples/basic.html` in browser
4. Test each feature:
   - Verify backend receives violation logs
   - Check screenshots are stored
   - Test tab switch detection
   - Test plagiarism check

---

## Tech Stack Summary

**Frontend:**
- Vanilla JavaScript (ES6+)
- Rollup for bundling
- Zero runtime dependencies

**Backend:**
- Node.js + Express.js
- SQLite (dev) / PostgreSQL (prod)
- Multer for file uploads
- UUID for session IDs

**Integration:**
- REST API with JSON
- API key authentication
- CORS enabled for cross-origin requests

**VIOLATION**
**Webcam Monitoring:**

Webcam "Violations" Detection Monitoring system doesn't─detect violations directly - it captures─screenshots
  Error-Related Events:

  The only "violation-like" events from webcam are errors, not behavioral violations:

  ┌──────────────────────┬─────────────────────────────────────────┐
  │      Event Type      │             When It Occurs              │
  ├──────────────────────┼─────────────────────────────────────────┤
  │ webcam_access_denied │ User denies camera permission (line 77) │
  ├──────────────────────┼─────────────────────────────────────────┤
  │ capture_failed       │ Screenshot capture fails (line 120)     │
  └──────────────────────┴─────────────────────────────────────────┘

How Violations Are Actually Handled:

  From proctor.js:85-95, when a capture occurs:
  this.modules.webcam.on('capture', async (screenshot) => {
    // Uploads to backend for storage/review
    await this.apiClient.uploadScreenshot(sessionId, 'webcam', screenshot.dataUrl, {...});
    this.emit('webcamCapture', screenshot);
  });

Summary:
The webcam module is passive monitoring, It simply:
  - Captures screenshots at intervals
  - Stores them for human review
  - Reports access/capture errors

**Keystroke/Mouse Tracking**




**FUTURE FEATURE** 
**Advance Webcam Monitoring:**
  Active/Real-Time violation detection would require computer vision/AI analysis on the backend, which isn't implemented in this codebase. The screenshots are stored. Analyze frames for suspicious behavior (like face detection, multiple people, looking away, etc.).