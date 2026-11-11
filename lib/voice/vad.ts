"use client";
/**
 * lib/voice/vad.ts
 * Robust Client-side Voice Activity Detection (VAD) with noise calibration.
 *
 * Improvements:
 * - 1-second background noise calibration at start to set an adaptive RMS threshold (min 0.035).
 * - Minimum speech duration check (~400 ms) to ignore clicks, breath, and taps.
 * - Minimum audio blob size threshold (~3500 bytes / ~0.5s duration) to discard tiny fragments.
 * - End-of-speech silence window: ~700 ms.
 * - pause() and resume() support to freeze VAD while the agent is speaking.
 * - Level meter callback for UI animation.
 */

export interface VADOptions {
  silenceMs?: number; // default 700 ms
  minSpeechDurationMs?: number; // default 400 ms
  onLevelChange?: (level: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: (blob: Blob, durationMs: number) => void;
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
  private paused = false;

  // Calibration state
  private isCalibrating = true;
  private calibrationSamples: number[] = [];
  private threshold = 0.035; // baseline minimum threshold
  private speechStartTime = 0;

  constructor(opts: VADOptions = {}) {
    this.opts = {
      silenceMs: opts.silenceMs ?? 700,
      minSpeechDurationMs: opts.minSpeechDurationMs ?? 400,
      onLevelChange: opts.onLevelChange ?? (() => {}),
      onSpeechStart: opts.onSpeechStart ?? (() => {}),
      onSpeechEnd: opts.onSpeechEnd ?? (() => {}),
    };
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
    });

    this.ctx = new AudioContext({ sampleRate: 16000 });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.2;
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    this.active = true;
    this.isCalibrating = true;
    this.calibrationSamples = [];

    // Calibrate background noise for 1 second
    setTimeout(() => {
      if (this.calibrationSamples.length > 0) {
        const avg =
          this.calibrationSamples.reduce((a, b) => a + b, 0) /
          this.calibrationSamples.length;
        // Adaptive threshold: 2.5x ambient noise, clamped between 0.035 and 0.12
        this.threshold = Math.max(0.035, Math.min(0.12, avg * 2.5));
        console.log(
          `[VAD] Calibrated: ambient=${avg.toFixed(4)}, threshold=${this.threshold.toFixed(4)}`
        );
      }
      this.isCalibrating = false;
    }, 1000);

    this.loop();
  }

  pause(): void {
    this.paused = true;
    if (this.speaking) {
      this.cancelSpeech();
    }
  }

  resume(): void {
    this.paused = false;
    this.speaking = false;
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  stop(): void {
    this.active = false;
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    if (this.silenceTimer !== null) clearTimeout(this.silenceTimer);
    this.cancelSpeech();
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

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);

    // Feed calibration
    if (this.isCalibrating) {
      this.calibrationSamples.push(rms);
    }

    // Live level visualizer (0 to 1)
    const level = Math.min(1, Math.max(0, (rms - 0.01) / 0.08));
    this.opts.onLevelChange(this.paused ? 0 : level);

    // Skip speech detection if paused or calibrating
    if (!this.paused && !this.isCalibrating) {
      if (rms > this.threshold) {
        if (!this.speaking) {
          this.onSpeakStart();
        }
        if (this.silenceTimer !== null) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (this.speaking) {
        if (this.silenceTimer === null) {
          this.silenceTimer = setTimeout(() => {
            this.onSpeakEnd();
          }, this.opts.silenceMs);
        }
      }
    }

    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  private onSpeakStart(): void {
    this.speaking = true;
    this.speechStartTime = Date.now();
    this.chunks = [];
    if (!this.stream) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.mediaRecorder.start(100);
      this.opts.onSpeechStart();
    } catch (e) {
      console.error("[VAD] Failed to start MediaRecorder:", e);
    }
  }

  private onSpeakEnd(): void {
    const duration = Date.now() - this.speechStartTime;
    this.speaking = false;
    this.silenceTimer = null;

    if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") return;

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, {
        type: this.mediaRecorder?.mimeType ?? "audio/webm",
      });
      this.chunks = [];

      // Discard clips shorter than minSpeechDurationMs or tiny size (under 3000 bytes)
      if (duration >= this.opts.minSpeechDurationMs && blob.size >= 3000) {
        this.opts.onSpeechEnd(blob, duration);
      } else {
        console.log(
          `[VAD] Discarded short audio: duration=${duration}ms, size=${blob.size}B`
        );
      }
    };

    try {
      this.mediaRecorder.stop();
    } catch {}
    this.mediaRecorder = null;
  }

  private cancelSpeech(): void {
    this.speaking = false;
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
