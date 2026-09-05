const tokenService = require('../auth/tokenService');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = tokenService.verifyAccessToken(token);
    req.user = decoded; // Attaches { userId, email }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
};

module.exports = authenticate;