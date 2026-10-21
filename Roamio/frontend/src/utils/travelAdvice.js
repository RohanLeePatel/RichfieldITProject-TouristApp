// Pure helpers behind the "typical weather", "best time to visit" and packing
// advice features - no network, no React. Data comes from api/climate.js.
// Temperatures are Celsius, wind km/h, rain mm.

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const RAINY_DAY_MM = 1; // a day counts as "rainy" from 1 mm

// daily = { time[], temperature_2m_max[], temperature_2m_min[], precipitation_sum[], wind_speed_10m_max[] }
// -> 12 entries (Jan..Dec) of averages across every year in the data.
export function summarizeClimate(daily) {
  const acc = Array.from({ length: 12 }, () => ({ hi: [], lo: [], wind: [], rain: 0, rainyDays: 0, days: 0, years: new Set() }));
  (daily?.time || []).forEach((date, i) => {
    const bucket = acc[Number(date.slice(5, 7)) - 1];
    const hi = daily.temperature_2m_max?.[i];
    const lo = daily.temperature_2m_min?.[i];
    const rain = daily.precipitation_sum?.[i];
    const wind = daily.wind_speed_10m_max?.[i];
    if (hi != null) bucket.hi.push(hi);
    if (lo != null) bucket.lo.push(lo);
    if (wind != null) bucket.wind.push(wind);
    if (rain != null) {
      bucket.days += 1;
      bucket.rain += rain;
      if (rain >= RAINY_DAY_MM) bucket.rainyDays += 1;
    }
    bucket.years.add(date.slice(0, 4));
  });
  const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  return acc.map((b, i) => ({
    month: i + 1,
    highC: mean(b.hi),
    lowC: mean(b.lo),
    windKmh: mean(b.wind),
    rainyDayPct: b.days ? b.rainyDays / b.days : null,
    rainMm: b.years.size ? b.rain / b.years.size : null, // average total per month
  }));
}

// 0-100 "how pleasant is a typical day": comfort band 20-28C highs, few wet
// days, not too windy. A rough heuristic for ranking months, not a forecast.
export function comfortScore(stats) {
  if (!stats || stats.highC == null) return null;
  const tempPenalty = Math.max(0, 20 - stats.highC, stats.highC - 28) * 4;
  const rainPenalty = (stats.rainyDayPct ?? 0) * 40;
  const windPenalty = Math.max(0, (stats.windKmh ?? 0) - 25) * 0.8;
  const idealDrift = Math.abs(stats.highC - 24) * 0.5; // breaks ties toward a ~24C day
  return Math.max(0, Math.round(100 - tempPenalty - rainPenalty - windPenalty - idealDrift));
}

// month numbers (1-12) of the n most pleasant months, best first
export function bestMonths(months, n = 3) {
  return months
    .map((m) => ({ month: m.month, score: comfortScore(m) }))
    .filter((m) => m.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((m) => m.month);
}

// Packing/planning tips for a typical day in one month. Each: { kind, text }.
export function monthAdvice(stats) {
  if (!stats || stats.highC == null) return [];
  const tips = [];
  const { highC, lowC, rainyDayPct, windKmh } = stats;

  if (highC >= 32) tips.push({ kind: "hot", text: "Very hot - plan outdoor stops for early morning or late afternoon, carry water and wear sun protection." });
  else if (highC >= 27) tips.push({ kind: "sun", text: "Warm days - pack light clothing, sunscreen and a hat." });
  else if (highC <= 8) tips.push({ kind: "cold", text: "Cold - pack a warm coat, gloves and thermal layers." });
  else if (highC <= 15) tips.push({ kind: "cold", text: "Cool - bring a proper jacket and layers." });
  else tips.push({ kind: "mild", text: "Mild days - light layers are usually enough." });

  if (lowC != null && lowC <= 3) tips.push({ kind: "cold", text: "Nights near freezing - expect frost and slippery mornings." });
  if (lowC != null && highC - lowC >= 12) tips.push({ kind: "layers", text: "Big swing between day and night - bring a layer for the evenings." });

  if (rainyDayPct != null && rainyDayPct >= 0.4) tips.push({ kind: "rain", text: "Rain is common - pack a waterproof jacket and keep an indoor plan B for each day." });
  else if (rainyDayPct != null && rainyDayPct >= 0.2) tips.push({ kind: "rain", text: "Showers are possible - a packable rain jacket is worth the space." });
  else if (rainyDayPct != null && rainyDayPct < 0.08) tips.push({ kind: "dry", text: "Usually dry - outdoor plans are low-risk." });

  if (windKmh != null && windKmh >= 35) tips.push({ kind: "wind", text: "Often windy - a windproof layer helps, and check ferry or boat trips the day before." });
  return tips;
}

export const NOTHING_TO_REPORT = "The coming days look settled - no weather-driven changes needed.";

const RAIN_WORDS = /rain|drizzle|shower|thunder|storm/;
const SNOW_WORDS = /snow|sleet/;

// Tips from an upcoming forecast: [{ date, description, temp }] in Celsius.
export function forecastAdvice(forecast) {
  if (!forecast?.length) return [];
  const tips = [];
  const day = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "long" });
  const wet = forecast.filter((f) => RAIN_WORDS.test((f.description || "").toLowerCase()));
  const snowy = forecast.filter((f) => SNOW_WORDS.test((f.description || "").toLowerCase()));
  const temps = forecast.map((f) => f.temp).filter((t) => t != null);

  if (wet.length) tips.push({ kind: "rain", text: `Rain in the forecast on ${wet.slice(0, 3).map((f) => day(f.date)).join(", ")} - schedule museums or indoor stops then.` });
  if (snowy.length) tips.push({ kind: "cold", text: `Snow possible on ${snowy.slice(0, 3).map((f) => day(f.date)).join(", ")} - check transport before heading out.` });
  if (temps.length && Math.max(...temps) >= 32) tips.push({ kind: "hot", text: "Some forecast days reach 32°C or more - avoid midday walking tours." });
  if (temps.length && Math.min(...temps) <= 3) tips.push({ kind: "cold", text: "Some forecast days are near freezing - pack warm layers." });
  if (!tips.length) tips.push({ kind: "mild", text: NOTHING_TO_REPORT });
  return tips;
}

// The two sources answer different questions - forecastAdvice covers the next
// few days, monthAdvice a typical year - and the Weather page printed them as
// one list. That shipped a panel reading "The coming days look settled - no
// weather-driven changes needed." directly above "Showers are possible - a
// packable rain jacket is worth the space."
//
// The settled line is only forecastAdvice saying it found nothing, so it holds
// just while nothing else does. Where both horizons raise the same kind of
// concern the forecast wins: it can name the actual days.
export function combineAdvice(forecast, stats) {
  const tips = forecastAdvice(forecast).filter((tip) => tip.text !== NOTHING_TO_REPORT);
  for (const tip of monthAdvice(stats)) {
    if (!tips.some((seen) => seen.kind === tip.kind)) tips.push(tip);
  }
  return tips.length ? tips : [{ kind: "mild", text: NOTHING_TO_REPORT }];
}

// The advisory feed sends an excerpt that can stop mid-word ("Kidnapping is a
// threat in So"). Keep the complete sentences; if there are none, mark the cut.
export function wholeSentences(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || /[.!?]["')]?$/.test(trimmed)) return trimmed;
  const lastEnd = Math.max(trimmed.lastIndexOf(". "), trimmed.lastIndexOf("! "), trimmed.lastIndexOf("? "));
  return lastEnd > 0 ? trimmed.slice(0, lastEnd + 1) : `${trimmed}…`;
}
