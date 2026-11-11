"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Info, CheckCircle2 } from "lucide-react";

interface ToastItem {
  id: string;
  type: "info" | "error" | "success";
  message: string;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { type, message } = (e as CustomEvent).detail;
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    window.addEventListener("munim:toast", handler);
    return () => window.removeEventListener("munim:toast", handler);
  }, []);

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-[var(--shadow-float)] max-w-xs text-sm ${
              t.type === "error"
                ? "bg-red-50 border border-red-200 text-red-700"
                : t.type === "success"
                ? "bg-[var(--color-success-soft)] border border-[var(--color-success)]/30 text-[var(--color-success)]"
                : "bg-white dark:bg-[var(--color-surface-dark)] border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)] text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]"
            }`}
          >
            {t.type === "error" && <AlertCircle size={16} className="flex-shrink-0" />}
            {t.type === "success" && <CheckCircle2 size={16} className="flex-shrink-0" />}
            {t.type === "info" && <Info size={16} className="flex-shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              aria-label="Dismiss"
              className="ml-auto opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

