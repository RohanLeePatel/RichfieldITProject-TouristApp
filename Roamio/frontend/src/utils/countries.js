// Reference data for the 60 countries in the recommendation catalog
// (ai-features data/destinations_seed.json), keyed by the name a trip's
// destination ends in ("Durban, South Africa").
//   iso3     - the code SafetyAdvisory rows use (GET /api/safety/:iso3)
//   language - the DeepL source code for the main local language, or null
//              when DeepL doesn't support it (Zulu, Afrikaans, Hindi, Malay,
//              Swahili, Croatian, Icelandic...) - the translator then auto-detects
export const COUNTRIES = {
  Argentina: { iso3: "ARG", language: "ES" },
  Australia: { iso3: "AUS", language: "EN" },
  Austria: { iso3: "AUT", language: "DE" },
  Botswana: { iso3: "BWA", language: "EN" },
  Brazil: { iso3: "BRA", language: "PT" },
  Canada: { iso3: "CAN", language: "EN" },
  Chile: { iso3: "CHL", language: "ES" },
  China: { iso3: "CHN", language: "ZH" },
  Colombia: { iso3: "COL", language: "ES" },
  "Costa Rica": { iso3: "CRI", language: "ES" },
  Croatia: { iso3: "HRV", language: null },
  "Czech Republic": { iso3: "CZE", language: "CS" },
  Denmark: { iso3: "DNK", language: "DA" },
  Egypt: { iso3: "EGY", language: "AR" },
  Finland: { iso3: "FIN", language: "FI" },
  France: { iso3: "FRA", language: "FR" },
  Germany: { iso3: "DEU", language: "DE" },
  Ghana: { iso3: "GHA", language: "EN" },
  Greece: { iso3: "GRC", language: "EL" },
  Hungary: { iso3: "HUN", language: "HU" },
  Iceland: { iso3: "ISL", language: null },
  India: { iso3: "IND", language: null },
  Indonesia: { iso3: "IDN", language: "ID" },
  Ireland: { iso3: "IRL", language: "EN" },
  Israel: { iso3: "ISR", language: "HE" },
  Italy: { iso3: "ITA", language: "IT" },
  Japan: { iso3: "JPN", language: "JA" },
  Jordan: { iso3: "JOR", language: "AR" },
  Kenya: { iso3: "KEN", language: null },
  Malaysia: { iso3: "MYS", language: null },
  Mauritius: { iso3: "MUS", language: null },
  Mexico: { iso3: "MEX", language: "ES" },
  Morocco: { iso3: "MAR", language: "AR" },
  Mozambique: { iso3: "MOZ", language: "PT" },
  Namibia: { iso3: "NAM", language: "EN" },
  Netherlands: { iso3: "NLD", language: "NL" },
  "New Zealand": { iso3: "NZL", language: "EN" },
  Norway: { iso3: "NOR", language: "NB" },
  Oman: { iso3: "OMN", language: "AR" },
  Peru: { iso3: "PER", language: "ES" },
  Philippines: { iso3: "PHL", language: null },
  Poland: { iso3: "POL", language: "PL" },
  Portugal: { iso3: "PRT", language: "PT" },
  Senegal: { iso3: "SEN", language: "FR" },
  Singapore: { iso3: "SGP", language: "EN" },
  "South Africa": { iso3: "ZAF", language: null },
  "South Korea": { iso3: "KOR", language: "KO" },
  Spain: { iso3: "ESP", language: "ES" },
  "Sri Lanka": { iso3: "LKA", language: null },
  Sweden: { iso3: "SWE", language: "SV" },
  Switzerland: { iso3: "CHE", language: "DE" },
  Tanzania: { iso3: "TZA", language: null },
  Thailand: { iso3: "THA", language: "TH" },
  Turkey: { iso3: "TUR", language: "TR" },
  "United Arab Emirates": { iso3: "ARE", language: "AR" },
  "United Kingdom": { iso3: "GBR", language: "EN" },
  "United States": { iso3: "USA", language: "EN" },
  Vietnam: { iso3: "VNM", language: "VI" },
  Zambia: { iso3: "ZMB", language: "EN" },
  Zimbabwe: { iso3: "ZWE", language: "EN" },
};

// "Durban, South Africa" -> { city: "Durban", country: "South Africa", info }
// info is null for a country outside the catalog - callers show "unavailable".
export function splitDestination(destination) {
  const parts = String(destination || "").split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts[0] || "";
  const country = parts.length > 1 ? parts[parts.length - 1] : "";
  return { city, country, info: COUNTRIES[country] || null };
}
