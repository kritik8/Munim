/**
 * lib/voice/provider.ts
 * Unified voice provider interface.
 * Switches between Gnani (server-side REST) and browser Web Speech API.
 *
 * Usage: import { getVoiceProvider } from "@/lib/voice/provider"
 */

export type VoiceProvider = "gnani" | "browser";

/** Detect which provider to use from the env flag */
export function getVoiceProvider(): VoiceProvider {
  if (typeof window === "undefined") return "gnani"; // server
  const flag = process.env.NEXT_PUBLIC_VOICE_PROVIDER;
  return flag === "browser" ? "browser" : "gnani";
}

/** Language code for the provider */
export type SupportedLanguage = "en" | "hi" | "hinglish";

export function getLangCode(
  provider: VoiceProvider,
  lang: SupportedLanguage
): string {
  if (provider === "gnani") {
    const map: Record<SupportedLanguage, string> = {
      en: "en-IN",
      hi: "hi-IN",
      hinglish: "indic-auto",
    };
    return map[lang];
  }
  // Web Speech API BCP-47
  const map: Record<SupportedLanguage, string> = {
    en: "en-IN",
    hi: "hi-IN",
    hinglish: "hi-IN", // best approximation
  };
  return map[lang];
}

