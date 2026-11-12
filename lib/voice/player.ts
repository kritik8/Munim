"use client";
/**
 * lib/voice/player.ts
 * Web Audio queue for sentence-chunked TTS playback with strict serial fetching.
 *
 * Guarantees:
 * - Single serial HTTP queue for /api/tts (never overlaps with itself or STT).
 * - Decouples `isAudioPlaying` from `hasActiveTurn` so sentence N+1 NEVER stalls
 *   if sentence N finishes playing before sentence N+1 finishes synthesizing.
 * - Generation token (`runId`) prevents stale async responses from playing after abort().
 * - Automatic browser SpeechSynthesis fallback if Gnani TTS fails.
 * - Only invokes `onEnd()` once ALL queued sentences have been synthesized AND played.
 */
import { voiceCoordinator } from "./coordinator";

export interface PlayerOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onChunkStart?: (text: string) => void;
  onTTSFirstByte?: (latencyMs: number) => void;
  onProviderFallback?: () => void;
}

interface PlaybackItem {
  text: string;
  buffer?: AudioBuffer;
  useBrowserSpeech?: boolean;
  lang: string;
  runId: number;
}

interface SynthesisItem {
  text: string;
  lang: string;
  enqueuedAt: number;
  runId: number;
}

export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private synthesisQueue: SynthesisItem[] = [];
  private playbackQueue: PlaybackItem[] = [];
  private isSynthesizing = false;
  private isAudioPlaying = false;
  private hasTriggeredStart = false;
  private runId = 0;

  private currentSource: AudioBufferSourceNode | null = null;
  private currentAbortController: AbortController | null = null;
  private opts: PlayerOptions;
  private firstByteLogged = false;
  private consecutiveFailures = 0;

  constructor(opts: PlayerOptions = {}) {
    this.opts = opts;
  }

  /** Eagerly create and resume AudioContext on user gesture to satisfy autoplay policy */
  async warmup(): Promise<void> {
    try {
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
    } catch (e) {
      console.warn("[Player] AudioContext warmup skipped:", e);
    }
  }

  /** Enqueue a sentence for serial TTS synthesis and uninterrupted sequential playback */
  enqueue(text: string, lang: string): void {
    const cleaned = text.trim();
    if (!cleaned) return;

    this.synthesisQueue.push({
      text: cleaned,
      lang,
      enqueuedAt: Date.now(),
      runId: this.runId,
    });

    if (!this.isSynthesizing) {
      this.processSynthesisQueue();
    }
  }

  /** Process one synthesis HTTP request at a time (strictly serial) */
  private async processSynthesisQueue(): Promise<void> {
    if (this.synthesisQueue.length === 0) {
      this.isSynthesizing = false;
      this.maybeEmitEnd();
      return;
    }

    this.isSynthesizing = true;
    const item = this.synthesisQueue.shift()!;

    // Discard stale items from an aborted turn
    if (item.runId !== this.runId) {
      this.processSynthesisQueue();
      return;
    }

    const releaseLock = await voiceCoordinator.acquire("tts");
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      // Re-check after lock wait in case abort() ran while waiting
      if (item.runId !== this.runId) return;

      const fetchStart = Date.now();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, lang: item.lang }),
        signal: abortController.signal,
      });

      if (item.runId !== this.runId) return;

      if (!this.firstByteLogged) {
        this.firstByteLogged = true;
        this.opts.onTTSFirstByte?.(Date.now() - fetchStart);
      }

      if (res.ok) {
        this.consecutiveFailures = 0;
        const arrayBuf = await res.arrayBuffer();
        if (item.runId !== this.runId) return;

        if (!this.ctx || this.ctx.state === "closed") {
          this.ctx = new AudioContext();
        }
        if (this.ctx.state === "suspended") {
          await this.ctx.resume();
        }

        const buffer = await this.ctx.decodeAudioData(arrayBuf);
        if (item.runId !== this.runId) return;

        this.playbackQueue.push({
          text: item.text,
          buffer,
          lang: item.lang,
          runId: item.runId,
        });

        if (!this.isAudioPlaying) {
          this.playNext();
        }
      } else {
        console.warn("[Player] TTS fetch returned status:", res.status);
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.opts.onProviderFallback?.();
        }
        this.playbackQueue.push({
          text: item.text,
          useBrowserSpeech: true,
          lang: item.lang,
          runId: item.runId,
        });
        if (!this.isAudioPlaying) {
          this.playNext();
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError" && item.runId === this.runId) {
        console.error("[Player] TTS synthesis error:", err);
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.opts.onProviderFallback?.();
        }
        this.playbackQueue.push({
          text: item.text,
          useBrowserSpeech: true,
          lang: item.lang,
          runId: item.runId,
        });
        if (!this.isAudioPlaying) {
          this.playNext();
        }
      }
    } finally {
      releaseLock();
      if (this.currentAbortController === abortController) {
        this.currentAbortController = null;
      }
      // Continue processing remaining sentences
      this.processSynthesisQueue();
    }
  }

  private playNext(): void {
    // Drop any stale queued items from previous aborted turns
    while (
      this.playbackQueue.length > 0 &&
      this.playbackQueue[0].runId !== this.runId
    ) {
      this.playbackQueue.shift();
    }

    if (this.playbackQueue.length === 0) {
      this.isAudioPlaying = false;
      this.maybeEmitEnd();
      return;
    }

    const item = this.playbackQueue.shift()!;
    this.isAudioPlaying = true;

    if (!this.hasTriggeredStart) {
      this.hasTriggeredStart = true;
      this.opts.onStart?.();
    }
    this.opts.onChunkStart?.(item.text);

    if (item.useBrowserSpeech || !item.buffer) {
      this.playBrowserSpeech(item.text, item.lang, item.runId);
      return;
    }

    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }

    const activeRunId = item.runId;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = item.buffer;
      source.connect(this.ctx.destination);
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
        }
        if (activeRunId === this.runId) {
          this.playNext();
        }
      };
      this.currentSource = source;
      source.start();
    } catch (e) {
      console.error("[Player] play error:", e);
      this.currentSource = null;
      if (activeRunId === this.runId) {
        this.playNext();
      }
    }
  }

  private playBrowserSpeech(text: string, lang: string, activeRunId: number): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (activeRunId === this.runId) this.playNext();
      return;
    }

    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === "hi" ? "hi-IN" : "en-IN";
      utter.rate = 1.02;
      utter.onend = () => {
        if (activeRunId === this.runId) this.playNext();
      };
      utter.onerror = () => {
        if (activeRunId === this.runId) this.playNext();
      };
      window.speechSynthesis.speak(utter);
    } catch {
      if (activeRunId === this.runId) this.playNext();
    }
  }

  private maybeEmitEnd(): void {
    if (
      !this.isAudioPlaying &&
      this.playbackQueue.length === 0 &&
      !this.isSynthesizing &&
      this.synthesisQueue.length === 0 &&
      this.hasTriggeredStart
    ) {
      this.hasTriggeredStart = false;
      this.opts.onEnd?.();
    }
  }

  /** Stop audio immediately (only invoked on explicit user interrupt like Space or End Call) */
  abort(): void {
    this.runId++;
    this.firstByteLogged = false;
    this.synthesisQueue = [];
    this.playbackQueue = [];
    this.isSynthesizing = false;
    this.isAudioPlaying = false;
    this.hasTriggeredStart = false;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    voiceCoordinator.reset();

    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  get isPlaying(): boolean {
    return (
      this.isAudioPlaying ||
      this.playbackQueue.length > 0 ||
      this.isSynthesizing ||
      this.synthesisQueue.length > 0
    );
  }
}
