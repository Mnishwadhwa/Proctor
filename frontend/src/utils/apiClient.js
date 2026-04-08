import storage from './storage.js';
import logger from './logger.js';

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

export default ApiClient;