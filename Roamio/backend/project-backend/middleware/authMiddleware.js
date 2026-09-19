const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // Get the Authorization header from the incoming request
  const authHeader = req.headers['authorization'];
  
  // Expected header format: "Bearer "
  const token = authHeader && authHeader.split(' ')[1];

  // 1. If no token was provided, reject immediately
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Server auth is not configured.' });
  }

  // 2. Verify the token using your secret key
  jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    // Attach the decoded user payload to the request object
    req.user = decodedUser;

    // Pass control to the next handler/route
    next();
  });
}

module.exports = authenticateToken;