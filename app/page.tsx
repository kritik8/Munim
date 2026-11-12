import { FloatingNav } from "@/components/nav/FloatingNav";
import { Hero } from "@/components/marketing/Hero";
import { Bento, Faq, Footer } from "@/components/marketing/Bento";

export default function HomePage() {
  return (
    <main>
      <FloatingNav />
      <Hero />
      <div id="how-it-works" className="py-16 px-4 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4 text-white">How it works</h2>
        <p className="text-slate-400 leading-relaxed">
          Click <strong className="text-white">Start a call</strong>. Munim greets you with your real numbers —
          sales, orders, and stock-outs. Answer one question at a time, in any language.
          Munim diagnoses the root cause, recommends actions, and executes them live.
          The call ends with a spoken and on-screen summary you can download.
        </p>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { n: "01", label: "Greet & probe" },
            { n: "02", label: "Diagnose with data" },
            { n: "03", label: "Execute actions" },
            { n: "04", label: "Summarise & close" },
          ].map((step) => (
            <div
              key={step.n}
              className="p-4 rounded-2xl border border-white/10 bg-[#13141B] text-center"
            >
              <div className="text-2xl font-bold font-mono text-[#E40046]">
                {step.n}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Bento />
      <Faq />
      <Footer />
    </main>
  );
}
