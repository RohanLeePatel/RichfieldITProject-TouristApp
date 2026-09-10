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

module.exports = router;
