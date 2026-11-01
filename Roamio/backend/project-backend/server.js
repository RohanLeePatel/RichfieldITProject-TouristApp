// 1. Environment & Core Imports
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cron = require('node-cron');
const path = require('node:path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const safetySyncService = require('./src/services/safetySyncService');

// 2. Custom Middleware Imports
const { generalLimiter, authLimiter, recommendationsLimiter, weatherLimiter, chatLimiter, supportLimiter } = require('./src/middleware/rateLimiter');
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
const translationRoutes = require('./src/routes/translation');
const personalTripRoutes = require('./src/routes/trips');
const { router: tripDocumentRoutes } = require('./src/routes/tripDocuments');
const recommendationRoutes = require('./src/routes/recommendations');
const weatherRoutes = require('./src/routes/weather');
const ratesRoutes = require('./src/routes/rates');
const adminRoutes = require('./src/routes/admin');
const chatRoutes = require('./src/routes/chat');
const meRoutes = require('./src/routes/me');
const supportRoutes = require('./src/routes/support');
const cronRoutes = require('./src/routes/cron');

// 4. App Initialization
const app = express();
const PORT = process.env.PORT || 3000; // the frontend's default VITE_BACKEND_API_URL

// 5. Global Middleware Setup

// Tell Express to trust the cloud provider's reverse proxy (MUST be before limiters)
app.set('trust proxy', 1);

// Security headers. The API only answers JSON, so its CSP allows nothing and
// forbids framing; the Swagger page at /api-docs needs its own scripts and
// styles, so it gets helmet without a CSP.
const apiHeaders = helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // the SPA is on another origin
});
const docsHeaders = helmet({ contentSecurityPolicy: false });
app.use((req, res, next) => (req.path.startsWith('/api-docs') ? docsHeaders : apiHeaders)(req, res, next));

// Enable CORS for your React frontend. CLIENT_URL may list several origins,
// comma-separated (e.g. the Vercel site and a preview URL).
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true // Crucial for sending/receiving secure cookies
}));

// Parse incoming JSON payloads and URL-encoded data. Trip documents arrive as
// base64 in JSON, so that one path gets a 2 MB limit (a 1 MB file, kept under
// Vercel's ~4.5 MB body cap); the route re-checks the decoded size.
const jsonDefault = express.json();
const jsonDocuments = express.json({ limit: '2mb' });
app.use((req, res, next) =>
  (/^\/api\/trips\/[^/]+\/documents\/?$/.test(req.path) ? jsonDocuments : jsonDefault)(req, res, next)
);
app.use(express.urlencoded({ extended: true }));

// Parse cookies (using the secret from .env if you are using signed cookies)
app.use(cookieParser(process.env.COOKIE_SECRET || 'roamio_secret'));

// Interactive API docs, built from the @openapi comments in src/routes
const swaggerDocs = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Roamio Backend API',
      version: '1.0.0',
      description: 'API documentation for travel planning, user authentication, itineraries, and expense tracking.',
    },
    servers: [{ url: `http://localhost:${PORT}`, description: 'Local Development Server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: [path.join(__dirname, 'src/routes/*.js')],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

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
app.use('/api/support', supportLimiter, supportRoutes);

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
app.use('/api/notifications', notificationRoutes);

// An /api path nothing answered: JSON, not Express's HTML page
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

// 7. Global Error Handling Middleware
// This catches any errors thrown via `next(error)` in your controllers
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.message);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    message, // the shape the pages read; `error` below is kept for older callers
    error: {
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) // Hide stack trace in production
    }
  });
});

// 8. Schedule the Safety Sync Job
// This cron expression ('0 */12 * * *') means "Run at minute 0 past every 12th hour." (Twice a day)
cron.schedule('0 */12 * * *', async () => {
  await safetySyncService.syncCountryAdvisories();
});

if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    safetySyncService.syncCountryAdvisories();
  }, 5000); 
}

// 9. Start Server
app.listen(PORT, () => {
  console.log(`Roamio API Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Interactive API Docs available at http://localhost:${PORT}/api-docs`);
});