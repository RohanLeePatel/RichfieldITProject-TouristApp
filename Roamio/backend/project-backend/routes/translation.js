const express = require('express');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

const aiFeaturesUrl = (
  process.env.AI_FEATURES_URL ||
  'https://richfield-it-project-tourist-app.vercel.app'
).replace(/\/$/, '');

const MAX_IMAGE_BYTES = 1024 * 1024; // OCR.space's free tier limit; the frontend compresses to this
const MAX_TEXT_CHARS = 2000;

// DeepL/OCR quota is shared by everyone on the public site
router.use(rateLimit({ max: 20, windowMs: 60_000 }));

// Sends the request to ai-features with node-secretkey added server side and
// relays the reply (or a readable error) to the browser.
async function forward(res, path, init) {
  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({ detail: 'Translation service authentication is not configured.' });
  }

  try {
    const response = await fetch(`${aiFeaturesUrl}${path}`, {
      method: 'POST',
      ...init,
      headers: { ...init.headers, 'node-secretkey': nodeSecretKey },
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data ?? { detail: 'Invalid response from translation service.' });
  } catch (error) {
    console.error(`Translation proxy error (${path}):`, error);
    return res.status(502).json({ detail: 'Could not connect to the translation service.' });
  }
}

// Image translation (OCR): streams the multipart upload straight through. No
// multer - express.json() leaves multipart bodies untouched, so req is a stream.
// The size check trusts Content-Length (browsers always send it for FormData);
// ai-features re-checks the real bytes and the file's magic number.
// ponytail: Vercel caps request bodies at ~4.5MB; big photos need direct-to-storage upload.
router.post('/ocr', (req, res) => {
  const type = req.headers['content-type'] || '';
  const length = Number(req.headers['content-length']);

  if (!type.startsWith('multipart/form-data')) {
    return res.status(415).json({ detail: 'Send the photo as a multipart form upload.' });
  }
  if (!Number.isFinite(length) || length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ detail: 'That photo is too large (1 MB max). Try a tighter crop of just the text.' });
  }

  return forward(res, '/ocr', { headers: { 'content-type': type }, body: req, duplex: 'half' });
});

// Typed / spoken text translation.
router.post('/text', (req, res) => {
  const { text, target_lang, source_lang } = req.body || {};

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ detail: 'Enter some text to translate.' });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return res.status(413).json({ detail: `Text is too long (${MAX_TEXT_CHARS} characters max).` });
  }

  return forward(res, '/text', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, target_lang, source_lang }),
  });
});

module.exports = router;
