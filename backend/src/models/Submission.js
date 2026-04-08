const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');
const crypto = require('crypto');

class Submission {
  static create(sessionId, userId, examId, content) {
    const id = uuidv4();
    const contentHash = this.generateHash(content);

    const stmt = db.prepare(`
      INSERT INTO submissions (id, session_id, user_id, exam_id, content, content_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, sessionId, userId, examId, content, contentHash);
    return this.getById(id);
  }

  static getById(id) {
    const stmt = db.prepare('SELECT * FROM submissions WHERE id = ?');
    return stmt.get(id);
  }

  static generateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Check for similar submissions
  static findSimilar(examId, content, excludeUserId = null) {
    const contentHash = this.generateHash(content);

    // Check for exact matches first
    const exactMatchStmt = db.prepare(`
      SELECT * FROM submissions
      WHERE exam_id = ? AND content_hash = ? AND user_id != ?
    `);
    const exactMatches = exactMatchStmt.all(examId, contentHash, excludeUserId);

    if (exactMatches.length > 0) {
      return {
        exactMatches: exactMatches.length,
        similarityScore: 1.0,
        matches: exactMatches.map(m => ({
          submissionId: m.id,
          userId: m.user_id,
          similarity: 1.0
        }))
      };
    }

    // For text similarity, get all submissions for this exam
    const allSubmissionsStmt = db.prepare(`
      SELECT * FROM submissions
      WHERE exam_id = ? AND user_id != ?
    `);
    const allSubmissions = allSubmissionsStmt.all(examId, excludeUserId);

    if (allSubmissions.length === 0) {
      return { exactMatches: 0, similarityScore: 0, matches: [] };
    }

    // Calculate Jaccard similarity for each submission
    const matches = [];
    let maxSimilarity = 0;

    allSubmissions.forEach(submission => {
      const similarity = this.calculateJaccardSimilarity(content, submission.content);
      if (similarity > 0.3) { // Only include if similarity > 30%
        matches.push({
          submissionId: submission.id,
          userId: submission.user_id,
          similarity
        });
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    });

    return {
      exactMatches: 0,
      similarityScore: maxSimilarity,
      matches: matches.sort((a, b) => b.similarity - a.similarity)
    };
  }

  static calculateJaccardSimilarity(text1, text2) {
    // Tokenize texts into words
    const tokenize = (text) => {
      return new Set(
        text.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 2)
      );
    };

    const set1 = tokenize(text1);
    const set2 = tokenize(text2);

    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;

    // Calculate intersection
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  static updateSimilarityScore(id, score) {
    const stmt = db.prepare('UPDATE submissions SET similarity_score = ? WHERE id = ?');
    stmt.run(score, id);
  }
}

module.exports = Submission;