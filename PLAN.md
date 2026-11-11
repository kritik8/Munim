# PLAN.md — Munim build plan

Companion to `AGENTS.md`. Work through phases in order. After each phase: run `pnpm lint && pnpm test && pnpm build`, commit, and tick the boxes below.

Target: working, deployed, demo-ready in **~8–10 hours**. Submission window ends tomorrow night (11 PM–12 AM IST); aim to finish recording by ~9 PM.

---

## 1. Architecture

```
Browser (Next.js client)
 ├─ Mic → VAD → audio blob ──► POST /api/stt ──► Gnani Prisma STT ──► text
 ├─ text ──► POST /api/chat (SSE) ──► LiteLLM (stream + tools)
 │                                   ├─ tool loop → lib/agent/tools.ts (mock actions)
 │                                   └─ events: sentence | tool_call | tool_result | phase
 ├─ sentence ──► POST /api/tts ──► Gnani Timbre TTS (SSE) ──► audio chunks ──► Web Audio queue
 └─ Zustand store ──► Transcript · Seller panel · Action feed · Summary
```

Fallback: `NEXT_PUBLIC_VOICE_PROVIDER=browser` swaps STT/TTS to the Web Speech API with the same interfaces (`lib/voice/provider.ts`). Stretch: `gateway/` on Render for Gnani realtime WebSockets (barge-in, lower latency).

## 2. Repo layout

```
app/
  page.tsx                    # landing / hero
  call/page.tsx               # call workspace
  api/{stt,tts,chat}/route.ts
components/
  brand/{Logo,Wordmark}.tsx
  nav/FloatingNav.tsx
  call/{CallShelf,Orb,Transcript,Composer,ShortcutHint}.tsx
  insights/{SellerPanel,MetricCard,Sparkline,CauseBar,AssumptionsPopover}.tsx
  actions/{ActionFeed,ActionCard}.tsx
  summary/SummaryCard.tsx
  marketing/{Hero,Bento,Faq,Footer}.tsx
lib/
  brand.ts  data/seller.ts
  agent/{prompt,tools,state,diagnose}.ts
  voice/{vad,player,provider,gnani,browser,toSpoken}.ts
  store.ts
public/logo.svg
gateway/                      # stretch (Render)
```

## 3. UI spec (inspired by Supaste's feel; original implementation)

**Design tokens**: canvas `#FAFAF8`, surface `#FFFFFF`, ink `#16171A`, muted `#6B6F76`, hairline `#ECECE8`, accent `#E40046`, accent-soft `#FFE9EF`, success `#12805C`. Dark: canvas `#0E0F11`, surface `#16181B`. Radius 24px cards, 999px pills. Shadows: `0 1px 0 rgba(0,0,0,.04), 0 12px 32px -12px rgba(0,0,0,.12)`. Motion: spring (stiffness 300, damping 30), 200–350 ms.

**Components to build**
1. **FloatingNav** — centred glass pill: logo + `Munim`, links (How it works, Features, FAQ), primary pill button "Start a call".
2. **Hero** — logo tile, wordmark `Munim`, two-line headline: **"Your sales dipped."** (ink) / **"Your account manager already knows why."** (muted). Sub-caption: *Built for the Virtual KAM of Snapdeal.* Buttons: "Start a call" and "See the demo". Under it, a large floating product mock of the call workspace. Pills: `Hindi · Hinglish · English`, `Voice-first`, `Mock data only`.
3. **CallShelf (the "notch")** — a Dynamic-Island-style pill pinned top-centre during a call: orb, timer, language chip, mute, interrupt, end. Expands on hover to show the current phase (Discover → Diagnose → Recommend → Commit).
4. **Orb** — soft red-gradient orb reacting to mic level (listening), pulsing (thinking), waveform ring (speaking). `Space` = talk/interrupt. Respect reduced-motion.
5. **Transcript** — chat-free timeline: seller lines right-aligned neutral, Munim lines left with accent bar; streaming text, muted interim bubble for partial STT, timestamps in Geist Mono.
6. **Filter tabs with counts** (Supaste "All Clips / Prompts / Colors" pattern) — `All · Insights · Actions · Transcript` with live counts over a single visual timeline of cards.
7. **SellerPanel** — metric cards (Sales, Orders, Cancellation, ASP, Out-of-stock) with last-vs-now deltas, red/green micro-badges, sparklines. A **CauseBar** splits the ₹65,000 gap into stock-out/visibility (₹56,900) and cancellations (₹8,100), animated when the agent mentions it.
8. **ActionFeed** — each tool call appears as a card that animates through *queued → running → done* with icon, title, and one-line result (e.g. "Restock alert · 13 SKUs · priority by last-month sales").
9. **SummaryCard** — end-of-call card: Key issues, Recommendations, Next steps, follow-up date; buttons "Copy summary", "Download .md".
10. **Bento section** — 4–6 tiles: *Listens in your language*, *Diagnoses with your numbers*, *Takes action, not notes*, *Follows up*, *Interrupt anytime*, *Private by design*. **FAQ** accordion. **Footer** with the disclaimer.
11. **ShortcutHint** — keycap chips (`Space` talk, `Esc` end) like Supaste's keyboard hints.
12. Toasts for errors; empty and loading skeleton states everywhere.

