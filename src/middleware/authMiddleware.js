const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  let token;

  // 1. Check if the token was sent in the Authorization header (Bearer token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // 2. If not in the header, check the signed cookies (set by our AuthController)
  else if (req.signedCookies && req.signedCookies.accessToken) {
    token = req.signedCookies.accessToken;
  }
  // 3. Fallback for unsigned cookies
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  // If no token is found anywhere, block the request
  if (!token) {
    return res.status(401).json({ message: 'Access token required. Please log in.' });
  }

  try {
    // Verify the token using the secret in your .env file
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the decoded user payload (which contains userId) to the request object
    req.user = decoded; 
    
    // Move on to the next middleware or the controller route
    next();
  } catch (error) {
    // If the token is expired or tampered with, block the request
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};

module.exports = requireAuth;