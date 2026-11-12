"use client";
/**
 * components/call/GuidePanel.tsx
 * Right-side helping column for first-time callers:
 * - Language switcher (Hinglish / English / Hindi)
 * - Phase-aware "How to talk to Munim" examples
 * - Clickable sample prompts (say aloud or click to test immediately)
 * - Compact fallback text input
 */
import { useState } from "react";
import { Sparkles, MessageSquare, Send, Mic } from "lucide-react";
import { useMunimStore } from "@/lib/store";
import type { ConversationPhase } from "@/lib/agent/prompt";
import type { SupportedLanguage } from "@/lib/voice/provider";

interface GuidePanelProps {
  onSendExample: (text: string) => void;
  disabled?: boolean;
}

const LANGUAGES: Array<{ id: SupportedLanguage; label: string }> = [
  { id: "hinglish", label: "Hinglish" },
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
];

interface ExampleStep {
  phaseLabel: string;
  hint: string;
  examples: Array<{ tag: string; text: string }>;
}

const GUIDE_BY_PHASE: Record<ConversationPhase, ExampleStep> = {
  greet: {
    phaseLabel: "Step 1 · Introduce yourself & problem",
    hint: "Speak naturally after Munim greets. Identify as any seller and explain your issue:",
    examples: [
      {
        tag: "Sample Account",
        text: "Hi Munim, I'm Rakesh from Rakesh Traders. My sales dropped this month and I don't know why.",
      },
      {
        tag: "Custom Seller (Hinglish)",
        text: "Namaste, main Priya bol rahi hoon HomeCraft Jaipur se. Pichle 2 hafte se mere orders 35% gir gaye hain.",
      },
      {
        tag: "Cancellations Issue",
        text: "Hello, main Amit Traders Delhi se hoon. Mere cancellations bahut badh gaye hain aur search visibility kam ho gayi hai.",
      },
    ],
  },
  discover: {
    phaseLabel: "Step 1 · Share details",
    hint: "Identify your store & problem, or answer Munim's follow-up question:",
    examples: [
      {
        tag: "Sample Account",
        text: "Hi, I'm Rakesh from Rakesh Traders. My sales fell from 2 lakh to 1.35 lakh this month.",
      },
      {
        tag: "Custom Seller",
        text: "Main Neha Electronics se hoon. Mere 10 top products out of stock the aur ab orders kam aa rahe hain.",
      },
      {
        tag: "Answer on Stock",
        text: "Haan, mere top 5 cookers aur tawa out of stock ho gaye hain, par price same hai.",
      },
    ],
  },
  diagnose: {
    phaseLabel: "Step 2 · Clarify root cause",
    hint: "Tell Munim whether pricing, stock-outs, or ads changed recently:",
    examples: [
      {
        tag: "Stock + Cancellations",
        text: "Price toh same rakha hai, par zero-stock listings ki wajah se orders cancel ho rahe hain.",
      },
      {
        tag: "Competitor Price",
        text: "Stock available hai, par lagta hai competitors saste me bech rahe hain.",
      },
      {
        tag: "Ask Solution",
        text: "Samajh gaya. Ab isko theek karne ke liye mujhe kya karna chahiye?",
      },
    ],
  },
  recommend: {
    phaseLabel: "Step 3 · Approve KAM actions",
    hint: "Agree to Munim's proposed solutions so she can execute them live:",
    examples: [
      {
        tag: "Execute All",
        text: "Haan bilkul, restock alert aur auto-pause listing chalu kar do.",
      },
      {
        tag: "Promo + Follow-up",
        text: "Yes, please draft a sponsored promo on restocked SKUs and schedule a follow-up.",
      },
    ],
  },
  commit: {
    phaseLabel: "Step 4 · Confirm & wrap up",
    hint: "Confirm next steps or ask Munim for your final call summary:",
    examples: [
      {
        tag: "Get Summary",
        text: "Thank you Munim, sab clear hai. Please call end karke summary de do.",
      },
      {
        tag: "Follow-up",
        text: "Haan, agle hafte Monday ko follow-up call schedule kar do.",
      },
    ],
  },
  summarise: {
    phaseLabel: "Call Complete",
    hint: "Your diagnostic summary is ready below. You can copy or download it.",
    examples: [],
  },
};

export function GuidePanel({ onSendExample, disabled = false }: GuidePanelProps) {
  const { phase, language, setLanguage } = useMunimStore();
  const [customText, setCustomText] = useState("");
  const currentGuide = GUIDE_BY_PHASE[phase] ?? GUIDE_BY_PHASE.discover;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed || disabled) return;
    onSendExample(trimmed);
    setCustomText("");
  };

  return (
    <div className="p-5 rounded-3xl border border-white/10 bg-[#13141B] shadow-[var(--shadow-card)] space-y-4">
      {/* Header + Language Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[rgba(228,0,70,0.16)] border border-[#E40046]/30 flex items-center justify-center">
            <Sparkles size={14} className="text-[#FF4F7E]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">How to Talk to Munim</h2>
            <p className="text-[11px] text-slate-400">Live speaking guide</p>
          </div>
        </div>
      </div>

      {/* Language selector */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0C10] border border-white/10">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            type="button"
            onClick={() => setLanguage(lang.id)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              language === lang.id
                ? "bg-[#E40046] text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      {/* Current step prompt */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FF4F7E]">
          <Mic size={12} />
          <span>{currentGuide.phaseLabel}</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {currentGuide.hint}
        </p>
      </div>

      {/* Example speech cards */}
      {currentGuide.examples.length > 0 && (
        <div className="space-y-2">
          {currentGuide.examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onSendExample(ex.text)}
              className="w-full text-left p-3 rounded-2xl bg-[#191A23] hover:bg-[#1F212D] border border-white/10 hover:border-[#E40046]/40 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-300">
                  {ex.tag}
                </span>
                <span className="text-[10px] text-[#FF4F7E] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <MessageSquare size={10} />
                  Click to send
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                &ldquo;{ex.text}&rdquo;
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Quick text fallback for silent testing */}
      <form onSubmit={handleSubmit} className="pt-2 border-t border-white/10">
        <label htmlFor="manual-reply" className="sr-only">
          Type a message if mic is unavailable
        </label>
        <div className="flex items-center gap-2">
          <input
            id="manual-reply"
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            disabled={disabled}
            placeholder="Or type your problem here…"
            className="flex-1 px-3 py-2 rounded-xl bg-[#0B0C10] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#E40046] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !customText.trim()}
            aria-label="Send message"
            className="p-2 rounded-xl bg-[#E40046] hover:bg-[#C80036] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

