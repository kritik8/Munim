/**
 * lib/voice/language.ts
 * Lightweight language detection and Devanagari script detection
 * for routing English vs Hinglish speech and enforcing English-script transcripts.
 */

export type DetectedVoiceLanguage = "en" | "hinglish";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

// Unambiguous Romanized Hindi / Hinglish markers (avoiding English homographs like "is", "me", "to", "in", "par", "se", "no", "or")
const HINGLISH_MARKERS = new Set([
  "haan",
  "hanji",
  "nahi",
  "nahin",
  "namaste",
  "namaskar",
  "ji",
  "mera",
  "meri",
  "mere",
  "humara",
  "hamara",
  "aap",
  "aapka",
  "aapki",
  "aapke",
  "tum",
  "tumhara",
  "main",
  "mein",
  "hum",
  "kya",
  "kyun",
  "kyon",
  "kyuki",
  "kyunki",
  "kaise",
  "kaisa",
  "kaisi",
  "kahan",
  "kitna",
  "kitni",
  "kitne",
  "kaun",
  "hai",
  "hain",
  "hoon",
  "tha",
  "thi",
  "gaya",
  "gayi",
  "gaye",
  "raha",
  "rahi",
  "rahe",
  "karna",
  "karo",
  "karenge",
  "karein",
  "karti",
  "karta",
  "karunga",
  "karungi",
  "chahiye",
  "chahie",
  "sakte",
  "sakta",
  "sakti",
  "bikri",
  "mahine",
  "pichle",
  "agla",
  "agle",
  "bahut",
  "jyada",
  "zyada",
  "thoda",
  "thodi",
  "kam",
  "badh",
  "gir",
  "gira",
  "giri",
  "samajh",
  "samjha",
  "batao",
  "bataiye",
  "bataye",
  "dekho",
  "dekhiye",
  "dekh",
  "suno",
  "suniye",
  "bilkul",
  "theek",
  "thik",
  "accha",
  "achha",
  "achhe",
  "toh",
  "lekin",
  "magar",
  "aur",
  "bhi",
  "sab",
  "kuch",
  "koi",
  "yeh",
  "woh",
  "iska",
  "iski",
  "iske",
  "uska",
  "uski",
  "unke",
  "abhi",
  "phir",
  "pehle",
  "baad",
  "wajah",
  "chalu",
  "band",
  "bech",
  "bechna",
  "saste",
  "mehenga",
  "dukaan",
  "khata",
  "paisa",
  "paise",
  "rupaye",
  "shukriya",
  "dhanyawad",
  "bol",
]);

/** Returns true if text contains any Devanagari (Hindi) Unicode characters. */
export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

/**
 * Determines whether an utterance or reply sentence is English or Hinglish/Hindi.
 * Text containing Devanagari or Hindi/Hinglish markers returns "hinglish";
 * clean English text returns "en".
 */
export function detectTextLanguage(
  text: string,
  sttDetectedCode?: string
): DetectedVoiceLanguage {
  const trimmed = text.trim();
  if (!trimmed) {
    return sttDetectedCode?.toLowerCase().startsWith("hi") ? "hinglish" : "en";
  }

  if (containsDevanagari(trimmed)) {
    return "hinglish";
  }

  const words = trimmed.toLowerCase().match(/[a-z]+/g) ?? [];
  let hindiHits = 0;
  for (const w of words) {
    if (HINGLISH_MARKERS.has(w)) {
      hindiHits++;
    }
  }

  if (hindiHits >= 1) {
    return "hinglish";
  }

  return "en";
}

