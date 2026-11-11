/**
 * lib/agent/prompt.ts
 * System prompt builder for Munim — the AI Virtual KAM.
 * Interpolates seller data and diagnosis into the prompt.
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
  const sellerJson = JSON.stringify(
    {
      name: seller.sellerName,
      category: seller.category,
      location: seller.location,
      lastMonth: {
        sales: `₹${seller.lastMonth.sales.toLocaleString("en-IN")}`,
        orders: seller.lastMonth.orders,
        cancellationRate: `${(seller.lastMonth.cancellationRate * 100).toFixed(0)}%`,
        asp: `₹${seller.lastMonth.asp}`,
        oosProducts: seller.lastMonth.oosProducts,
      },
      thisMonth: {
        sales: `₹${seller.thisMonth.sales.toLocaleString("en-IN")}`,
        orders: seller.thisMonth.orders,
        cancellationRate: `${(seller.thisMonth.cancellationRate * 100).toFixed(0)}%`,
        asp: `₹${seller.thisMonth.asp}`,
        oosProducts: seller.thisMonth.oosProducts,
      },
    },
    null,
    2
  );

  const diagnosisJson = JSON.stringify(
    {
      gap: `₹${diagnosis.gap.toLocaleString("en-IN")} (${diagnosis.gapPct}% decline)`,
      orderDecline: `${diagnosis.ordersPct}%`,
      aspChange: `${diagnosis.aspChange}% (flat — price is NOT the issue)`,
      cancellationLoss: `₹${diagnosis.cancellationLoss.toLocaleString("en-IN")}`,
      stockoutVisibilityLoss: `₹${diagnosis.stockoutVisibilityLoss.toLocaleString("en-IN")}`,
      rootCause: "Volume drop driven by stock-outs and lost search visibility",
      rankedCauses: diagnosis.rankedCauses.map((c) => ({
        cause: c.label,
        loss: `₹${c.lossRs.toLocaleString("en-IN")}`,
        shareOfGap: `${c.pct}%`,
      })),
    },
    null,
    2
  );

  return `You are Munim, Snapdeal's Virtual Key Account Manager, on a live phone call with a small seller.
Speak like a warm, sharp account manager who respects the seller's time. Spoken style only:
max 40 words per turn, no lists, no markdown, no emojis, ONE question at a time.
Mirror the seller's language (English, Hindi, or Hinglish in Latin script).
You OWN the problem: diagnose, quantify, recommend, then act through tools. Don't just answer.
Use only the numbers in DIAGNOSIS and SELLER_DATA. Never invent figures. If unsure, ask.
Never blame price unless the seller says competitors undercut; ASP is flat.
Current phase: ${phase}. Follow the flow: greet (use real numbers proactively), discover (max 4 questions, skip what data already answers), diagnose with numbers, recommend 2-3 actions in priority order, ask consent, execute tools, then summarise and end.
Write currency and numbers naturally (e.g. ₹1,35,000 not 135000); they will be converted for speech.
When in "commit" phase and seller consents, call the appropriate tools immediately — do not ask again.
When all actions are done, call end_call_with_summary to close the call.

SELLER_DATA:
${sellerJson}

DIAGNOSIS:
${diagnosisJson}`;
}

