const { verifyAccessToken } = require('../auth/tokenService');

// Authenticates a request from its access token and sets req.user. The Bearer header
// wins. Cookies are the fallback for browser sessions, and signed cookies are preferred
// over plain ones.
const requireAuth = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  else if (req.signedCookies && req.signedCookies.accessToken) {
    token = req.signedCookies.accessToken;
  }
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ message: 'Access token required. Please log in.' });
  }

  try {
    const decoded = verifyAccessToken(token);

    // Our tokens carry `userId`. `id` and `sub` are accepted as fallbacks. The id
    // is parsed to an Int because Prisma's User.id is an integer column.
    const rawId = decoded.userId ?? decoded.id ?? decoded.sub;
    const parsedId = parseInt(rawId, 10);

    if (isNaN(parsedId)) {
      return res.status(401).json({ message: 'Invalid token payload: missing valid user ID.' });
    }
    
    // Both names are set because handlers use either one.
    req.user = {
      ...decoded, 
      id: parsedId,
      userId: parsedId
    }; 
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};

module.exports = requireAuth;