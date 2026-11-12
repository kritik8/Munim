"use client";
/**
 * lib/voice/vad.ts
 * Client-side Voice Activity Detection (VAD) that outputs 16kHz 16-bit mono WAV.
 *
 * Why WAV instead of MediaRecorder webm?
 * Gnani REST STT accepts: ogg, aac, flac, mp3, m4a, wav (NOT webm).
 * Recording raw PCM via Web Audio API and encoding a standard RIFF WAV ensures
 * universal browser compatibility and zero 400 UNSUPPORTED_AUDIO_FORMAT errors.
 */

export interface VADOptions {
  silenceMs?: number; // default 800 ms
  minSpeechDurationMs?: number; // default 350 ms
  maxSpeechDurationMs?: number; // default 18000 ms
  onLevelChange?: (level: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: (blob: Blob, durationMs: number) => void;
}

const TARGET_SAMPLE_RATE = 16000;

/** Downsample Float32 PCM buffer from inputSampleRate to targetSampleRate */
function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (inputSampleRate === targetSampleRate) return buffer;
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/** Encode Float32Array PCM samples as a 16-bit mono RIFF WAV Blob */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export class VAD {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private stream: MediaStream | null = null;

  private opts: Required<VADOptions>;
  private animFrame: number | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private speaking = false;
  private active = false;
  private paused = false;
  private muted = false;

  // PCM recording buffers
  private preRollBuffers: Float32Array[] = [];
  private readonly maxPreRollChunks = 3; // ~300-700ms pre-roll
  private recordedFrames: Float32Array[] = [];

  // Calibration state
  private isCalibrating = true;
  private calibrationSamples: number[] = [];
  private threshold = 0.018;
  private speechStartTime = 0;

  constructor(opts: VADOptions = {}) {
    this.opts = {
      silenceMs: opts.silenceMs ?? 800,
      minSpeechDurationMs: opts.minSpeechDurationMs ?? 350,
      maxSpeechDurationMs: opts.maxSpeechDurationMs ?? 18000,
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
      },
    });

    try {
      this.ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    } catch {
      this.ctx = new AudioContext();
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.2;

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    // ScriptProcessor captures raw PCM cleanly across all browsers
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.ctx.createGain();
    this.silentGain.gain.value = 0;

    this.processor.onaudioprocess = (e) => {
      if (!this.active || this.paused || this.muted) return;
      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);

      if (this.speaking) {
        this.recordedFrames.push(copy);
      } else {
        this.preRollBuffers.push(copy);
        if (this.preRollBuffers.length > this.maxPreRollChunks) {
          this.preRollBuffers.shift();
        }
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.ctx.destination);

    this.active = true;
    this.isCalibrating = true;
    this.calibrationSamples = [];

    // Calibrate background noise for 900ms
    setTimeout(() => {
      if (this.calibrationSamples.length > 0) {
        const avg =
          this.calibrationSamples.reduce((a, b) => a + b, 0) /
          this.calibrationSamples.length;
        // Adaptive threshold: gentle floor 0.015, cap 0.08 so quiet laptop mics work well
        this.threshold = Math.max(0.015, Math.min(0.08, avg * 2.4 + 0.005));
        console.log(
          `[VAD] Calibrated: ambient=${avg.toFixed(4)}, threshold=${this.threshold.toFixed(4)}, sampleRate=${this.ctx?.sampleRate}`
        );
      }
      this.isCalibrating = false;
    }, 900);

    this.loop();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.speaking) {
      this.cancelSpeech();
    }
  }

  pause(): void {
    this.paused = true;
    if (this.speaking) {
      this.cancelSpeech();
    }
    this.opts.onLevelChange(0);
  }

  resume(): void {
    this.paused = false;
    this.speaking = false;
    this.preRollBuffers = [];
    this.clearTimers();
    if (this.ctx?.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Force-finalize the current spoken utterance immediately (e.g. user tapped Orb) */
  forceStopSpeech(): void {
    if (this.speaking) {
      this.onSpeakEnd();
    }
  }

  stop(): void {
    this.active = false;
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    this.cancelSpeech();

    try {
      this.processor?.disconnect();
      this.silentGain?.disconnect();
      this.source?.disconnect();
    } catch {}

    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.processor = null;
    this.silentGain = null;
    this.stream = null;
  }

  private clearTimers(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxDurationTimer !== null) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
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

    if (this.isCalibrating) {
      this.calibrationSamples.push(rms);
    }

    const level = Math.min(1, Math.max(0, (rms - 0.005) / 0.06));
    this.opts.onLevelChange(this.paused || this.muted ? 0 : level);

    if (!this.paused && !this.muted && !this.isCalibrating) {
      const holdThreshold = this.speaking ? this.threshold * 0.72 : this.threshold;
      if (rms > holdThreshold) {
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
    // Seed with pre-roll so initial syllable is never clipped
    this.recordedFrames = [...this.preRollBuffers];
    this.preRollBuffers = [];

    this.maxDurationTimer = setTimeout(() => {
      if (this.speaking) {
        this.onSpeakEnd();
      }
    }, this.opts.maxSpeechDurationMs);

    this.opts.onSpeechStart();
  }

  private onSpeakEnd(): void {
    const duration = Date.now() - this.speechStartTime;
    this.speaking = false;
    this.clearTimers();

    const frames = this.recordedFrames;
    this.recordedFrames = [];

    if (duration < this.opts.minSpeechDurationMs || frames.length === 0) {
      console.log(`[VAD] Discarded short audio: duration=${duration}ms`);
      return;
    }

    // Concatenate Float32 PCM chunks
    const totalLength = frames.reduce((acc, f) => acc + f.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const f of frames) {
      merged.set(f, offset);
      offset += f.length;
    }

    const actualRate = this.ctx?.sampleRate ?? TARGET_SAMPLE_RATE;
    const pcm16k = downsampleBuffer(merged, actualRate, TARGET_SAMPLE_RATE);
    const wavBlob = encodeWav(pcm16k, TARGET_SAMPLE_RATE);

    if (wavBlob.size < 4000) {
      console.log(`[VAD] Discarded tiny WAV: size=${wavBlob.size}B`);
      return;
    }

    this.opts.onSpeechEnd(wavBlob, duration);
  }

  private cancelSpeech(): void {
    this.speaking = false;
    this.clearTimers();
    this.recordedFrames = [];
    this.preRollBuffers = [];
  }
}
