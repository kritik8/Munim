"use client";
import { motion } from "framer-motion";
import {
  Mic,
  TrendingDown,
  Zap,
  CalendarCheck,
  OctagonPause,
  ShieldOff,
} from "lucide-react";
import { PRODUCT_DISCLAIMER } from "@/lib/brand";

const TILES = [
  {
    icon: Mic,
    title: "Listens in your language",
    body: "Hindi, Hinglish, or English — Munim understands how you actually speak.",
    span: "col-span-1",
    accent: true,
  },
  {
    icon: TrendingDown,
    title: "Diagnoses with your numbers",
    body: "Sales drop computed from real metrics — no guesswork, no hallucinated figures.",
    span: "col-span-1",
  },
  {
    icon: Zap,
    title: "Takes action, not notes",
    body: "Creates restock alerts, fixes cancellations, drafts promos — all in one call.",
    span: "col-span-1 sm:col-span-2",
  },
  {
    icon: CalendarCheck,
    title: "Follows up",
    body: "Schedules a check-in automatically and tracks whether stock came back.",
    span: "col-span-1",
  },
  {
    icon: OctagonPause,
    title: "Interrupt anytime",
    body: "Press Space or tap the orb to stop Munim mid-sentence and jump in.",
    span: "col-span-1",
  },
  {
    icon: ShieldOff,
    title: "Private by design",
    body: "No audio stored. API keys never leave the server. Mock data only.",
    span: "col-span-1",
  },
];

export function Bento() {
  return (
    <section
      id="features"
      className="py-24 px-4 max-w-5xl mx-auto"
      aria-labelledby="features-heading"
    >
      <div className="text-center mb-12">
        <h2
          id="features-heading"
          className="text-3xl sm:text-4xl font-bold tracking-tight"
        >
          Built to own the problem.
        </h2>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          Not just answer questions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <motion.div
              key={tile.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`${tile.span} p-6 rounded-3xl border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${
                tile.accent
                  ? "bg-[var(--color-accent)] text-white border-transparent"
                  : ""
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${
                  tile.accent
                    ? "bg-white/20"
                    : "bg-[var(--color-accent-soft)]"
                }`}
              >
                <Icon
                  size={20}
                  className={
                    tile.accent ? "text-white" : "text-[var(--color-accent)]"
                  }
                />
              </div>
              <h3
                className={`font-semibold mb-1 ${
                  tile.accent ? "text-white" : "text-slate-900"
                }`}
              >
                {tile.title}
              </h3>
              <p
                className={`text-sm leading-relaxed ${
                  tile.accent
                    ? "text-white/80"
                    : "text-slate-600"
                }`}
              >
                {tile.body}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "Is this a real Snapdeal product?",
    a: "No. This is an independent prototype built for a take-home assignment. It uses mock seller data and is not affiliated with Snapdeal.",
  },
  {
    q: "What languages does Munim speak?",
    a: "English, Hindi, and Hinglish. It mirrors the language you use. Gnani Vachana handles the STT and TTS with native Indian-language support.",
  },
  {
    q: "Are the numbers real?",
    a: "The numbers are deterministically computed from mock seller data. The LLM narrates them but cannot invent new figures.",
  },
  {
    q: "What happens if the mic permission is denied?",
    a: "Munim falls back to the browser's Web Speech API automatically, with a toast explaining the switch.",
  },
  {
    q: "Can I interrupt Munim mid-sentence?",
    a: "Yes. Press Space or tap the orb. Audio stops immediately and listening starts.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="py-24 px-4 max-w-2xl mx-auto"
      aria-labelledby="faq-heading"
    >
      <h2
        id="faq-heading"
        className="text-3xl font-bold tracking-tight text-center mb-10 text-slate-900"
      >
        FAQs
      </h2>
      <div className="divide-y divide-[var(--color-hairline)]">
        {FAQ_ITEMS.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-slate-900 hover:text-[var(--color-accent)] transition-colors">
              <span>{item.q}</span>
              <span className="text-slate-400 group-open:rotate-45 transition-transform flex-shrink-0 text-xl leading-none">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-hairline)] py-8 px-4 text-center">
      <p className="text-xs text-[var(--color-ink-faint)]">{PRODUCT_DISCLAIMER}</p>
      <p className="text-xs text-[var(--color-ink-faint)] mt-1">
        Made with care for the Snapdeal Seller Experience team assignment.
      </p>
    </footer>
  );
}

