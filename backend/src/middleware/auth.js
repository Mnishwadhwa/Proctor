const config = require('../config');

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key is required',
      code: 'MISSING_API_KEY'
    });
  }

  if (apiKey !== config.apiKey) {
    return res.status(403).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
}

// Optional auth - allows requests without API key in development
function optionalAuth(req, res, next) {
  if (config.nodeEnv === 'development') {
    return next();
  }
  return authMiddleware(req, res, next);
}

module.exports = {
  authMiddleware,
  optionalAuth
};