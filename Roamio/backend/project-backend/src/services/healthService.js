const prisma = require('../config/prisma');
const emailService = require('./emailService');

const TIMEOUT_MS = 5000;
let gaClient;
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

// The FastAPI service behind translation, weather, recommendations and chat.
// /health is guarded by the same shared secret the proxies send.
const checkAiService = () => timed(async () => {
  const { AI_FEATURES_URL, superSecretKey } = process.env;
  if (!AI_FEATURES_URL) throw notConfigured('AI_FEATURES_URL');
  await probe(`${AI_FEATURES_URL.replace(/\/$/, '')}/health`, { headers: { 'node-secretkey': superSecretKey || '' } });
});

// SMTP handshake only: verify() connects and authenticates but sends nothing.
const checkEmail = () => timed(async () => {
  if (!emailService.isConfigured()) throw notConfigured('SMTP_HOST');
  await Promise.race([
    emailService.verifyConnection(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP timed out')), TIMEOUT_MS)),
  ]);
});

// Lists models: needs the key but generates nothing.
const checkGemini = () => timed(async () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw notConfigured('GEMINI_API_KEY');
  await probe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key } });
});

// One current-weather lookup (free tier)
const checkWeather = () => timed(async () => {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw notConfigured('OPENWEATHER_API_KEY');
  await probe(`https://api.openweathermap.org/data/2.5/weather?lat=0&lon=0&appid=${encodeURIComponent(key)}`);
});

// One single-result geocode (free tier)
const checkGeoapify = () => timed(async () => {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw notConfigured('GEOAPIFY_API_KEY');
  await probe(`https://api.geoapify.com/v1/geocode/search?text=London&limit=1&apiKey=${encodeURIComponent(key)}`);
});

// One USD->EUR rate
const checkFastForex = () => timed(async () => {
  const key = process.env.FASTFOREX_API_KEY;
  if (!key) throw notConfigured('FASTFOREX_API_KEY');
  await probe(`https://api.fastforex.io/fetch-one?from=USD&to=EUR&api_key=${encodeURIComponent(key)}`);
});

// Same endpoint and header safetySyncService uses. In mock mode the real API isn't used.
const checkTravelRisk = () => timed(async () => {
  const { TRAVEL_RISK_API_KEY_1: key, TRAVEL_RISK_API_URL_1: url, SAFETY_SYNC_MODE } = process.env;
  if (!key || !url) throw notConfigured('TRAVEL_RISK_API_KEY_1 / TRAVEL_RISK_API_URL_1');
  if (SAFETY_SYNC_MODE === 'mock') return 'Mock mode';
  await probe(`${url.replace(/\/$/, '')}/countries/US`, { headers: { 'X-API-Key': key } });
});

// Property metadata: needs credentials and property access, returns no report data.
const checkAnalytics = () => timed(async () => {
  const { GA_PROPERTY_ID, GOOGLE_APPLICATION_CREDENTIALS } = process.env;
  if (!GA_PROPERTY_ID || !GOOGLE_APPLICATION_CREDENTIALS) throw notConfigured('GA_PROPERTY_ID / GOOGLE_APPLICATION_CREDENTIALS');
  gaClient ??= new (require('@google-analytics/data').BetaAnalyticsDataClient)();
  await gaClient.getMetadata({ name: `properties/${GA_PROPERTY_ID}/metadata` }, { timeout: TIMEOUT_MS });
});

async function checkAll() {
  const [database, storage, deepl, aiService, email, gemini, weather, geoapify, fastforex, travelRisk, analytics] =
    await Promise.all([
      checkDatabase(), checkStorage(), checkDeepL(), checkAiService(), checkEmail(), checkGemini(),
      checkWeather(), checkGeoapify(), checkFastForex(), checkTravelRisk(), checkAnalytics(),
    ]);
  return { database, storage, deepl, aiService, email, gemini, weather, geoapify, fastforex, travelRisk, analytics };
}

module.exports = { checkAll };
