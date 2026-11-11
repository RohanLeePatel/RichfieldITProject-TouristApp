// 1. Environment & Core Imports
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cron = require('node-cron');
const safetySyncService = require('./src/services/safetySyncService');

// 2. Custom Middleware Imports
const { generalLimiter, authLimiter, recommendationsLimiter, weatherLimiter, chatLimiter, supportLimiter, feedbackLimiter } = require('./src/middleware/rateLimiter');
const attachActivityLogger = require('./src/middleware/activityLoggerMiddleware');

// 3. Route Imports
const authRoutes = require('./src/routes/auth'); 
const travelGroupRoutes = require('./src/routes/travelGroup');
const invitationRoutes = require('./src/routes/invitation');
const tripRoutes = require('./src/routes/trip');
const destinationRoutes = require('./src/routes/destination');
const itineraryRoutes = require('./src/routes/itinerary');
const activityRoutes = require('./src/routes/activity');
const safetyRoutes = require('./src/routes/safety');
const expenseRoutes = require('./src/routes/expense');
const budgetRoutes = require('./src/routes/budget');
const notificationRoutes = require('./src/routes/notification');
const pushRoutes = require('./src/routes/push');
const translationRoutes = require('./src/routes/translation');
const personalTripRoutes = require('./src/routes/trips');
const { router: tripDocumentRoutes } = require('./src/routes/tripDocuments');
const recommendationRoutes = require('./src/routes/recommendations');
const weatherRoutes = require('./src/routes/weather');
const ratesRoutes = require('./src/routes/rates');
const adminRoutes = require('./src/routes/admin');
const chatRoutes = require('./src/routes/chat');
const meRoutes = require('./src/routes/me');
const wizardEventRoutes = require('./src/routes/wizardEvents');
const supportRoutes = require('./src/routes/support');
const destinationFeedbackRoutes = require('./src/routes/destinationFeedback');
const cronRoutes = require('./src/routes/cron');

// 4. App Initialization
const app = express();
const PORT = process.env.PORT || 3000; // the frontend's default VITE_BACKEND_API_URL

// 5. Global Middleware Setup

// Tell Express to trust the cloud provider's reverse proxy (MUST be before limiters)
app.set('trust proxy', 1);

// Security headers. The API only answers JSON, so its CSP allows nothing and
// forbids framing.
app.use(helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // the SPA is on another origin
}));

// Enable CORS for your React frontend. CLIENT_URL may list several origins,
// comma-separated (e.g. the Vercel site and a preview URL).
const allowedOrigins = (process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000'))
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true // Crucial for sending/receiving secure cookies
}));

// Parse incoming JSON payloads and URL-encoded data. Trip documents arrive as
// base64 in JSON, so that one path gets a 2 MB limit (a 1 MB file, kept under
// Vercel's ~4.5 MB body cap); the route re-checks the decoded size. The saved
// trip-planner draft (itinerary and landmarks) is bigger than 100 KB too.
const jsonDefault = express.json();
const jsonDocuments = express.json({ limit: '2mb' });
app.use((req, res, next) =>
  (/^\/api\/(trips\/[^/]+\/documents|users\/me\/planner-draft)\/?$/.test(req.path) ? jsonDocuments : jsonDefault)(req, res, next)
);
app.use(express.urlencoded({ extended: true }));

// Parse cookies (using the secret from .env if you are using signed cookies)
if (!process.env.COOKIE_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('COOKIE_SECRET must be set in production');
}
app.use(cookieParser(process.env.COOKIE_SECRET || 'roamio_secret'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Roamio API is running.' });
});

// Apply the general limiter to all API routes
app.use('/api', generalLimiter);

// 6. Mount API Routes

