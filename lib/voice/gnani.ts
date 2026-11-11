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

/** Language codes for Gnani STT */
export const GNANI_LANG_CODES = {
  en: "en-IN",
  hi: "hi-IN",
  hinglish: "indic-auto", // auto-detect handles Hinglish well
} as const;

export interface GnaniSTTResponse {
  text: string;
  language_code?: string;
  confidence?: number;
}

/** Build the multipart FormData for Gnani STT */
export function buildSttFormData(
  audioBlob: Blob,
  langCode: string,
  filename = "audio.webm"
): FormData {
  const form = new FormData();
  form.append("audio_file", audioBlob, filename);
  form.append("model", "prisma-v2.5");
  form.append("language_code", langCode);
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

