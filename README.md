# Munim — AI Virtual Key Account Manager for Snapdeal Sellers

> **"Your sales dipped. Your account manager already knows why."**
> An AI-first Virtual KAM built for the Snapdeal Seller Experience team assignment.
> Independent prototype. Not an official Snapdeal product. Mock data only.

---

## 1. Executive Summary & Problem

Small sellers on marketplaces like Snapdeal often see sudden revenue declines without knowing why:
- *Was it competitor price undercutting?*
- *Did listings lose search rank?*
- *Did cancellations trigger algorithmic penalties?*

Traditional bots are passive: they wait for questions and regurgitate FAQ links. **Munim takes complete ownership**:
1. **Greets proactively** with the seller's actual numbers (sales, volume, cancellations).
2. **Holds a natural spoken dialogue** in English, Hindi, or Latin Hinglish.
3. **Diagnoses deterministically** in code—quantifying the exact revenue gap into stock-out/visibility loss vs. cancellation penalties, without LLM hallucinations.
4. **Recommends 2–3 prioritised actions** and executes them through mock seller tools shown live in the UI.
5. **Ends with an actionable written and spoken summary** that the seller can export.

---

## 2. Architecture & Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js Client)                        │
│                                                                        │
│  [ Microphone ] ──► [ Client VAD ] ──► Audio Blob                      │
│                           │                                            │
│                           ▼                                            │
│                     POST /api/stt ──► Gnani Prisma v2.5 STT            │
│                           │           (Fallback: Web Speech API)       │
│                           ▼                                            │
│                     Transcribed Text                                   │
│                           │                                            │
│                           ▼                                            │
│                     POST /api/chat (SSE Stream)                        │
│                           │                                            │
│       ┌───────────────────┴────────────────────┐                       │
│       ▼                                        ▼                       │
│  LiteLLM Proxy                        Sentence Detection               │
│  (OpenAI Compatible)                           │                       │
│       │                                        ▼                       │
│  Tool Calling Loop                    toSpoken(sentence)               │
│  - get_seller_metrics                          │                       │
│  - diagnose_decline                            ▼                       │
│  - list_oos_skus                         POST /api/tts                 │
│  - create_restock_alert                        │                       │
│  - flag_cancellations                          ▼                       │
│  - draft_promo                        Gnani Timbre TTS (SSE)           │
│  - schedule_followup                           │                       │
│  - end_call_with_summary                       ▼                       │
│       │                               Web Audio Queue Playback         │
│       ▼                                                                │
│  Zustand Live State ──► Orb · Shelf · Transcript · Actions · Summary   │
└────────────────────────────────────────────────────────────────────────┘
```

### Voice Pipeline Highlights
- **Sentence-Chunked Audio Streaming**: Text is streamed from the LLM, split into complete sentences, converted to spoken Indian words via `toSpoken()`, and synthesised in parallel. Sentence $N+1$ synthesises while sentence $N$ plays—drastically reducing time-to-first-voice.
- **Half-Duplex with Instant Barge-In**: Tapping the Orb or pressing `Space` immediately aborts in-flight TTS playback and LLM stream requests using `AbortController`, resetting state to active listening.
- **Resilient Fallback**: If Gnani API is unavailable or keys are omitted, the app gracefully switches to the browser's native Web Speech API (`SpeechRecognition` / `SpeechSynthesis`) and alerts the seller with an inline notification.

---

## 3. Models & Technology Stack

| Component | Choice | Reason |
|---|---|---|
| **Framework** | Next.js 16 (App Router) + TypeScript | Standard for production React apps, zero-config API routes, edge-ready |
| **Styling** | Tailwind CSS v4 + Framer Motion + Lucide | Minimalist glassmorphic aesthetic inspired by Supaste, smooth spring physics |
| **LLM Gateway** | LiteLLM Proxy via `openai` SDK | Model-agnostic proxy supporting streaming function calling with zero provider lock-in |
| **STT** | Gnani Prisma v2.5 (`https://api.vachana.ai/stt/v3`) | Native state-of-the-art accuracy for Indian languages and code-switched Hinglish |
| **TTS** | Gnani Timbre (`https://api.vachana.ai/api/v1/tts/sse`) | Expressive Indian English and Hindi voice synthesis (`Nalini` / `Sia`) |
| **State** | Zustand | Lightweight client state for call status, audio queues, and live tool feeds |
| **Validation** | Zod | Runtime schema validation for all tool inputs and API payloads |

---

## 4. Deterministic Diagnosis Engine (`lib/agent/diagnose.ts`)

Instead of asking the LLM to invent figures or calculate percentages, diagnosis is executed deterministically in code:

| Metric | Last Month | This Month | Change |
|---|---|---|---|
| **Sales** | ₹2,00,000 | ₹1,35,000 | **−₹65,000 (−32.5%)** |
| **Orders** | 400 | 270 | **−130 (−32.5%)** |
| **ASP (Average Selling Price)** | ₹500 | ₹500 | **Flat (0%)** |
| **Cancellations** | 8% | 14% | **+6% excess** |
| **Out-of-Stock SKUs** | 5 | 18 | **+13 SKUs** |

### Mathematical Breakdown
1. **ASP is flat (₹500)**: Proves this is a **volume issue**, not competitor undercutting.
2. **Excess Cancellation Loss**:
   $$\Delta \text{Cancellation Rate} \times \text{Current Orders} \times \text{ASP} = (14\% - 8\%) \times 270 \times ₹500 = \mathbf{₹8,100}$$
3. **Stock-Out & Lost Visibility Loss**:
   $$\text{Total Gap} - \text{Cancellation Loss} = ₹65,000 - ₹8,100 = \mathbf{₹56,900}$$
