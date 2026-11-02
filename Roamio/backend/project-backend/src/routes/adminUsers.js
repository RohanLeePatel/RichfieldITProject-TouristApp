const express = require('express');
const { listUsers } = require('../services/adminUserService');

const router = express.Router();

// GET /api/admin/users?page=1&pageSize=20&q= - registered users and their last successful login
router.get('/', async (req, res) => {
  res.json(await listUsers(req.query));
});

module.exports = router;
