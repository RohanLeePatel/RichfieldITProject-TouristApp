const { httpError } = require('./tripAccessService');

// Cloudflare Turnstile, checked server-side before an account is created.
// Off when TURNSTILE_SECRET_KEY is unset (like GA / Web Push); set it together
// with the frontend's VITE_TURNSTILE_SITE_KEY. The secret never leaves the server.
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048; // Turnstile's own limit

const failed = () =>
  Object.assign(httpError(400, 'The verification check failed or expired. Please complete it again and retry.'), { code: 'CAPTCHA_FAILED' });

async function verifyCaptcha(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { skipped: true };

  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) throw failed();

  let result;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, ...(remoteip && { remoteip }) }),
      signal: AbortSignal.timeout(8000),
    });
    result = await response.json();
  } catch (error) {
    console.error('Turnstile siteverify unreachable:', error.message);
    throw Object.assign(httpError(503, "We couldn't check the verification just now. Please try again in a moment."), { code: 'CAPTCHA_UNAVAILABLE' });
  }

  if (result?.success !== true) {
    const codes = result?.['error-codes'] || [];
    // our configuration, not the visitor: say so in the log, and fail closed
    if (codes.includes('missing-input-secret') || codes.includes('invalid-input-secret')) {
      console.error('Turnstile rejected TURNSTILE_SECRET_KEY:', codes.join(', '));
    }
    throw failed();
  }
  return { skipped: false };
}

module.exports = { verifyCaptcha };
