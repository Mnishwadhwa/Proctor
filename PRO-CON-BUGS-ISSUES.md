# Production Deployment Analysis: Proctor System

## Context

This document analyzes the browser-based exam proctoring system for production deployment considerations, identifying advantages, disadvantages, and potential technical issues that may arise during deployment and user interaction.

---

## PROS (Advantages)

### Architecture
1. **Modular Frontend Design** - Each monitoring feature (tab, webcam, screen, input) is a separate module extending EventEmitter, making it easy to enable/disable features per exam
2. **Framework-Agnostic** - Frontend builds to UMD, ESM, and minified outputs via Rollup, compatible with any web framework
3. **Local Storage Fallback** - API client stores violations/screenshots locally when server is unreachable, then syncs when connection restores

### Security
1. **API Key Authentication** - All endpoints require X-API-Key header validation
2. **File Type Validation** - Screenshots limited to PNG/JPEG/WebP formats
3. **File Size Limits** - 10MB max for screenshot uploads, 50MB JSON payload limit

### User Experience
1. **Permission Pre-Check** - `Proctor.checkPermissions()` and `Proctor.requestPermissions()` allow pre-validating camera/screen access before exam starts
2. **Graceful Degradation** - If webcam/screen fails to start, error is emitted but doesn't crash the session
3. **Configurable Intervals** - Screenshot capture intervals are configurable per deployment needs

---

## CONS (Disadvantages)

### Scalability
1. **In-Memory SQLite Database** - `sql.js` runs SQLite entirely in memory with file persistence. This doesn't scale horizontally - each server instance has its own memory state
2. **Synchronous File Writes** - Database saves to disk after EVERY write operation (`saveDatabase()` called in dbWrapper.run), causing I/O bottlenecks under load
3. **No Connection Pooling** - Single database instance limits concurrent operations
4. **File Storage on Local Disk** - Screenshots stored in `uploads/` directory on server, no cloud storage integration

### Security
1. **Single API Key** - All clients share one API key; no per-user/per-session authentication
2. **No Rate Limiting** - No protection against abuse or DoS attacks
3. **CORS Wide Open by Default** - `CORS_ORIGIN: '*'` allows requests from any domain
4. **Weak Default API Key** - `'dev-api-key'` as default is insecure if not changed

### Data Integrity
1. **No Data Validation** - User IDs, exam IDs, and metadata have no format validation or sanitization
2. **No SQL Injection Protection** - While using parameterized queries, there's no explicit input sanitization layer
3. **No File Cleanup** - Old screenshots accumulate indefinitely in `uploads/` directory

---

## TECHNICAL BUGS & ISSUES

### Critical Issues

#### 1. Browser Permission Denial Handling (Frontend)
**Location:** `frontend/src/proctor.js:204-218`
```javascript
startPromises.push(
  this.modules.webcam.start().catch(err => {
    this._handleError({ type: 'webcam_error', message: err.message });
  })
);
```
**Problem:** When user denies camera/screen permission, the session continues without the feature. The exam proceeds but proctoring is incomplete. No option to block exam start or force permission grant.

**User Impact:** Students can bypass webcam monitoring by simply denying permission.

#### 2. Screen Share Can Be Stopped Silently (Frontend)
**Location:** `frontend/src/modules/screenMonitor.js:54-55`
```javascript
this.stream.getVideoTracks()[0].addEventListener('ended', () => {
  this._handleStreamEnd();
});
```
**Problem:** User can click browser's "Stop sharing" button. A violation is logged but monitoring stops. No automatic re-request or exam termination.

**User Impact:** Students can stop screen sharing mid-exam with only a logged violation.

#### 3. Database Concurrency Issues (Backend)
**Location:** `backend/src/utils/db.js:103-106`
```javascript
run: (sql, params = []) => {
  db.run(sql, params);
  saveDatabase();  // Synchronous file write
},
```
**Problem:** Under concurrent requests, the in-memory database could have race conditions. File writes are synchronous, blocking the event loop.

**User Impact:** With multiple concurrent exams, data corruption or lost violations possible.

#### 4. Memory Leak in Screenshots Array (Frontend)
**Location:** `frontend/src/modules/webcam.js:112`, `frontend/src/modules/screenMonitor.js:134`
```javascript
this.screenshots.push(screenshot);
```
**Problem:** All screenshots are kept in memory for the session duration. For long exams with frequent captures, this causes significant memory growth.

**User Impact:** Browser slowdown or crash during long exams (3+ hours with 30-second intervals = 360+ screenshots in memory).

### High Priority Issues

#### 5. Network Failure During Exam (Frontend)
**Location:** `frontend/src/utils/apiClient.js:100-108`
```javascript
try {
  return await this._request('/api/violations', { ... });
} catch (error) {
  logger.warn('Failed to log violation to server, stored locally:', error);
  return violation;
}
```
**Problem:** Local storage is used as fallback, but there's no automatic sync mechanism when connection restores. Local data could be lost if browser crashes.

