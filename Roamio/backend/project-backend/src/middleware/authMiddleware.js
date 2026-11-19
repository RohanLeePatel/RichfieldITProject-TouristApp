const { verifyAccessToken } = require('../auth/tokenService');
const sessionService = require('../services/sessionService');

// Authenticates a request from its access token and sets req.user. The Bearer header
// wins. Cookies are the fallback for browser sessions, and signed cookies are preferred
// over plain ones.
const requireAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  else if (req.signedCookies && req.signedCookies.accessToken) {
    token = req.signedCookies.accessToken;
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
    
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }

  // A signed token is only as good as its session: signing out, suspending the account
  // or resetting the password revokes the session, which must stop the token working
  // now rather than when it expires. Legacy tokens without sid require a new sign-in.
  try {
    if (!req.user.sid || !(await sessionService.isLive(req.user.sid, req.user.id))) {
      return res.status(401).json({ message: 'This session was signed out. Please log in again.' });
    }
  } catch (error) {
    return next(error);
  }
  return next();
};

// For public routes that say a little more to a signed-in visitor: sets req.user
// when a valid token is present, and otherwise carries on anonymously (never 401s).
const optionalAuth = (req, res, next) => requireAuth(req, { status: () => ({ json: () => next() }) }, next);

module.exports = requireAuth;
module.exports.optionalAuth = optionalAuth;
