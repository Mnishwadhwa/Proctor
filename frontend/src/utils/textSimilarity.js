/**
 * Text similarity algorithms for plagiarism detection
 */
class TextSimilarity {
  /**
   * Tokenize text into words
   * @param {string} text - Input text
   * @returns {Set<string>} Set of words
   */
  static tokenize(text) {
    return new Set(
      text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
    );
  }

  /**
   * Calculate Jaccard similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  static jaccardSimilarity(text1, text2) {
    const set1 = this.tokenize(text1);
    const set2 = this.tokenize(text2);

    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate n-grams from text
   * @param {string} text - Input text
   * @param {number} n - N-gram size
   * @returns {string[]} Array of n-grams
   */
  static getNgrams(text, n = 3) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);

    const ngrams = [];
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  /**
   * Calculate n-gram similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @param {number} n - N-gram size
   * @returns {number} Similarity score (0-1)
   */
  static ngramSimilarity(text1, text2, n = 3) {
    const ngrams1 = new Set(this.getNgrams(text1, n));
    const ngrams2 = new Set(this.getNgrams(text2, n));

    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  static levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate Levenshtein similarity (normalized)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  static levenshteinSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    return 1 - distance / maxLength;
  }

  /**
   * Calculate overall similarity score using multiple methods
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {object} Similarity scores
   */
  static calculateSimilarity(text1, text2) {
    const jaccard = this.jaccardSimilarity(text1, text2);
    const ngram = this.ngramSimilarity(text1, text2, 3);
    const levenshtein = this.levenshteinSimilarity(
      text1.toLowerCase().replace(/\s+/g, ' '),
      text2.toLowerCase().replace(/\s+/g, ' ')
    );

    // Weighted average
    const overall = (jaccard * 0.3 + ngram * 0.4 + levenshtein * 0.3);

    return {
      jaccard,
      ngram,
      levenshtein,
      overall,
      isSimilar: overall > 0.7
    };
  }

  /**
   * Find matching sequences between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @param {number} minLength - Minimum match length
   * @returns {string[]} Array of matching sequences
   */
  static findMatches(text1, text2, minLength = 10) {
    const sentences1 = text1.split(/[.!?]+/).filter(s => s.trim().length >= minLength);
    const sentences2 = text2.split(/[.!?]+/).filter(s => s.trim().length >= minLength);

    const matches = [];

    for (const s1 of sentences1) {
      for (const s2 of sentences2) {
        const similarity = this.levenshteinSimilarity(
          s1.toLowerCase().trim(),
          s2.toLowerCase().trim()
        );
        if (similarity > 0.8) {
          matches.push({
            text1: s1.trim(),
            text2: s2.trim(),
            similarity
          });
        }
      }
    }

    return matches;
  }
}

export default TextSimilarity;