4. **Ranked Causes**:
   - Cause 1: Stock-outs of top 5 bestsellers & algorithmic search demotion ($87.5\%$ of decline).
   - Cause 2: Seller cancellations due to stock-outs causing fulfillment failures ($12.5\%$ of decline).

The LLM is prompted strictly to narrate these exact numbers and is forbidden from hallucinating alternative explanations unless the seller explicitly mentions external factors.

---

## 5. Spoken Number Conversion (`lib/voice/toSpoken.ts`)

Indian TTS models stumble over raw numerals like `₹1,35,000` or `32.5%`. `toSpoken()` transforms text before synthesis:
- `₹1,35,000` $\rightarrow$ *"one lakh thirty five thousand rupees"*
- `₹8,100` $\rightarrow$ *"eight thousand one hundred rupees"*
- `32.5%` $\rightarrow$ *"thirty two point five percent"*
- `18 products` $\rightarrow$ *"eighteen products"*
- Strips markdown symbols, asterisks, bullet points, and emojis to prevent TTS artifacts.
- Fully covered by Jest unit tests (`pnpm test`).

---

## 6. 90-Second Demo Script

Follow this path to showcase Munim's capabilities during a demo recording:

| Step | Time | Spoken Dialogue / Action | What to Notice in the UI |
|---|---|---|---|
| **1. Start** | 0:00 | Click **"Start a call"** on landing page. | Dynamic island "CallShelf" appears top-centre; status turns to *Connecting* then *Listening*. |
| **2. Greet** | 0:10 | Munim proactively greets: *"Namaste Rakesh ji, aapki sales is mahine ₹65,000 neeche aayi hai. Kya aapke best-sellers out of stock hain?"* | Metric cards animate; Sales and Orders show red $-32.5\%$ badges. |
| **3. Seller** | 0:25 | Seller: *"Haan, pressure cooker aur tawa stock me khatam ho gaye hain."* | Mic level meter pulses on Orb; speech transcribed in real time into transcript feed. |
| **4. Diagnose** | 0:40 | Munim: *"Samajh gaya. ₹56,900 ka nuksaan stock-out se hai, aur ₹8,100 extra cancellations se. Price drop nahi hua hai."* | **CauseBar** smoothly animates: $88\%$ red (Stock-outs) vs $12\%$ orange (Cancellations). |
| **5. Action** | 0:55 | Seller: *"Theek hai, isko kaise theek karein?"* Munim recommends 3 actions and seller replies *"Haan, kar do."* | Tool cards appear in Action Feed: *Creating restock alert* $\rightarrow$ *Done*, *Auto-pause enabled* $\rightarrow$ *Done*. |
| **6. Summary** | 1:15 | Seller: *"Shukriya."* Munim calls `end_call_with_summary` and closes gracefully. | **SummaryCard** renders with Key Issues, Actions Taken, and Next Steps. Buttons to Copy or Download Markdown. |

---

## 7. Recording Checklist for Submission

- [ ] Use Google Chrome on Desktop or Mobile.
- [ ] Connect headphones with mic to avoid speaker-to-mic acoustic feedback.
- [ ] Ensure `.env.local` has `LITELLM_API_KEY` and `GNANI_API_KEY` set (or run in browser fallback mode with `NEXT_PUBLIC_VOICE_PROVIDER=browser`).
- [ ] Run `pnpm test` beforehand to verify all 33 tests pass.
- [ ] Record fullscreen at 1080p with system audio and microphone enabled.
- [ ] Hit `Space` once during playback to demonstrate mid-sentence interruption.

---

## 8. Deployment Instructions (Vercel)

### Step 1: Push to GitHub / GitLab
```bash
git add .
git commit -m "feat: complete Munim voice-first Virtual KAM for Snapdeal sellers"
git push origin main
```

### Step 2: Import into Vercel
1. In Vercel Dashboard, click **Add New** $\rightarrow$ **Project**.
2. Select your repository.
3. Framework Preset: **Next.js**.
4. Set Environment Variables:
   ```
   LITELLM_BASE_URL=https://your-litellm-proxy/v1
   LITELLM_API_KEY=your_litellm_api_key
   LITELLM_MODEL=gpt-4o-mini
   GNANI_API_KEY=your_gnani_vachana_key
   GNANI_TTS_VOICE=Nalini
   NEXT_PUBLIC_VOICE_PROVIDER=gnani
   ```
5. Click **Deploy**.

---

## 9. Assumptions & Trade-offs

1. **Deterministic vs Pure Generative**: We deliberately restricted the LLM to narrating deterministic math calculations. For financial and seller trust metrics, LLMs cannot be trusted to perform dynamic arithmetic reliably without hallucinations.
2. **REST STT + SSE TTS vs Full Duplex WebSockets (Path A vs Path B)**: Vercel serverless functions cannot maintain persistent stateful WebSockets to third-party endpoints. Path A (REST STT with client VAD + SSE chunked TTS) delivers sub-second response times on standard serverless infrastructure with zero infrastructure maintenance. Path B (Render Node WebSocket gateway) remains a planned stretch feature.
3. **Mock Data**: Real Snapdeal APIs require seller OAuth and staging credentials not provided in the assignment; all 22 SKUs, metrics, and tool execution endpoints simulate realistic production payloads.

---

## 10. What to Build Next

- **Proactive Outbound Trigger**: Munim initiates a call when stock drops below 7 days of cover, rather than waiting for seller inbound.
- **Deeper Multi-dialects**: Extend support to Tamil, Telugu, Marathi, and Bengali regional voice models for tier-2/3 Indian merchant hubs.
- **Direct Snapdeal API Hookup**: Connect real inventory sync and Snapdeal Ads sponsored products campaign creation.

