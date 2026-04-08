import { EventEmitter } from '../utils/eventEmitter.js';
import TextSimilarity from '../utils/textSimilarity.js';
import ApiClient from '../utils/apiClient.js';
import logger from '../utils/logger.js';

/**
 * Plagiarism Checker Module
 * Checks text submissions for plagiarism against a database
 */
class PlagiarismChecker extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      apiClient: null,
      apiUrl: '',
      apiKey: '',
      localThreshold: 0.7, // Similarity threshold for local check
      ...config
    };
    this.apiClient = config.apiClient || new ApiClient({
      apiUrl: this.config.apiUrl,
      apiKey: this.config.apiKey
    });
    this.submissions = [];
  }

  /**
   * Check text for plagiarism
   * @param {string} content - Text content to check
   * @param {object} options - Check options
   * @returns {Promise<object>} Plagiarism check result
   */
  async check(content, options = {}) {
    const {
      sessionId,
      userId,
      examId,
      localOnly = false,
      compareWith = [] // Additional texts to compare with locally
    } = options;

    const result = {
      content,
      timestamp: new Date().toISOString(),
      localResults: null,
      serverResults: null,
      overallScore: 0,
      isPlagiarized: false
    };

    // Perform local similarity checks
    result.localResults = await this._localCheck(content, compareWith);

    // Perform server check if not localOnly
    if (!localOnly && sessionId && userId && examId && this.config.apiUrl) {
      try {
        result.serverResults = await this.apiClient.checkPlagiarism(
          sessionId,
          userId,
          examId,
          content
        );
      } catch (error) {
        logger.error('Server plagiarism check failed:', error);
        result.serverError = error.message;
      }
    }

    // Calculate overall score
    result.overallScore = this._calculateOverallScore(result);
    result.isPlagiarized = result.overallScore > this.config.localThreshold;

    logger.info('Plagiarism check completed:', {
      overallScore: result.overallScore,
      isPlagiarized: result.isPlagiarized
    });

    this.emit('checked', result);
    return result;
  }

  /**
   * Perform local similarity check
   * @param {string} content - Content to check
   * @param {string[]} compareWith - Texts to compare against
   * @returns {object} Local check results
   */
  async _localCheck(content, compareWith = []) {
    const results = {
      similarityScores: [],
      matches: []
    };

    // Compare with provided texts
    for (let i = 0; i < compareWith.length; i++) {
      const text = compareWith[i];
      const similarity = TextSimilarity.calculateSimilarity(content, text);

      results.similarityScores.push({
        index: i,
        ...similarity
      });

      if (similarity.isSimilar) {
        const matches = TextSimilarity.findMatches(content, text);
        results.matches.push({
          index: i,
          matches,
          similarity: similarity.overall
        });
      }
    }

    // Compare with stored submissions
    for (const submission of this.submissions) {
      const similarity = TextSimilarity.calculateSimilarity(content, submission.content);

      if (similarity.isSimilar) {
        results.similarityScores.push({
          submissionId: submission.id,
          ...similarity
        });

        const matches = TextSimilarity.findMatches(content, submission.content);
        results.matches.push({
          submissionId: submission.id,
          matches,
          similarity: similarity.overall
        });
      }
    }

    // Get highest similarity
    const maxSimilarity = results.similarityScores.length > 0
      ? Math.max(...results.similarityScores.map(s => s.overall))
      : 0;

    results.maxSimilarity = maxSimilarity;
    results.hasMatches = results.matches.length > 0;

    return results;
  }

  /**
   * Calculate overall plagiarism score
   * @param {object} result - Check result
   * @returns {number} Overall score (0-1)
   */
  _calculateOverallScore(result) {
    const scores = [];

    if (result.localResults && result.localResults.maxSimilarity) {
      scores.push(result.localResults.maxSimilarity);
    }

    if (result.serverResults && result.serverResults.similarityScore) {
      scores.push(result.serverResults.similarityScore);
    }

    if (scores.length === 0) return 0;
    return Math.max(...scores);
  }

  /**
   * Store a submission for future comparisons
   * @param {string} id - Submission ID
   * @param {string} content - Submission content
   */
  storeSubmission(id, content) {
    this.submissions.push({
      id,
      content,
      storedAt: new Date().toISOString()
    });
    logger.debug('Submission stored:', id);
  }

  /**
   * Clear stored submissions
   */
  clearSubmissions() {
    this.submissions = [];
    logger.info('Stored submissions cleared');
  }

  /**
   * Compare two texts directly
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {object} Similarity result
   */
  compare(text1, text2) {
    const similarity = TextSimilarity.calculateSimilarity(text1, text2);
    const matches = TextSimilarity.findMatches(text1, text2);

    return {
      ...similarity,
      matches,
      isPlagiarized: similarity.overall > this.config.localThreshold
    };
  }

  /**
   * Get detailed analysis of similarity
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {object} Detailed analysis
   */
  analyze(text1, text2) {
    const jaccard = TextSimilarity.jaccardSimilarity(text1, text2);
    const ngram = TextSimilarity.ngramSimilarity(text1, text2, 3);
    const levenshtein = TextSimilarity.levenshteinSimilarity(text1, text2);
    const matches = TextSimilarity.findMatches(text1, text2);

    // Get word counts
    const words1 = text1.split(/\s+/).filter(w => w.length > 0);
    const words2 = text2.split(/\s+/).filter(w => w.length > 0);

    return {
      text1: {
        wordCount: words1.length,
        characterCount: text1.length
      },
      text2: {
        wordCount: words2.length,
        characterCount: text2.length
      },
      similarity: {
        jaccard,
        ngram,
        levenshtein,
        overall: (jaccard * 0.3 + ngram * 0.4 + levenshtein * 0.3)
      },
      matches,
      uniqueMatches: matches.length,
      matchPercentage: matches.length > 0
        ? (matches.length / Math.max(words1.length, words2.length) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Set API configuration
   * @param {object} config - API configuration
   */
  setApiConfig(config) {
    if (config.apiUrl) this.config.apiUrl = config.apiUrl;
    if (config.apiKey) this.config.apiKey = config.apiKey;
    this.apiClient.setConfig({
      apiUrl: this.config.apiUrl,
      apiKey: this.config.apiKey
    });
  }
}

export default PlagiarismChecker;