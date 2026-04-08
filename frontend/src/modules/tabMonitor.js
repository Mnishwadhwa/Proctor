import { EventEmitter } from '../utils/eventEmitter.js';
import logger from '../utils/logger.js';

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

export default TabMonitor;