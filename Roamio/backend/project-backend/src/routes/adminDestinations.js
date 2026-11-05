const express = require('express');
const catalogService = require('../services/catalogService');

const router = express.Router();

// The cities the recommendation engine can suggest. Behind isAdmin (admin.js).

// GET /api/admin/destinations - every city, active or not, with how fresh its data is
router.get('/', async (req, res) => {
  res.json({ destinations: await catalogService.listAll(), staleAfterDays: catalogService.STALE_AFTER_DAYS });
});

// POST /api/admin/destinations { name, country, lat, lon, radiusM?, costIndex?, imageUrl? } - adds a
// city and fetches its data. 201 even if the fetch failed: the city is saved and enrichError says why.
router.post('/', async (req, res) => {
  res.status(201).json(await catalogService.create(req.body));
});

// PATCH /api/admin/destinations/:id - change any of the fields above, or active
router.patch('/:id', async (req, res) => {
  res.json({ destination: await catalogService.update(req.params.id, req.body) });
});

// POST /api/admin/destinations/:id/enrich - fetch the city's data again
router.post('/:id/enrich', async (req, res) => {
  res.json({ destination: await catalogService.enrich(req.params.id) });
});

// DELETE /api/admin/destinations/:id
router.delete('/:id', async (req, res) => {
  await catalogService.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
