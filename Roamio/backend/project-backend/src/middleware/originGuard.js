// CORS controls response access, not whether a browser sends a form POST.
// Require a trusted Origin on cookie-authenticated writes, and reject all
// untrusted browser writes (including login, which can otherwise plant a session).
const originGuard = (allowedOrigins) => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const hasSessionCookie = /(?:^|;\s*)(?:accessToken|refreshToken)=/.test(req.get('cookie') || '');
  if ((origin && !allowedOrigins.includes(origin)) || (!origin && hasSessionCookie)) {
    return res.status(403).json({ message: 'This request must come from a trusted application origin.' });
  }
  return next();
};

module.exports = originGuard;
