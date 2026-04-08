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

export default new Logger();