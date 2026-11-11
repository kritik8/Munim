/**
 * lib/store.ts
 * Global Zustand store for Munim — call state, transcript, action feed.
 */
import { create } from "zustand";
import type { ConversationPhase } from "./agent/prompt";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TranscriptRole = "seller" | "munim";

export interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  partial: boolean; // true while streaming / interim STT
  ts: number; // Date.now()
}

export type ActionStatus = "queued" | "running" | "done" | "error";

export interface ActionEntry {
  id: string;
  toolName: string;
  toolLabel: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: ActionStatus;
  ts: number;
}

export interface CallSummary {
  issues: string[];
  actions: string[];
  nextSteps: string[];
  ts: number;
}

export type CallState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "ended";

export type Language = "en" | "hi" | "hinglish";

export interface LatencyReadout {
  stt?: number; // ms
  llmFirstToken?: number; // ms
  ttsFirstByte?: number; // ms
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface MunimStore {
  // ── Call state
  callState: CallState;
  phase: ConversationPhase;
  language: Language;
  muted: boolean;
  callStartedAt: number | null;
  latency: LatencyReadout;

  // ── Transcript
  transcript: TranscriptEntry[];
  
  // ── Action feed
  actions: ActionEntry[];

  // ── Summary
  summary: CallSummary | null;

  // ── Active tab on call screen
  activeTab: "all" | "insights" | "actions" | "transcript";

  // ── Setters
  setCallState: (state: CallState) => void;
  setPhase: (phase: ConversationPhase) => void;
  setLanguage: (lang: Language) => void;
  setMuted: (muted: boolean) => void;
  setLatency: (l: Partial<LatencyReadout>) => void;
  setActiveTab: (tab: MunimStore["activeTab"]) => void;

  // ── Transcript helpers
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  updateTranscriptEntry: (id: string, update: Partial<TranscriptEntry>) => void;
  finalisePartial: (id: string, text: string) => void;

  // ── Action helpers
  addAction: (action: ActionEntry) => void;
  updateAction: (id: string, update: Partial<ActionEntry>) => void;

  // ── Summary
  setSummary: (summary: CallSummary) => void;

  // ── Reset
  resetCall: () => void;
}

const initialState = {
  callState: "idle" as CallState,
  phase: "greet" as ConversationPhase,
  language: "hinglish" as Language,
  muted: false,
  callStartedAt: null as number | null,
  latency: {} as LatencyReadout,
  transcript: [] as TranscriptEntry[],
  actions: [] as ActionEntry[],
  summary: null as CallSummary | null,
  activeTab: "all" as MunimStore["activeTab"],
};

export const useMunimStore = create<MunimStore>((set) => ({
  ...initialState,

  setCallState: (callState) =>
    set((s) => ({
      callState,
      callStartedAt:
        callState === "connecting" && !s.callStartedAt
          ? Date.now()
          : s.callStartedAt,
    })),

  setPhase: (phase) => set({ phase }),
  setLanguage: (language) => set({ language }),
  setMuted: (muted) => set({ muted }),
  setLatency: (l) => set((s) => ({ latency: { ...s.latency, ...l } })),
  setActiveTab: (activeTab) => set({ activeTab }),

  addTranscriptEntry: (entry) =>
    set((s) => ({ transcript: [...s.transcript, entry] })),

  updateTranscriptEntry: (id, update) =>
    set((s) => ({
      transcript: s.transcript.map((e) =>
        e.id === id ? { ...e, ...update } : e
      ),
    })),

  finalisePartial: (id, text) =>
    set((s) => ({
      transcript: s.transcript.map((e) =>
        e.id === id ? { ...e, text, partial: false } : e
      ),
    })),

  addAction: (action) =>
    set((s) => ({ actions: [...s.actions, action] })),

  updateAction: (id, update) =>
    set((s) => ({
      actions: s.actions.map((a) =>
        a.id === id ? { ...a, ...update } : a
      ),
    })),

  setSummary: (summary) => set({ summary }),

  resetCall: () => set({ ...initialState }),
}));

