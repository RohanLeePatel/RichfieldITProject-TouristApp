// Fixed-window limiter per client IP. In-memory, so on Vercel each serverless
// instance counts separately (it slows abuse, it doesn't guarantee a hard cap).
// ponytail: swap for a shared store (Redis/Upstash) if a strict global limit matters.
function rateLimit({ max, windowMs, now = Date.now }) {
  const hits = new Map(); // ip -> { count, resetAt }

  return function limiter(req, res, next) {
    const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    const t = now();
    let entry = hits.get(ip);

    if (!entry || t >= entry.resetAt) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(ip, entry);
      if (hits.size > 5000) for (const [key, e] of hits) if (t >= e.resetAt) hits.delete(key);
    }

    if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      return res.status(429).json({ detail: 'Too many translation requests - wait a minute and try again.' });
    }
    next();
  };
}

module.exports = rateLimit;
