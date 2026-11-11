/**
 * app/api/stt/route.ts
 * POST /api/stt
 * Accepts: multipart/form-data with audio blob + lang field
 * Returns: { text: string, lang: string }
 * Falls back to { text: "", error: "..." } on failure.
 */
import { NextRequest, NextResponse } from "next/server";
import { GNANI_STT_URL, GNANI_LANG_CODES } from "@/lib/voice/gnani";
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
    // No Gnani key — return empty to trigger browser fallback
    return NextResponse.json(
      { error: "Gnani not configured", code: "PROVIDER_UNAVAILABLE" },
      { status: 503 }
    );
  }

  const langCode = GNANI_LANG_CODES[lang];

  // Build form for Gnani
  const gnaniForm = new FormData();
  const blob = await audioFile.arrayBuffer().then((ab) => new Blob([ab], { type: audioFile.type }));
  gnaniForm.append("audio_file", blob, audioFile.name || "audio.webm");
  gnaniForm.append("model", "prisma-v2.5");
  gnaniForm.append("language_code", langCode);
  gnaniForm.append("format", "transcribe");

  try {
    const res = await fetch(GNANI_STT_URL, {
      method: "POST",
      headers: { "X-API-Key-ID": apiKey },
      body: gnaniForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[STT] Gnani error:", res.status, errText);
      return NextResponse.json(
        { error: "STT provider error", code: "PROVIDER_ERROR" },
        { status: 502 }
      );
    }

    const json = await res.json();
    const text: string =
      json?.text ?? json?.transcript ?? json?.results?.[0]?.transcript ?? "";

    return NextResponse.json({ text: text.trim(), lang });
  } catch (err) {
    console.error("[STT] fetch error:", err);
    return NextResponse.json(
      { error: "STT network error", code: "NETWORK_ERROR" },
      { status: 502 }
    );
  }
}

