import { EventEmitter } from './utils/eventEmitter.js';
import ApiClient from './utils/apiClient.js';
import storage from './utils/storage.js';
import logger from './utils/logger.js';
import defaultConfig from './config/defaults.js';

// Modules
import TabMonitor from './modules/tabMonitor.js';
import InputTracker from './modules/inputTracker.js';
import WebcamMonitor from './modules/webcam.js';
import ScreenMonitor from './modules/screenMonitor.js';
import PlagiarismChecker from './modules/plagiarism.js';

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

export default Proctor;