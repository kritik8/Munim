# AGENTS.md — Munim (Virtual KAM for Snapdeal sellers)

> Read this file fully before writing any code. Then read `PLAN.md` and follow its phases in order.
> The product name is **Munim**. If the owner renames it, change it only in `lib/brand.ts`.

## 1. What we are building

A **voice-first AI Virtual Key Account Manager** for Snapdeal sellers, built as a take-home for the Snapdeal Seller Experience team (AI First Intern assignment).

Scenario: a seller calls and says *"My sales have dropped significantly this month. I don't understand why. Can you help me?"*

The agent must:
1. Greet and understand why the seller is calling (it already knows the account, so it opens proactively).
2. Hold a natural two-way **voice** conversation (Hindi / Hinglish / English).
3. Ask relevant follow-up questions, one at a time.
4. Use the mock seller data to diagnose: pricing, inventory, cancellations, visibility.
5. Recommend 2–3 practical actions, then **execute them via tools** (mock) and show them live in the UI.
6. End with a spoken **and** on-screen summary: key issues, recommendations, next steps.

Judging criteria: voice interaction & naturalness (30), understanding seller queries (20), quality of recommendations (20), AI implementation & workflow (20), creativity & execution (10). Optimise for these.

**The brief says: do NOT build "just another bot that answers questions". The agent must take ownership: diagnose, quantify, act, follow up.**

## 2. Stack (fixed — do not swap without asking)

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript, deployed on Vercel |
| Styling | Tailwind CSS + shadcn/ui + Framer Motion + lucide-react. Fonts: Geist Sans + Geist Mono |
| LLM | **LiteLLM proxy** via OpenAI-compatible API (`openai` npm SDK with custom `baseURL`). Must support streaming + tool calling |
| STT / TTS | **Gnani Vachana**: STT = Prisma v2.5, TTS = Timbre. Fallback = browser Web Speech API |
| State | Zustand (client call state). No database. Mock data only |
| Validation | zod for tool args and API payloads |

### Environment variables (`.env.local`, never committed; mirror names in `.env.example`)
```
LITELLM_BASE_URL=
LITELLM_API_KEY=
LITELLM_MODEL=              # model alias exposed by the proxy
GNANI_API_KEY=
GNANI_ORGANIZATION_ID=      # only needed for REST STT, per Gnani docs
GNANI_USER_ID=              # only needed for REST STT
GNANI_TTS_VOICE=sia         # verify voice list in docs
NEXT_PUBLIC_VOICE_PROVIDER=gnani   # gnani | browser
```
Keys are **server-side only**. The browser never sees them. All provider calls go through `app/api/*` route handlers.

## 3. Gnani integration notes (verify against docs before coding)

Docs index: https://docs.gnani.ai/llms.txt — fetch it and read the STT and TTS pages. Facts known at planning time:
- Base host `https://api.vachana.ai`. Auth header: `X-API-Key-ID: <key>`.
- TTS endpoints: REST `/api/v1/tts/inference`, SSE streaming `POST /api/v1/tts/sse`, WebSocket `wss://api.vachana.ai/api/v1/tts`. Request body has `text`, `voice`, `model` (e.g. `vachana-voice-v2` / `timbre-v2.5`), plus audio options (sample rate, container, encoding). Check exact fields.
- STT: Prisma v2.5. REST (file based), realtime WebSocket `wss://api.vachana.ai/stt/v3`, and batch. Language codes include `hi-IN`, `en-IN`, and a Hinglish mode (`en-hi-IN-latn` for Latin-script Hinglish). Use the Hinglish mode when UI language = Hinglish.
- Gnani TTS pronounces numbers badly unless they are written as words. **Always pass text through `toSpoken()`** (see §7) before TTS.
- Browsers cannot set custom headers on WebSockets, so a browser-to-Gnani WebSocket needs a server proxy. Vercel cannot host one. Therefore:
  - **Path A (build first, Vercel only):** `/api/stt` (REST STT, one utterance per request, client-side VAD) and `/api/tts` (SSE → stream audio back). Chat reply is split into sentences; each sentence is synthesised as soon as it completes, so speech starts before the LLM finishes.
  - **Path B (stretch, Render):** `gateway/` Node `ws` server proxying browser audio to Gnani realtime STT and TTS for barge-in and lower latency. Keep behind `NEXT_PUBLIC_GATEWAY_URL`; Path A must keep working without it.