// Apply the stricter auth limiter to the credential endpoints (login, register,
// codes). Not to the profile read/write or the token refresh: pages load the
// profile on open, so 10 a minute turned ordinary browsing into 429s. Those two
// stay under the general limiter.
const UNLIMITED_AUTH_PATHS = new Set(['/users/me', '/users/me/terms', '/refresh']);
app.use('/api/auth', (req, res, next) => (UNLIMITED_AUTH_PATHS.has(req.path) ? next() : authLimiter(req, res, next)));
app.use('/api/auth', authRoutes); // e.g., /api/auth/login, /api/auth/register

// AI-feature proxies. Public (signing in is optional for translation), so they
// go before the routers below: those are mounted on all of /api and start
// with requireAuth, which would 401 anything that reaches them.
app.use('/api/translate', translationRoutes);
app.use('/api/recommendations', recommendationsLimiter, recommendationRoutes);
app.use('/api/weather', weatherLimiter, weatherRoutes);
app.use('/api/rates', weatherLimiter, ratesRoutes); // same shared-quota limit
app.use('/api/chat', chatLimiter, chatRoutes);

// Settings page: notifications, sessions, travellers, data export, account
// deletion, problem reports. They guard themselves with requireAuth, so they
// go before the /api routers below that would 401 them.
app.use('/api/users/me', meRoutes);
app.use('/api/wizard-events', wizardEventRoutes);
app.use('/api/support', supportLimiter, supportRoutes);
app.use('/api/places', feedbackLimiter, destinationFeedbackRoutes);

// Vercel Cron (vercel.json). Guarded by CRON_SECRET, not by a login.
app.use('/api/cron', cronRoutes);

// Admin dashboard API. Before the /api routers below, which would 401 it;
// the router guards itself with isAdmin and has its own error handler.
app.use('/api/admin', adminRoutes);

app.use(attachActivityLogger);

// The frontend's trip API (personal + group trips, documents). Mounted before
// the group routes below, which still answer whatever these don't match.
app.use('/api/trips', personalTripRoutes);
app.use('/api/trips', tripDocumentRoutes);

// Mount all other core endpoints
app.use('/api', travelGroupRoutes);
app.use('/api', invitationRoutes);
app.use('/api', tripRoutes);
app.use('/api', destinationRoutes);
app.use('/api', itineraryRoutes); 
app.use('/api/trips/:tripId/expenses', expenseRoutes);
app.use('/api/trips/:tripId/budget', budgetRoutes);
app.use('/api', activityRoutes);
app.use('/api', safetyRoutes);
app.use('/api/notifications/push', pushRoutes);
app.use('/api/notifications', notificationRoutes);

// An address nothing answered: JSON, not Express's HTML page
app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

// 7. Global Error Handling Middleware
// This catches any errors thrown via `next(error)` in your controllers
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.message);
  
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) console.error(err.stack); // the log only, never the response
  // 5xx text can carry Prisma table or column names, so clients get a fixed sentence
  let message = statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Request failed');
  // body-parser's own wording is technical; say it plainly
  if (err.type === 'entity.too.large') message = 'That is too much to send at once. Try something smaller.';
  else if (err.type === 'entity.parse.failed') message = 'We could not read that request. Please try again.';

  res.status(statusCode).json({
    message, // the shape the pages read; `error` below is kept for older callers
    error: {
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) // Hide stack trace in production
    }
  });
});

// 8. Scheduled jobs
// node-cron only fires while this process is running, so it covers local development
// and any always-on host. On Vercel, vercel.json triggers the daily version of the
// same work through /api/cron, which is why those routes exist as well.
cron.schedule('0 */12 * * *', async () => {
  await safetySyncService.syncCountryAdvisories();
});

// Tell the admins when a service is down or places get flagged (only emails when something changes)
cron.schedule('0 * * * *', () => require('./src/services/adminAlertService').check());

// In development, also run one sync shortly after boot, so local data appears
// without waiting up to 12 hours for the first scheduled run.
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    safetySyncService.syncCountryAdvisories();
  }, 5000); 
}

// 9. Start Server
app.listen(PORT, () => {
  console.log(`Roamio API Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});