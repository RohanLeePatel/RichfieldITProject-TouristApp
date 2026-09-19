const express = require('express');

const router = express.Router();

const aiFeaturesUrl = (
  process.env.AI_FEATURES_URL ||
  'https://richfield-it-project-tourist-app.vercel.app'
).replace(/\/$/, '');

// Image translation (OCR): streams the multipart upload straight through to
// the ai-features service, adding node-secretkey server side. No multer -
// express.json() leaves multipart bodies untouched, so req is still a stream.
// ponytail: Vercel caps request bodies at ~4.5MB; big photos need direct-to-storage upload.
router.post('/ocr', async (req, res) => {
  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({ detail: 'Translation service authentication is not configured.' });
  }

  try {
    const response = await fetch(`${aiFeaturesUrl}/ocr`, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'],
        'node-secretkey': nodeSecretKey,
      },
      body: req,
      duplex: 'half',
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data ?? { detail: 'Invalid response from translation service.' });
  } catch (error) {
    console.error('OCR proxy error:', error);
    return res.status(502).json({ detail: 'Could not connect to the translation service.' });
  }
});

module.exports = router;
