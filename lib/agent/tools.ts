/**
 * lib/agent/tools.ts
 * Zod-validated tool schemas and mock implementations for Munim.
 * All tools are mock — they return plausible JSON for demo purposes.
 */
import { z } from "zod";
import { SKUS, SELLER } from "@/lib/data/seller";
import { diagnose } from "./diagnose";

// ─── Tool Schemas ─────────────────────────────────────────────────────────────

export const GetSellerMetricsSchema = z.object({});

export const DiagnoseDeclineSchema = z.object({});

export const ListOosSkusSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
});

export const CreateRestockAlertSchema = z.object({
  skus: z.array(z.string()).min(1).max(20),
});

export const FlagCancellationsSchema = z.object({
  count: z.number().int().min(1),
  reason: z.string().min(1),
});

export const DraftPromoSchema = z.object({
  skus: z.array(z.string()).min(1).max(10),
  type: z.enum(["sponsored", "flash_sale", "bundle"]),
});

export const ScheduleFollowupSchema = z.object({
  when: z.string().min(1), // e.g. "in 7 days", "next Monday"
});

export const EndCallWithSummarySchema = z.object({
  issues: z.array(z.string()),
  actions: z.array(z.string()),
  next_steps: z.array(z.string()),
});

// ─── OpenAI Tool Definitions ──────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_seller_metrics",
      description:
        "Retrieve current seller performance metrics: sales, orders, cancellation rate, ASP, and out-of-stock count.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "diagnose_decline",
      description:
        "Run the deterministic diagnosis to quantify the sales decline gap, root causes, and loss breakdown.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_oos_skus",
      description:
        "List the top out-of-stock SKUs sorted by last-month sales volume.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max SKUs to return (default 10)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_restock_alert",
      description:
        "Create a restock alert for the specified SKU IDs, prioritised by last-month sales.",
      parameters: {
        type: "object",
        properties: {
          skus: {
            type: "array",
            items: { type: "string" },
            description: "Array of SKU IDs to alert on",
          },
        },
        required: ["skus"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "flag_cancellations",
      description:
        "Flag a set of cancellations for review and enable auto-pause on zero-stock listings.",
      parameters: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: "Number of cancellations to flag",
          },
          reason: {
            type: "string",
            description: "Root cause reason",
          },
        },
        required: ["count", "reason"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_promo",
      description:
        "Draft a promotional campaign (sponsored listing / flash sale / bundle) for selected SKUs.",
      parameters: {
        type: "object",
        properties: {
          skus: {
            type: "array",
            items: { type: "string" },
            description: "SKU IDs to include",
          },
          type: {
            type: "string",
            enum: ["sponsored", "flash_sale", "bundle"],
            description: "Promo type",
          },
        },
        required: ["skus", "type"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_followup",
      description: "Schedule a follow-up call or check-in with the seller.",
      parameters: {
        type: "object",
        properties: {
          when: {
            type: "string",
            description: "When to follow up, e.g. 'in 7 days'",
          },
        },
        required: ["when"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "end_call_with_summary",
      description:
        "End the call and generate the final summary with issues, actions taken, and next steps.",
      parameters: {
        type: "object",
        properties: {
          issues: {
            type: "array",
            items: { type: "string" },
            description: "Key issues identified",
          },
          actions: {
            type: "array",
            items: { type: "string" },
            description: "Actions taken during this call",
          },
          next_steps: {
            type: "array",
            items: { type: "string" },
            description: "Seller's next steps",
          },
        },
        required: ["issues", "actions", "next_steps"],
      },
    },
  },
] as const;

// ─── Mock Implementations ─────────────────────────────────────────────────────

type ToolResult = Record<string, unknown>;

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Simulate a brief async delay for realism
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

  switch (name) {
    case "get_seller_metrics": {
      return {
        seller: SELLER.sellerName,
        category: SELLER.category,
        location: SELLER.location,
        lastMonth: SELLER.lastMonth,
        thisMonth: SELLER.thisMonth,
        status: "ok",
      };
    }

    case "diagnose_decline": {
      const d = diagnose();
      return { ...d, status: "ok" };
    }

    case "list_oos_skus": {
      const parsed = ListOosSkusSchema.safeParse(args);
      const limit = parsed.success ? parsed.data.limit : 10;
      const oos = SKUS.filter((s) => s.isOos)
        .sort((a, b) => b.lastMonthUnits - a.lastMonthUnits)
        .slice(0, limit)
        .map((s) => ({
          id: s.id,
          name: s.name,
          lastMonthUnits: s.lastMonthUnits,
          asp: s.asp,
          isBestSeller: s.isBestSeller,
        }));
      return { oosSkus: oos, total: SKUS.filter((s) => s.isOos).length, status: "ok" };
    }

    case "create_restock_alert": {
      const parsed = CreateRestockAlertSchema.safeParse(args);
      if (!parsed.success) return { error: "Invalid args", status: "error" };
      const skuIds = parsed.data.skus;
      const matched = SKUS.filter((s) => skuIds.includes(s.id));
      return {
        alertCreated: true,
        skuCount: skuIds.length,
        skus: matched.map((s) => s.name),
        priority: "high",
        estimatedRestockDate: "within 3-5 business days",
        message: `Restock alert created for ${skuIds.length} SKUs, prioritised by last-month sales.`,
        status: "ok",
      };
    }

    case "flag_cancellations": {
      const parsed = FlagCancellationsSchema.safeParse(args);
      if (!parsed.success) return { error: "Invalid args", status: "error" };
      return {
        flagged: parsed.data.count,
        reason: parsed.data.reason,
        autoPauseEnabled: true,
        message: `${parsed.data.count} cancellations flagged. Auto-pause on zero-stock activated — future orders won't be placed when you run out.`,
        status: "ok",
      };
    }

    case "draft_promo": {
      const parsed = DraftPromoSchema.safeParse(args);
      if (!parsed.success) return { error: "Invalid args", status: "error" };
      const promoLabels = {
        sponsored: "Sponsored Listing Boost",
        flash_sale: "Flash Sale (24h)",
        bundle: "Bundle Deal",
      };
      return {
        promoDrafted: true,
        type: promoLabels[parsed.data.type],
        skuCount: parsed.data.skus.length,
        estimatedReach: "12,000–18,000 impressions",
        estimatedOrders: "30–45 additional orders",
        budget: "₹500 suggested boost",
        message: `${promoLabels[parsed.data.type]} drafted for ${parsed.data.skus.length} SKUs. Estimated reach: twelve to eighteen thousand impressions.`,
        status: "ok",
      };
    }

    case "schedule_followup": {
      const parsed = ScheduleFollowupSchema.safeParse(args);
      if (!parsed.success) return { error: "Invalid args", status: "error" };
      const followupDate = new Date();
      followupDate.setDate(followupDate.getDate() + 7);
      return {
        scheduled: true,
        when: parsed.data.when,
        date: followupDate.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        message: `Follow-up scheduled ${parsed.data.when}. I'll check restock status and order recovery with you then.`,
        status: "ok",
      };
    }

    case "end_call_with_summary": {
      const parsed = EndCallWithSummarySchema.safeParse(args);
      if (!parsed.success) return { error: "Invalid args", status: "error" };
      return {
        callEnded: true,
        summary: {
          issues: parsed.data.issues,
          actions: parsed.data.actions,
          nextSteps: parsed.data.next_steps,
        },
        status: "ok",
      };
    }

    default:
      return { error: `Unknown tool: ${name}`, status: "error" };
  }
}

