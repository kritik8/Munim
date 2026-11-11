/**
 * lib/agent/diagnose.ts
 * Deterministic diagnosis of the seller's sales decline.
 * The LLM narrates these numbers; it must NOT invent its own.
 */
import { SELLER } from "@/lib/data/seller";

export type Cause = "stockout_visibility" | "cancellations" | "other";

export interface RankedCause {
  cause: Cause;
  label: string;
  lossRs: number;
  pct: number; // percentage of total gap
}

export interface Diagnosis {
  gap: number; // total revenue gap in ₹
  gapPct: number; // % decline
  ordersPct: number; // % decline in orders
  aspChange: number; // % change in ASP (should be 0)
  cancellationLoss: number; // ₹ lost to excess cancellations
  stockoutVisibilityLoss: number; // ₹ attributed to stockouts + lost visibility
  rankedCauses: RankedCause[];
  confidence: "high" | "medium" | "low";
}

export function diagnose(): Diagnosis {
  const lm = SELLER.lastMonth;
  const tm = SELLER.thisMonth;

  const gap = lm.sales - tm.sales; // 65,000
  const gapPct = (gap / lm.sales) * 100; // 32.5

  const ordersPct = ((lm.orders - tm.orders) / lm.orders) * 100; // 32.5

  const aspChange = ((tm.asp - lm.asp) / lm.asp) * 100; // 0

  // Excess cancellation rate = (14% − 8%) = 6%
  // Orders that were cancelled in excess this month
  const excessCancellationRate = tm.cancellationRate - lm.cancellationRate;
  // Cancellation loss = excess_rate × this_month_orders × ASP
  const cancellationLoss =
    excessCancellationRate * tm.orders * tm.asp; // 0.06 × 270 × 500 = 8,100

  const stockoutVisibilityLoss = gap - cancellationLoss; // 56,900

  const rankedCauses: RankedCause[] = [
    {
      cause: "stockout_visibility",
      label: "Stock-outs & lost search visibility",
      lossRs: Math.round(stockoutVisibilityLoss),
      pct: Math.round((stockoutVisibilityLoss / gap) * 100),
    },
    {
      cause: "cancellations",
      label: "Excess cancellations (stock-driven)",
      lossRs: Math.round(cancellationLoss),
      pct: Math.round((cancellationLoss / gap) * 100),
    },
  ];

  return {
    gap: Math.round(gap),
    gapPct: Math.round(gapPct * 10) / 10,
    ordersPct: Math.round(ordersPct * 10) / 10,
    aspChange: Math.round(aspChange * 10) / 10,
    cancellationLoss: Math.round(cancellationLoss),
    stockoutVisibilityLoss: Math.round(stockoutVisibilityLoss),
    rankedCauses,
    confidence: "high",
  };
}