## 4. Seller data & assumptions (single source: `lib/data/seller.ts`)

| Metric | Last month | This month |
|---|---|---|
| Sales | ₹2,00,000 | ₹1,35,000 |
| Orders | 400 | 270 |
| Cancellation rate | 8% | 14% |
| Average selling price | ₹500 | ₹500 |
| Out-of-stock products | 5 | 18 |

Seller persona (mock): "Rakesh Traders", home & kitchen category, Indore. Add a mock SKU list (≥18 SKUs, 5 best sellers among the out-of-stock ones with last-month units) in the same file. State assumptions in the UI (an "Assumptions" popover) and in `README.md`:
1. Orders = net placed orders; sales = orders × ASP.
2. The 13 additional stock-outs are assumed to be mostly top sellers; out-of-stock listings lose search rank.
3. Seller-initiated cancellations are assumed to be driven mainly by stock-outs.
4. Competitor pricing is unknown. ASP is flat, so ask the seller before blaming price.

### Deterministic diagnosis (`lib/agent/diagnose.ts`) — do this in code, not in the LLM
- Gap = 65,000 (−32.5%). Orders −32.5%. ASP flat, so this is a **volume** problem, not a price problem.
- Cancellation loss ≈ (14% − 8%) × 270 × ₹500 = **₹8,100**.
- Remainder ≈ **₹56,900** attributed to stock-outs + lost visibility.
- Return `{ gap, gapPct, ordersPct, aspChange, cancellationLoss, stockoutVisibilityLoss, rankedCauses[], confidence }`. The LLM narrates this object and must not invent other numbers.

## 5. Agent design

**Conversation phases** (kept in state and injected into the system prompt each turn): `greet → discover → diagnose → recommend → commit → summarise`.
- greet: proactive opening using real numbers.
- discover: ask 2–4 questions max, one per turn (stock? price vs competitors? listing/ads changes? cancellation reasons?). Skip any question the data already answers.
- diagnose: give root cause with numbers from `diagnose()`.
- recommend: 2–3 prioritised actions.
- commit: on seller consent, call tools; confirm each result in one line.
- summarise: call `end_call_with_summary`.

**Tools** (zod-validated; all mock, return plausible JSON, and each call is streamed to the UI Action feed):
- `get_seller_metrics()` · `diagnose_decline()` · `list_oos_skus({limit})`
- `create_restock_alert({skus[]})` · `flag_cancellations({count, reason})`
- `draft_promo({skus[], type})` · `schedule_followup({when})`
- `end_call_with_summary({issues[], actions[], next_steps[]})`

**Recommendation playbook** (priority order):
1. Restock the top out-of-stock best sellers first (highest recovery per rupee).
2. Fix inventory sync / auto-pause listings at zero stock to stop cancellations.
3. Win back visibility: a small sponsored/promo push on restocked SKUs.
4. Only if the seller reports competitor undercutting: a price check on affected SKUs.

### System prompt (put in `lib/agent/prompt.ts`; interpolate data and phase)
```
You are Munim, Snapdeal's Virtual Key Account Manager, on a live phone call with a small seller.
Speak like a warm, sharp account manager who respects the seller's time. Spoken style only:
max 40 words per turn, no lists, no markdown, no emojis, ONE question at a time.
Mirror the seller's language (English, Hindi, or Hinglish in Latin script).
You OWN the problem: diagnose, quantify, recommend, then act through tools. Don't just answer.
Use only the numbers in DIAGNOSIS and SELLER_DATA. Never invent figures. If unsure, ask.
Never blame price unless the seller says competitors undercut; ASP is flat.
Current phase: {{phase}}. Follow the flow: greet, discover (max 4 questions), diagnose with numbers,
recommend 2-3 actions in priority order, ask consent, execute tools, then summarise and end.
Write currency and numbers naturally; they will be converted for speech.
SELLER_DATA: {{seller_json}}
DIAGNOSIS: {{diagnosis_json}}
```

