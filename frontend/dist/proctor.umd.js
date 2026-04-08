(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Proctor = {}));
})(this, (function (exports) { 'use strict';

  /**
   * Simple event emitter for managing events
   */
  class EventEmitter {
    constructor() {
      this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} listener - Callback function
     */
    on(event, listener) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(listener);
      return () => this.off(event, listener);
    }

    /**
     * Subscribe to an event (one-time)
     * @param {string} event - Event name
     * @param {Function} listener - Callback function
     */
    once(event, listener) {
      const onceWrapper = (...args) => {
        listener(...args);
        this.off(event, onceWrapper);
      };
      return this.on(event, onceWrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} listener - Callback function
     */
    off(event, listener) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter(l => l !== listener);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to listeners
     */
    emit(event, ...args) {
      if (!this.events[event]) return;
      this.events[event].forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    removeAllListeners(event) {
      if (event) {
        delete this.events[event];
      } else {
        this.events = {};
      }
    }
  }

  /**
   * Local storage utility with fallback to memory storage
   */
  class Storage {
    constructor() {
      this.prefix = 'proctor_';
      this.memoryStorage = new Map();
      this.isLocalStorageAvailable = this._checkLocalStorage();
    }

    _checkLocalStorage() {
      try {
        const testKey = '__test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    }

    _getKey(key) {
      return `${this.prefix}${key}`;
    }

    set(key, value) {
      const fullKey = this._getKey(key);
      const serialized = JSON.stringify(value);

      if (this.isLocalStorageAvailable) {
        try {
          localStorage.setItem(fullKey, serialized);
        } catch (e) {
          // Storage full, fallback to memory
          this.memoryStorage.set(fullKey, serialized);
        }
      } else {
        this.memoryStorage.set(fullKey, serialized);
      }
    }

    get(key, defaultValue = null) {
      const fullKey = this._getKey(key);

      if (this.isLocalStorageAvailable) {
        const value = localStorage.getItem(fullKey);
        if (value !== null) {
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        }
      }

      if (this.memoryStorage.has(fullKey)) {
        try {
          return JSON.parse(this.memoryStorage.get(fullKey));
        } catch (e) {
          return this.memoryStorage.get(fullKey);
        }
      }

      return defaultValue;
    }

    remove(key) {
      const fullKey = this._getKey(key);

      if (this.isLocalStorageAvailable) {
        localStorage.removeItem(fullKey);
      }
      this.memoryStorage.delete(fullKey);
    }

    clear() {
      if (this.isLocalStorageAvailable) {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
        keys.forEach(k => localStorage.removeItem(k));
      }
      this.memoryStorage.clear();
    }

    // Store violation locally for backup
    storeViolation(violation) {
      const violations = this.get('violations', []);
      violations.push({
        ...violation,
        storedAt: new Date().toISOString()
      });
      this.set('violations', violations);
      return violations;
    }

    // Get all stored violations
    getStoredViolations() {
      return this.get('violations', []);
    }

    // Clear stored violations
    clearViolations() {
      this.set('violations', []);
    }

    // Store screenshot data URL locally
    storeScreenshot(type, dataUrl) {
      const screenshots = this.get('screenshots', []);
      screenshots.push({
        type,
        dataUrl,
        timestamp: new Date().toISOString()
      });
      this.set('screenshots', screenshots);
      return screenshots;
    }

    // Get stored screenshots
    getStoredScreenshots() {
      return this.get('screenshots', []);
    }

    // Clear stored screenshots
    clearScreenshots() {
      this.set('screenshots', []);
    }
  }

  var storage = new Storage();

  /**
   * Logger utility for consistent logging
   */
  class Logger {
    constructor(prefix = 'Proctor') {
      this.prefix = prefix;
      this.debugMode = false;
    }

    setDebug(enabled) {
      this.debugMode = enabled;
    }

    _log(level, ...args) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${this.prefix}]`;

      switch (level) {
        case 'error':
          console.error(prefix, ...args);
          break;
        case 'warn':
          console.warn(prefix, ...args);
          break;
        case 'info':
          console.info(prefix, ...args);
          break;
        case 'debug':
          if (this.debugMode) {
            console.log(prefix, ...args);
          }
          break;
        default:
          console.log(prefix, ...args);
      }
    }

    error(...args) {
      this._log('error', ...args);
    }

    warn(...args) {
      this._log('warn', ...args);
    }

    info(...args) {
      this._log('info', ...args);
    }

    debug(...args) {
      this._log('debug', ...args);
    }
  }

  var logger = new Logger();

  /**
   * API client for communicating with the proctor backend
   */
  class ApiClient {
    constructor(config = {}) {
      this.baseUrl = config.apiUrl || '';
      this.apiKey = config.apiKey || '';
      this.timeout = config.timeout || 30000;
    }

    setConfig(config) {
      this.baseUrl = config.apiUrl || this.baseUrl;
      this.apiKey = config.apiKey || this.apiKey;
    }

    async _request(endpoint, options = {}) {
      const url = `${this.baseUrl}${endpoint}`;

      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          const error = new Error(data.error || 'API request failed');
          error.code = data.code || 'API_ERROR';
          error.status = response.status;
          throw error;
        }

        return data;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }

        logger.error('API request failed:', error);
        throw error;
      }
    }

    // Session endpoints
    async createSession(userId, examId, metadata = {}) {
      return this._request('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ userId, examId, metadata })
      });
    }

    async getSession(sessionId) {
      return this._request(`/api/sessions/${sessionId}`);
    }

    async endSession(sessionId) {
      return this._request(`/api/sessions/${sessionId}/end`, {
        method: 'PUT'
      });
    }

    async getSessionReport(sessionId) {
      return this._request(`/api/sessions/${sessionId}/report`);
    }

    // Violation endpoints
    async logViolation(sessionId, type, duration = 0, metadata = {}) {
      const violation = {
        sessionId,
        type,
        duration,
        metadata,
        timestamp: new Date().toISOString()
      };

      // Store locally as backup
      storage.storeViolation(violation);

      try {
        return await this._request('/api/violations', {
          method: 'POST',
          body: JSON.stringify(violation)
        });
      } catch (error) {
        logger.warn('Failed to log violation to server, stored locally:', error);
        return violation; // Return local copy
      }
    }

    async getViolations(sessionId) {
      return this._request(`/api/violations/${sessionId}`);
    }

    // Screenshot endpoints
    async uploadScreenshot(sessionId, type, dataUrl, metadata = {}) {
      // Store locally as backup
      storage.storeScreenshot(type, dataUrl);

      try {
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('screenshot', blob, `screenshot-${Date.now()}.png`);
        formData.append('sessionId', sessionId);
        formData.append('type', type);
        formData.append('metadata', JSON.stringify(metadata));

        const url = `${this.baseUrl}/api/screenshots`;
        const headers = {};
        if (this.apiKey) {
          headers['X-API-Key'] = this.apiKey;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: formData
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload screenshot');
        }

        return data;
      } catch (error) {
        logger.warn('Failed to upload screenshot, stored locally:', error);
        return { stored: true, local: true };
      }
    }

    async getScreenshots(sessionId) {
      return this._request(`/api/screenshots/${sessionId}`);
    }

    // Plagiarism endpoints
    async checkPlagiarism(sessionId, userId, examId, content) {
      return this._request('/api/plagiarism/check', {
        method: 'POST',
        body: JSON.stringify({ sessionId, userId, examId, content })
      });
    }

    async getPlagiarismReport(reportId) {
      return this._request(`/api/plagiarism/report/${reportId}`);
    }

    // Health check
    async healthCheck() {
      return this._request('/api/health');
    }
  }

  var defaultConfig = {
    // API configuration
    apiUrl: '',
    apiKey: '',

    // User/exam identifiers
    userId: '',
    examId: '',

    // Feature toggles
    features: {
      webcam: {
        enabled: true,
        interval: 30000, // 30 seconds
        quality: 0.8,
        facingMode: 'user'
      },
      screenMonitor: {
        enabled: true,
        interval: 60000, // 60 seconds
        quality: 0.8
      },
      tabSwitch: {
        enabled: true,
        maxWarnings: 3
      },
      inputTracking: {
        enabled: true,
        trackKeystrokes: true,
        trackMouse: true,
        detectCopyPaste: true
      }
    },

    // Callbacks
    onViolation: null,
    onError: null,
    onReady: null,
    onStart: null,
    onStop: null,

    // Violation types
    violationTypes: {
      TAB_SWITCH: 'tab_switch',
      WINDOW_BLUR: 'window_blur',
      FACE_NOT_DETECTED: 'face_not_detected',
      MULTIPLE_FACES: 'multiple_faces',
      COPY_PASTE: 'copy_paste',
      SUSPICIOUS_SHORTCUT: 'suspicious_shortcut',
      SCREEN_SHARE_STOPPED: 'screen_share_stopped',
      WEBCAM_STOPPED: 'webcam_stopped'
    },

    // Privacy settings
    privacy: {
      maskSensitiveKeys: true, // Don't log actual key content
      storeLocally: true // Store data locally as backup
    }
  };

  /**
   * Tab Switch Detection Module
   * Detects when user switches tabs or windows during exam
   */
  class TabMonitor extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = {
        maxWarnings: 3,
        ...config
      };
      this.isActive = false;
      this.switchCount = 0;
      this.lastSwitchTime = null;
      this.switchStartTime = null;
      this.violations = [];
    }

    /**
     * Start monitoring tab visibility
     */
    start() {
      if (this.isActive) {
        logger.warn('Tab monitor is already active');
        return;
      }

      this.isActive = true;
      this.switchCount = 0;
      this.violations = [];

      // Visibility change detection
      this._handleVisibilityChange = this._onVisibilityChange.bind(this);
      document.addEventListener('visibilitychange', this._handleVisibilityChange);

      // Window blur detection (for Alt+Tab, etc.)
      this._handleBlur = this._onBlur.bind(this);
      window.addEventListener('blur', this._handleBlur);

      // Focus detection for duration tracking
      this._handleFocus = this._onFocus.bind(this);
      window.addEventListener('focus', this._handleFocus);

      logger.info('Tab monitor started');
      this.emit('started');
    }

    /**
     * Stop monitoring
     */
    stop() {
      if (!this.isActive) return;

      this.isActive = false;
      document.removeEventListener('visibilitychange', this._handleVisibilityChange);
      window.removeEventListener('blur', this._handleBlur);
      window.removeEventListener('focus', this._handleFocus);

      logger.info('Tab monitor stopped');
      this.emit('stopped', { switchCount: this.switchCount, violations: this.violations });
    }

    /**
     * Handle visibility change events
     */
    _onVisibilityChange() {
      if (document.hidden) {
        this._handleSwitch('tab_switch');
      } else {
        this._handleReturn();
      }
    }

    /**
     * Handle window blur events
     */
    _onBlur() {
      if (this.isActive && !document.hidden) {
        this._handleSwitch('window_blur');
      }
    }

    /**
     * Handle window focus events
     */
    _onFocus() {
      if (this.isActive && this.switchStartTime) {
        this._handleReturn();
      }
    }

    /**
     * Handle tab/window switch
     * @param {string} type - Switch type
     */
    _handleSwitch(type) {
      this.switchStartTime = Date.now();
      this.switchCount++;

      const violation = {
        type,
        timestamp: new Date().toISOString(),
        count: this.switchCount
      };

      this.violations.push(violation);

      logger.warn(`${type} detected (count: ${this.switchCount})`);
      this.emit('violation', {
        type,
        timestamp: violation.timestamp,
        count: this.switchCount
      });

      // Check if max warnings exceeded
      if (this.switchCount >= this.config.maxWarnings) {
        this.emit('maxViolations', {
          type,
          count: this.switchCount,
          maxAllowed: this.config.maxWarnings
        });
      }
    }

    /**
     * Handle return to tab/window
     */
    _handleReturn() {
      if (this.switchStartTime) {
        const duration = Date.now() - this.switchStartTime;

        // Update the last violation with duration
        const lastViolation = this.violations[this.violations.length - 1];
        if (lastViolation) {
          lastViolation.duration = duration;
        }

        logger.info(`Returned after ${duration}ms`);
        this.emit('returned', {
          duration,
          switchCount: this.switchCount
        });

        this.switchStartTime = null;
      }
    }

    /**
     * Get current status
     */
    getStatus() {
      return {
        isActive: this.isActive,
        switchCount: this.switchCount,
        violations: this.violations,
        isCurrentlyAway: !!this.switchStartTime
      };
    }

    /**
     * Get all recorded violations
     */
    getViolations() {
      return this.violations.map(v => ({
        type: v.type,
        timestamp: v.timestamp,
        duration: v.duration || 0
      }));
    }

    /**
     * Reset violation count
     */
    reset() {
      this.switchCount = 0;
      this.violations = [];
      this.switchStartTime = null;
      logger.info('Tab monitor reset');
      this.emit('reset');
    }
  }

  /**
   * Input Tracking Module
   * Tracks keyboard and mouse activity, detects suspicious patterns
   */
  class InputTracker extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = {
        trackKeystrokes: true,
        trackMouse: true,
        detectCopyPaste: true,
        maskSensitiveKeys: true,
        ...config
      };
      this.isActive = false;
      this.keystrokeCount = 0;
      this.mouseClickCount = 0;
      this.mouseMoveCount = 0;
      this.violations = [];
      this.lastKeyTime = null;
      this.keystrokeIntervals = [];
    }

    /**
     * Start input tracking
     */
    start() {
      if (this.isActive) {
        logger.warn('Input tracker is already active');
        return;
      }

      this.isActive = true;
      this.keystrokeCount = 0;
      this.mouseClickCount = 0;
      this.mouseMoveCount = 0;
      this.violations = [];
      this.keystrokeIntervals = [];

      if (this.config.trackKeystrokes) {
        this._handleKeyDown = this._onKeyDown.bind(this);
        this._handleKeyUp = this._onKeyUp.bind(this);
        document.addEventListener('keydown', this._handleKeyDown);
        document.addEventListener('keyup', this._handleKeyUp);
      }

      if (this.config.trackMouse) {
        this._handleMouseMove = this._onMouseMove.bind(this);
        this._handleMouseDown = this._onMouseDown.bind(this);
        document.addEventListener('mousemove', this._handleMouseMove);
        document.addEventListener('mousedown', this._handleMouseDown);
      }

      if (this.config.detectCopyPaste) {
        this._handleCopy = this._onCopy.bind(this);
        this._handlePaste = this._onPaste.bind(this);
        this._handleCut = this._onCut.bind(this);
        document.addEventListener('copy', this._handleCopy);
        document.addEventListener('paste', this._handlePaste);
        document.addEventListener('cut', this._handleCut);
      }

      logger.info('Input tracker started');
      this.emit('started');
    }

    /**
     * Stop input tracking
     */
    stop() {
      if (!this.isActive) return;

      this.isActive = false;

      if (this._handleKeyDown) {
        document.removeEventListener('keydown', this._handleKeyDown);
      }
      if (this._handleKeyUp) {
        document.removeEventListener('keyup', this._handleKeyUp);
      }
      if (this._handleMouseMove) {
        document.removeEventListener('mousemove', this._handleMouseMove);
      }
      if (this._handleMouseDown) {
        document.removeEventListener('mousedown', this._handleMouseDown);
      }
      if (this._handleCopy) {
        document.removeEventListener('copy', this._handleCopy);
      }
      if (this._handlePaste) {
        document.removeEventListener('paste', this._handlePaste);
      }
      if (this._handleCut) {
        document.removeEventListener('cut', this._handleCut);
      }

      logger.info('Input tracker stopped');
      this.emit('stopped', this.getStats());
    }

    /**
     * Handle keydown events
     */
    _onKeyDown(event) {
      if (!this.isActive) return;

      const now = Date.now();
      this.keystrokeCount++;

      // Track keystroke timing
      if (this.lastKeyTime) {
        this.keystrokeIntervals.push(now - this.lastKeyTime);
      }
      this.lastKeyTime = now;

      // Detect suspicious shortcuts
      this._detectSuspiciousShortcut(event);

      // Emit keystroke event (masked for privacy)
      this.emit('keystroke', {
        count: this.keystrokeCount,
        key: this.config.maskSensitiveKeys ? this._maskKey(event.key) : event.key,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        timestamp: new Date().toISOString()
      });
    }

    /**
     * Handle keyup events
     */
    _onKeyUp(event) {
      if (!this.isActive) return;
      // Can be used for timing analysis
    }

    /**
     * Handle mouse move events
     */
    _onMouseMove(event) {
      if (!this.isActive) return;

      // Throttle mouse move events
      if (this._lastMouseMove && Date.now() - this._lastMouseMove < 100) {
        return;
      }
      this._lastMouseMove = Date.now();
      this.mouseMoveCount++;
    }

    /**
     * Handle mouse down events
     */
    _onMouseDown(event) {
      if (!this.isActive) return;

      this.mouseClickCount++;
      this.emit('mouseClick', {
        count: this.mouseClickCount,
        button: event.button,
        timestamp: new Date().toISOString()
      });
    }

    /**
     * Handle copy events
     */
    _onCopy(event) {
      if (!this.isActive) return;

      const violation = {
        type: 'copy_paste',
        action: 'copy',
        timestamp: new Date().toISOString()
      };
      this.violations.push(violation);

      logger.warn('Copy action detected');
      this.emit('violation', violation);
    }

    /**
     * Handle paste events
     */
    _onPaste(event) {
      if (!this.isActive) return;

      const violation = {
        type: 'copy_paste',
        action: 'paste',
        timestamp: new Date().toISOString()
      };
      this.violations.push(violation);

      logger.warn('Paste action detected');
      this.emit('violation', violation);
    }

    /**
     * Handle cut events
     */
    _onCut(event) {
      if (!this.isActive) return;

      const violation = {
        type: 'copy_paste',
        action: 'cut',
        timestamp: new Date().toISOString()
      };
      this.violations.push(violation);

      logger.warn('Cut action detected');
      this.emit('violation', violation);
    }

    /**
     * Detect suspicious keyboard shortcuts
     */
    _detectSuspiciousShortcut(event) {
      const suspiciousCombinations = [
        { key: 'Tab', altKey: true },           // Alt+Tab
        { key: 'Tab', ctrlKey: true },          // Ctrl+Tab
        { key: 'Escape', altKey: true },        // Alt+Esc
        { key: 'F11' },                          // Fullscreen toggle
        { key: 'F12' },                          // Dev tools
        { key: 'i', ctrlKey: true, shiftKey: true }, // Dev tools
        { key: 'j', ctrlKey: true, shiftKey: true }, // Dev tools
        { key: 'c', ctrlKey: true, shiftKey: true }, // Dev tools
        { key: 'k', ctrlKey: true, shiftKey: true }, // Dev tools
      ];

      for (const combo of suspiciousCombinations) {
        if (
          event.key.toLowerCase() === combo.key.toLowerCase() &&
          !!event.altKey === !!combo.altKey &&
          !!event.ctrlKey === !!combo.ctrlKey &&
          !!event.shiftKey === !!combo.shiftKey &&
          !!event.metaKey === !!combo.metaKey
        ) {
          const violation = {
            type: 'suspicious_shortcut',
            shortcut: this._describeShortcut(event),
            timestamp: new Date().toISOString()
          };
          this.violations.push(violation);

          logger.warn('Suspicious shortcut detected:', violation.shortcut);
          this.emit('violation', violation);
          break;
        }
      }
    }

    /**
     * Describe keyboard shortcut
     */
    _describeShortcut(event) {
      const parts = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Meta');
      parts.push(event.key);
      return parts.join('+');
    }

    /**
     * Mask sensitive key for privacy
     */
    _maskKey(key) {
      const sensitiveKeys = ['Backspace', 'Delete', 'Enter', 'Tab', 'Escape'];
      if (sensitiveKeys.includes(key)) {
        return key;
      }
      if (key.length === 1) {
        return '*';
      }
      return key;
    }

    /**
     * Get current statistics
     */
    getStats() {
      const avgInterval = this.keystrokeIntervals.length > 0
        ? this.keystrokeIntervals.reduce((a, b) => a + b, 0) / this.keystrokeIntervals.length
        : 0;

      return {
        keystrokeCount: this.keystrokeCount,
        mouseClickCount: this.mouseClickCount,
        mouseMoveCount: this.mouseMoveCount,
        violationCount: this.violations.length,
        averageKeystrokeInterval: avgInterval,
        violations: this.violations
      };
    }

    /**
     * Get all recorded violations
     */
    getViolations() {
      return this.violations;
    }

    /**
     * Reset statistics
     */
    reset() {
      this.keystrokeCount = 0;
      this.mouseClickCount = 0;
      this.mouseMoveCount = 0;
      this.violations = [];
      this.keystrokeIntervals = [];
      this.lastKeyTime = null;
      logger.info('Input tracker reset');
      this.emit('reset');
    }
  }

  /**
   * Webcam Monitor Module
   * Captures and monitors webcam feed during exam
   */
  class WebcamMonitor extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = {
        interval: 30000, // 30 seconds
        quality: 0.8,
        facingMode: 'user',
        width: 640,
        height: 480,
        ...config
      };
      this.isActive = false;
      this.stream = null;
      this.videoElement = null;
      this.canvasElement = null;
      this.captureInterval = null;
      this.screenshots = [];
    }

    /**
     * Start webcam monitoring
     * @returns {Promise<HTMLVideoElement>} Video element for preview
     */
    async start() {
      if (this.isActive) {
        logger.warn('Webcam monitor is already active');
        return this.videoElement;
      }

      try {
        // Request camera access
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: this.config.width },
            height: { ideal: this.config.height },
            facingMode: this.config.facingMode
          },
          audio: false
        });

        // Create video element for preview
        this.videoElement = document.createElement('video');
        this.videoElement.srcObject = this.stream;
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.muted = true;
        await this.videoElement.play();

        // Create canvas for screenshots
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = this.config.width;
        this.canvasElement.height = this.config.height;

        this.isActive = true;
        this.screenshots = [];

        // Start periodic capture
        if (this.config.interval > 0) {
          this.captureInterval = setInterval(() => {
            this.capture();
          }, this.config.interval);
        }

        logger.info('Webcam monitor started');
        this.emit('started', { videoElement: this.videoElement });

        return this.videoElement;
      } catch (error) {
        logger.error('Failed to start webcam:', error);
        this.emit('error', {
          type: 'webcam_access_denied',
          message: error.message
        });
        throw error;
      }
    }

    /**
     * Capture a screenshot from the webcam
     * @returns {Promise<string>} Data URL of the screenshot
     */
    async capture() {
      if (!this.isActive || !this.videoElement || !this.canvasElement) {
        logger.warn('Webcam not active, cannot capture');
        return null;
      }

      try {
        const ctx = this.canvasElement.getContext('2d');
        ctx.drawImage(
          this.videoElement,
          0, 0,
          this.canvasElement.width,
          this.canvasElement.height
        );

        const dataUrl = this.canvasElement.toDataURL('image/jpeg', this.config.quality);
        const timestamp = new Date().toISOString();

        const screenshot = {
          dataUrl,
          timestamp,
          type: 'webcam'
        };

        this.screenshots.push(screenshot);
        logger.debug('Webcam screenshot captured');
        this.emit('capture', screenshot);

        return dataUrl;
      } catch (error) {
        logger.error('Failed to capture webcam screenshot:', error);
        this.emit('error', {
          type: 'capture_failed',
          message: error.message
        });
        return null;
      }
    }

    /**
     * Stop webcam monitoring
     */
    stop() {
      if (!this.isActive) return;

      // Stop capture interval
      if (this.captureInterval) {
        clearInterval(this.captureInterval);
        this.captureInterval = null;
      }

      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      // Clean up video element
      if (this.videoElement) {
        this.videoElement.srcObject = null;
        this.videoElement = null;
      }

      this.canvasElement = null;
      this.isActive = false;

      logger.info('Webcam monitor stopped');
      this.emit('stopped', { screenshots: this.screenshots });
    }

    /**
     * Get video element for preview
     */
    getVideoElement() {
      return this.videoElement;
    }

    /**
     * Check if webcam is active
     */
    isRunning() {
      return this.isActive && this.stream !== null;
    }

    /**
     * Get all captured screenshots
     */
    getScreenshots() {
      return this.screenshots;
    }

    /**
     * Get current status
     */
    getStatus() {
      return {
        isActive: this.isActive,
        hasStream: this.stream !== null,
        screenshotCount: this.screenshots.length,
        config: this.config
      };
    }

    /**
     * Check camera permissions
     * @returns {Promise<string>} Permission status
     */
    static async checkPermission() {
      try {
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state; // 'granted', 'denied', or 'prompt'
      } catch (error) {
        // Fallback for browsers that don't support permissions API
        return 'unknown';
      }
    }

    /**
     * Get available video devices
     * @returns {Promise<MediaDeviceInfo[]>} List of video input devices
     */
    static async getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
      } catch (error) {
        logger.error('Failed to get video devices:', error);
        return [];
      }
    }
  }

  /**
   * Screen Monitor Module
   * Captures screen during exam
   */
  class ScreenMonitor extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = {
        interval: 60000, // 60 seconds
        quality: 0.8,
        ...config
      };
      this.isActive = false;
      this.stream = null;
      this.videoElement = null;
      this.canvasElement = null;
      this.captureInterval = null;
      this.screenshots = [];
    }

    /**
     * Start screen monitoring
     * @returns {Promise<HTMLVideoElement>} Video element for preview
     */
    async start() {
      if (this.isActive) {
        logger.warn('Screen monitor is already active');
        return this.videoElement;
      }

      try {
        // Request screen share
        this.stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          },
          audio: false
        });

        // Create video element
        this.videoElement = document.createElement('video');
        this.videoElement.srcObject = this.stream;
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.muted = true;
        await this.videoElement.play();

        // Create canvas for screenshots
        this.canvasElement = document.createElement('canvas');

        // Handle stream end (user clicks "Stop sharing")
        this.stream.getVideoTracks()[0].addEventListener('ended', () => {
          this._handleStreamEnd();
        });

        this.isActive = true;
        this.screenshots = [];

        // Start periodic capture
        if (this.config.interval > 0) {
          this.captureInterval = setInterval(() => {
            this.capture();
          }, this.config.interval);
        }

        logger.info('Screen monitor started');
        this.emit('started', { videoElement: this.videoElement });

        return this.videoElement;
      } catch (error) {
        logger.error('Failed to start screen capture:', error);
        this.emit('error', {
          type: 'screen_access_denied',
          message: error.message
        });
        throw error;
      }
    }

    /**
     * Handle stream end (user stopped sharing)
     */
    _handleStreamEnd() {
      if (!this.isActive) return;

      logger.warn('Screen share stopped by user');
      this.emit('violation', {
        type: 'screen_share_stopped',
        timestamp: new Date().toISOString()
      });

      this.stop();
    }

    /**
     * Capture a screenshot of the screen
     * @returns {Promise<string>} Data URL of the screenshot
     */
    async capture() {
      if (!this.isActive || !this.videoElement || !this.canvasElement) {
        logger.warn('Screen monitor not active, cannot capture');
        return null;
      }

      try {
        const videoTrack = this.stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        // Set canvas size to match video
        this.canvasElement.width = settings.width || this.videoElement.videoWidth;
        this.canvasElement.height = settings.height || this.videoElement.videoHeight;

        const ctx = this.canvasElement.getContext('2d');
        ctx.drawImage(
          this.videoElement,
          0, 0,
          this.canvasElement.width,
          this.canvasElement.height
        );

        const dataUrl = this.canvasElement.toDataURL('image/jpeg', this.config.quality);
        const timestamp = new Date().toISOString();

        const screenshot = {
          dataUrl,
          timestamp,
          type: 'screen',
          width: this.canvasElement.width,
          height: this.canvasElement.height
        };

        this.screenshots.push(screenshot);
        logger.debug('Screen screenshot captured');
        this.emit('capture', screenshot);

        return dataUrl;
      } catch (error) {
        logger.error('Failed to capture screen screenshot:', error);
        this.emit('error', {
          type: 'capture_failed',
          message: error.message
        });
        return null;
      }
    }

    /**
     * Stop screen monitoring
     */
    stop() {
      if (!this.isActive) return;

      // Stop capture interval
      if (this.captureInterval) {
        clearInterval(this.captureInterval);
        this.captureInterval = null;
      }

      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      // Clean up video element
      if (this.videoElement) {
        this.videoElement.srcObject = null;
        this.videoElement = null;
      }

      this.canvasElement = null;
      this.isActive = false;

      logger.info('Screen monitor stopped');
      this.emit('stopped', { screenshots: this.screenshots });
    }

    /**
     * Get video element for preview
     */
    getVideoElement() {
      return this.videoElement;
    }

    /**
     * Check if screen monitoring is active
     */
    isRunning() {
      return this.isActive && this.stream !== null;
    }

    /**
     * Get all captured screenshots
     */
    getScreenshots() {
      return this.screenshots;
    }

    /**
     * Get current status
     */
    getStatus() {
      return {
        isActive: this.isActive,
        hasStream: this.stream !== null,
        screenshotCount: this.screenshots.length,
        config: this.config
      };
    }

    /**
     * Check if screen capture is supported
     */
    static isSupported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    }
  }

  /**
   * Text similarity algorithms for plagiarism detection
   */
  class TextSimilarity {
    /**
     * Tokenize text into words
     * @param {string} text - Input text
     * @returns {Set<string>} Set of words
     */
    static tokenize(text) {
      return new Set(
        text.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 2)
      );
    }

    /**
     * Calculate Jaccard similarity between two texts
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {number} Similarity score (0-1)
     */
    static jaccardSimilarity(text1, text2) {
      const set1 = this.tokenize(text1);
      const set2 = this.tokenize(text2);

      if (set1.size === 0 && set2.size === 0) return 1;
      if (set1.size === 0 || set2.size === 0) return 0;

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);

      return intersection.size / union.size;
    }

    /**
     * Calculate n-grams from text
     * @param {string} text - Input text
     * @param {number} n - N-gram size
     * @returns {string[]} Array of n-grams
     */
    static getNgrams(text, n = 3) {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 0);

      const ngrams = [];
      for (let i = 0; i <= words.length - n; i++) {
        ngrams.push(words.slice(i, i + n).join(' '));
      }
      return ngrams;
    }

    /**
     * Calculate n-gram similarity between two texts
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @param {number} n - N-gram size
     * @returns {number} Similarity score (0-1)
     */
    static ngramSimilarity(text1, text2, n = 3) {
      const ngrams1 = new Set(this.getNgrams(text1, n));
      const ngrams2 = new Set(this.getNgrams(text2, n));

      if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
      if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

      const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
      const union = new Set([...ngrams1, ...ngrams2]);

      return intersection.size / union.size;
    }

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Edit distance
     */
    static levenshteinDistance(str1, str2) {
      const m = str1.length;
      const n = str2.length;
      const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (str1[i - 1] === str2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
          } else {
            dp[i][j] = 1 + Math.min(
              dp[i - 1][j],     // deletion
              dp[i][j - 1],     // insertion
              dp[i - 1][j - 1]  // substitution
            );
          }
        }
      }

      return dp[m][n];
    }

    /**
     * Calculate Levenshtein similarity (normalized)
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score (0-1)
     */
    static levenshteinSimilarity(str1, str2) {
      if (str1 === str2) return 1;
      const distance = this.levenshteinDistance(str1, str2);
      const maxLength = Math.max(str1.length, str2.length);
      if (maxLength === 0) return 1;
      return 1 - distance / maxLength;
    }

    /**
     * Calculate overall similarity score using multiple methods
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {object} Similarity scores
     */
    static calculateSimilarity(text1, text2) {
      const jaccard = this.jaccardSimilarity(text1, text2);
      const ngram = this.ngramSimilarity(text1, text2, 3);
      const levenshtein = this.levenshteinSimilarity(
        text1.toLowerCase().replace(/\s+/g, ' '),
        text2.toLowerCase().replace(/\s+/g, ' ')
      );

      // Weighted average
      const overall = (jaccard * 0.3 + ngram * 0.4 + levenshtein * 0.3);

      return {
        jaccard,
        ngram,
        levenshtein,
        overall,
        isSimilar: overall > 0.7
      };
    }

    /**
     * Find matching sequences between two texts
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @param {number} minLength - Minimum match length
     * @returns {string[]} Array of matching sequences
     */
    static findMatches(text1, text2, minLength = 10) {
      const sentences1 = text1.split(/[.!?]+/).filter(s => s.trim().length >= minLength);
      const sentences2 = text2.split(/[.!?]+/).filter(s => s.trim().length >= minLength);

      const matches = [];

      for (const s1 of sentences1) {
        for (const s2 of sentences2) {
          const similarity = this.levenshteinSimilarity(
            s1.toLowerCase().trim(),
            s2.toLowerCase().trim()
          );
          if (similarity > 0.8) {
            matches.push({
              text1: s1.trim(),
              text2: s2.trim(),
              similarity
            });
          }
        }
      }

      return matches;
    }
  }

  /**
   * Plagiarism Checker Module
   * Checks text submissions for plagiarism against a database
   */
  class PlagiarismChecker extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = {
        apiClient: null,
        apiUrl: '',
        apiKey: '',
        localThreshold: 0.7, // Similarity threshold for local check
        ...config
      };
      this.apiClient = config.apiClient || new ApiClient({
        apiUrl: this.config.apiUrl,
        apiKey: this.config.apiKey
      });
      this.submissions = [];
    }

    /**
     * Check text for plagiarism
     * @param {string} content - Text content to check
     * @param {object} options - Check options
     * @returns {Promise<object>} Plagiarism check result
     */
    async check(content, options = {}) {
      const {
        sessionId,
        userId,
        examId,
        localOnly = false,
        compareWith = [] // Additional texts to compare with locally
      } = options;

      const result = {
        content,
        timestamp: new Date().toISOString(),
        localResults: null,
        serverResults: null,
        overallScore: 0,
        isPlagiarized: false
      };

      // Perform local similarity checks
      result.localResults = await this._localCheck(content, compareWith);

      // Perform server check if not localOnly
      if (!localOnly && sessionId && userId && examId && this.config.apiUrl) {
        try {
          result.serverResults = await this.apiClient.checkPlagiarism(
            sessionId,
            userId,
            examId,
            content
          );
        } catch (error) {
          logger.error('Server plagiarism check failed:', error);
          result.serverError = error.message;
        }
      }

      // Calculate overall score
      result.overallScore = this._calculateOverallScore(result);
      result.isPlagiarized = result.overallScore > this.config.localThreshold;

      logger.info('Plagiarism check completed:', {
        overallScore: result.overallScore,
        isPlagiarized: result.isPlagiarized
      });

      this.emit('checked', result);
      return result;
    }

    /**
     * Perform local similarity check
     * @param {string} content - Content to check
     * @param {string[]} compareWith - Texts to compare against
     * @returns {object} Local check results
     */
    async _localCheck(content, compareWith = []) {
      const results = {
        similarityScores: [],
        matches: []
      };

      // Compare with provided texts
      for (let i = 0; i < compareWith.length; i++) {
        const text = compareWith[i];
        const similarity = TextSimilarity.calculateSimilarity(content, text);

        results.similarityScores.push({
          index: i,
          ...similarity
        });

        if (similarity.isSimilar) {
          const matches = TextSimilarity.findMatches(content, text);
          results.matches.push({
            index: i,
            matches,
            similarity: similarity.overall
          });
        }
      }

      // Compare with stored submissions
      for (const submission of this.submissions) {
        const similarity = TextSimilarity.calculateSimilarity(content, submission.content);

        if (similarity.isSimilar) {
          results.similarityScores.push({
            submissionId: submission.id,
            ...similarity
          });

          const matches = TextSimilarity.findMatches(content, submission.content);
          results.matches.push({
            submissionId: submission.id,
            matches,
            similarity: similarity.overall
          });
        }
      }

      // Get highest similarity
      const maxSimilarity = results.similarityScores.length > 0
        ? Math.max(...results.similarityScores.map(s => s.overall))
        : 0;

      results.maxSimilarity = maxSimilarity;
      results.hasMatches = results.matches.length > 0;

      return results;
    }

    /**
     * Calculate overall plagiarism score
     * @param {object} result - Check result
     * @returns {number} Overall score (0-1)
     */
    _calculateOverallScore(result) {
      const scores = [];

      if (result.localResults && result.localResults.maxSimilarity) {
        scores.push(result.localResults.maxSimilarity);
      }

      if (result.serverResults && result.serverResults.similarityScore) {
        scores.push(result.serverResults.similarityScore);
      }

      if (scores.length === 0) return 0;
      return Math.max(...scores);
    }

    /**
     * Store a submission for future comparisons
     * @param {string} id - Submission ID
     * @param {string} content - Submission content
     */
    storeSubmission(id, content) {
      this.submissions.push({
        id,
        content,
        storedAt: new Date().toISOString()
      });
      logger.debug('Submission stored:', id);
    }

    /**
     * Clear stored submissions
     */
    clearSubmissions() {
      this.submissions = [];
      logger.info('Stored submissions cleared');
    }

    /**
     * Compare two texts directly
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {object} Similarity result
     */
    compare(text1, text2) {
      const similarity = TextSimilarity.calculateSimilarity(text1, text2);
      const matches = TextSimilarity.findMatches(text1, text2);

      return {
        ...similarity,
        matches,
        isPlagiarized: similarity.overall > this.config.localThreshold
      };
    }

    /**
     * Get detailed analysis of similarity
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {object} Detailed analysis
     */
    analyze(text1, text2) {
      const jaccard = TextSimilarity.jaccardSimilarity(text1, text2);
      const ngram = TextSimilarity.ngramSimilarity(text1, text2, 3);
      const levenshtein = TextSimilarity.levenshteinSimilarity(text1, text2);
      const matches = TextSimilarity.findMatches(text1, text2);

      // Get word counts
      const words1 = text1.split(/\s+/).filter(w => w.length > 0);
      const words2 = text2.split(/\s+/).filter(w => w.length > 0);

      return {
        text1: {
          wordCount: words1.length,
          characterCount: text1.length
        },
        text2: {
          wordCount: words2.length,
          characterCount: text2.length
        },
        similarity: {
          jaccard,
          ngram,
          levenshtein,
          overall: (jaccard * 0.3 + ngram * 0.4 + levenshtein * 0.3)
        },
        matches,
        uniqueMatches: matches.length,
        matchPercentage: matches.length > 0
          ? (matches.length / Math.max(words1.length, words2.length) * 100).toFixed(2)
          : 0
      };
    }

    /**
     * Set API configuration
     * @param {object} config - API configuration
     */
    setApiConfig(config) {
      if (config.apiUrl) this.config.apiUrl = config.apiUrl;
      if (config.apiKey) this.config.apiKey = config.apiKey;
      this.apiClient.setConfig({
        apiUrl: this.config.apiUrl,
        apiKey: this.config.apiKey
      });
    }
  }

  /**
   * Main Proctor class
   * Orchestrates all proctoring modules and manages sessions
   */
  class Proctor extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = this._mergeConfig(defaultConfig, config);
      this.sessionId = null;
      this.isActive = false;
      this.startTime = null;

      // Initialize API client
      this.apiClient = new ApiClient({
        apiUrl: this.config.apiUrl,
        apiKey: this.config.apiKey
      });

      // Initialize modules
      this.modules = {
        tabMonitor: new TabMonitor(this.config.features.tabSwitch),
        inputTracker: new InputTracker(this.config.features.inputTracking),
        webcam: new WebcamMonitor(this.config.features.webcam),
        screenMonitor: new ScreenMonitor(this.config.features.screenMonitor),
        plagiarism: new PlagiarismChecker({
          apiClient: this.apiClient,
          apiUrl: this.config.apiUrl,
          apiKey: this.config.apiKey
        })
      };

      this._setupModuleListeners();
    }

    /**
     * Merge user config with defaults
     */
    _mergeConfig(defaults, userConfig) {
      return {
        ...defaults,
        ...userConfig,
        features: {
          ...defaults.features,
          ...(userConfig.features || {})
        }
      };
    }

    /**
     * Setup event listeners for all modules
     */
    _setupModuleListeners() {
      // Tab monitor events
      this.modules.tabMonitor.on('violation', (data) => {
        this._handleViolation('tab_switch', data);
      });

      this.modules.tabMonitor.on('maxViolations', (data) => {
        this.emit('maxViolations', data);
      });

      this.modules.tabMonitor.on('returned', (data) => {
        this._logViolation('tab_switch', data.duration, data);
      });

      // Input tracker events
      this.modules.inputTracker.on('violation', (data) => {
        this._handleViolation(data.type, data);
      });

      // Webcam events
      this.modules.webcam.on('capture', async (screenshot) => {
        if (this.sessionId && this.config.apiUrl) {
          await this.apiClient.uploadScreenshot(
            this.sessionId,
            'webcam',
            screenshot.dataUrl,
            { timestamp: screenshot.timestamp }
          );
        }
        this.emit('webcamCapture', screenshot);
      });

      this.modules.webcam.on('error', (error) => {
        this._handleError(error);
      });

      // Screen monitor events
      this.modules.screenMonitor.on('capture', async (screenshot) => {
        if (this.sessionId && this.config.apiUrl) {
          await this.apiClient.uploadScreenshot(
            this.sessionId,
            'screen',
            screenshot.dataUrl,
            { timestamp: screenshot.timestamp }
          );
        }
        this.emit('screenCapture', screenshot);
      });

      this.modules.screenMonitor.on('violation', (data) => {
        this._handleViolation('screen_share_stopped', data);
      });

      this.modules.screenMonitor.on('error', (error) => {
        this._handleError(error);
      });

      // Plagiarism checker events
      this.modules.plagiarism.on('checked', (result) => {
        this.emit('plagiarismCheck', result);
      });
    }

    /**
     * Handle a violation event
     */
    _handleViolation(type, data) {
      logger.warn('Violation detected:', type, data);
      this.emit('violation', { type, ...data, timestamp: data.timestamp || new Date().toISOString() });

      // Call user callback if provided
      if (typeof this.config.onViolation === 'function') {
        this.config.onViolation(type, data);
      }
    }

    /**
     * Handle an error event
     */
    _handleError(error) {
      logger.error('Error:', error);
      this.emit('error', error);

      // Call user callback if provided
      if (typeof this.config.onError === 'function') {
        this.config.onError(error);
      }
    }

    /**
     * Log a violation to the server
     */
    async _logViolation(type, duration = 0, metadata = {}) {
      if (!this.sessionId || !this.config.apiUrl) return;

      try {
        await this.apiClient.logViolation(this.sessionId, type, duration, metadata);
      } catch (error) {
        logger.error('Failed to log violation:', error);
      }
    }

    /**
     * Start proctoring session
     */
    async start() {
      if (this.isActive) {
        throw new Error('Proctoring session is already active');
      }

      try {
        // Create session on server
        if (this.config.apiUrl) {
          const session = await this.apiClient.createSession(
            this.config.userId,
            this.config.examId,
            {
              features: this.config.features,
              startedAt: new Date().toISOString()
            }
          );
          this.sessionId = session.id;
          logger.info('Session created:', this.sessionId);
        }

        this.isActive = true;
        this.startTime = Date.now();

        // Start modules based on config
        const startPromises = [];

        if (this.config.features.tabSwitch.enabled) {
          this.modules.tabMonitor.start();
        }

        if (this.config.features.inputTracking.enabled) {
          this.modules.inputTracker.start();
        }

        if (this.config.features.webcam.enabled) {
          startPromises.push(
            this.modules.webcam.start().catch(err => {
              this._handleError({ type: 'webcam_error', message: err.message });
            })
          );
        }

        if (this.config.features.screenMonitor.enabled) {
          startPromises.push(
            this.modules.screenMonitor.start().catch(err => {
              this._handleError({ type: 'screen_error', message: err.message });
            })
          );
        }

        await Promise.all(startPromises);

        logger.info('Proctoring started');
        this.emit('started', { sessionId: this.sessionId });

        // Call user callback if provided
        if (typeof this.config.onStart === 'function') {
          this.config.onStart({ sessionId: this.sessionId });
        }

        // Call ready callback
        if (typeof this.config.onReady === 'function') {
          this.config.onReady({ sessionId: this.sessionId });
        }

        return { sessionId: this.sessionId };
      } catch (error) {
        logger.error('Failed to start proctoring:', error);
        this._handleError({ type: 'start_failed', message: error.message });
        throw error;
      }
    }

    /**
     * Stop proctoring session
     */
    async stop() {
      if (!this.isActive) {
        throw new Error('No active proctoring session');
      }

      try {
        // Stop all modules
        this.modules.tabMonitor.stop();
        this.modules.inputTracker.stop();
        this.modules.webcam.stop();
        this.modules.screenMonitor.stop();

        // Collect statistics
        const stats = this.getStats();

        // End session on server
        if (this.sessionId && this.config.apiUrl) {
          const report = await this.apiClient.endSession(this.sessionId);
          stats.serverReport = report;
        }

        this.isActive = false;
        const duration = Date.now() - this.startTime;

        logger.info('Proctoring stopped');
        this.emit('stopped', { ...stats, duration });

        // Call user callback if provided
        if (typeof this.config.onStop === 'function') {
          this.config.onStop({ ...stats, duration });
        }

        return stats;
      } catch (error) {
        logger.error('Failed to stop proctoring:', error);
        this._handleError({ type: 'stop_failed', message: error.message });
        throw error;
      }
    }

    /**
     * Get current statistics
     */
    getStats() {
      return {
        sessionId: this.sessionId,
        userId: this.config.userId,
        examId: this.config.examId,
        startTime: this.startTime ? new Date(this.startTime).toISOString() : null,
        duration: this.startTime ? Date.now() - this.startTime : 0,
        isActive: this.isActive,
        tabMonitor: this.modules.tabMonitor.getStatus(),
        inputTracker: this.modules.inputTracker.getStats(),
        webcam: this.modules.webcam.getStatus(),
        screenMonitor: this.modules.screenMonitor.getStatus(),
        violations: [
          ...this.modules.tabMonitor.getViolations(),
          ...this.modules.inputTracker.getViolations()
        ]
      };
    }

    /**
     * Get session report from server
     */
    async getReport() {
      if (!this.sessionId) {
        throw new Error('No active session');
      }

      if (!this.config.apiUrl) {
        return this.getStats();
      }

      return this.apiClient.getSessionReport(this.sessionId);
    }

    /**
     * Check content for plagiarism
     */
    async checkPlagiarism(content, options = {}) {
      return this.modules.plagiarism.check(content, {
        sessionId: this.sessionId,
        userId: this.config.userId,
        examId: this.config.examId,
        ...options
      });
    }

    /**
     * Get webcam video element for preview
     */
    getWebcamPreview() {
      return this.modules.webcam.getVideoElement();
    }

    /**
     * Get screen video element for preview
     */
    getScreenPreview() {
      return this.modules.screenMonitor.getVideoElement();
    }

    /**
     * Take a manual webcam screenshot
     */
    async captureWebcam() {
      return this.modules.webcam.capture();
    }

    /**
     * Take a manual screen screenshot
     */
    async captureScreen() {
      return this.modules.screenMonitor.capture();
    }

    /**
     * Check permissions for all required features
     */
    static async checkPermissions() {
      const permissions = {
        camera: 'unknown',
        screen: 'unknown'
      };

      try {
        const cameraResult = await navigator.permissions.query({ name: 'camera' });
        permissions.camera = cameraResult.state;
      } catch (e) {
        // Browser doesn't support permissions API for camera
      }

      // Screen capture permissions are handled differently
      permissions.screen = 'prompt';

      return permissions;
    }

    /**
     * Request permissions for webcam and screen
     */
    static async requestPermissions() {
      const results = {
        camera: false,
        screen: false
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        results.camera = true;
      } catch (e) {
        results.camera = false;
      }

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        results.screen = true;
      } catch (e) {
        results.screen = false;
      }

      return results;
    }
  }

  // Main entry point for Proctor library

  // Export individual modules for advanced usage
  const modules = {
    TabMonitor,
    InputTracker,
    WebcamMonitor,
    ScreenMonitor,
    PlagiarismChecker
  };

  // Export utilities
  const utils = {
    EventEmitter,
    TextSimilarity,
    ApiClient,
    storage,
    logger
  };

  // Also expose globally for script tag usage
  if (typeof window !== 'undefined') {
    window.Proctor = Proctor;
    window.ProctorModules = modules;
    window.ProctorUtils = utils;
  }

  exports.ApiClient = ApiClient;
  exports.EventEmitter = EventEmitter;
  exports.InputTracker = InputTracker;
  exports.PlagiarismChecker = PlagiarismChecker;
  exports.Proctor = Proctor;
  exports.ScreenMonitor = ScreenMonitor;
  exports.TabMonitor = TabMonitor;
  exports.TextSimilarity = TextSimilarity;
  exports.WebcamMonitor = WebcamMonitor;
  exports.default = Proctor;
  exports.logger = logger;
  exports.modules = modules;
  exports.storage = storage;
  exports.utils = utils;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=proctor.umd.js.map
