const express = require('express');
const catalogService = require('../services/catalogService');
const { log } = require('../services/adminAuditService');

const record = (req, action, details) => log(req.user.id, action, { entityType: 'DESTINATION', details });

const router = express.Router();

// The cities the recommendation engine can suggest. Behind isAdmin (admin.js).

// GET /api/admin/destinations - every city, active or not, with how fresh its data is,
// what is missing (issues) and how many trips use it (tripCount)
router.get('/', async (req, res) => {
  const [rows, counts] = await Promise.all([catalogService.listAll(), catalogService.tripCounts()]);
  res.json({
    destinations: rows.map((row) => ({ ...row, tripCount: counts[row.id] || 0 })),
    staleAfterDays: catalogService.STALE_AFTER_DAYS,
  });
});

// POST /api/admin/destinations/bulk { ids, active } - show or hide several cities at once
router.post('/bulk', async (req, res) => {
  const result = await catalogService.setActiveMany(req.body?.ids, req.body?.active);
  await record(req, req.body.active ? 'ADMIN_DESTINATIONS_SHOW' : 'ADMIN_DESTINATIONS_HIDE', `${result.updated} cities`);
  res.json(result);
});

// POST /api/admin/destinations { name, country, lat, lon, radiusM?, costIndex?, imageUrl? } - adds a
// city and fetches its data. 201 even if the fetch failed: the city is saved and enrichError says why.
router.post('/', async (req, res) => {
  const created = await catalogService.create(req.body);
  await record(req, 'ADMIN_DESTINATION_ADD', `${created.destination.name}, ${created.destination.country}`);
  res.status(201).json(created);
});

// PATCH /api/admin/destinations/:id - change any of the fields above, or active
router.patch('/:id', async (req, res) => {
  const destination = await catalogService.update(req.params.id, req.body);
  await record(req, 'ADMIN_DESTINATION_EDIT', `${destination.name}, ${destination.country}: ${Object.keys(req.body).join(', ')}`);
  res.json({ destination });
});

// POST /api/admin/destinations/:id/enrich - fetch the city's data again
router.post('/:id/enrich', async (req, res) => {
  const destination = await catalogService.enrich(req.params.id);
  await record(req, 'ADMIN_DESTINATION_REFRESH', `${destination.name}, ${destination.country}`);
  res.json({ destination });
});

// DELETE /api/admin/destinations/:id
router.delete('/:id', async (req, res) => {
  await catalogService.remove(req.params.id);
  await record(req, 'ADMIN_DESTINATION_DELETE', req.params.id);
  res.status(204).end();
});

module.exports = router;
