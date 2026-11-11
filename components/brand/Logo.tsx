"use client";
import Image from "next/image";
import { PRODUCT_NAME } from "@/lib/brand";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt={`${PRODUCT_NAME} logo`}
      width={size}
      height={size}
      className={`rounded-xl flex-shrink-0 ${className}`}
      priority
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-semibold tracking-tight text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] ${className}`}
    >
      {PRODUCT_NAME}
    </span>
  );
}

