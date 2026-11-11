"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMunimStore } from "@/lib/store";

export function Transcript() {
  const transcript = useMunimStore((s) => s.transcript);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation transcript"
      className="flex flex-col gap-3 overflow-y-auto max-h-96 pr-1"
    >
      <AnimatePresence initial={false}>
        {transcript.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex ${entry.role === "seller" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                entry.role === "seller"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                  : `bg-[var(--color-surface)] border border-[var(--color-hairline)] border-l-2 border-l-[var(--color-accent)] text-[var(--color-ink)] ${
                      entry.partial ? "opacity-70" : ""
                    }`
              }`}
            >
              {entry.text || <span className="animate-pulse">…</span>}
              <div className="mt-1 text-[10px] font-mono text-[var(--color-ink-faint)] text-right">
                {new Date(entry.ts).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}

