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

export default new Storage();