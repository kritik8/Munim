/**
 * app/api/stt/route.ts
 * POST /api/stt
 * Accepts: multipart/form-data with audio blob + lang field
 * Returns: { text: string, lang: string }
 * Falls back to { text: "", error: "..." } on failure.
 */
import { NextRequest, NextResponse } from "next/server";
import { GNANI_STT_URL, GNANI_LANG_CONFIG } from "@/lib/voice/gnani";
import type { SupportedLanguage } from "@/lib/voice/provider";

export const maxDuration = 30;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5MB cap

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

  // Build form for Gnani
  const gnaniForm = new FormData();
  const blob = await audioFile
    .arrayBuffer()
    .then((ab) => new Blob([ab], { type: audioFile.type }));

  gnaniForm.append("audio_file", blob, audioFile.name || "audio.webm");
  gnaniForm.append("model", "prisma-v2.5");
  gnaniForm.append("language_code", langConfig.language_code);
  if (langConfig.multi_lang_codes) {
    gnaniForm.append("multi_lang_codes", langConfig.multi_lang_codes);
  }
  gnaniForm.append("format", "transcribe");

  try {
    let res = await fetch(GNANI_STT_URL, {
      method: "POST",
      headers: { "X-API-Key-ID": apiKey },
      body: gnaniForm,
    });

    // Retry once on 429 concurrency limit
    if (res.status === 429) {
      console.warn("[STT] Gnani 429 received, retrying in 350ms...");
      await new Promise((r) => setTimeout(r, 350));
      res = await fetch(GNANI_STT_URL, {
        method: "POST",
        headers: { "X-API-Key-ID": apiKey },
        body: gnaniForm,
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

    const json = await res.json();
    let text = "";

    if (typeof json?.transcript === "string") {
      text = json.transcript;
    } else if (json?.transcript && typeof json.transcript === "object") {
      // For indic-auto, transcript is an object: { "hi-IN": "...", "en-IN": "..." }
      text =
        json.transcript["hi-IN"] ||
        json.transcript["en-IN"] ||
        Object.values(json.transcript).find(
          (v) => typeof v === "string" && v.trim().length > 0
        ) ||
        "";
    } else {
      text =
        json?.text ??
        json?.results?.[0]?.transcript ??
        "";
    }

    return NextResponse.json({ text: (text as string).trim(), lang });
  } catch (err) {
    console.error("[STT] fetch error:", err);
    return NextResponse.json(
      { error: "STT network error", code: "NETWORK_ERROR" },
      { status: 502 }
    );
  }
}
