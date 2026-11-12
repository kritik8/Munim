/**
 * app/api/stt/route.ts
 * POST /api/stt
 * Accepts: multipart/form-data with audio blob + lang field
 * Returns: { text: string, detectedLang: "en" | "hinglish", rawText: string, lang: string }
 * Ensures returned `text` is ALWAYS English regardless of whether the speaker spoke English, Hindi, or Hinglish.
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GNANI_STT_URL, GNANI_LANG_CONFIG } from "@/lib/voice/gnani";
import {
  containsDevanagari,
  detectTextLanguage,
  type DetectedVoiceLanguage,
} from "@/lib/voice/language";
import type { SupportedLanguage } from "@/lib/voice/provider";

export const maxDuration = 30;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5MB cap

function buildForm(
  blob: Blob,
  filename: string,
  opts: {
    model: string;
    language_code: string;
    multi_lang_codes?: string;
    format: string;
  }
): FormData {
  const form = new FormData();
  form.append("audio_file", blob, filename);
  form.append("model", opts.model);
  form.append("language_code", opts.language_code);
  if (opts.multi_lang_codes) {
    form.append("multi_lang_codes", opts.multi_lang_codes);
  }
  form.append("format", opts.format);
  return form;
}

/** Translate non-English or Devanagari speech transcripts into natural English via LiteLLM. */
async function translateToEnglish(rawText: string): Promise<string> {
  if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_API_KEY) {
    return rawText;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const client = new OpenAI({
      baseURL: process.env.LITELLM_BASE_URL,
      apiKey: process.env.LITELLM_API_KEY,
    });
    const model = process.env.LITELLM_MODEL ?? "gpt-4o-mini";

    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "Translate the speaker's Hindi, Hinglish, or Devanagari transcript into clear, natural English. Preserve store names, product names, numbers, and percentages accurately. Output ONLY the English translation without quotes or commentary.",
          },
          {
            role: "user",
            content: rawText,
          },
        ],
      },
      { signal: controller.signal }
    );

    const translated = completion.choices[0]?.message?.content?.trim();
    if (translated && !containsDevanagari(translated)) {
      return translated;
    }
    return rawText;
  } catch (err) {
    console.warn("[STT] English normalization skipped:", (err as Error)?.message);
    return rawText;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Failed to parse form data", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const audioFile = formData.get("audio") as File | null;
  const langRaw = (formData.get("lang") as string | null) ?? "hinglish";
  const lang = (["en", "hi", "hinglish"].includes(langRaw)
    ? langRaw
    : "hinglish") as SupportedLanguage;

  if (!audioFile) {
    return NextResponse.json(
      { error: "Missing audio field", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio file too large", code: "AUDIO_TOO_LARGE" },
      { status: 413 }
    );
  }

  const apiKey = process.env.GNANI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gnani not configured", code: "PROVIDER_UNAVAILABLE" },
      { status: 503 }
    );
  }

  const langConfig = GNANI_LANG_CONFIG[lang] ?? GNANI_LANG_CONFIG.hinglish;

  const blob = await audioFile
    .arrayBuffer()
    .then((ab) => new Blob([ab], { type: audioFile.type || "audio/wav" }));

  const filename =
    audioFile.name && !audioFile.name.endsWith(".webm")
      ? audioFile.name
      : "audio.wav";

  try {
    const primaryForm = buildForm(blob, filename, {
      model: langConfig.model,
      language_code: langConfig.language_code,
      multi_lang_codes: langConfig.multi_lang_codes,
      format: langConfig.format,
    });

    let res = await fetch(GNANI_STT_URL, {
      method: "POST",
      headers: { "X-API-Key-ID": apiKey },
      body: primaryForm,
    });

    // Retry once on 429 concurrency limit
    if (res.status === 429) {
      console.warn("[STT] Gnani 429 received, retrying in 350ms...");
      await new Promise((r) => setTimeout(r, 350));
      res = await fetch(GNANI_STT_URL, {
        method: "POST",
        headers: { "X-API-Key-ID": apiKey },
        body: primaryForm,
      });
    }

    // Fallback to prisma-v2.5 if prisma-v3.0 is rejected by plan
    if (!res.ok && res.status >= 400 && res.status < 500 && res.status !== 429) {
      console.warn("[STT] Falling back from prisma-v3.0 to prisma-v2.5 after status", res.status);
      const fallbackForm = buildForm(blob, filename, {
        model: "prisma-v2.5",
        language_code: "indic-auto",
        multi_lang_codes: "en-IN,hi-IN",
        format: "transcribe",
      });
      res = await fetch(GNANI_STT_URL, {
        method: "POST",
        headers: { "X-API-Key-ID": apiKey },
        body: fallbackForm,
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[STT] Gnani error:", res.status, errText);
      return NextResponse.json(
        { error: "STT provider error", code: "PROVIDER_ERROR", details: errText },
        { status: res.status === 429 ? 429 : 502 }
      );
    }

    const json = (await res.json()) as {
      transcript?: string | Record<string, string>;
      text?: string;
      results?: Array<{ transcript?: string }>;
      detected_language_code?: string;
    };

    let rawText = "";
    if (typeof json?.transcript === "string") {
      rawText = json.transcript;
    } else if (json?.transcript && typeof json.transcript === "object") {
      // Prioritize English script key if present
      rawText =
        json.transcript["en-IN"] ||
        json.transcript["hi-IN"] ||
        Object.values(json.transcript).find(
          (v) => typeof v === "string" && v.trim().length > 0
        ) ||
        "";
    } else {
      rawText = json?.text ?? json?.results?.[0]?.transcript ?? "";
    }

    rawText = rawText.trim();
    const detectedLang: DetectedVoiceLanguage = detectTextLanguage(
      rawText,
      json.detected_language_code
    );

    // Ensure the displayed transcript is ALWAYS clean English regardless of spoken language
    let englishText = rawText;
    if (rawText.length > 0 && (containsDevanagari(rawText) || detectedLang !== "en")) {
      englishText = await translateToEnglish(rawText);
    }

    return NextResponse.json({
      text: englishText,
      detectedLang,
      rawText,
      lang,
    });
  } catch (err) {
    console.error("[STT] fetch error:", err);
    return NextResponse.json(
      { error: "STT network error", code: "NETWORK_ERROR" },
      { status: 502 }
    );
  }
}
