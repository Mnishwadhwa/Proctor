# Proctor.js - Browser-Based Proctoring System

A framework-agnostic JavaScript library for browser-based exam proctoring. Easily integrate with any LMS or SaaS platform built with React, Vue, Angular, Node.js, Python, or any other technology.

## Features

- **Webcam Monitoring** - Periodic screenshot capture from webcam
- **Tab-Switch Detection** - Detect when users switch tabs or windows
- **Keystroke/Mouse Tracking** - Track input activity and detect suspicious patterns
- **Screen Monitoring** - Capture screen screenshots during exams
- **Plagiarism Checker** - Compare submissions for text similarity

## Architecture

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
│  │  • POST /api/sessions     - Create session               ││
│  │  • POST /api/violations   - Log violations               ││
│  │  • POST /api/screenshots  - Upload screenshots           ││
│  │  • POST /api/plagiarism   - Check plagiarism             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Backend Setup

```bash
cd backend
npm install
npm start
```

The server will start on port 3000 by default.

### Frontend Setup

```bash
cd frontend
npm install
npm run build
```

### Basic Usage

```javascript
import Proctor from 'proctor-js';

const proctor = new Proctor({
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key',
  userId: 'user-123',
  examId: 'exam-456',

  features: {
    webcam: { enabled: true, interval: 30000 },
    screenMonitor: { enabled: true, interval: 60000 },
    tabSwitch: { enabled: true, maxWarnings: 3 },
    inputTracking: { enabled: true }
  },

  onViolation: (type, data) => {
    console.log('Violation detected:', type, data);
  },

  onError: (error) => {
    console.error('Proctoring error:', error);
  }
});

// Start proctoring
await proctor.start();

// Get webcam preview element
const videoElement = proctor.getWebcamPreview();
document.body.appendChild(videoElement);

// Stop proctoring and get report
const report = await proctor.stop();
console.log('Session report:', report);
```

### Script Tag Usage

```html
<script src="dist/proctor.umd.js"></script>
<script>
  const proctor = new Proctor({
    apiUrl: 'http://localhost:3000/api',
    apiKey: 'your-api-key',
    userId: 'user-123',
    examId: 'exam-456'
  });

  proctor.start().then(() => {
    console.log('Proctoring started');
  });
</script>
```

## API Reference

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | `''` | Backend API URL |
| `apiKey` | string | `''` | API key for authentication |
| `userId` | string | `''` | User identifier |
| `examId` | string | `''` | Exam identifier |
| `features.webcam.enabled` | boolean | `true` | Enable webcam monitoring |
| `features.webcam.interval` | number | `30000` | Screenshot interval (ms) |
| `features.screenMonitor.enabled` | boolean | `true` | Enable screen monitoring |
| `features.screenMonitor.interval` | number | `60000` | Screenshot interval (ms) |
| `features.tabSwitch.enabled` | boolean | `true` | Enable tab switch detection |
| `features.tabSwitch.maxWarnings` | number | `3` | Max allowed tab switches |
| `features.inputTracking.enabled` | boolean | `true` | Enable input tracking |

### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start proctoring session |
| `stop()` | Stop session and get report |
| `getStats()` | Get current statistics |
| `getReport()` | Get server-side report |
| `captureWebcam()` | Take manual webcam screenshot |
| `captureScreen()` | Take manual screen screenshot |
| `checkPlagiarism(content, options)` | Check content for plagiarism |
| `getWebcamPreview()` | Get webcam video element |
| `getScreenPreview()` | Get screen video element |

### Events

| Event | Description |
|-------|-------------|
| `started` | Proctoring started |
| `stopped` | Proctoring stopped |
| `violation` | Violation detected |
| `error` | Error occurred |
| `webcamCapture` | Webcam screenshot taken |
| `screenCapture` | Screen screenshot taken |
| `plagiarismCheck` | Plagiarism check completed |

## Backend API Endpoints

