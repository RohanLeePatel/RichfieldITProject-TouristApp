const express = require('express');
const { verifyAccessToken } = require('../auth/tokenService');
const authenticateToken = require('../middleware/authMiddleware');
const { translateLimiter } = require('../middleware/rateLimiter');
const { aiApiUrl } = require('../utils/aiService');

const router = express.Router();

const aiFeaturesUrl = aiApiUrl();

const MAX_IMAGE_BYTES = 1024 * 1024; // OCR.space's free tier limit; the frontend compresses to this
const MAX_TEXT_CHARS = 2000;

// DeepL/OCR quota is shared by everyone on the public site
router.use(translateLimiter);

// Who is translating, for their history. Read from a verified token only:
// ai-features trusts x-user-id because this API vouches for it, so it must
// never come from anything the browser can set. No valid token is not an
// error - the translation still happens, it just isn't saved anywhere.
// Looks for the token in the same places as authMiddleware.
function verifiedUserId(req) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.split(' ')[1]
    : req.signedCookies?.accessToken || req.cookies?.accessToken;
  if (!token) return null;
  try {
    const { userId } = verifyAccessToken(token);
    return userId == null ? null : String(userId);
  } catch {
    return null;
  }
}

// Sends the request to ai-features with node-secretkey added server side and
// relays the reply (or a readable error) to the browser. Headers are built
// here rather than copied from req, so a client-sent x-user-id never passes.
async function forward(res, path, init, userId = null) {
  const nodeSecretKey = process.env.superSecretKey;

  if (!nodeSecretKey) {
    return res.status(500).json({ detail: 'Translation service authentication is not configured.' });
  }

  try {
    const response = await fetch(`${aiFeaturesUrl}${path}`, {
      method: 'POST',
      ...init,
      headers: {
        ...init.headers,
        'node-secretkey': nodeSecretKey,
        ...(userId ? { 'x-user-id': userId } : {}),
      },
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
// Known limit: Vercel caps request bodies at about 4.5 MB. Larger photos would need a
// direct-to-storage upload, which this route doesn't do.
router.post('/ocr', (req, res) => {
  const type = req.headers['content-type'] || '';
  const length = Number(req.headers['content-length']);

  if (!type.startsWith('multipart/form-data')) {
    return res.status(415).json({ detail: 'Send the photo as a multipart form upload.' });
  }
  if (!Number.isFinite(length) || length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ detail: 'That photo is too large (1 MB max). Try a tighter crop of just the text.' });
  }

  return forward(
    res,
    '/api/translate/camera',
    { headers: { 'content-type': type }, body: req, duplex: 'half' },
    verifiedUserId(req)
  );
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

  return forward(
    res,
    '/api/translate/text',
    {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, target_lang, source_lang }),
    },
    verifiedUserId(req)
  );
});

// The signed-in traveller's saved translations. Unlike the two routes above
// these need a user, so a missing or bad token is a 401/403 here.
router.get('/history', authenticateToken, (req, res) => {
  const query = new URLSearchParams();
  for (const key of ['limit', 'offset', 'type']) {
    if (typeof req.query[key] === 'string') query.set(key, req.query[key]);
  }
  return forward(res, `/api/translate/history?${query}`, { method: 'GET' }, String(req.user.userId));
});

// Every saved translation and stored photograph of the signed-in traveller
router.delete('/history', authenticateToken, (req, res) => {
  return forward(res, '/api/translate/history', { method: 'DELETE' }, String(req.user.userId));
});

router.delete('/history/:id', authenticateToken, (req, res) => {
  return forward(
    res,
    `/api/translate/history/${encodeURIComponent(req.params.id)}`,
    { method: 'DELETE' },
    String(req.user.userId)
  );
});

module.exports = router;
