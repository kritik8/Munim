"use client";
/**
 * lib/voice/vad.ts
 * Client-side Voice Activity Detection (VAD) using an RMS-threshold approach.
 * - Starts recording when RMS > SPEAK_THRESHOLD for SPEAK_DEBOUNCE_MS.
 * - Stops recording after SILENCE_MS of RMS below threshold.
 * - Provides a live level value (0-1) for the UI meter.
 */

export interface VADOptions {
  speakThreshold?: number;   // 0-1, default 0.015
  silenceMs?: number;        // default 700
  speakDebounceMs?: number;  // default 150
  onLevelChange?: (level: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: (blob: Blob) => void;
}

export class VAD {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  private opts: Required<VADOptions>;
  private animFrame: number | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private speaking = false;
  private active = false;

  constructor(opts: VADOptions = {}) {
    this.opts = {
      speakThreshold: opts.speakThreshold ?? 0.015,
      silenceMs: opts.silenceMs ?? 700,
      speakDebounceMs: opts.speakDebounceMs ?? 150,
      onLevelChange: opts.onLevelChange ?? (() => {}),
      onSpeechStart: opts.onSpeechStart ?? (() => {}),
      onSpeechEnd: opts.onSpeechEnd ?? (() => {}),
    };
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
    });

    this.ctx = new AudioContext({ sampleRate: 16000 });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    this.active = true;
    this.loop();
  }

  stop(): void {
    this.active = false;
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    if (this.silenceTimer !== null) clearTimeout(this.silenceTimer);
    this.stopRecording();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
  }

  private loop(): void {
    if (!this.active || !this.analyser) return;

    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);

    // RMS
    let sum = 0;
    for (const v of data) sum += v * v;
    const rms = Math.sqrt(sum / data.length);
    const level = Math.min(1, rms / 0.1);
    this.opts.onLevelChange(level);

    if (rms > this.opts.speakThreshold) {
      if (!this.speaking) this.onSpeakStart();
      if (this.silenceTimer !== null) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else {
      if (this.speaking && this.silenceTimer === null) {
        this.silenceTimer = setTimeout(() => {
          this.onSpeakEnd();
        }, this.opts.silenceMs);
      }
    }

    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  private onSpeakStart(): void {
    this.speaking = true;
    this.chunks = [];
    if (!this.stream) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(100); // 100ms timeslice
    this.opts.onSpeechStart();
  }

  private onSpeakEnd(): void {
    this.speaking = false;
    this.silenceTimer = null;
    this.stopRecording();
  }

  private stopRecording(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") return;
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType ?? "audio/webm" });
      if (blob.size > 1000) {
        this.opts.onSpeechEnd(blob);
      }
      this.chunks = [];
    };
    this.mediaRecorder.stop();
    this.mediaRecorder = null;
  }
}

