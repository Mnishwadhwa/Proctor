import { EventEmitter } from '../utils/eventEmitter.js';
import logger from '../utils/logger.js';

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

export default WebcamMonitor;