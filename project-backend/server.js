require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

// Import Middlewares
const errorHandler = require('./src/middleware/errorMiddleware');

// Import Routes
const authRoutes = require('./src/routes/auth');
const groupRoutes = require('./src/routes/groups');

const app = express();
const PORT = process.env.PORT || 3000;

// Standard Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(morgan('dev'));

// Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'SmartTravel Core Platform API is running',
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);

// Global Error Handler (Must remain after all routes)
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`Core Platform Backend listening on port ${PORT}`);
});