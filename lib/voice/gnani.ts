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
  language_code: string;
  multi_lang_codes?: string;
  tts_lang: string;
}

/**
 * Supported language configurations for Gnani Prisma STT and Timbre TTS.
 * Prisma supported codes: as-IN, bn-IN, en-IN, gu-IN, hi-IN, indic-auto, kn-IN, ml-IN, mr-IN, pa-IN, ta-IN, te-IN.
 * Note: language_code=indic-auto requires multi_lang_codes="hi-IN,en-IN".
 */
export const GNANI_LANG_CONFIG: Record<string, GnaniLangConfig> = {
  en: {
    language_code: "en-IN",
    tts_lang: "en-IN",
  },
  hi: {
    language_code: "hi-IN",
    tts_lang: "hi-IN",
  },
  hinglish: {
    language_code: "indic-auto",
    multi_lang_codes: "hi-IN,en-IN",
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
  form.append("model", "prisma-v2.5");
  form.append("language_code", cfg.language_code);
  if (cfg.multi_lang_codes) {
    form.append("multi_lang_codes", cfg.multi_lang_codes);
  }
  form.append("format", "transcribe");
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
