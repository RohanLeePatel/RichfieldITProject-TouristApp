const express = require('express');
const { aiApiUrl } = require('../utils/aiService');

const router = express.Router();

const aiFeaturesUrl = aiApiUrl();

// Same proxy pattern as recommendations/landmarks: the browser never needs the
// node-secretkey, and the OpenWeather key stays inside the ai-features service.
router.get('/:city', async (req, res) => {
  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({ message: 'Weather service authentication is not configured.' });
  }

  try {
    const units = req.query.units === 'imperial' ? 'imperial' : 'metric';
    const response = await fetch(
      `${aiFeaturesUrl}/weather/${encodeURIComponent(req.params.city)}?units=${units}`,
      { headers: { 'node-secretkey': nodeSecretKey } }
    );
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.detail || 'Weather information is currently unavailable.',
      });
    }

    return res.json(data);
  } catch (error) {
    console.error('Weather proxy error:', error);
    return res.status(502).json({ message: 'Could not connect to the weather service.' });
  }
});

module.exports = router;
