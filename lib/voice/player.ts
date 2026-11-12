"use client";
/**
 * lib/voice/player.ts
 * Web Audio queue for sentence-chunked TTS playback with strict serial fetching.
 *
 * Requirements:
 * - Single serial queue for TTS requests (sentence N+1 synthesizes only after sentence N finishes).
 * - Sentence N plays as soon as its audio arrives, overlapping synthesis with playback.
 * - Global in-flight guard via voiceCoordinator (never overlaps with STT).
 * - Browser SpeechSynthesis fallback per-sentence if Gnani TTS returns an error.
 * - Always calls onEnd() when all queued speech finishes or fails, so VAD never gets stuck paused.
 * - abort() cancels in-flight fetches and stops audio immediately (for interrupt / barge-in).
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
}

interface SynthesisItem {
  text: string;
  lang: string;
  enqueuedAt: number;
}

export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private synthesisQueue: SynthesisItem[] = [];
  private playbackQueue: PlaybackItem[] = [];
  private isSynthesizing = false;
  private playing = false;
  private hasTriggeredStart = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAbortController: AbortController | null = null;
  private opts: PlayerOptions;
  private firstByteLogged = false;
  private consecutiveFailures = 0;

  constructor(opts: PlayerOptions = {}) {
    this.opts = opts;
  }

  /** Eagerly create and resume AudioContext on call start to satisfy browser autoplay policy */
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

  /** Enqueue a sentence for serial TTS synthesis and playback */
  enqueue(text: string, lang: string): void {
    if (!text || text.trim().length === 0) return;
    this.synthesisQueue.push({
      text: text.trim(),
      lang,
      enqueuedAt: Date.now(),
    });

    if (!this.isSynthesizing) {
      this.processSynthesisQueue();
    }
  }

  /** Process one synthesis request at a time (strictly serial) */
  private async processSynthesisQueue(): Promise<void> {
    if (this.synthesisQueue.length === 0) {
      this.isSynthesizing = false;
      // If playback already finished (or never started due to errors), ensure onEnd fires
      if (!this.playing && this.playbackQueue.length === 0 && this.hasTriggeredStart) {
        this.hasTriggeredStart = false;
        this.opts.onEnd?.();
      }
      return;
    }

    this.isSynthesizing = true;
    const item = this.synthesisQueue.shift()!;

    // Acquire global lock so no STT or concurrent TTS request can collide
    const releaseLock = await voiceCoordinator.acquire("tts");
    this.currentAbortController = new AbortController();

    try {
      const fetchStart = Date.now();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, lang: item.lang }),
        signal: this.currentAbortController.signal,
      });

      if (!this.firstByteLogged) {
        this.firstByteLogged = true;
        this.opts.onTTSFirstByte?.(Date.now() - fetchStart);
      }

      if (res.ok) {
        this.consecutiveFailures = 0;
        const arrayBuf = await res.arrayBuffer();
        if (!this.ctx || this.ctx.state === "closed") {
          this.ctx = new AudioContext();
        }
        if (this.ctx.state === "suspended") {
          await this.ctx.resume();
        }

        const buffer = await this.ctx.decodeAudioData(arrayBuf);
        this.playbackQueue.push({ text: item.text, buffer, lang: item.lang });

        if (!this.playing) {
          this.playNext();
        }
      } else {
        console.warn("[Player] TTS fetch returned status:", res.status);
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.opts.onProviderFallback?.();
        }
        // Fallback to browser SpeechSynthesis for this sentence
        this.playbackQueue.push({
          text: item.text,
          useBrowserSpeech: true,
          lang: item.lang,
        });
        if (!this.playing) {
          this.playNext();
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("[Player] TTS synthesis error:", err);
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.opts.onProviderFallback?.();
        }
        this.playbackQueue.push({
          text: item.text,
          useBrowserSpeech: true,
          lang: item.lang,
        });
        if (!this.playing) {
          this.playNext();
        }
      }
    } finally {
      releaseLock();
      this.currentAbortController = null;
      // Synthesize sentence N+1 only after sentence N's HTTP request has finished
      this.processSynthesisQueue();
    }
  }

  private playNext(): void {
    if (this.playbackQueue.length === 0) {
      // If synthesis is still going, wait for next sentence buffer
      if (this.isSynthesizing || this.synthesisQueue.length > 0) {
        return;
      }
      this.playing = false;
      this.hasTriggeredStart = false;
      this.opts.onEnd?.();
      return;
    }

    const item = this.playbackQueue.shift()!;
    const wasAlreadyPlaying = this.playing;
    this.playing = true;
    if (!wasAlreadyPlaying && !this.hasTriggeredStart) {
      this.hasTriggeredStart = true;
      this.opts.onStart?.();
    }
    this.opts.onChunkStart?.(item.text);

    if (item.useBrowserSpeech || !item.buffer) {
      this.playBrowserSpeech(item.text, item.lang);
      return;
    }

    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }

    try {
      this.currentSource = this.ctx.createBufferSource();
      this.currentSource.buffer = item.buffer;
      this.currentSource.connect(this.ctx.destination);
      this.currentSource.onended = () => {
        this.currentSource = null;
        this.playNext();
      };
      this.currentSource.start();
    } catch (e) {
      console.error("[Player] play error:", e);
      this.currentSource = null;
      this.playNext();
    }
  }

  private playBrowserSpeech(text: string, lang: string): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.playNext();
      return;
    }

    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === "hi" ? "hi-IN" : "en-IN";
      utter.rate = 1.02;
      utter.onend = () => this.playNext();
      utter.onerror = () => this.playNext();
      window.speechSynthesis.speak(utter);
    } catch {
      this.playNext();
    }
  }

  /** Stop audio, cancel queued fetches, and release locks immediately (for interrupt / barge-in) */
  abort(): void {
    this.firstByteLogged = false;
    this.synthesisQueue = [];
    this.playbackQueue = [];
    this.isSynthesizing = false;
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

    this.playing = false;
  }

  get isPlaying(): boolean {
    return this.playing || this.playbackQueue.length > 0 || this.isSynthesizing;
  }
}
