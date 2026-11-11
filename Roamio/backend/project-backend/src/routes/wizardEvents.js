const express = require('express');
const { z } = require('zod');
const prisma = require('../config/prisma');
const requireAuth = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

// POST /api/wizard-events { step: 0-4 } - the trip wizard reports each step the
// signed-in user reaches (4 = ran the search). Counted once per user per step per
// hour, so a refresh or a back-and-forth can't inflate the funnel.
const router = express.Router();
router.use(requireAuth);

const HOUR = 3_600_000;

router.post('/', validate(z.object({ step: z.number().int().min(0).max(4) })), async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { step } = req.body;
    const recent = await prisma.wizardStepEvent.findFirst({ where: { userId, step, at: { gte: new Date(Date.now() - HOUR) } }, select: { id: true } });
    if (!recent) await prisma.wizardStepEvent.create({ data: { userId, step } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
