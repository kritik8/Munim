"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone, Play } from "lucide-react";
import { Logo, Wordmark } from "@/components/brand/Logo";
import {
  PRODUCT_HERO_LINE1,
  PRODUCT_HERO_LINE2,
  PRODUCT_CAPTION,
  PRODUCT_DISCLAIMER,
} from "@/lib/brand";

const PILLS = ["Hindi · Hinglish · English", "Voice-first", "Mock data only"];

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
      {/* Background gradient */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,var(--color-accent-soft),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(228,0,70,0.08),transparent)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center text-center max-w-3xl"
      >
        {/* Logo tile */}
        <div className="mb-6">
          <Logo size={72} className="shadow-[var(--shadow-float)]" />
        </div>

        {/* Wordmark */}
        <Wordmark className="text-5xl sm:text-6xl font-bold mb-4" />

        {/* Two-line hero headline */}
        <h1 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight">
          <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {PRODUCT_HERO_LINE1}
          </span>
          <br />
          <span className="text-[var(--color-ink-muted)]">
            {PRODUCT_HERO_LINE2}
          </span>
        </h1>

        {/* Caption */}
        <p className="mt-4 text-sm text-[var(--color-ink-faint)] uppercase tracking-widest">
          {PRODUCT_CAPTION}
        </p>

        {/* Pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {PILLS.map((p) => (
            <span
              key={p}
              className="px-3 py-1 text-xs rounded-full bg-[var(--color-surface)] border border-[var(--color-hairline)] text-[var(--color-ink-muted)] dark:bg-[var(--color-surface-dark)] dark:border-[var(--color-hairline-dark)]"
            >
              {p}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Link
            href="/call"
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors shadow-[var(--shadow-card)]"
          >
            <Phone size={18} />
            Start a call
          </Link>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)] text-[var(--color-ink-muted)] dark:text-[var(--color-ink-muted-dark)] font-medium hover:bg-[var(--color-surface-raised)] dark:hover:bg-[var(--color-surface-dark)] transition-colors"
          >
            <Play size={16} />
            See the demo
          </a>
        </div>
      </motion.div>

      {/* Product mock preview */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        className="mt-16 w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)] shadow-[var(--shadow-float)] bg-white dark:bg-[var(--color-surface-dark)]"
      >
        <MockCallPreview />
      </motion.div>

      {/* Disclaimer */}
      <p className="mt-8 text-xs text-[var(--color-ink-faint)] text-center">
        {PRODUCT_DISCLAIMER}
      </p>
    </section>
  );
}

function MockCallPreview() {
  return (
    <div className="p-6 sm:p-8 bg-[var(--color-canvas)] dark:bg-[var(--color-canvas-dark)] min-h-48 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-[var(--color-accent)]" />
        <span className="text-xs text-[var(--color-ink-faint)] font-mono">
          LIVE CALL · 00:34
        </span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium">
          Diagnose
        </span>
      </div>

      {/* Mock transcript lines */}
      {[
        { role: "munim", text: "Rakesh bhai, aapki sales ₹65,000 neeche aayi hai is mahine — 32.5% ki girawat. Main already jaanta hoon kyun. Kya aapke paas kuch best-sellers ka stock khatam ho gaya hai?" },
        { role: "seller", text: "Haan, kuch items khatam ho gaye hain." },
        { role: "munim", text: "Bilkul. 18 products out of stock hain, jisme aapke top 5 sellers bhi hain. Yehi main wajah hai — ₹56,900 ka nuksaan stock-out se, aur ₹8,100 extra cancellations se." },
      ].map((line, i) => (
        <div
          key={i}
          className={`flex ${line.role === "seller" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-xs sm:max-w-sm px-3 py-2 rounded-2xl text-sm ${
              line.role === "munim"
                ? "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)] text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] border-l-2 border-l-[var(--color-accent)]"
                : "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
            }`}
          >
            {line.text}
          </div>
        </div>
      ))}
    </div>
  );
}