### Sessions

```
POST /api/sessions
  Body: { userId, examId, metadata }
  Returns: { id, userId, examId, status, startedAt }

GET /api/sessions/:id
  Returns: Session details

PUT /api/sessions/:id/end
  Returns: Full session report

GET /api/sessions/:id/report
  Returns: { session, violations, screenshots, summary }
```

### Violations

```
POST /api/violations
  Body: { sessionId, type, duration, metadata }
  Returns: Violation record

GET /api/violations/:sessionId
  Returns: Array of violations
```

### Screenshots

```
POST /api/screenshots
  Body: FormData with sessionId, type, screenshot file
  Returns: Screenshot record

GET /api/screenshots/:sessionId
  Returns: Array of screenshots
```

### Plagiarism

```
POST /api/plagiarism/check
  Body: { sessionId, userId, examId, content }
  Returns: { submissionId, similarityScore, matches, isPlagiarized }

GET /api/plagiarism/report/:id
  Returns: Detailed plagiarism report
```

## Violation Types

| Type | Description |
|------|-------------|
| `tab_switch` | User switched to another tab |
| `window_blur` | Window lost focus |
| `copy_paste` | Copy or paste action detected |
| `suspicious_shortcut` | Suspicious keyboard shortcut |
| `screen_share_stopped` | User stopped screen sharing |
| `webcam_stopped` | Webcam stream ended |

## Integration Examples

### React

```jsx
import { useEffect, useRef, useState } from 'react';
import Proctor from 'proctor-js';

function ExamComponent() {
  const proctorRef = useRef(null);
  const [violations, setViolations] = useState([]);

  useEffect(() => {
    proctorRef.current = new Proctor({
      apiUrl: '/api',
      apiKey: process.env.REACT_APP_API_KEY,
      userId: currentUser.id,
      examId: exam.id,
      onViolation: (type, data) => {
        setViolations(v => [...v, { type, data, time: new Date() }]);
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
        <div className="warnings">
          Violations: {violations.length}
        </div>
      )}
    </div>
  );
}
```

### Vue

```vue
<template>
  <div>
    <h1>Exam</h1>
    <video ref="webcamPreview" autoplay></video>
  </div>
</template>

<script>
import Proctor from 'proctor-js';

export default {
  data() {
    return {
      proctor: null
    };
  },
  async mounted() {
    this.proctor = new Proctor({
      apiUrl: '/api',
      apiKey: process.env.VUE_APP_API_KEY,
      userId: this.$user.id,
      examId: this.$exam.id,
      onViolation: (type, data) => {
        this.$emit('violation', { type, data });
      }
    });

    await this.proctor.start();
    const video = this.proctor.getWebcamPreview();
    if (video) {
      this.$refs.webcamPreview.srcObject = video.srcObject;
    }
  },
  async beforeUnmount() {
    if (this.proctor) {
      await this.proctor.stop();
    }
  }
};
</script>
```

### Python Backend Integration

The frontend library works with any backend. Here's a Python Flask example:

```python
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/violations', methods=['POST'])
def log_violation():
    data = request.json
    # Store violation in database
    return jsonify({'status': 'ok'})

@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.json
    # Create session in database
    return jsonify({'id': 'session-id', 'status': 'active'})
```

## Configuration

### Environment Variables (Backend)

```
PORT=3000
API_KEY=your-secret-api-key
NODE_ENV=development
```

### Browser Compatibility

| Browser | Webcam | Screen | Tab Detection | Input Tracking |
|---------|--------|--------|---------------|----------------|
| Chrome 60+ | ✅ | ✅ | ✅ | ✅ |
| Firefox 55+ | ✅ | ✅ | ✅ | ✅ |
| Edge 79+ | ✅ | ✅ | ✅ | ✅ |
| Safari 13+ | ✅ | ❌ | ✅ | ✅ |

Note: Screen capture requires user permission and is not supported in Safari.

## License

MIT