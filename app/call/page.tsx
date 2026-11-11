"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMunimStore } from "@/lib/store";
import { VAD } from "@/lib/voice/vad";
import { AudioPlayer } from "@/lib/voice/player";
import { voiceCoordinator } from "@/lib/voice/coordinator";
import { toSpoken } from "@/lib/voice/toSpoken";
import type { ConversationPhase } from "@/lib/agent/prompt";
import { CallShelf } from "@/components/call/CallShelf";
import { Orb } from "@/components/call/Orb";
import { Transcript } from "@/components/call/Transcript";
import { ActionFeed } from "@/components/actions/ActionFeed";
import { SellerPanel } from "@/components/insights/SellerPanel";
import { SummaryCard } from "@/components/summary/SummaryCard";
import { ShortcutHint } from "@/components/call/ShortcutHint";
import { toast } from "@/lib/hooks/useToast";
import type { TranscriptEntry, ActionEntry } from "@/lib/store";

// ── Browser speech recognition fallback type ──────────────────────────────
interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "all", label: "All" },
  { id: "insights", label: "Insights" },
  { id: "actions", label: "Actions" },
  { id: "transcript", label: "Transcript" },
] as const;

type Tab = (typeof TABS)[number]["id"];

// ── Main call page ────────────────────────────────────────────────────────────
export default function CallPage() {
  const router = useRouter();
  const store = useMunimStore();
  const {
    callState,
    phase,
    language,
    transcript,
    actions,
    summary,
    activeTab,
  } = store;

  const [micLevel, setMicLevel] = useState(0);
  const [latency, setLatency] = useState<{ stt?: number; llm?: number; tts?: number }>({});

  const vadRef = useRef<VAD | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const munimMsgIdRef = useRef<string | null>(null);
  const ttsLangRef = useRef("hinglish");
  const isTranscribingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const hasShownFallbackToastRef = useRef(false);

  // Keep TTS lang in sync
  useEffect(() => {
    ttsLangRef.current = language;
  }, [language]);

  // ── Browser fallback STT ───────────────────────────────────────────────────
  const browserSttRef = useRef<BrowserSpeechRecognition | null>(null);
  const [usesBrowserFallback, setUsesBrowserFallback] = useState(false);

  // ── Voice provider env ─────────────────────────────────────────────────────
  const voiceProvider =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_VOICE_PROVIDER ?? "gnani")
      : "gnani";

  // ── Send text to LLM and stream response ──────────────────────────────────
  const sendToLLM = useCallback(
    async (userText: string) => {
      // Pause VAD while Munim is thinking or replying
      vadRef.current?.pause();
      store.setCallState("thinking");
      chatAbortRef.current?.abort();
      chatAbortRef.current = new AbortController();

      // Add user message to transcript
      const userId = crypto.randomUUID();
      store.addTranscriptEntry({
        id: userId,
        role: "seller",
        text: userText,
        partial: false,
        ts: Date.now(),
      });

      // Add partial Munim response entry
      const munimId = crypto.randomUUID();
      munimMsgIdRef.current = munimId;
      store.addTranscriptEntry({
        id: munimId,
        role: "munim",
        text: "",
        partial: true,
        ts: Date.now(),
      });

      const llmStart = Date.now();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              ...transcript.filter((e) => !e.partial).map((e) => ({
                role: e.role === "seller" ? "user" : "assistant",
                content: e.text,
              })),
              { role: "user", content: userText },
            ],
            phase,
          }),
          signal: chatAbortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat API error");
        }

        store.setCallState("speaking");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let munimText = "";
        let firstToken = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let evt: Record<string, unknown>;
            try {
              evt = JSON.parse(raw);
            } catch {
              continue;
            }

            switch (evt.event) {
              case "ttft": {
                if (!firstToken) {
                  firstToken = true;
                  setLatency((l) => ({ ...l, llm: evt.ttft as number }));
                }
                break;
              }

              case "text_delta": {
                if (!firstToken) {
                  firstToken = true;
                  setLatency((l) => ({ ...l, llm: Date.now() - llmStart }));
                }
                munimText += evt.text as string;
                store.updateTranscriptEntry(munimId, { text: munimText });
                break;
              }

              case "sentence": {
                const spoken = toSpoken(evt.text as string);
                // Enqueue for serial TTS (sentence N+1 synthesizes only after sentence N finishes)
                playerRef.current?.enqueue(spoken, ttsLangRef.current);
                break;
              }

              case "tool_call": {
                const actionId = crypto.randomUUID();
                const toolName = evt.name as string;
                store.addAction({
                  id: actionId,
                  toolName,
                  toolLabel: toolName,
                  args: (evt.args as Record<string, unknown>) ?? {},
                  status: "running",
                  ts: Date.now(),
                });
                (evt as Record<string, unknown>)._actionId = actionId;
                break;
              }

              case "tool_result": {
                const matchingAction = actions
                  .slice()
                  .reverse()
                  .find((a) => a.toolName === evt.name && a.status === "running");
                if (matchingAction) {
                  const result = evt.result as Record<string, unknown>;
                  store.updateAction(matchingAction.id, {
                    status: result.status === "error" ? "error" : "done",
                    result,
                  });

                  if (evt.name === "end_call_with_summary" && result.summary) {
                    const s = result.summary as {
                      issues: string[];
                      actions: string[];
                      nextSteps: string[];
                    };
                    store.setSummary({
                      issues: s.issues,
                      actions: s.actions,
                      nextSteps: s.nextSteps,
                      ts: Date.now(),
                    });
                  }
                }
                break;
              }

              case "phase": {
                store.setPhase(evt.phase as ConversationPhase);
                break;
              }

              case "done": {
                store.finalisePartial(munimId, munimText);
                break;
              }

              case "error": {
                toast.error("Munim ran into an issue. Try speaking again.");
                vadRef.current?.resume();
                store.setCallState("listening");
                break;
              }
            }
          }
        }

        store.finalisePartial(munimId, munimText);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.error("[chat]", err);
        toast.error("Connection issue. Speak to try again.");
        vadRef.current?.resume();
        store.setCallState("listening");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, transcript, actions]
  );

  // ── REST STT via Gnani with global lock & failure threshold ───────────────
  const transcribeBlob = useCallback(
    async (blob: Blob): Promise<string | null> => {
      if (usesBrowserFallback || isTranscribingRef.current) return null;

      isTranscribingRef.current = true;
      const sttStart = Date.now();

      // Acquire global lock so STT never collides with TTS
      const releaseLock = await voiceCoordinator.acquire("stt");

      try {
        const form = new FormData();
        form.append("audio", blob, "audio.webm");
        form.append("lang", language);

        const res = await fetch("/api/stt", { method: "POST", body: form });

        if (!res.ok) {
          const errText = await res.text();
          console.warn("[STT] fetch status:", res.status, errText);
          consecutiveErrorsRef.current++;
          if (consecutiveErrorsRef.current >= 2) {
            activateBrowserFallback();
          }
          return null;
        }

        const json = await res.json();
        consecutiveErrorsRef.current = 0; // reset on success
        setLatency((l) => ({ ...l, stt: Date.now() - sttStart }));
        return (json.text as string) || null;
      } catch (err) {
        console.error("[STT] network error:", err);
        consecutiveErrorsRef.current++;
        if (consecutiveErrorsRef.current >= 2) {
          activateBrowserFallback();
        }
        return null;
      } finally {
        releaseLock();
        isTranscribingRef.current = false;
      }
    },
    [language, usesBrowserFallback]
  );

  const activateBrowserFallback = useCallback(() => {
    if (usesBrowserFallback) return;
    setUsesBrowserFallback(true);
    store.setVoiceProvider("browser");
    if (!hasShownFallbackToastRef.current) {
      hasShownFallbackToastRef.current = true;
      toast.info("Switched to browser speech (Gnani unavailable).");
    }
  }, [usesBrowserFallback, store]);

  // ── Start the call ─────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    store.setCallState("connecting");

    // AudioPlayer with callbacks that coordinate VAD pausing and latency logging
    playerRef.current = new AudioPlayer({
      onStart: () => {
        vadRef.current?.pause();
        store.setCallState("speaking");
      },
      onEnd: () => {
        // Resume VAD only when speech playback completes
        vadRef.current?.resume();
        if (store.callState !== "ended") {
          store.setCallState("listening");
        }
      },
      onTTSFirstByte: (latencyMs) => {
        setLatency((l) => ({ ...l, tts: latencyMs }));
      },
    });

    // Start VAD with adaptive noise calibration and speech thresholds
    try {
      vadRef.current = new VAD({
        silenceMs: 700,
        minSpeechDurationMs: 400,
        onLevelChange: setMicLevel,
        onSpeechStart: () => {
          if (playerRef.current?.isPlaying) {
            // Barge-in: interrupt TTS immediately
            playerRef.current.abort();
            chatAbortRef.current?.abort();
            voiceCoordinator.reset();
          }
          store.setCallState("listening");
        },
        onSpeechEnd: async (blob) => {
          if (isTranscribingRef.current || playerRef.current?.isPlaying) return;

          store.setCallState("thinking");
          const text = await transcribeBlob(blob);
          if (text && text.trim().length > 0) {
            await sendToLLM(text.trim());
          } else {
            if (store.callState !== "speaking") {
              vadRef.current?.resume();
              store.setCallState("listening");
            }
          }
        },
      });
      await vadRef.current.start();
    } catch {
      activateBrowserFallback();
    }

    // Proactive greeting turn
    store.setCallState("thinking");
    await sendToLLM("(call started — please greet me proactively with the seller data)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Browser speech recognition fallback ───────────────────────────────────
  useEffect(() => {
    if (!usesBrowserFallback) return;
    const windowObj = typeof window !== "undefined" ? (window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    }) : {};
    const SR = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (!SR) return;

    const sr = new SR();
    sr.continuous = false;
    sr.interimResults = true;
    sr.lang = language === "hi" ? "hi-IN" : language === "en" ? "en-IN" : "hi-IN";

    let partialId = "";

    sr.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => {
      const resultsArr = Array.from(e.results);
      const transcript = resultsArr
        .map((r) => r[0].transcript)
        .join("");
      const isFinal = resultsArr[resultsArr.length - 1]?.isFinal ?? false;

      if (!partialId) {
        partialId = crypto.randomUUID();
        store.addTranscriptEntry({
          id: partialId,
          role: "seller",
          text: transcript,
          partial: true,
          ts: Date.now(),
        });
      } else {
        store.updateTranscriptEntry(partialId, { text: transcript });
      }

      if (isFinal) {
        store.finalisePartial(partialId, transcript);
        partialId = "";
        sendToLLM(transcript);
      }
    };

    sr.onend = () => {
      if (store.callState === "listening") sr.start();
    };

    browserSttRef.current = sr;
    sr.start();

    return () => {
      sr.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usesBrowserFallback, language]);

  // ── Auto-start call on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (callState === "idle") {
      startCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        handleOrbPress();
      }
      if (e.code === "Escape") {
        endCall();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // ── Orb press handler ─────────────────────────────────────────────────────
  const handleOrbPress = useCallback(() => {
    if (callState === "speaking") {
      // Interrupt
      playerRef.current?.abort();
      chatAbortRef.current?.abort();
      voiceCoordinator.reset();
      vadRef.current?.resume();
      store.setCallState("listening");
    } else if (callState === "listening") {
      // Manual push-to-talk stop (do nothing, VAD handles end)
    } else if (callState === "thinking") {
      // Cancel LLM
      chatAbortRef.current?.abort();
      voiceCoordinator.reset();
      vadRef.current?.resume();
      store.setCallState("listening");
    }
  }, [callState, store]);

  // ── End call ──────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    vadRef.current?.stop();
    playerRef.current?.abort();
    chatAbortRef.current?.abort();
    browserSttRef.current?.stop();
    store.setCallState("ended");
  }, [store]);

  const handleMuteToggle = useCallback(() => {
    store.setMuted(!store.muted);
  }, [store]);

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts: Record<Tab, number> = {
    all: transcript.length + actions.length,
    insights: 5, // always showing 5 metrics
    actions: actions.length,
    transcript: transcript.length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] dark:bg-[var(--color-canvas-dark)]">
      <CallShelf
        onEnd={endCall}
        onMuteToggle={handleMuteToggle}
        onInterrupt={handleOrbPress}
      />

      <main className="max-w-6xl mx-auto px-4 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* ── Left: Orb + Transcript/Actions ── */}
          <div className="flex flex-col gap-6">
            {/* Orb area */}
            <div className="flex flex-col items-center py-8 gap-4">
              <Orb onPress={handleOrbPress} level={micLevel} />
              <div className="text-sm text-[var(--color-ink-muted)]">
                {callState === "listening" && "Listening…"}
                {callState === "thinking" && "Munim is thinking…"}
                {callState === "speaking" && "Munim is speaking…"}
                {callState === "connecting" && "Connecting…"}
                {callState === "ended" && "Call ended"}
              </div>
              <ShortcutHint />
              {/* Dev latency readout */}
              {process.env.NODE_ENV === "development" && (
                <div className="text-[10px] font-mono text-[var(--color-ink-faint)] flex gap-3">
                  {latency.stt !== undefined && <span>STT: {latency.stt}ms</span>}
                  {latency.llm !== undefined && <span>TTFT: {latency.llm}ms</span>}
                  {latency.tts !== undefined && <span>TTS: {latency.tts}ms</span>}
                </div>
              )}
            </div>

            {/* Filter tabs */}
            <div
              role="tablist"
              className="flex gap-1 p-1 rounded-2xl bg-[var(--color-surface-raised)] dark:bg-[var(--color-surface-dark)] border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() =>
                    store.setActiveTab(tab.id as MunimStore["activeTab"])
                  }
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white dark:bg-[var(--color-surface-dark)] shadow-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {tab.label}
                  {tabCounts[tab.id as Tab] > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-hairline)] dark:bg-[var(--color-hairline-dark)] text-[var(--color-ink-faint)] text-[10px]">
                      {tabCounts[tab.id as Tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>
              {(activeTab === "all" || activeTab === "transcript") && (
                <section aria-label="Conversation transcript">
                  <Transcript />
                </section>
              )}
              {(activeTab === "all" || activeTab === "actions") &&
                actions.length > 0 && (
                  <section aria-label="Actions" className="mt-4">
                    <ActionFeed />
                  </section>
                )}
              {activeTab === "all" && summary && (
                <div className="mt-4">
                  <SummaryCard />
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Seller insights ── */}
          <aside>
            <div className="sticky top-20">
              {(activeTab === "all" || activeTab === "insights") && (
                <SellerPanel />
              )}
              {activeTab === "actions" && <ActionFeed />}
              {summary && activeTab === "all" && (
                <div className="mt-4">
                  <SummaryCard />
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Summary standalone when call ended */}
        <AnimatePresence>
          {callState === "ended" && summary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 max-w-2xl mx-auto"
            >
              <SummaryCard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Type stub ─────────────────────────────────────────────────────────────────
interface MunimStore {
  activeTab: "all" | "insights" | "actions" | "transcript";
}