**User Impact:** Violations during network issues may be permanently lost.

#### 6. Alt+Tab Detection Unreliable (Frontend)
**Location:** `frontend/src/modules/tabMonitor.js:79-84`
```javascript
_onBlur() {
  if (this.isActive && !document.hidden) {
    this._handleSwitch('window_blur');
  }
}
```
**Problem:** `blur` event fires for many reasons (clicking address bar, opening DevTools, OS notifications). Not specific to tab switching.

**User Impact:** False positive violations for legitimate actions.

#### 7. File Path Traversal Risk (Backend)
**Location:** `backend/src/routes/screenshots.js:157`
```javascript
res.sendFile(path.resolve(screenshot.file_path));
```
**Problem:** `file_path` is stored in database and read directly. If someone could manipulate the database (via SQL injection or direct access), arbitrary file read is possible.

**User Impact:** Potential security breach exposing server files.

#### 8. Session ID Predictability (Backend)
**Location:** Session model (not shown but typical UUID implementation)
**Problem:** Session IDs appear to be simple identifiers. If predictable, an attacker could access other users' exam data.

**User Impact:** Potential for exam data leakage between students.

### Medium Priority Issues

#### 9. DevTools Detection Bypassable (Frontend)
**Location:** `frontend/src/modules/inputTracker.js:229-230`
```javascript
{ key: 'F12' },
{ key: 'i', ctrlKey: true, shiftKey: true },
```
**Problem:** Only detects keyboard shortcuts. DevTools can be opened via:
- Browser menu (F12 shortcut disabled but menu works)
- Right-click → Inspect
- `javascript:` URLs in address bar

**User Impact:** Students can open DevTools without detection.

#### 10. Copy/Paste Detection Limited (Frontend)
**Location:** `frontend/src/modules/inputTracker.js:171-201`
**Problem:** Only detects clipboard events within the document. Doesn't detect:
- Right-click → Paste from context menu
- Paste from browser menu
- Drag-and-drop content

**User Impact:** Students can paste content using alternative methods.

#### 11. Timezone Inconsistency (Both)
**Location:** Multiple files use `new Date().toISOString()`
**Problem:** All timestamps are in UTC (toISOString). If server and client are in different timezones, relative time calculations could be confusing for reports.

**User Impact:** Confusion in violation timing reports.

#### 12. No HTTPS Enforcement (Backend)
**Location:** `backend/src/index.js`
**Problem:** No HTTPS redirect or HSTS headers. getUserMedia and getDisplayMedia require HTTPS in production (except localhost).

**User Impact:** Camera/screen sharing won't work on non-HTTPS production deployments.

### Low Priority Issues

#### 13. Missing Browser Compatibility Checks
**Problem:** No explicit checks for:
- WebRTC support (`getUserMedia`, `getDisplayMedia`)
- Canvas API support
- Permissions API support (falls back silently)

**User Impact:** Silent failures on older browsers.

#### 14. No Cleanup on Tab Close
**Problem:** If user closes tab/browser during exam, `stop()` is never called. Session remains "active" on server.

**User Impact:** Orphaned sessions in database, inaccurate session reports.

#### 15. Unlimited Local Storage
**Location:** `frontend/src/utils/storage.js`
**Problem:** Local storage fallback has no size limits. Could fill browser quota.

**User Impact:** Storage quota exceeded errors during long offline periods.

---

## Production Deployment Checklist

### Before Deployment
- [ ] Configure strong, unique API_KEY in environment
- [ ] Set CORS_ORIGIN to specific domain(s)
- [ ] Ensure HTTPS is enabled (required for camera/screen APIs)
- [ ] Set up proper logging/monitoring
- [ ] Configure reverse proxy (nginx) with rate limiting
- [ ] Set up database backups

### Infrastructure Recommendations
- [ ] Replace sql.js with PostgreSQL/MySQL for horizontal scaling
- [ ] Move screenshot storage to S3/cloud storage
- [ ] Add Redis for session caching
- [ ] Implement proper authentication (JWT/OAuth)
- [ ] Add rate limiting middleware

### Frontend Hardening
- [ ] Add `beforeunload` handler for session cleanup
- [ ] Implement automatic retry/sync for offline violations
- [ ] Add periodic memory cleanup for screenshots array
- [ ] Consider IndexedDB instead of localStorage for offline storage
- [ ] Add more comprehensive browser feature detection

---

## Summary

| Category | Count |
|----------|-------|
| Critical Issues | 4 |
| High Priority Issues | 4 |
| Medium Priority Issues | 4 |
| Low Priority Issues | 3 |

**Primary Risk:** The in-memory SQLite database with synchronous file writes will not scale for production use with concurrent users. This should be the first issue addressed.

**Secondary Risk:** Browser permission handling allows students to bypass monitoring features by denying permissions, with no way to enforce compliance.