**Logo (`public/logo.svg`, already provided in the repo handoff)**: red rounded square, white diamond, waveform bars inside. Also export a 32×32 favicon and an OG image.

## 4. Phases & checklists

### Phase 0 — Scaffold (30 min)
- [x] `pnpm create next-app` (TS, Tailwind, App Router), add shadcn/ui, framer-motion, zustand, zod, openai SDK, lucide-react, Geist fonts
- [x] `.env.example`, `lib/brand.ts`, design tokens in `globals.css`, logo in `public/`
- [x] Commit; connect repo to Vercel early so every push gives a preview URL

### Phase 1 — Brain in text (1 h)
- [x] `lib/data/seller.ts` (metrics, SKUs, assumptions)
- [x] `diagnose.ts` + unit tests (assert 65,000 / 8,100 / 56,900 / −32.5%)
- [x] `prompt.ts`, `tools.ts` (zod schemas), `/api/chat` SSE with tool loop against LiteLLM
- [x] Temporary dev text box to verify: proactive greeting, one question at a time, tool calls fire on consent, summary ends the call

### Phase 2 — Voice loop (2 h)
- [x] `toSpoken.ts` + tests
- [x] Read Gnani docs; implement `/api/stt` and `/api/tts` (SSE → streamed audio), `lib/voice/gnani.ts`
- [x] `vad.ts`, `player.ts` (Web Audio queue, abort support), `provider.ts` with browser fallback
- [x] Sentence-chunked pipeline: STT → chat stream → TTS per sentence
- [x] Interrupt via `Space`/orb; abort in-flight requests
- [x] Test English, Hindi, Hinglish; measure and log per-turn latency

### Phase 3 — UI (2.5 h)
- [x] Components in §3 wired to the Zustand store
- [x] Live transcript with partials, action feed animation, cause bar, summary card
- [x] Dark mode, responsive (mobile call screen must work), reduced-motion, a11y pass

### Phase 4 — Landing & polish (1 h)
- [x] Hero, bento, FAQ, footer, OG image, favicon
- [x] Copy pass: short, confident, no hype. Include the disclaimer

### Phase 5 — Harden & deploy (1 h)
- [x] Error paths: mic denied, STT empty, Gnani/LiteLLM failure → browser fallback + toast
- [x] Rate-limit and size-limit API routes; no secrets in client bundle (grep the build)
- [x] Vercel production deploy, env vars set, test on a real phone

### Phase 6 — Stretch (only if everything above is solid)
- [ ] `gateway/` Render WebSocket proxy for Gnani realtime STT/TTS and true barge-in
- [ ] Proactive "outbound" mode: Munim calls the seller about an anomaly (stock-outs rising) without being asked

## 5. README / one-page note (deliverable)

Sections: Problem & approach · Architecture diagram · Models & voice tech (LiteLLM model name, Gnani Prisma v2.5 STT, Gnani Timbre TTS, why Gnani: Indian-language and code-switching accuracy) · Agent design (phases, tools, deterministic diagnosis, why numbers are computed in code) · Assumptions · Trade-offs (HTTP turn-based vs realtime, mock tools vs real APIs) · What I'd build next (real Seller Panel API, proactive alerts, multilingual regional languages, human handoff).

## 6. Demo script (aim for 90 seconds)

1. Open the app, click **Start a call**. Munim opens with the numbers.
2. Seller: *"Haan, sales kaafi gir gayi hai, samajh nahi aa raha kyun."*
3. Munim asks about stock. Seller: *"Kuch best sellers khatam ho gaye hain."*
4. Munim asks about competitors. Seller: *"Nahi, price same hai."*
5. Munim explains: about ₹56,900 from stock-outs and visibility, ₹8,100 from cancellations (cause bar animates), proposes 3 actions.
6. Seller: *"Haan, kar do."* Action cards complete one by one.
7. Seller: *"Bas, thank you."* Munim speaks the summary; summary card appears.

Record screen with system audio and mic on. Do two dry runs first.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Gnani latency or quota issues on demo day | Browser Web Speech fallback; pre-warm the TTS call |
| LLM hallucinated numbers | Numbers only from `diagnose()`; prompt forbids others |
| Echo / feedback loop on speakers | Half-duplex; stop VAD while speaking; recommend headphones for the recording |
| Number mispronunciation | `toSpoken()` with tests |
| Vercel function timeouts on streams | Stream responses; set `maxDuration`; keep TTS chunks small |
| Autoplay / mic permission blocks | Start audio context on the first click of "Start a call" |
