import { EventEmitter } from '../utils/eventEmitter.js';
import logger from '../utils/logger.js';

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

export default ScreenMonitor;