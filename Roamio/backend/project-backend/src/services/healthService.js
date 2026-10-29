const prisma = require('../config/prisma');

const TIMEOUT_MS = 5000;
const SLOW_MS = 1500; // answered, but slower than this = degraded

// Times a check. It resolves { status, latencyMs, detail? } and never throws,
// so one broken service can't fail the whole report.
async function timed(check) {
  const start = performance.now();
  try {
    const detail = await check();
    const latencyMs = Math.round(performance.now() - start);
    return { status: latencyMs > SLOW_MS ? 'degraded' : 'online', latencyMs, ...(detail && { detail }) };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return { status: error.degraded ? 'degraded' : 'down', latencyMs, detail: error.message };
  }
}

const notConfigured = (what) => new Error(`${what} is not configured`);

// 4xx/5xx from a dependency: 5xx and auth failures mean it isn't usable (down),
// 429 means it is up but throttling (degraded).
async function probe(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 429) throw Object.assign(new Error('Rate limited (429)'), { degraded: true });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

const checkDatabase = () => timed(async () => { await prisma.$queryRaw`SELECT 1`; });

// Lists buckets with the service-role key (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
const checkStorage = () => timed(async () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw notConfigured('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  await probe(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/bucket`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
});

// DeepL's /usage endpoint is free to call and doesn't consume translation quota.
// Free-tier keys end in ":fx" and use a different host.
const checkDeepL = () => timed(async () => {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw notConfigured('DEEPL_API_KEY');
  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  await probe(`https://${host}/v2/usage`, { headers: { Authorization: `DeepL-Auth-Key ${key}` } });
});

async function checkAll() {
  const [database, storage, deepl] = await Promise.all([checkDatabase(), checkStorage(), checkDeepL()]);
  return { database, storage, deepl };
}

module.exports = { checkAll };
