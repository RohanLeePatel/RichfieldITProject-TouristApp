const { verifyAccessToken } = require('../auth/tokenService');

const requireAuth = (req, res, next) => {
  let token;

  // 1. Check Authorization header (Bearer token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // 2. Check signed cookies
  else if (req.signedCookies && req.signedCookies.accessToken) {
    token = req.signedCookies.accessToken;
  }
  // 3. Fallback for unsigned cookies
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  // Block if no token is found
  if (!token) {
    return res.status(401).json({ message: 'Access token required. Please log in.' });
  }

  try {
    // Verify token using tokenService's encapsulated verification & secret
    const decoded = verifyAccessToken(token);
    
    // Extract and parse the ID to an integer for Prisma compatibility
    const rawId = decoded.userId ?? decoded.id ?? decoded.sub;
    const parsedId = parseInt(rawId, 10);

    if (isNaN(parsedId)) {
      return res.status(401).json({ message: 'Invalid token payload: missing valid user ID.' });
    }
    
    // Attach both .id and .userId normalized as integers
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