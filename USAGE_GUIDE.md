# Proctoring System - Step-by-Step Usage Guide

This guide will walk you through setting up and using the proctoring system.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Starting the Backend Server](#3-starting-the-backend-server)
4. [Using the Demo Page](#4-using-the-demo-page)
5. [Integration with Your Application](#5-integration-with-your-application)
6. [API Reference](#6-api-reference)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

Before you begin, ensure you have:

- **Node.js** v16 or higher installed
- A modern web browser (Chrome, Firefox, Edge recommended)
- Camera and microphone (for webcam monitoring)
- For screen monitoring: a desktop/laptop (mobile not supported)

### Check Node.js Version

```bash
node --version
# Should output v16.x.x or higher
```

---

## 2. Installation

### Step 2.1: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 2.2: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### Step 2.3: Build the Frontend Library

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

Create a `.env` file in the `backend/` folder:

```env
PORT=3000
API_KEY=your-secret-api-key
NODE_ENV=development
```

### Step 3.2: Start the Server

```bash
cd backend
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

Open a new terminal and run:

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-...","version":"1.0.0"}
```

---

## 4. Using the Demo Page

### Step 4.1: Open the Demo

Open `examples/basic.html` in your browser:

- **Windows**: Double-click the file
- **Mac**: Right-click → Open With → Browser
- **Or use a local server** (recommended for camera access):

```bash
cd D:/Proctor-new
npx serve .
# Then open http://localhost:3000/examples/basic.html
```

### Step 4.2: Configure Settings

1. **API URL**: `http://localhost:3000/api`
2. **API Key**: `dev-api-key` (or your custom key)
3. **User ID**: Any identifier for the user
4. **Exam ID**: Any identifier for the exam

### Step 4.3: Select Features

Check/uncheck the features you want:
- **Webcam Monitoring**: Takes periodic screenshots
- **Screen Monitoring**: Captures the screen
- **Tab Switch Detection**: Detects when user switches tabs
- **Input Tracking**: Tracks keyboard/mouse activity

### Step 4.4: Request Permissions

Click **"Request Permissions"** button to:
- Allow camera access
- Allow screen sharing

### Step 4.5: Start Proctoring

Click **"Start Proctoring"**:
1. Camera and screen sharing prompts will appear
2. Allow both permissions
3. Video previews will appear
4. Violations will be logged automatically

### Step 4.6: Test Features

- **Tab Switch**: Switch to another tab, then return. A violation will be logged.
- **Copy/Paste**: Try copying text in the page. A violation will be logged.
- **Plagiarism**: Enter text in the plagiarism checker and click "Check for Plagiarism"

### Step 4.7: Stop Proctoring

Click **"Stop Proctoring"** to:
- End the session
- Get a full report
- Stop all monitoring

---

## 5. Integration with Your Application

### Option A: Script Tag (Simple)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Exam</title>
</head>
<body>
  <!-- Your exam content -->

  <script src="path/to/proctor.umd.js"></script>
  <script>
    const proctor = new Proctor({
      apiUrl: 'http://localhost:3000/api',
      apiKey: 'dev-api-key',
      userId: 'student-123',
      examId: 'final-exam-2024',

      features: {
        webcam: { enabled: true, interval: 30000 },
        screenMonitor: { enabled: true, interval: 60000 },
        tabSwitch: { enabled: true, maxWarnings: 3 },
        inputTracking: { enabled: true }
      },

      onViolation: function(type, data) {
        console.log('Violation:', type, data);
        alert('Warning: ' + type + ' detected!');
      },

      onError: function(error) {
        console.error('Error:', error);
      }
    });

    // Start when page loads
    proctor.start().then(function() {
      console.log('Proctoring started');
    });

    // Stop when exam is submitted
    function submitExam() {
      proctor.stop().then(function(report) {
        console.log('Session report:', report);
        // Submit your exam form
      });
    }
  </script>
</body>
</html>
```

### Option B: ES Module (React/Vue/Angular)

```javascript
import Proctor from './path/to/proctor.esm.js';

class ExamComponent {
  constructor() {
    this.proctor = new Proctor({
      apiUrl: 'http://localhost:3000/api',
      apiKey: 'dev-api-key',
      userId: getCurrentUser().id,
      examId: getExamId(),
      features: {
        webcam: { enabled: true },
        screenMonitor: { enabled: true },
        tabSwitch: { enabled: true },
        inputTracking: { enabled: true }
      },
      onViolation: (type, data) => this.handleViolation(type, data)
    });
  }

  async startExam() {
    await this.proctor.start();
  }

  async endExam() {
    const report = await this.proctor.stop();
    return report;
  }

  handleViolation(type, data) {
    // Show warning to user
    // Log to your system
    console.warn(`Violation: ${type}`, data);
  }
}
```

### Option C: React Hook Example

```jsx
import { useEffect, useRef, useState } from 'react';
import Proctor from './proctor.esm.js';

function useProctor(config) {
  const proctorRef = useRef(null);
  const [violations, setViolations] = useState([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    proctorRef.current = new Proctor({
      ...config,
      onViolation: (type, data) => {
        setViolations(prev => [...prev, { type, data, time: new Date() }]);
        config.onViolation?.(type, data);
      }
    });

    return () => {
      proctorRef.current?.stop();
    };
  }, []);

  const start = async () => {
    await proctorRef.current.start();
    setIsActive(true);
  };

  const stop = async () => {
    const report = await proctorRef.current.stop();
    setIsActive(false);
    return report;
  };

  return { start, stop, violations, isActive };
}

// Usage
function ExamPage() {
  const { start, stop, violations, isActive } = useProctor({
    apiUrl: '/api',
    apiKey: process.env.API_KEY,
    userId: currentUser.id,
    examId: exam.id
  });

  return (
    <div>
      <h1>Exam</h1>
      {violations.length > 0 && (
        <div className="warning">
          Warnings: {violations.length}
        </div>
      )}
      <button onClick={start} disabled={isActive}>
        Start Exam
      </button>
      <button onClick={stop} disabled={!isActive}>
        Submit Exam
      </button>
    </div>
  );
}
```

---

## 6. API Reference

### Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create a new proctoring session |
| `GET` | `/api/sessions/:id` | Get session details |
| `PUT` | `/api/sessions/:id/end` | End session and get report |
| `GET` | `/api/sessions/:id/report` | Get full session report |
| `POST` | `/api/violations` | Log a violation |
| `GET` | `/api/violations/:sessionId` | Get all violations for session |
| `POST` | `/api/screenshots` | Upload a screenshot |
| `GET` | `/api/screenshots/:sessionId` | Get all screenshots for session |
| `POST` | `/api/plagiarism/check` | Check text for plagiarism |
| `GET` | `/api/health` | Health check |

### Example API Calls

#### Create Session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key" \
  -d '{"userId":"user-123","examId":"exam-456"}'
```

Response:
```json
{
  "id": "session-uuid",
  "user_id": "user-123",
  "exam_id": "exam-456",
  "status": "active",
  "started_at": "2024-..."
}
```

#### Log Violation

```bash
curl -X POST http://localhost:3000/api/violations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key" \
  -d '{
    "sessionId": "session-uuid",
    "type": "tab_switch",
    "duration": 5000,
    "metadata": {}
  }'
```

#### Get Report

```bash
curl http://localhost:3000/api/sessions/session-uuid/report \
  -H "X-API-Key: dev-api-key"
```

### Frontend Proctor Class Methods

| Method | Description |
|--------|-------------|
| `start()` | Start proctoring session |
| `stop()` | Stop session and get report |
| `getStats()` | Get current statistics |
| `getReport()` | Get server-side report |
| `captureWebcam()` | Take manual webcam screenshot |
| `captureScreen()` | Take manual screen screenshot |
| `checkPlagiarism(content, options)` | Check content for plagiarism |
| `getWebcamPreview()` | Get video element for webcam |
| `getScreenPreview()` | Get video element for screen |

---

## 7. Troubleshooting

### Camera Not Working

1. **Check permissions**: Browser may have blocked camera access
   - Chrome: Click the camera icon in the address bar
   - Firefox: Check Permissions in the address bar
   - Edge: Click the lock icon in the address bar

2. **Use HTTPS**: Camera requires HTTPS in production
   - localhost is allowed for development

3. **Check browser console**: Look for permission errors

### Screen Sharing Not Working

1. **Browser support**: Screen sharing requires:
   - Chrome 72+
   - Firefox 66+
   - Edge 79+
   - Safari: Not supported

2. **User must select a screen**: User needs to choose which screen/window to share

### Backend Not Starting

1. **Port in use**: Change PORT in `.env` file

2. **Check Node version**:
   ```bash
   node --version  # Should be v16+
   ```

3. **Reinstall dependencies**:
   ```bash
   cd backend
   rm -rf node_modules
   npm install
   ```

### API Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `MISSING_API_KEY` | No API key provided | Add `X-API-Key` header |
| `INVALID_API_KEY` | Wrong API key | Check your `.env` file |
| `SESSION_NOT_FOUND` | Invalid session ID | Create a new session |
| `SESSION_NOT_ACTIVE` | Session already ended | Start a new session |

### CORS Errors

If you see CORS errors in the browser console:

1. **Check backend is running** on the correct port
2. **Use the correct API URL** in frontend config
3. **For production**: Update CORS settings in `backend/src/config/index.js`

---

## Quick Reference Card

```bash
# Start backend
cd backend && npm start

# Build frontend
cd frontend && npm run build

# Test API
curl http://localhost:3000/api/health

# Open demo
open examples/basic.html
```

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#7-troubleshooting) section
2. Review the [README.md](README.md) for architecture details
3. Check browser console for errors
4. Check backend server logs for errors