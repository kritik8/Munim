/**
 * lib/voice/coordinator.ts
 * Global in-flight guard for Gnani API requests.
 * Gnani Vachana allows ONLY 1 active request at a time across STT and TTS.
 */

class VoiceCoordinator {
  private activeRequest: "stt" | "tts" | null = null;
  private waitQueue: Array<() => void> = [];

  get isBusy(): boolean {
    return this.activeRequest !== null;
  }

  get currentType(): "stt" | "tts" | null {
    return this.activeRequest;
  }

  /**
   * Acquire exclusive access to the Gnani API.
   * Returns a release function that MUST be called in a finally block.
   */
  async acquire(type: "stt" | "tts"): Promise<() => void> {
    while (this.activeRequest !== null) {
      await new Promise<void>((resolve) => this.waitQueue.push(resolve));
    }
    this.activeRequest = type;
    let released = false;

    return () => {
      if (!released) {
        released = true;
        this.activeRequest = null;
        const next = this.waitQueue.shift();
        if (next) next();
      }
    };
  }

  /**
   * Abort waiting requests (e.g. on user barge-in / interrupt).
   */
  reset(): void {
    this.waitQueue = [];
    this.activeRequest = null;
  }
}

export const voiceCoordinator = new VoiceCoordinator();
