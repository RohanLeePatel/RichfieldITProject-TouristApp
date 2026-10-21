// 1. Environment & Core Imports
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const safetySyncService = require('./src/services/safetySyncService');

// 2. Custom Middleware Imports
const { generalLimiter, authLimiter } = require('./src/middleware/rateLimiter');
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

// 4. App Initialization
const app = express();
const PORT = process.env.PORT || 5000;

// 5. Global Middleware Setup

// Tell Express to trust the cloud provider's reverse proxy (MUST be before limiters)
app.set('trust proxy', 1);

// Enable CORS for your React frontend 
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true // Crucial for sending/receiving secure cookies
}));

// Parse incoming JSON payloads and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Parse cookies (using the secret from .env if you are using signed cookies)
app.use(cookieParser(process.env.COOKIE_SECRET || 'roamio_secret'));

// Apply the general limiter to all API routes
app.use('/api', generalLimiter);

// 6. Mount API Routes

// Apply the stricter auth limiter specifically to authentication routes
app.use('/api/auth', authLimiter);
app.use('/api/auth', authRoutes); // e.g., /api/auth/login, /api/auth/register

app.use(attachActivityLogger);

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
app.use('/api/translate', translationRoutes);

// 7. Global Error Handling Middleware
// This catches any errors thrown via `next(error)` in your controllers
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.message);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
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
});