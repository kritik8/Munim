"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Square } from "lucide-react";
import { useMunimStore } from "@/lib/store";
import type { ConversationPhase } from "@/lib/agent/prompt";

const PHASE_LABELS: Record<ConversationPhase, string> = {
  greet: "Greeting",
  discover: "Discover",
  diagnose: "Diagnose",
  recommend: "Recommend",
  commit: "Taking action",
  summarise: "Summary",
};

interface CallShelfProps {
  onEnd: () => void;
  onMuteToggle: () => void;
  onInterrupt: () => void;
}

export function CallShelf({ onEnd, onMuteToggle, onInterrupt }: CallShelfProps) {
  const { callState, phase, muted, callStartedAt } = useMunimStore();
  const [elapsed, setElapsed] = useState("00:00");
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!callStartedAt) return;
    const tick = () => {
      const secs = Math.floor((Date.now() - callStartedAt) / 1000);
      const m = Math.floor(secs / 60).toString().padStart(2, "0");
      const s = (secs % 60).toString().padStart(2, "0");
      setElapsed(`${m}:${s}`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStartedAt]);

  if (callState === "idle" || callState === "ended") return null;

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <motion.div
        layout
        className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--color-ink)] dark:bg-[var(--color-surface-dark)] text-white shadow-[var(--shadow-float)] overflow-hidden"
      >
        {/* Orb indicator */}
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            callState === "listening"
              ? "bg-[var(--color-accent)] animate-pulse"
              : callState === "speaking"
              ? "bg-green-400 animate-pulse"
              : callState === "thinking"
              ? "bg-yellow-400 animate-pulse"
              : "bg-white/40"
          }`}
          aria-label={callState}
        />

        {/* Timer */}
        <span className="font-mono text-sm text-white/70">{elapsed}</span>

        {/* Phase label — only when expanded */}
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="text-xs text-white/60 whitespace-nowrap overflow-hidden"
            >
              {PHASE_LABELS[phase]}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center gap-2 ml-1">
          <button
            onClick={onMuteToggle}
            aria-label={muted ? "Unmute" : "Mute"}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            {muted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button
            onClick={onInterrupt}
            aria-label="Interrupt"
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <Square size={14} />
          </button>
          <button
            onClick={onEnd}
            aria-label="End call"
            className="p-1.5 rounded-full hover:bg-red-500/30 transition-colors text-red-400"
          >
            <PhoneOff size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

