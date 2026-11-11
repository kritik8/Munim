/**
 * lib/agent/prompt.ts
 * Streamlined system prompt for Munim — Virtual Key Account Manager.
 */
import type { Diagnosis } from "./diagnose";
import type { SellerMetrics } from "@/lib/data/seller";

export type ConversationPhase =
  | "greet"
  | "discover"
  | "diagnose"
  | "recommend"
  | "commit"
  | "summarise";

export function buildSystemPrompt(
  phase: ConversationPhase,
  seller: SellerMetrics,
  diagnosis: Diagnosis
): string {
  const sellerSummary = `${seller.sellerName} (${seller.category}, ${seller.location}). Last month: ₹${seller.lastMonth.sales.toLocaleString("en-IN")}, ${seller.lastMonth.orders} orders, ${(seller.lastMonth.cancellationRate * 100).toFixed(0)}% cancel, ASP ₹${seller.lastMonth.asp}, ${seller.lastMonth.oosProducts} OOS. This month: ₹${seller.thisMonth.sales.toLocaleString("en-IN")}, ${seller.thisMonth.orders} orders, ${(seller.thisMonth.cancellationRate * 100).toFixed(0)}% cancel, ASP ₹${seller.thisMonth.asp}, ${seller.thisMonth.oosProducts} OOS.`;

  const diagSummary = `Decline Gap: ₹${diagnosis.gap.toLocaleString("en-IN")} (−${diagnosis.gapPct}%). Orders: −${diagnosis.ordersPct}%. ASP flat (0% change - NOT a price issue). Root cause: stock-outs & search demotion = ₹${diagnosis.stockoutVisibilityLoss.toLocaleString("en-IN")}; excess cancellations = ₹${diagnosis.cancellationLoss.toLocaleString("en-IN")}.`;

  return `You are Munim, Snapdeal's Virtual Key Account Manager, on a live phone call with seller Rakesh.
Spoken style: max 35 words per turn, conversational, no markdown, no emojis, ONE question at a time.
Mirror seller language (English, Hindi, or Hinglish in Latin script).
OWN the problem: diagnose, quantify with numbers, recommend, then execute tools.
Never blame price; ASP is flat. Use only provided figures.
Current phase: ${phase}.
SELLER: ${sellerSummary}
DIAGNOSIS: ${diagSummary}
If in "commit" phase and seller agrees, call tools immediately. Call end_call_with_summary when done.`;
}
