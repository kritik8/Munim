/**
 * app/api/chat/route.ts
 * POST /api/chat
 * SSE stream: text_delta, sentence, tool_call, tool_result, phase, done
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/agent/tools";
import { buildSystemPrompt, type ConversationPhase } from "@/lib/agent/prompt";
import { SELLER } from "@/lib/data/seller";
import { diagnose } from "@/lib/agent/diagnose";

export const maxDuration = 60;

const ChatBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system", "tool"]),
      content: z.union([z.string(), z.null()]),
      tool_call_id: z.string().optional(),
      name: z.string().optional(),
    })
  ),
  phase: z.enum([
    "greet",
    "discover",
    "diagnose",
    "recommend",
    "commit",
    "summarise",
  ]),
  replyLanguage: z.enum(["en", "hi", "hinglish"]).optional(),
});

type ChatMessage = z.infer<typeof ChatBodySchema>["messages"][number];

function isSentenceEnd(char: string): boolean {
  return [".", "!", "?", "।"].includes(char);
}

function enc(event: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ event, ...data })}\n\n`;
}

export async function POST(req: NextRequest) {
  const turnStart = Date.now();
  let body: z.infer<typeof ChatBodySchema>;
  try {
    const raw = await req.json();
    body = ChatBodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const { messages, phase, replyLanguage } = body;

  if (!process.env.LITELLM_BASE_URL || !process.env.LITELLM_API_KEY) {
    return NextResponse.json(
      { error: "LiteLLM not configured", code: "CONFIG_ERROR" },
      { status: 503 }
    );
  }

  const client = new OpenAI({
    baseURL: process.env.LITELLM_BASE_URL,
    apiKey: process.env.LITELLM_API_KEY,
  });

  const model = process.env.LITELLM_MODEL ?? "gpt-4o-mini";
  const systemPrompt = buildSystemPrompt(
    phase,
    SELLER,
    diagnose(),
    replyLanguage ?? "hinglish"
  );

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(enc(event, data)));
      };

      let currentPhase: ConversationPhase = phase;
      let iterCount = 0;
      const MAX_ITERS = 3; // tool loop + spoken confirmation
      let ttftLogged = false;

      try {
        while (iterCount < MAX_ITERS) {
          iterCount++;

          const chatStream = await client.chat.completions.create({
            model,
            messages: allMessages as OpenAI.ChatCompletionMessageParam[],
            tools: TOOL_DEFINITIONS as unknown as OpenAI.ChatCompletionTool[],
            tool_choice: "auto",
            stream: true,
            max_tokens: 160,
          });

          let fullText = "";
          let sentenceBuffer = "";
          const toolCalls: Array<{
            id: string;
            name: string;
            arguments: string;
          }> = [];

          for await (const chunk of chatStream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              if (!ttftLogged) {
                ttftLogged = true;
                const ttft = Date.now() - turnStart;
                console.log(
                  `[CHAT] TTFT (time-to-first-token): ${ttft}ms (model: ${model})`
                );
                send("ttft", { ttft });
              }

              fullText += delta.content;
              sentenceBuffer += delta.content;
              send("text_delta", { text: delta.content });

              let match: RegExpMatchArray | null;
              while ((match = sentenceBuffer.match(/^([\s\S]*?[.!?।])\s+([\s\S]*)$/))) {
                const candidate = match[1].trim();
                sentenceBuffer = match[2];
                if (candidate.length > 4) {
                  send("sentence", { text: candidate });
                }
              }
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls[idx]) {
                  toolCalls[idx] = {
                    id: tc.id ?? "",
                    name: "",
                    arguments: "",
                  };
                }
                if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments)
                  toolCalls[idx].arguments += tc.function.arguments;
                if (tc.id) toolCalls[idx].id = tc.id;
              }
            }
          }

          // Flush leftover sentence buffer
          if (sentenceBuffer.trim().length > 2) {
            send("sentence", { text: sentenceBuffer.trim() });
          }

          if (toolCalls.length > 0) {
            allMessages.push({
              role: "assistant",
              content: fullText || null,
              // @ts-expect-error raw tool_calls
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
              })),
            });

            for (const tc of toolCalls) {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.arguments || "{}");
              } catch {}

              send("tool_call", { id: tc.id, name: tc.name, args });

              const result = await executeTool(tc.name, args);
              send("tool_result", { id: tc.id, name: tc.name, result });

              if (tc.name === "end_call_with_summary") {
                currentPhase = "summarise";
                send("phase", { phase: currentPhase });
              } else if (
                ["create_restock_alert", "flag_cancellations", "draft_promo", "schedule_followup"].includes(tc.name)
              ) {
                currentPhase = "commit";
                send("phase", { phase: currentPhase });
              } else if (["diagnose_decline", "list_oos_skus"].includes(tc.name)) {
                currentPhase = "diagnose";
                send("phase", { phase: currentPhase });
              }

              allMessages.push({
                role: "tool",
                content: JSON.stringify(result),
                tool_call_id: tc.id,
                name: tc.name,
              });
            }
            continue;
          }

          if (fullText.length > 10) {
            if (currentPhase === "greet") {
              currentPhase = "discover";
              send("phase", { phase: currentPhase });
            } else if (currentPhase === "discover" && messages.length >= 3) {
              currentPhase = "diagnose";
              send("phase", { phase: currentPhase });
            } else if (currentPhase === "diagnose") {
              currentPhase = "recommend";
              send("phase", { phase: currentPhase });
            } else if (currentPhase === "recommend") {
              currentPhase = "commit";
              send("phase", { phase: currentPhase });
            }
          }

          break;
        }

        const totalTime = Date.now() - turnStart;
        console.log(
          `[CHAT] Turn completed in ${totalTime}ms (model: ${model})`
        );
        send("turn_complete", { totalMs: totalTime });
        send("done", {});
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[CHAT] error:", message);
        send("error", { error: message, code: "LLM_ERROR" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
