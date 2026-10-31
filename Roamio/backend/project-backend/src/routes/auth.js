const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middleware/authMiddleware');

// Auth endpoints (FR-001 - FR-004)
router.post('/register', authController.register);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Profile endpoints (FR-005 - FR-006)
router.get('/users/me', requireAuth, authController.getMe);
router.patch('/users/me', requireAuth, authController.updateMe);
router.post('/users/me/terms', requireAuth, authController.acceptTerms);

module.exports = router;