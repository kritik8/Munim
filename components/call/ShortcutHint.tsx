"use client";
import { Keyboard } from "lucide-react";

interface ShortcutHintProps {
  className?: string;
}

export function ShortcutHint({ className = "" }: ShortcutHintProps) {
  return (
    <div
      className={`flex items-center gap-3 text-xs text-[var(--color-ink-faint)] ${className}`}
      aria-label="Keyboard shortcuts"
    >
      <Keyboard size={12} />
      <span>
        <Keycap>Space</Keycap> talk / interrupt
      </span>
      <span>
        <Keycap>Esc</Keycap> end call
      </span>
    </div>
  );
}

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-white/10 font-mono text-[10px] bg-white/5 text-slate-300">
      {children}
    </kbd>
  );
}

