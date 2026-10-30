const requireAuth = require('./authMiddleware');

// Admin ids come from ADMIN_USER_IDS (comma-separated). The User model has no
// role column yet, so this is a mocked check: replace isAllowed() with a real
// role lookup when one exists. It fails closed - no allowlist, no admins.
const adminIds = () =>
  (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id));

function isAllowed(user) {
  // Local testing only: let any signed-in user through. Ignored outside development.
  if (process.env.NODE_ENV === 'development' && process.env.ADMIN_MOCK_ALLOW_ALL === 'true') return true;
  return user.role === 'admin' || adminIds().includes(user.id);
}

// Verifies the access token (401), then the admin check (403).
const checkAdmin = (req, res, next) => {
  if (!isAllowed(req.user)) {
    return res.status(403).json({ success: false, status: 403, message: 'Admin access required.' });
  }
  next();
};

module.exports = [requireAuth, checkAdmin];
// Also used to tell the frontend whether to show the Admin link (GET /users/me)
module.exports.isAdminUser = isAllowed;
