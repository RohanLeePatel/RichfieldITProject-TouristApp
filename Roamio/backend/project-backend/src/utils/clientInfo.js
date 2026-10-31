// What a sign-in looks like to the person reviewing it in Settings: the browser,
// the operating system, the kind of device, roughly where and from which address.
// Read from the request only - nothing here is trusted for anything but display.

const MAX = 80;

// Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
const BROWSERS = [
  [/edg(e|a|ios)?\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/firefox|fxios/i, 'Firefox'],
  [/chrome|crios/i, 'Chrome'],
  [/safari/i, 'Safari'],
];

// iPhone and iPad user agents say "like Mac OS X", so they come before macOS.
const SYSTEMS = [
  [/iphone|ipad|ipod/i, 'iOS'],
  [/android/i, 'Android'],
  [/windows/i, 'Windows'],
  [/mac os x|macintosh/i, 'macOS'],
  [/cros/i, 'ChromeOS'],
  [/linux/i, 'Linux'],
];

const firstMatch = (table, text) => table.find(([pattern]) => pattern.test(text))?.[1] || '';

function parseAgent(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.slice(0, 400) : '';
  let deviceType = 'desktop';
  if (/ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) deviceType = 'tablet';
  else if (/mobi|iphone|ipod|android/i.test(ua)) deviceType = 'mobile';
  return { browser: firstMatch(BROWSERS, ua) || 'Unknown browser', os: firstMatch(SYSTEMS, ua) || 'Unknown system', deviceType };
}

const countryName = (() => {
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return (code) => names.of(code.toUpperCase());
  } catch {
    return (code) => code;
  }
})();

// Vercel adds the visitor's country and city as headers. There is no look-up
// service behind this: elsewhere (local development) the location is simply blank.
function locationFrom(headers) {
  const code = String(headers['x-vercel-ip-country'] || '').trim();
  if (!/^[A-Za-z]{2}$/.test(code)) return '';
  let city = '';
  try {
    city = decodeURIComponent(String(headers['x-vercel-ip-city'] || '')).trim();
  } catch {
    city = '';
  }
  const country = countryName(code);
  return (city ? `${city}, ${country}` : country).slice(0, MAX);
}

// `req` is an Express request ("trust proxy" is on, so req.ip is the visitor's address)
function clientInfo(req) {
  const headers = req?.headers || {};
  return {
    ...parseAgent(headers['user-agent']),
    location: locationFrom(headers),
    ipAddress: String(req?.ip || '').replace(/^::ffff:/, '').slice(0, 64),
  };
}

module.exports = { clientInfo, parseAgent };
