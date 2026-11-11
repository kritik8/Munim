"use client";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Package, AlertTriangle, Percent } from "lucide-react";
import { SELLER, ASSUMPTIONS } from "@/lib/data/seller";
import { diagnose } from "@/lib/agent/diagnose";
import { useMunimStore } from "@/lib/store";
import { Info } from "lucide-react";
import { useState } from "react";

const diagnosis = diagnose();

function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

function MetricCard({
  label,
  last,
  now,
  format,
  unit = "",
  inverse = false,
}: {
  label: string;
  last: number;
  now: number;
  format?: (n: number) => string;
  unit?: string;
  inverse?: boolean; // true means lower = better (cancellations)
}) {
  const pct = ((now - last) / last) * 100;
  const isPositive = inverse ? pct < 0 : pct > 0;
  const fmt = format ?? ((n: number) => n.toLocaleString("en-IN") + unit);

  return (
    <div className="p-4 rounded-2xl border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]">
      <div className="text-xs text-[var(--color-ink-faint)] mb-2">{label}</div>
      <div className="font-semibold text-lg text-[var(--color-ink)]">
        {fmt(now)}
      </div>
      <div
        className={`flex items-center gap-1 text-xs mt-1 ${
          isPositive ? "text-[var(--color-success)]" : "text-[var(--color-accent)]"
        }`}
      >
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(pct).toFixed(1)}% vs last month ({fmt(last)})
      </div>
    </div>
  );
}

export function SellerPanel() {
  const { phase } = useMunimStore();
  const [showAssumptions, setShowAssumptions] = useState(false);
  const showCauseBar = ["diagnose", "recommend", "commit", "summarise"].includes(phase);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{SELLER.sellerName}</div>
          <div className="text-xs text-[var(--color-ink-faint)]">
            {SELLER.category} · {SELLER.location}
          </div>
        </div>
        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          aria-label="Show assumptions"
          className="p-1.5 rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors"
        >
          <Info size={16} className="text-[var(--color-ink-faint)]" />
        </button>
      </div>

      {/* Assumptions popover */}
      {showAssumptions && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 text-xs space-y-1.5"
        >
          <div className="font-medium text-[var(--color-warning)]">Assumptions</div>
          {ASSUMPTIONS.map((a, i) => (
            <div key={i} className="text-[var(--color-ink-muted)]">
              {i + 1}. {a}
            </div>
          ))}
        </motion.div>
      )}

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Sales"
          last={SELLER.lastMonth.sales}
          now={SELLER.thisMonth.sales}
          format={formatINR}
        />
        <MetricCard
          label="Orders"
          last={SELLER.lastMonth.orders}
          now={SELLER.thisMonth.orders}
        />
        <MetricCard
          label="Cancellation rate"
          last={SELLER.lastMonth.cancellationRate * 100}
          now={SELLER.thisMonth.cancellationRate * 100}
          unit="%"
          format={(n) => n.toFixed(0) + "%"}
          inverse
        />
        <MetricCard
          label="Out-of-stock"
          last={SELLER.lastMonth.oosProducts}
          now={SELLER.thisMonth.oosProducts}
          unit=" SKUs"
          inverse
        />
      </div>

      {/* Cause bar */}
      {showCauseBar && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-4 rounded-2xl border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]"
        >
          <div className="text-xs text-[var(--color-ink-faint)] mb-3">
            Gap breakdown — {formatINR(diagnosis.gap)} (−{diagnosis.gapPct}%)
          </div>
          <CauseBar />
        </motion.div>
      )}
    </div>
  );
}

function CauseBar() {
  const stockPct = diagnosis.rankedCauses[0]?.pct ?? 87;
  const cancelPct = diagnosis.rankedCauses[1]?.pct ?? 13;

  return (
    <div className="space-y-3">
      {/* Visual bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${stockPct}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="bg-[var(--color-accent)] rounded-l-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cancelPct}%` }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="bg-[var(--color-warning)] rounded-r-full"
        />
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-sm bg-[var(--color-accent)] flex-shrink-0" />
          <span className="text-[var(--color-ink-muted)] flex-1">Stock-outs &amp; visibility</span>
          <span className="font-mono font-medium text-[var(--color-ink)]">
            {formatINR(diagnosis.stockoutVisibilityLoss)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-sm bg-[var(--color-warning)] flex-shrink-0" />
          <span className="text-[var(--color-ink-muted)] flex-1">Excess cancellations</span>
          <span className="font-mono font-medium text-[var(--color-ink)]">
            {formatINR(diagnosis.cancellationLoss)}
          </span>
        </div>
      </div>
    </div>
  );
}

