"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";
import { useMunimStore } from "@/lib/store";
import type { ActionStatus } from "@/lib/store";

const TOOL_LABELS: Record<string, string> = {
  get_seller_metrics: "Fetching seller metrics",
  diagnose_decline: "Running diagnosis",
  list_oos_skus: "Listing out-of-stock SKUs",
  create_restock_alert: "Creating restock alert",
  flag_cancellations: "Flagging cancellations",
  draft_promo: "Drafting promotion",
  schedule_followup: "Scheduling follow-up",
  end_call_with_summary: "Generating summary",
};

function StatusIcon({ status }: { status: ActionStatus }) {
  if (status === "done")
    return <CheckCircle2 size={16} className="text-[var(--color-success)] flex-shrink-0" />;
  if (status === "running")
    return <Loader2 size={16} className="animate-spin text-[var(--color-accent)] flex-shrink-0" />;
  if (status === "error")
    return <AlertCircle size={16} className="text-[var(--color-error)] flex-shrink-0" />;
  return <Clock size={16} className="text-[var(--color-ink-faint)] flex-shrink-0" />;
}

export function ActionFeed() {
  const actions = useMunimStore((s) => s.actions);

  if (actions.length === 0) {
    return (
      <div className="text-sm text-[var(--color-ink-faint)] text-center py-8">
        Actions will appear here when Munim takes steps.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {actions.map((action) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-start gap-3 p-3 rounded-2xl bg-[#14151B] border border-white/10"
          >
            <StatusIcon status={action.status} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-white">
                {TOOL_LABELS[action.toolName] ?? action.toolName}
              </div>
              {typeof action.result?.message === "string" && (
                <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {action.result.message}
                </div>
              )}
              {action.status === "running" && !action.result && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Running…
                </div>
              )}
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                action.status === "done"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : action.status === "running"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : action.status === "error"
                  ? "bg-red-950/60 text-red-300 border border-red-800/40"
                  : "bg-white/10 text-slate-400"
              }`}
            >
              {action.status}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

