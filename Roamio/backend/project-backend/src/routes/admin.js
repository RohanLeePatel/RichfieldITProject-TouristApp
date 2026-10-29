const express = require('express');
const isAdmin = require('../middleware/isAdmin');
const errorHandler = require('../middleware/errorMiddleware');

const router = express.Router();

// Everything under /api/admin needs an admin
router.use(isAdmin);
router.use('/analytics', require('./adminAnalytics'));
router.use('/config', require('./adminConfig'));
router.use('/health', require('./adminHealth'));

// Unknown admin path: JSON, not Express's HTML page
router.use((req, res) => res.status(404).json({ success: false, status: 404, message: 'Not found.' }));

// Errors thrown by the admin routes (Express 5 forwards async rejections here)
router.use(errorHandler);

module.exports = router;
