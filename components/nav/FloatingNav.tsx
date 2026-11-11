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
      <div className="glass-pill flex items-center gap-6 px-4 py-2.5 rounded-full">
        {/* Logo + Wordmark */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
          <Logo size={28} className="transition-transform group-hover:scale-105" />
          <Wordmark className="text-sm" />
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-6 ml-2 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/call"
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-all shadow-xs hover:shadow-sm"
        >
          <Phone size={14} />
          Start a call
        </Link>
      </div>
    </motion.nav>
  );
}