## 6. API contract

- `POST /api/chat` — body `{ messages, phase }`; responds as SSE with events: `text_delta {text}`, `sentence {text}`, `tool_call {id,name,args}`, `tool_result {id,result}`, `phase {phase}`, `done`. Run the tool loop server-side (max 4 iterations).
- `POST /api/stt` — multipart audio blob + `lang` → `{ text, lang }`.
- `POST /api/tts` — `{ text, lang }` → streamed audio. Rate-limit and cap text at 500 chars.
- Errors: every route returns `{ error, code }`; client shows a calm inline toast and auto-falls back to the browser Web Speech provider if Gnani fails.

## 7. Voice pipeline rules

- Client VAD (e.g. `@ricky0123/vad-web` or an RMS-threshold fallback): start on speech, end after ~700 ms silence; show a live level meter.
- Half-duplex with **interrupt**: tapping the orb or pressing `Space` stops TTS immediately and starts listening. Cancel in-flight chat and TTS fetches with `AbortController`.
- Sentence-chunk the LLM stream; synthesise sentence N+1 while N plays; play through a Web Audio queue.
- `toSpoken(text)`: convert `₹1,35,000` → "one lakh thirty five thousand rupees", `32.5%` → "thirty two point five percent", `18` → "eighteen"; strip markdown/emojis. Unit-test it.
- Keep a transcript store with `{id, role, text, partial, ts}`; render interim STT text as a muted partial bubble.
- Show latency per turn in a small dev-only readout (STT, LLM first token, TTS first byte).

## 8. UI direction (see `PLAN.md` §3 for the full component list)

Minimal, calm, premium. Light-first with a dark mode. Warm off-white canvas, near-black ink, **one** accent: Snapdeal red `#E40046`. Large radius (`rounded-3xl`), soft layered shadows, hairline borders, generous whitespace, subtle motion only (spring easing, no bounce theatrics).
Visual reference: https://www.supaste.com/ — borrow its *feel*: floating pill nav, big two-line hero (bold first line, muted second line), a floating "notch" shelf, category tabs with counts, visual timeline cards, bento feature grid. Do not copy its assets, copy, or branding.

Brand: product **Munim**. Hero headline pattern: `Munim` (wordmark) + tagline **"Your seller's AI account manager."** + small caption **"Built for the Virtual KAM of Snapdeal."** Logo: red rounded-square tile with a white diamond ("deal tag") containing a waveform; keep it inspired by, not identical to, the Snapdeal mark. Source file: `public/logo.svg`. Add a footer line "Independent prototype. Not an official Snapdeal product. Mock data only."

## 9. Conventions

- TypeScript strict, no `any`. Small files, named exports, colocated tests for `diagnose.ts` and `toSpoken.ts`.
- `pnpm` scripts: `dev`, `build`, `lint`, `test`. Run `lint`, `test`, and `build` before saying you are done with a phase.
- Commit per phase with conventional commits (`feat:`, `fix:`, `chore:`).
- Accessibility: all controls keyboard reachable, `aria-live="polite"` on the transcript, respect `prefers-reduced-motion`.
- Never commit secrets. Never log API keys. Never use real Snapdeal data.
- If a doc or API behaves differently from this file, trust the live docs, then update this file.

## 10. Definition of done

- A full voice call works end to end in Chrome on desktop **and** mobile, in English and Hinglish.
- Seller data panel, live transcript, live action feed, and end-of-call summary all update in real time.
- Deployed on Vercel with env vars set; `README.md` contains architecture, models used, assumptions, and trade-offs (this becomes the one-page note).
- A scripted 90-second demo path works reliably (see `PLAN.md` §6).
