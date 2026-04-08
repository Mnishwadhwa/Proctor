export default {
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