const express = require('express');
const { list, exportCsv, actions } = require('../services/adminAuditService');

const router = express.Router();

// GET /api/admin/audit?page=1&action=&adminId=&targetId=&from=YYYY-MM-DD&to=YYYY-MM-DD - what admins did, newest first
router.get('/', async (req, res) => res.json(await list(req.query)));

// GET /api/admin/audit/export.csv - the same filters, as a spreadsheet
router.get('/export.csv', async (req, res) => {
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="roamio-audit-log.csv"').send(await exportCsv(req.query));
});

// GET /api/admin/audit/actions - action codes seen so far
router.get('/actions', async (req, res) => res.json({ actions: await actions() }));

module.exports = router;
