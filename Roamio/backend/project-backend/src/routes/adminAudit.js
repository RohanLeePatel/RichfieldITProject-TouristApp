const express = require('express');
const { list } = require('../services/adminAuditService');

const router = express.Router();

// GET /api/admin/audit?page=1 - what admins did, newest first
router.get('/', async (req, res) => res.json(await list(req.query)));

module.exports = router;
