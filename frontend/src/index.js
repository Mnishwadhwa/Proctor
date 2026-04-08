// Main entry point for Proctor library
import Proctor from './proctor.js';
import { EventEmitter } from './utils/eventEmitter.js';
import TabMonitor from './modules/tabMonitor.js';
import InputTracker from './modules/inputTracker.js';
import WebcamMonitor from './modules/webcam.js';
import ScreenMonitor from './modules/screenMonitor.js';
import PlagiarismChecker from './modules/plagiarism.js';
import TextSimilarity from './utils/textSimilarity.js';
import ApiClient from './utils/apiClient.js';
import storage from './utils/storage.js';
import logger from './utils/logger.js';

// Export main class and modules
export {
  Proctor,
  EventEmitter,
  TabMonitor,
  InputTracker,
  WebcamMonitor,
  ScreenMonitor,
  PlagiarismChecker,
  TextSimilarity,
  ApiClient,
  storage,
  logger
};

// Export individual modules for advanced usage
export const modules = {
  TabMonitor,
  InputTracker,
  WebcamMonitor,
  ScreenMonitor,
  PlagiarismChecker
};

// Export utilities
export const utils = {
  EventEmitter,
  TextSimilarity,
  ApiClient,
  storage,
  logger
};

// Default export
export default Proctor;

// Also expose globally for script tag usage
if (typeof window !== 'undefined') {
  window.Proctor = Proctor;
  window.ProctorModules = modules;
  window.ProctorUtils = utils;
}