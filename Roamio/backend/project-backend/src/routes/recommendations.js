const express = require('express');

const router = express.Router();

const aiFeaturesUrl = (
  process.env.AI_FEATURES_URL ||
  'https://richfield-it-project-tourist-app.vercel.app'
).replace(/\/$/, '');

router.post('/', async (req, res) => {
  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({
      message: 'Recommendation service authentication is not configured.',
    });
  }

  try {
    const response = await fetch(`${aiFeaturesUrl}/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'node-secretkey': nodeSecretKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.detail || 'Recommendation service is unavailable.',
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
