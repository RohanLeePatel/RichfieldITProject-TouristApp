const express = require('express');
const catalogService = require('../services/catalogService');

const router = express.Router();

const aiFeaturesUrl = (
  process.env.AI_FEATURES_URL ||
  'https://richfield-it-project-tourist-app.vercel.app'
).replace(/\/$/, '');

// The managed destinations (admin dashboard), for the AI service to score. The seed
// file in the AI service answers when there are none or the database is down.
async function managedCatalog() {
  try {
    return await catalogService.loadCatalog();
  } catch (error) {
    console.error('Destination catalog unavailable, using the built-in list:', error.message);
    return [];
  }
}

router.post('/', async (req, res) => {
  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({
      message: 'Recommendation service authentication is not configured.',
    });
  }

  try {
    const body = { ...req.body };
    delete body.catalog; // only ever the database's list, never the browser's
    if (!body.candidates && body.level !== 'place') {
      const all = await managedCatalog();
      // one country's cities are all a city-level request can use. A country the list no
      // longer has still goes with the whole list, so the answer is "no cities" rather
      // than the built-in list's.
      const ofCountry = body.level === 'city' && body.parent_id
        ? all.filter((c) => catalogService.countrySlug(c.country) === body.parent_id)
        : all;
      if (all.length) body.catalog = ofCountry.length ? ofCountry : all;
    }

    const response = await fetch(`${aiFeaturesUrl}/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'node-secretkey': nodeSecretKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // FastAPI sends validation failures as a list of { msg }; the browser shows one sentence
      const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg?.replace(/^Value error, /, '') : data?.detail;
      return res.status(response.status).json({
        message: detail || 'Recommendation service is unavailable.',
      });
    }

    return res.json(data);
  } catch (error) {
    console.error('Recommendation proxy error:', error);
    return res.status(502).json({
      message: 'Could not connect to the recommendation service.',
    });
  }
});

router.get('/catalog', async (req, res) => {
  const managed = await managedCatalog();
  if (managed.length) return res.json({ countries: catalogService.countriesOf(managed) });

  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({
      message: 'Recommendation service authentication is not configured.',
    });
  }

  try {
    const response = await fetch(`${aiFeaturesUrl}/recommendations/catalog`, {
      headers: {
        'node-secretkey': nodeSecretKey,
      },
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.detail || 'Recommendation catalog is unavailable.',
      });
    }

    return res.json(data);
  } catch (error) {
    console.error('Recommendation catalog proxy error:', error);
    return res.status(502).json({
      message: 'Could not connect to the recommendation catalog.',
    });
  }
});

// Landmarks: same proxy pattern as the catalog above, so the browser never
// needs the node-secretkey. Query string is forwarded as-is.
router.get('/landmarks', async (req, res) => {
  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({
      message: 'Recommendation service authentication is not configured.',
    });
  }

  try {
    const query = new URLSearchParams(req.query).toString();
    const response = await fetch(`${aiFeaturesUrl}/landmarks?${query}`, {
      headers: { 'node-secretkey': nodeSecretKey },
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.detail || 'Landmarks are unavailable.',
      });
    }

    return res.json(data);
  } catch (error) {
    console.error('Landmarks proxy error:', error);
    return res.status(502).json({ message: 'Could not connect to the landmarks service.' });
  }
});

module.exports = router;
