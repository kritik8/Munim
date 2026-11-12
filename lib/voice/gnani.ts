/**
 * lib/voice/gnani.ts
 * Client helpers for Gnani Vachana STT and TTS (called server-side via API routes).
 * These are used server-side only — no API keys ever reach the browser.
 *
 * STT: POST https://api.vachana.ai/stt/v3  (multipart/form-data)
 * TTS: POST https://api.vachana.ai/api/v1/tts/sse  (SSE streaming)
 */

export const GNANI_BASE = "https://api.vachana.ai";
export const GNANI_STT_URL = `${GNANI_BASE}/stt/v3`;
export const GNANI_TTS_SSE_URL = `${GNANI_BASE}/api/v1/tts/sse`;

export interface GnaniLangConfig {
  model: string;
  language_code: string;
  multi_lang_codes?: string;
  format: string;
  tts_lang: string;
}

/**
 * Supported language configurations for Gnani Prisma v3.0 STT and Timbre TTS.
 * Prisma v3.0 with language_code="indic-auto" and format="transliterate" recognizes
 * English, Hindi, and code-mixed speech and returns Latin-script text + detected_language_code.
 */
export const GNANI_LANG_CONFIG: Record<string, GnaniLangConfig> = {
  en: {
    model: "prisma-v3.0",
    language_code: "indic-auto",
    format: "transliterate",
    tts_lang: "en-IN",
  },
  hi: {
    model: "prisma-v3.0",
    language_code: "indic-auto",
    format: "transliterate",
    tts_lang: "hi-IN",
  },
  hinglish: {
    model: "prisma-v3.0",
    language_code: "indic-auto",
    format: "transliterate",
    tts_lang: "hi-IN",
  },
};

export interface GnaniSTTResponse {
  text: string;
  language_code?: string;
  confidence?: number;
}

/** Build the multipart FormData for Gnani STT */
export function buildSttFormData(
  audioBlob: Blob,
  lang: string,
  filename = "audio.webm"
): FormData {
  const form = new FormData();
  const cfg = GNANI_LANG_CONFIG[lang] ?? GNANI_LANG_CONFIG.hinglish;

  form.append("audio_file", audioBlob, filename);
  form.append("model", cfg.model);
  form.append("language_code", cfg.language_code);
  if (cfg.multi_lang_codes) {
    form.append("multi_lang_codes", cfg.multi_lang_codes);
  }
  form.append("format", cfg.format);
  return form;
}

export interface GnaniTTSRequest {
  text: string;
  voice: string;
  language: string;
  speed?: number;
}

/** Build the JSON body for Gnani TTS SSE */
export function buildTtsBody(req: GnaniTTSRequest): string {
  return JSON.stringify({
    text: req.text,
    voice: req.voice,
    model: "timbre-v2.5",
    language: req.language,
    speed: req.speed ?? 1.0,
    audio_config: {
      encoding: "linear_pcm",
      container: "wav",
      num_channels: 1,
      sample_rate: 22050,
      sample_width: 2,
    },
  });
}
