"use client";
/**
 * lib/voice/player.ts
 * Web Audio queue for sentence-chunked TTS playback.
 * - Sentence N+1 is fetched while N is playing.
 * - abort() cancels all in-flight fetches and stops audio immediately.
 */

export interface PlayerOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onChunkStart?: (text: string) => void;
}

export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private queue: Array<{ text: string; buffer?: AudioBuffer }> = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private abortController: AbortController | null = null;
  private playing = false;
  private opts: PlayerOptions;

  constructor(opts: PlayerOptions = {}) {
    this.opts = opts;
  }

  /** Enqueue a sentence for TTS synthesis and playback */
  async enqueue(text: string, lang: string): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // Fetch audio for this sentence
    const buffer = await this.fetchAudio(text, lang);
    if (!buffer) return;

    this.queue.push({ text, buffer });
    if (!this.playing) this.playNext();
  }

  private async fetchAudio(text: string, lang: string): Promise<AudioBuffer | null> {
    this.abortController = new AbortController();
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: this.abortController.signal,
      });
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      if (!this.ctx) return null;
      return await this.ctx.decodeAudioData(arrayBuf);
    } catch {
      return null;
    }
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.playing = false;
      this.opts.onEnd?.();
      return;
    }
    const item = this.queue.shift()!;
    if (!item.buffer || !this.ctx) {
      this.playNext();
      return;
    }

    this.playing = true;
    if (this.queue.length === 0) this.opts.onStart?.();
    this.opts.onChunkStart?.(item.text);

    this.currentSource = this.ctx.createBufferSource();
    this.currentSource.buffer = item.buffer;
    this.currentSource.connect(this.ctx.destination);
    this.currentSource.onended = () => this.playNext();
    this.currentSource.start();
  }

  /** Stop audio and clear queue immediately (for interrupt) */
  abort(): void {
    this.abortController?.abort();
    this.currentSource?.stop();
    this.currentSource = null;
    this.queue = [];
    this.playing = false;
  }

  get isPlaying(): boolean {
    return this.playing;
  }
}

