"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone } from "lucide-react";
import { Logo, Wordmark } from "@/components/brand/Logo";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
];

export function FloatingNav() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-6 px-4 py-2.5 rounded-full bg-white/80 dark:bg-[var(--color-surface-dark)]/80 backdrop-blur-md border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)] shadow-[var(--shadow-card)]">
        {/* Logo + Wordmark */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <Logo size={28} />
          <Wordmark className="text-sm" />
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-5 ml-2 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] dark:hover:text-[var(--color-ink-dark)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/call"
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Phone size={14} />
          Start a call
        </Link>
      </div>
    </motion.nav>
  );
}

