"use client";
import { motion } from "framer-motion";
import { Copy, Download } from "lucide-react";
import { useMunimStore } from "@/lib/store";

export function SummaryCard() {
  const summary = useMunimStore((s) => s.summary);

  if (!summary) return null;

  const mdContent = `# Munim Call Summary
*${new Date(summary.ts).toLocaleString("en-IN")}*

## Key Issues
${summary.issues.map((i) => `- ${i}`).join("\n")}

## Actions Taken
${summary.actions.map((a) => `- ${a}`).join("\n")}

## Next Steps
${summary.nextSteps.map((n) => `- ${n}`).join("\n")}
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mdContent).catch(console.error);
  };

  const downloadMd = () => {
    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `munim-summary-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="p-6 rounded-3xl border border-[#E40046]/40 bg-[#14151B] shadow-[var(--shadow-float)]"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-semibold text-lg text-white">Call Summary</div>
          <div className="text-xs text-slate-400">
            {new Date(summary.ts).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            aria-label="Copy summary"
            className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-slate-300 transition-colors"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={downloadMd}
            aria-label="Download as Markdown"
            className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-slate-300 transition-colors"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Section title="Key Issues" items={summary.issues} accent />
        <Section title="Actions Taken" items={summary.actions} />
        <Section title="Next Steps" items={summary.nextSteps} success />
      </div>
    </motion.div>
  );
}

function Section({
  title,
  items,
  accent,
  success,
}: {
  title: string;
  items: string[];
  accent?: boolean;
  success?: boolean;
}) {
  const color = accent
    ? "var(--color-accent)"
    : success
    ? "var(--color-success)"
    : "var(--color-ink-faint)";

  return (
    <div>
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color }}
      >
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

