const express = require('express');
const { fetchRate } = require('../services/ratesService');

const router = express.Router();

// GET /api/rates/:base/:target - what the expense form shows ("≈ R455") before
// saving. The rate actually stored is fetched again server-side on save.
router.get('/:base/:target', async (req, res) => {
  const { base, target } = req.params;
  if (!/^[A-Za-z]{3}$/.test(base) || !/^[A-Za-z]{3}$/.test(target)) {
    return res.status(400).json({ message: 'Currencies must be 3-letter codes, e.g. ZAR.' });
  }
  try {
    return res.json(await fetchRate(base.toUpperCase(), target.toUpperCase()));
  } catch (error) {
    return res.status(error.statusCode || 502).json({ message: error.message });
  }
});

module.exports = router;
