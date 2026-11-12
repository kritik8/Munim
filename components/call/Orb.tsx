"use client";
import { motion } from "framer-motion";
import { useMunimStore } from "@/lib/store";

interface OrbProps {
  onPress: () => void;
  level?: number; // 0–1 mic level
}

export function Orb({ onPress, level = 0 }: OrbProps) {
  const { callState } = useMunimStore();

  const isListening = callState === "listening";
  const isSpeaking = callState === "speaking";
  const isThinking = callState === "thinking";

  // Scale pulsation based on mic level when listening
  const scale = isListening ? 1 + level * 0.25 : 1;

  return (
    <button
      onClick={onPress}
      aria-label={isListening ? "Stop listening" : "Start speaking (Space)"}
      className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-4 rounded-full"
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: isListening
            ? `0 0 0 ${8 + level * 20}px rgba(228,0,70,0.25)`
            : isSpeaking
            ? "0 0 0 12px rgba(16,185,129,0.2)"
            : "0 0 0 0px rgba(228,0,70,0)",
        }}
        transition={{ duration: 0.1 }}
      />

      {/* Orb body */}
      <motion.div
        animate={{ scale: isListening ? scale : isSpeaking ? [1, 1.04, 1] : 1 }}
        transition={
          isSpeaking
            ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" }
            : { duration: 0.08 }
        }
        className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, #FF4F7E, #E40046 60%, #8B0029)",
          boxShadow:
            "0 4px 28px rgba(228,0,70,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
        }}
      >
        {/* Inner waveform when speaking */}
        {isSpeaking && (
          <div className="flex items-end gap-0.5 h-8">
            {[3, 6, 9, 6, 3, 8, 5, 10, 4, 7].map((h, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-white/70"
                animate={{ height: [h * 2, h * 3, h * 2] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.4 + i * 0.05,
                  ease: "easeInOut",
                  delay: i * 0.04,
                }}
                style={{ height: h * 2 }}
              />
            ))}
          </div>
        )}

        {/* Mic icon when listening */}
        {isListening && (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}

        {/* Thinking dots */}
        {isThinking && (
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-white/80"
                animate={{ y: [0, -4, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {/* Idle state */}
        {!isListening && !isSpeaking && !isThinking && (
          <div className="text-white/60 text-xs text-center px-2 leading-tight">
            Tap to<br />speak
          </div>
        )}
      </motion.div>
    </button>
  );
}

