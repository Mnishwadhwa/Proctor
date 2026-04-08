import { EventEmitter } from '../utils/eventEmitter.js';
import logger from '../utils/logger.js';

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

export default InputTracker;