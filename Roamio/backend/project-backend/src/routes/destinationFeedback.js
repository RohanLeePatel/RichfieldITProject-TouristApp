const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const service = require('../services/destinationFeedbackService');

const router = express.Router();
router.use(requireAuth);

const fail = (res, next, err) =>
  err.statusCode ? res.status(err.statusCode).json({ message: err.message }) : next(err);

// A place is a trip's destination text, e.g. "Cape Town, South Africa".

// GET /api/places/rating?place=... -> { avgRating, reviewCount, mine }
router.get('/rating', async (req, res, next) => {
  try { res.json(await service.summary(req.user.userId, req.query.place)); } catch (err) { fail(res, next, err); }
});

// POST /api/places/review { place, rating 1-5, comment? } - a member of a finished trip there; re-posting edits
router.post('/review', async (req, res, next) => {
  try { res.status(201).json({ review: await service.review(req.user.userId, req.body) }); } catch (err) { fail(res, next, err); }
});

// POST /api/places/report { place, reason, note? } - a member of any trip there; once per place
router.post('/report', async (req, res, next) => {
  try { res.status(201).json(await service.report(req.user.userId, req.body)); } catch (err) { fail(res, next, err); }
});

module.exports = router;
