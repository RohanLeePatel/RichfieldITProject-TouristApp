const express = require('express');
const service = require('../services/adminUserService');

const router = express.Router();

// GET /api/admin/users?page=1&pageSize=20&q=&status=active|unverified|suspended|inactive|no_trips&sort=newest|oldest
router.get('/', async (req, res) => {
  res.json(await service.listUsers(req.query));
});

// GET /api/admin/users/export.csv - every user, for a spreadsheet
router.get('/export.csv', async (req, res) => {
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="roamio-users.csv"').send(await service.exportCsv());
});

// POST /api/admin/users/bulk { ids, action: suspend|reactivate|signOut } -> { done, failed }
router.post('/bulk', async (req, res) => {
  res.json(await service.bulk(req.user.id, req.body));
});

// GET /api/admin/users/:id - one user with their counts, trips and recent sign-ins
router.get('/:id', async (req, res) => {
  res.json(await service.getUser(req.params.id));
});

// PATCH /api/admin/users/:id { isActive } - suspend (false) or reactivate (true)
router.patch('/:id', async (req, res) => {
  res.json(await service.setActive(req.user.id, req.params.id, req.body?.isActive));
});

// POST /api/admin/users/:id/sign-out - ends every session of that user
router.post('/:id/sign-out', async (req, res) => {
  await service.signOutEverywhere(req.user.id, req.params.id);
  res.status(204).end();
});

module.exports = router;
