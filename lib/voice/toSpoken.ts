/**
 * lib/voice/toSpoken.ts
 * Converts raw LLM text into spoken-friendly form before TTS synthesis.
 * Rules:
 *  - ₹ amounts → Indian number words (lakh, crore)
 *  - Percentages → "X point Y percent"
 *  - Plain integers → words
 *  - Strip markdown, emojis, bullet points
 */

// ─── Number → Words (Indian system) ──────────────────────────────────────────

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigit(n: number): string {
  if (n === 0) return "";
  if (n < 100) return twoDigit(n);
  const h = Math.floor(n / 100);
  const rem = n % 100;
  return ONES[h] + " hundred" + (rem ? " " + twoDigit(rem) : "");
}

/**
 * Convert an integer to Indian-system words.
 * Handles up to 99,99,99,999 (99 crore 99 lakh 99 thousand 999).
 */
export function intToWords(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) return "minus " + intToWords(-n);

  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore) parts.push(twoDigit(crore) + " crore");
  if (lakh) parts.push(twoDigit(lakh) + " lakh");
  if (thousand) parts.push(twoDigit(thousand) + " thousand");
  if (remainder) parts.push(threeDigit(remainder));

  return parts.join(" ");
}

// ─── Currency (₹) ────────────────────────────────────────────────────────────

/**
 * "₹1,35,000" → "one lakh thirty five thousand rupees"
 * "₹8,100"   → "eight thousand one hundred rupees"
 */
function convertCurrency(match: string): string {
  // Remove ₹ and commas
  const digits = match.replace(/[₹,]/g, "").trim();
  const num = parseInt(digits, 10);
  if (isNaN(num)) return match;
  return intToWords(num) + " rupees";
}

// ─── Percentages ──────────────────────────────────────────────────────────────

/**
 * "32.5%" → "thirty two point five percent"
 * "14%"   → "fourteen percent"
 */
function convertPercent(match: string): string {
  const num = match.replace("%", "").trim();
  if (num.includes(".")) {
    const [whole, frac] = num.split(".");
    const wholeWords = intToWords(parseInt(whole, 10));
    // frac digits spoken individually
    const fracWords = frac
      .split("")
      .map((d) => intToWords(parseInt(d, 10)))
      .join(" ");
    return `${wholeWords} point ${fracWords} percent`;
  }
  const n = parseInt(num, 10);
  if (isNaN(n)) return match;
  return intToWords(n) + " percent";
}

// ─── Plain numbers ────────────────────────────────────────────────────────────

/**
 * Standalone integers in context (e.g. "18 products", "270 orders").
 * We replace numbers that are ≥ 10 and appear as whole words.
 */
function convertPlainNumber(match: string): string {
  const n = parseInt(match.replace(/,/g, ""), 10);
  if (isNaN(n)) return match;
  return intToWords(n);
}

// ─── Strip Markdown & Emoji ───────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return (
    text
      // Remove code fences
      .replace(/```[\s\S]*?```/g, "")
      // Remove inline code
      .replace(/`[^`]*`/g, "")
      // Remove bold/italic markers
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
      // Remove markdown headings
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bullet points and numbered lists
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      // Remove horizontal rules
      .replace(/^---+$/gm, "")
      // Collapse multiple spaces/newlines
      .replace(/\n{2,}/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function stripEmoji(text: string): string {
  // Remove emoji characters
  return text.replace(
    /[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}]/gu,
    ""
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert LLM output text to spoken-friendly form for TTS synthesis.
 */
export function toSpoken(text: string): string {
  let out = text;

  // 1. Strip markdown and emojis first
  out = stripMarkdown(out);
  out = stripEmoji(out);

  // 2. ₹ amounts (must come before plain number pass)
  out = out.replace(/₹[\d,]+/g, convertCurrency);

  // 3. Percentages
  out = out.replace(/\d+(?:\.\d+)?%/g, convertPercent);

  // 4. Plain numbers with commas (e.g. 1,35,000 not preceded by ₹)
  out = out.replace(/\b\d{1,3}(?:,\d{2,3})+\b/g, convertPlainNumber);

  // 5. Remaining standalone integers ≥ 10 (single or multi digit without commas)
  out = out.replace(/\b\d{2,}\b/g, (m) => {
    const n = parseInt(m, 10);
    return intToWords(n);
  });

  // 6. Single digits already readable as-is; optionally convert
  out = out.replace(/\b([2-9])\b/g, (m) => intToWords(parseInt(m, 10)));

  // 7. Clean up extra spaces
  out = out.replace(/\s{2,}/g, " ").trim();

  return out;
}

