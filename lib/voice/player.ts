"use client";
/**
 * lib/voice/player.ts
 * Web Audio queue for sentence-chunked TTS playback with strict serial fetching.
 *
 * Requirements:
 * - Single serial queue for TTS requests (sentence N+1 synthesizes only after sentence N finishes).
 * - Sentence N plays as soon as its audio arrives, overlapping synthesis with playback.
 * - Global in-flight guard via voiceCoordinator (never overlaps with STT).
 * - abort() cancels in-flight fetches and stops audio immediately (for interrupt / barge-in).
 */
import { voiceCoordinator } from "./coordinator";

export interface PlayerOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onChunkStart?: (text: string) => void;
  onTTSFirstByte?: (latencyMs: number) => void;
}

interface PlaybackItem {
  text: string;
  buffer: AudioBuffer;
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
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAbortController: AbortController | null = null;
  private opts: PlayerOptions;
  private firstByteLogged = false;

  constructor(opts: PlayerOptions = {}) {
    this.opts = opts;
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
        const arrayBuf = await res.arrayBuffer();
        if (!this.ctx || this.ctx.state === "closed") {
          this.ctx = new AudioContext();
        }
        if (this.ctx.state === "suspended") {
          await this.ctx.resume();
        }

        const buffer = await this.ctx.decodeAudioData(arrayBuf);
        this.playbackQueue.push({ text: item.text, buffer });

        // Start playing immediately if idle
        if (!this.playing) {
          this.playNext();
        }
      } else {
        console.warn("[Player] TTS fetch returned status:", res.status);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("[Player] TTS synthesis error:", err);
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
      this.opts.onEnd?.();
      return;
    }

    const item = this.playbackQueue.shift()!;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }

    const wasAlreadyPlaying = this.playing;
    this.playing = true;
    if (!wasAlreadyPlaying) {
      this.opts.onStart?.();
    }
    this.opts.onChunkStart?.(item.text);

    try {
      this.currentSource = this.ctx.createBufferSource();
      this.currentSource.buffer = item.buffer;
      this.currentSource.connect(this.ctx.destination);
      this.currentSource.onended = () => {
        this.playNext();
      };
      this.currentSource.start();
    } catch (e) {
      console.error("[Player] play error:", e);
      this.playNext();
    }
  }

  /** Stop audio, cancel queued fetches, and release locks immediately (for interrupt / barge-in) */
  abort(): void {
    this.firstByteLogged = false;
    this.synthesisQueue = [];
    this.playbackQueue = [];
    this.isSynthesizing = false;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    voiceCoordinator.reset();

    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }

    this.playing = false;
  }

  get isPlaying(): boolean {
    return this.playing || this.playbackQueue.length > 0 || this.isSynthesizing;
  }
}
