// Language lists and small helpers for the translator page.

// DeepL target languages.
export const LANGUAGES = [
  { code: "AR", name: "Arabic" },
  { code: "BG", name: "Bulgarian" },
  { code: "CS", name: "Czech" },
  { code: "DA", name: "Danish" },
  { code: "DE", name: "German" },
  { code: "EL", name: "Greek" },
  { code: "EN-GB", name: "English (British)" },
  { code: "EN-US", name: "English (American)" },
  { code: "ES", name: "Spanish" },
  { code: "ES-419", name: "Spanish (Latin American)" },
  { code: "ET", name: "Estonian" },
  { code: "FI", name: "Finnish" },
  { code: "FR", name: "French" },
  { code: "HE", name: "Hebrew" },
  { code: "HU", name: "Hungarian" },
  { code: "ID", name: "Indonesian" },
  { code: "IT", name: "Italian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "LT", name: "Lithuanian" },
  { code: "LV", name: "Latvian" },
  { code: "NB", name: "Norwegian (Bokmål)" },
  { code: "NL", name: "Dutch" },
  { code: "PL", name: "Polish" },
  { code: "PT-BR", name: "Portuguese (Brazilian)" },
  { code: "PT-PT", name: "Portuguese (European)" },
  { code: "RO", name: "Romanian" },
  { code: "RU", name: "Russian" },
  { code: "SK", name: "Slovak" },
  { code: "SL", name: "Slovenian" },
  { code: "SV", name: "Swedish" },
  { code: "TH", name: "Thai" },
  { code: "TR", name: "Turkish" },
  { code: "UK", name: "Ukrainian" },
  { code: "VI", name: "Vietnamese" },
  { code: "ZH", name: "Chinese (Simplified)" },
  { code: "ZH-HANT", name: "Chinese (Traditional)" },
];

// "EN-US" -> "EN". DeepL source languages carry no region.
export const baseCode = (code) => String(code || "").toUpperCase().split("-")[0];

// One entry per base language, named without the regional bracket: EN-GB/EN-US -> "English".
export const SOURCE_LANGUAGES = LANGUAGES.filter(
  (l, i) => LANGUAGES.findIndex((o) => baseCode(o.code) === baseCode(l.code)) === i,
).map((l) => ({ code: baseCode(l.code), name: l.name.replace(/ \(.*\)/, "") }));

// Which target variant to use when a source language becomes the target (swap).
const PREFERRED_TARGET = { EN: "EN-US", PT: "PT-BR" };
export function targetForBase(base) {
  const code = baseCode(base);
  if (PREFERRED_TARGET[code]) return PREFERRED_TARGET[code];
  return LANGUAGES.find((l) => baseCode(l.code) === code)?.code || null;
}

// BCP-47 tag for the browser's speech APIs.
const SPEECH_TAGS = { "ZH-HANT": "zh-TW", ZH: "zh-CN", NB: "nb-NO", "ES-419": "es-419", UK: "uk-UA", EL: "el-GR", CS: "cs-CZ", DA: "da-DK", ET: "et-EE", HE: "he-IL", SV: "sv-SE", JA: "ja-JP", KO: "ko-KR", SL: "sl-SI", AR: "ar-SA" };
export function speechLang(code) {
  const upper = String(code || "").toUpperCase();
  if (SPEECH_TAGS[upper]) return SPEECH_TAGS[upper];
  const [lang, region] = upper.split("-");
  return region ? `${lang.toLowerCase()}-${region}` : lang.toLowerCase();
}

// Shrinks a photo before upload: longest side <= maxSide and, if possible, <= maxBytes
// (OCR.space's free tier rejects files over 1 MB). Falls back to the original file
// if the browser can't decode it. Returns { blob, width, height }.
export async function compressImage(file, { maxSide = 1600, maxBytes = 1024 * 1024 } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let blob = null;
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= maxBytes) break;
    }
    return blob ? { blob, width, height } : { blob: file, width: null, height: null };
  } catch {
    return { blob: file, width: null, height: null };
  }
}
