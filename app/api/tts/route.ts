/**
 * app/api/tts/route.ts
 * POST /api/tts
 * Body: { text: string, lang: string }
 * Returns: streamed audio (WAV) from Gnani Timbre SSE, or browser fallback signal.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GNANI_TTS_SSE_URL, buildTtsBody, GNANI_LANG_CODES } from "@/lib/voice/gnani";
import type { SupportedLanguage } from "@/lib/voice/provider";

export const maxDuration = 30;

const MAX_TEXT_CHARS = 500;

const TtsBodySchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_CHARS),
  lang: z.string().default("hinglish"),
});

function getLangCode(lang: string): string {
  const supported: SupportedLanguage[] = ["en", "hi", "hinglish"];
  const l = supported.includes(lang as SupportedLanguage)
    ? (lang as SupportedLanguage)
    : "hinglish";
  return GNANI_LANG_CODES[l];
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof TtsBodySchema>;
  try {
    body = TtsBodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const { text, lang } = body;
  const apiKey = process.env.GNANI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Gnani not configured", code: "PROVIDER_UNAVAILABLE" },
      { status: 503 }
    );
  }

  const voice = process.env.GNANI_TTS_VOICE ?? "Nalini";
  const langCode = getLangCode(lang);

  const ttsBody = buildTtsBody({ text, voice, language: langCode });

  try {
    const res = await fetch(GNANI_TTS_SSE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key-ID": apiKey,
      },
      body: ttsBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[TTS] Gnani error:", res.status, errText);
      return NextResponse.json(
        { error: "TTS provider error", code: "PROVIDER_ERROR" },
        { status: 502 }
      );
    }

    // Gnani SSE streams audio chunks as base64 in event data.
    // We collect them and return as a WAV blob.
    // The SSE format: data: {"audio": "<base64>", "done": false}
    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      // Parse SSE stream and collect audio chunks
      const reader = res.body?.getReader();
      if (!reader) {
        return NextResponse.json(
          { error: "No body from TTS", code: "PROVIDER_ERROR" },
          { status: 502 }
        );
      }

      const audioChunks: Uint8Array[] = [];
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.audio) {
                const bytes = Buffer.from(payload.audio, "base64");
                audioChunks.push(new Uint8Array(bytes));
              }
            } catch {}
          }
        }
      }

      if (audioChunks.length === 0) {
        return NextResponse.json(
          { error: "Empty TTS response", code: "EMPTY_RESPONSE" },
          { status: 502 }
        );
      }

      const totalLength = audioChunks.reduce((s, c) => s + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return new Response(combined.buffer, {
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(combined.length),
          "Cache-Control": "no-store",
        },
      });
    }

    // If not SSE, proxy raw audio directly
    if (!res.body) {
      return NextResponse.json(
        { error: "No body from TTS", code: "PROVIDER_ERROR" },
        { status: 502 }
      );
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[TTS] fetch error:", err);
    return NextResponse.json(
      { error: "TTS network error", code: "NETWORK_ERROR" },
      { status: 502 }
    );
  }
}

