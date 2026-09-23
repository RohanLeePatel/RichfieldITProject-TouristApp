// 1. Environment & Core Imports
const cron = require('node-cron');
const safetySyncService = require('./src/services/safetySyncService');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const PORT = process.env.PORT || 5000;

// 2. Route Imports
const authRoutes = require('./src/routes/auth.routes'); 
const travelGroupRoutes = require('./src/routes/travelGroup.routes');
const invitationRoutes = require('./src/routes/invitation.routes');
const tripRoutes = require('./src/routes/trip.routes');
const destinationRoutes = require('./src/routes/destination.routes');
const itineraryRoutes = require('./src/routes/itinerary.routes');
const expenseRoutes = require('./src/routes/expense.routes');
const activityRoutes = require('./src/routes/activity.routes');
const safetyRoutes = require('./src/routes/safety.routes');
app.use('/api', safetyRoutes);

// 3. Custom Middleware Imports
const attachActivityLogger = require('./src/middleware/activityLogger.middleware');

// 4. App Initialization
const app = express();

// 5. Global Middleware Setup
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

// Attach the `req.logActivity` helper to every request
app.use(attachActivityLogger);

// 6. Mount API Routes
// All core endpoints are prefixed with /api
app.use('/api/auth', authRoutes); // e.g., /api/auth/login, /api/auth/register
app.use('/api', travelGroupRoutes);
app.use('/api', invitationRoutes);
app.use('/api', tripRoutes);
app.use('/api', destinationRoutes);
app.use('/api', itineraryRoutes); // Implicitly handles /api/trips/:tripId/itinerary, etc.
app.use('/api', expenseRoutes);
app.use('/api', activityRoutes);

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

// Schedule the Safety Sync Job
// This cron expression ('0 */12 * * *') means "Run at minute 0 past every 12th hour." (Twice a day)
cron.schedule('0 */12 * * *', async () => {
  await safetySyncService.syncCountryAdvisories();
});

if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    safetySyncService.syncCountryAdvisories();
  }, 5000); 
}

app.listen(PORT, () => {
  console.log(` Roamio API Server running on http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
});