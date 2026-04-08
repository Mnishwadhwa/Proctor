# Proctoring System - Step-by-Step Usage Guide

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Starting the Backend Server](#3-starting-the-backend-server)
4. [Using the Demo Page](#4-using-the-demo-page)
5. [Integration with Your Application](#5-integration-with-your-application)
6. [API Reference](#6-api-reference)
7. [Configuration Options](#7-configuration-options)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download Node.js](https://nodejs.org/)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge recommended)

To verify your installation:
```bash
node --version
npm --version
```

---

## 2. Installation

### Step 2.1: Navigate to Project Directory
```bash
cd D:\Proctor-new
```

### Step 2.2: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2.3: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### Step 2.4: Build the Frontend Library
```bash
npm run build
```

This creates three files in `frontend/dist/`:
- `proctor.umd.js` - For `<script>` tag usage
- `proctor.esm.js` - For ES module imports
- `proctor.min.js` - Minified version

---

## 3. Starting the Backend Server

### Step 3.1: Configure Environment (Optional)
```bash
cd D:\Proctor-new\backend
```

Create a `.env` file (copy from `.env.example`):
```bash
copy .env.example .env
```

Edit `.env` to customize settings:
```
PORT=3000
API_KEY=your-secure-api-key-here
NODE_ENV=development
```

### Step 3.2: Start the Server
```bash
npm start
```

You should see:
```
╔════════════════════════════════════════════╗
║       Proctor Backend Server               ║
║       Running on port 3000                 ║
╚════════════════════════════════════════════╝
```

### Step 3.3: Verify Server is Running
Open a new terminal and test:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-16T17:00:00.000Z","version":"1.0.0"}
```

---

## 4. Using the Demo Page

### Step 4.1: Open the Demo
With the backend running, open in your browser:
```
file:///D:/Proctor-new/examples/basic.html
```

Or use a local server:
```bash
cd D:\Proctor-new
npx serve .
# Then open http://localhost:3000/examples/basic.html
```

### Step 4.2: Configure Settings
1. **API URL**: `http://localhost:3000/api`
2. **API Key**: `dev-api-key` (default)
3. **User ID**: Your user identifier
4. **Exam ID**: Your exam identifier

### Step 4.3: Select Features
Check/uncheck the features you want:
- [x] Webcam Monitoring
- [x] Screen Monitoring
- [x] Tab Switch Detection
- [x] Input Tracking

### Step 4.4: Request Permissions
Click **"Request Permissions"** to grant:
- Camera access
- Screen share access

### Step 4.5: Start Proctoring
Click **"Start Proctoring"** to begin monitoring.

### Step 4.6: Test Features
- **Tab Switch**: Switch to another tab, then return. A violation will be logged.
- **Copy/Paste**: Try copying text - this will be detected.
- **Keyboard Shortcuts**: Press Alt+Tab - detected as suspicious.
- **Plagiarism**: Enter text in the checker and click "Check for Plagiarism"

### Step 4.7: Stop Proctoring
Click **"Stop Proctoring"** to end the session and view the report.

---

## 5. Integration with Your Application

### Option A: Script Tag (Simple HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Exam</title>
</head>
<body>
  <!-- Your exam content -->

  <!-- Include Proctor.js -->
  <script src="path/to/proctor.umd.js"></script>
  <script>
    const proctor = new Proctor({
      apiUrl: 'http://localhost:3000/api',
      apiKey: 'your-api-key',
      userId: 'user-123',
      examId: 'exam-456',
      onViolation: function(type, data) {
        console.log('Violation:', type);
        alert('Warning: ' + type + ' detected!');
      }
    });

    // Start when exam begins
    proctor.start().then(function() {
      console.log('Proctoring started');
    });

    // Stop when exam ends
    function endExam() {
      proctor.stop().then(function(report) {
        console.log('Session report:', report);
      });
    }
  </script>
</body>
</html>
```

### Option B: ES Module (Modern Frameworks)

```javascript
import Proctor from './path/to/proctor.esm.js';

const proctor = new Proctor({
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key',
  userId: currentUser.id,
  examId: currentExam.id,

  features: {
    webcam: { enabled: true, interval: 30000 },
    screenMonitor: { enabled: true, interval: 60000 },
    tabSwitch: { enabled: true, maxWarnings: 3 },
    inputTracking: { enabled: true }
  },

  onViolation: (type, data) => {
    console.log('Violation:', type, data);
    // Handle violation (show warning, log, etc.)
  },

  onError: (error) => {
    console.error('Proctor error:', error);
  },

  onStart: (data) => {
    console.log('Session started:', data.sessionId);
  },

  onStop: (report) => {
    console.log('Session ended:', report);
    // Submit report to your backend
  }
});

// Start proctoring
await proctor.start();

// Get video preview elements
const webcamVideo = proctor.getWebcamPreview();
const screenVideo = proctor.getScreenPreview();

// Add to DOM if needed
document.getElementById('webcam-container').appendChild(webcamVideo);

// End session
const report = await proctor.stop();
```

### Option C: React Integration

```jsx
import { useEffect, useRef, useState } from 'react';
import Proctor from './path/to/proctor.esm.js';

function ExamPage({ user, exam }) {
  const proctorRef = useRef(null);
  const [violations, setViolations] = useState([]);

  useEffect(() => {
    proctorRef.current = new Proctor({
      apiUrl: process.env.REACT_APP_API_URL,
      apiKey: process.env.REACT_APP_API_KEY,
      userId: user.id,
      examId: exam.id,
      onViolation: (type, data) => {
        setViolations(prev => [...prev, { type, data, time: new Date() }]);
      }
    });

    proctorRef.current.start();

    return () => {
      proctorRef.current?.stop();
    };
  }, []);

  return (
    <div>
      <h1>Exam in Progress</h1>
      {violations.length > 0 && (
        <div className="alert alert-warning">
          Warnings: {violations.length}
        </div>
      )}
      {/* Exam content */}
    </div>
  );
}
```

---

## 6. API Reference

### Backend API Endpoints

#### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create a new proctoring session |
| `GET` | `/api/sessions/:id` | Get session details |
| `PUT` | `/api/sessions/:id/end` | End session and get report |
| `GET` | `/api/sessions/:id/report` | Get full session report |

#### Violations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/violations` | Log a violation |
| `GET` | `/api/violations/:sessionId` | Get violations for session |

#### Screenshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/screenshots` | Upload a screenshot |
| `GET` | `/api/screenshots/:sessionId` | Get screenshots for session |

#### Plagiarism

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/plagiarism/check` | Check text for plagiarism |

### Frontend API Methods

```javascript
// Start proctoring
await proctor.start();

// Stop proctoring and get report
const report = await proctor.stop();

// Get current statistics
const stats = proctor.getStats();

// Get session report from server
const serverReport = await proctor.getReport();

// Check content for plagiarism
const result = await proctor.checkPlagiarism(textContent);

// Get video preview elements
const webcamElement = proctor.getWebcamPreview();
const screenElement = proctor.getScreenPreview();

// Take manual screenshots
const webcamShot = await proctor.captureWebcam();
const screenShot = await proctor.captureScreen();

// Check/request permissions
const perms = await Proctor.checkPermissions();
const results = await proctor.requestPermissions();
```

---

## 7. Configuration Options

### Complete Configuration Example

```javascript
const proctor = new Proctor({
  // Required
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key',
  userId: 'user-123',
  examId: 'exam-456',

  // Feature Configuration
  features: {
    webcam: {
      enabled: true,
      interval: 30000,      // Screenshot every 30 seconds
      quality: 0.8,         // JPEG quality (0-1)
      facingMode: 'user',   // 'user' or 'environment'
      width: 640,
      height: 480
    },
    screenMonitor: {
      enabled: true,
      interval: 60000,      // Screenshot every 60 seconds
      quality: 0.8
    },
    tabSwitch: {
      enabled: true,
      maxWarnings: 3        // Alert after 3 violations
    },
    inputTracking: {
      enabled: true,
      trackKeystrokes: true,
      trackMouse: true,
      detectCopyPaste: true
    }
  },

  // Callbacks
  onViolation: (type, data) => { },
  onError: (error) => { },
  onReady: (data) => { },
  onStart: (data) => { },
  onStop: (report) => { }
});
```

### Violation Types

| Type | Description |
|------|-------------|
| `tab_switch` | User switched to another tab |
| `window_blur` | Window lost focus |
| `copy_paste` | Copy or paste action detected |
| `suspicious_shortcut` | Keyboard shortcut like Alt+Tab |
| `screen_share_stopped` | User stopped screen sharing |
| `webcam_stopped` | Webcam stream ended |

---

## 8. Troubleshooting

### Backend Won't Start

**Error: Port 3000 already in use**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /PID <pid> /F
```

**Error: Cannot find module**
```bash
# Reinstall dependencies
cd backend
rm -rf node_modules
npm install
```

### Webcam/Screen Not Working

1. **Check browser permissions**: Click the lock icon in the address bar
2. **Use HTTPS**: Some browsers require HTTPS for media access
3. **Check browser compatibility**:
   - Chrome 60+ ✅
   - Firefox 55+ ✅
   - Edge 79+ ✅
   - Safari 13+ (screen capture limited)

### CORS Errors

If frontend and backend are on different origins, ensure CORS is configured in `backend/src/config/index.js`:
```javascript
cors: {
  origin: ['http://localhost:3001', 'https://your-lms.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}
```

### API Key Errors

Make sure to include the API key in requests:
```bash
curl -H "X-API-Key: dev-api-key" http://localhost:3000/api/sessions
```

### Database Issues

The database is stored in `backend/data/proctor.db`. To reset:
```bash
rm backend/data/proctor.db
# Restart the server
```

---

## Quick Reference Card

```bash
# Install
cd backend && npm install
cd ../frontend && npm install && npm run build

# Start backend
cd backend && npm start

# Test API
curl http://localhost:3000/api/health

# Create session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key" \
  -d '{"userId":"user1","examId":"exam1"}'
```

---

## Support

For issues or questions:
- Check the [README.md](README.md) for detailed documentation
- Review the demo page at `examples/basic.html`
- Examine the source code in `frontend/src/` and `backend/src/`