<p align="center">
  <img src="./assets/logo.png" alt="Verdict Logo" width="130" />
</p>

# Verdict

**Verify the agent. Evaluate the action. Render the verdict.**

Verdict is a pre-action security gate for autonomous agents. Before an agent performs a sensitive action, Verdict checks its identity, capabilities, policy limits, and risk signals — then returns **ALLOW**, **REVIEW**, or **REJECT**. A rejected action is genuinely blocked; it never produces an executable transaction.

Built for the **Orion Agents Builder Hackathon**.

---

## The Problem

AI agents are gaining the ability to act independently — sending funds, calling contracts, making decisions with no human in the loop. Autonomous action creates a trust problem: there's currently no standard way to verify that an agent is who it claims to be, is authorized for the action it's attempting, or is behaving within safe bounds *before* it acts.

## The Solution

Verdict sits in front of any sensitive agent action as a pre-action gate:

1. **Verifies identity** — is this a known, registered agent?
2. **Checks capabilities** — is this agent authorized for this type of action?
3. **Evaluates policy** — does the amount fall within the agent's configured limits?
4. **Checks risk/reputation** — any flags, unknown recipients, or anomalies?
5. **Returns a decision** — `ALLOW`, `REVIEW`, or `REJECT`.

An `ALLOW` proceeds to real execution on Base Sepolia. A `REJECT` is genuinely blocked — no transaction is ever produced. A `REVIEW` routes to a human, backed by **the Docket**: a lightweight record of similar past decisions that helps a reviewer decide faster.

**The decision is always deterministic.** An LLM is never the authority on ALLOW/REJECT/REVIEW — that logic is a pure, auditable function. The only place AI may optionally appear is generating a plain-language summary for the Docket, after a human has already decided.

---

## Demo

| Scenario | Agent | Request | Result |
|---|---|---|---|
| A | Agent Alpha (verified, clean history) | Send 5 USDC to a known recipient | 🟢 **ALLOW** — real transaction executes on Base Sepolia |
| B | Agent Shadow (unverified, no declared capability) | Send 500 USDC | 🔴 **REJECT** — transaction blocked, reason shown on screen |
| C (optional) | A borderline request just above the soft limit | — | 🟡 **REVIEW** — the Docket surfaces similar past cases to help a human decide |

Success criteria: a judge should understand the product in under 30 seconds and see, live, that an approved action executes while a rejected one is actually blocked.

---

## Architecture

```
Agent
  │
  ▼
POST /trust/evaluate ──► Verdict Engine (pure, deterministic)
  │                           │
  │                     ALLOW / REVIEW / REJECT
  │                           │
  ├── ALLOW ──► authorization_token issued ──► POST /actions/execute ──► Base Sepolia transfer
  ├── REVIEW ─► Docket queried for similar past cases ──► human reviews ──► POST /actions/:id/review
  └── REJECT ─► nothing issued, nothing executable
```

Execution is only ever reachable through a valid, single-use `authorization_token` produced by `/trust/evaluate`. There is no other path to on-chain execution — this is what makes a REJECT a real block, not a cosmetic warning.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js + TypeScript + Tailwind |
| Backend | Node.js + TypeScript + Express |
| Database | SQLite (better-sqlite3) |
| Blockchain | Base Sepolia (testnet) |
| Web3 library | viem |
| AI (optional) | Any hosted LLM API — explanations only, never the decision |

---

## Frontend Architecture & Implementation

The Verdict frontend (`apps/web`) is built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Lucide Icons**, implementing a custom dark-mode glassmorphism design system (`.glass-panel`, `.glass-panel-subtle`) defined in `apps/web/src/app/globals.css`.

### Why Next.js?
1. **Zero-Lag Interactive Transitions**: Next.js App Router provides instantaneous client-side navigation between inspection tools while retaining shared layouts and ambient gradient backdrops.
2. **Unified TypeScript Type Contract**: Directly imports shared schemas and types from `@verdict/shared` without code duplication or serialization mismatch.
3. **Optimized Demo Delivery**: Fast cold starts, automatic font sub-setting, and minimal bundle footprint (< 106 kB First Load JS per route) ensure smooth live stage presentations.

---

### The 5 Screens Built

| Screen | File Path | Purpose & Capabilities |
|---|---|---|
| **1. Landing / Hero** | `apps/web/src/app/page.tsx` | High-impact entry point featuring the metallic chrome headline, honest hackathon testnet badge, 5-gate pipeline tracker, interactive card preview, and direct demo CTA triggers (`Run Agent Alpha` & `See it reject a bad agent`). |
| **2. Trust Check** | `apps/web/src/app/trust-check/page.tsx` | The primary interactive evaluation gate. Executes live `POST /trust/evaluate` API calls for Scenario A (`alpha`), Scenario B (`shadow`), and Scenario C (`sentinel`), driving the sequential gate animation, outcome panels, on-chain execution triggers, and human review overrides. |
| **3. Operations Dashboard** | `apps/web/src/app/dashboard/page.tsx` | System overview displaying live security gate metrics (total evaluated, pass rate, blocked actions, pending review), active agent roster, recent policy enforcement stream, and Base Sepolia network status. |
| **4. Agent Passports** | `apps/web/src/app/agents/page.tsx`<br/>`apps/web/src/app/agents/[id]/page.tsx` | Agent directory and detailed identity cards displaying wallet addresses, verification status (`VERIFIED`, `UNVERIFIED`), declared capabilities (`PAYMENT`, `TRANSFER`), transaction limits, review thresholds, and historical enforcement records. |
| **5. Immutable Audit Log** | `apps/web/src/app/audit-log/page.tsx` | Forensic ledger showing immutable chronological action evaluation events, status filter pills, cryptographic authorization token issuance records, and BaseScan transaction verification links. |

---

### Check-List Animation & Demo Pacing

Located in `apps/web/src/components/CheckList.tsx`.

- **The Problem**: A live local evaluation call to `POST /trust/evaluate` finishes in only **~4–50ms**. If the screen updated instantaneously, an audience or hackathon judge during a 45-second pitch would miss the security gate in action — it would look like pre-baked static text.
- **The Solution**: The checklist introduces an intentional, rhythmic staggered sequence (~300ms interval per gate):
  1. `Identity verified` (Checks on-chain registry)
  2. `Capability declared` (Confirms action type matches permissions)
  3. `Within transaction limit` (Validates spending policy)
  4. `Recipient trusted` (Screens destination address reputation)
  5. `No reputation flags` (Evaluates behavioral velocity)
- **Why It Matters**: This deliberate pacing visually proves the **defense-in-depth architecture** to judges in real time before revealing the green Base Sepolia execution hash or the red hard-block state.

---

### Fixture Strategy Before API Wiring

All mock data was structured in `apps/web/src/fixtures/`:
- `scenarios.ts` — Full Scenario A, B, and C payloads and expected states.
- `agents.ts` — Agent Alpha, Agent Shadow, and Sentinel Agent profiles.
- `audit.ts` & `docket.ts` — Mock audit trail events and precedent entries.

**Design Decision**: Every fixture strictly adheres to the frozen interfaces in `packages/shared/src/types.ts` (`Agent`, `ActionRequestInput`, `Decision`, `DocketEntry`). This decoupled frontend (P4) development from backend (P2) engineering — when the real Express API endpoints (`/trust/evaluate`, `/actions/execute`, `/docket/search`) were ready, connecting them in `apps/web/src/app/trust-check/page.tsx` was a seamless 1:1 drop-in replacement with automatic offline fallback.

---

### Notable UX Decisions

1. **Deterministic 3-State Decision Color System**:
   - `ALLOW` (`#22c55e` / Emerald): `bg-emerald-500/10 text-emerald-400 border-emerald-500/30` with `glow-green` shadow. Signals an authorized action that immediately calls `/actions/execute` and surfaces the live BaseScan transaction hash.
   - `REVIEW` (`#f59e0b` / Amber): `bg-amber-500/10 text-amber-400 border-amber-500/30`. Indicates a soft limit or policy trigger requiring human sign-off; reveals interactive **Approve** / **Deny** buttons.
   - `REJECT` (`#ef4444` / Rose): `bg-rose-500/10 text-rose-400 border-rose-500/30` with `glow-red` shadow. Genuinely blocks execution with a clear `"No transaction created"` badge and explicit policy violation reasons.

2. **Embedded Docket Precedents Panel (`apps/web/src/components/DocketPanel.tsx`)**:
   - Visible **strictly** when `decision === 'REVIEW'`. It is not a separate standalone page; it is embedded directly beneath the human review action controls.
   - Dynamically calls `GET /docket/search?category=[derived category]` and displays up to 5 precedent cases.
   - Each card displays a plain-text summary, a compact tag for `humanDecision` (`APPROVED` in emerald, `DENIED` in rose), and a relative timestamp (e.g. `"3 days ago"`).
   - Styled with `.glass-panel-subtle` (`border-white/[0.06]`, `bg-white/[0.02]`) and compact typography (`text-xs text-slate-300`) to maintain clear visual hierarchy as a supporting reference without distracting from the primary decision badge.

---

## Project Structure

```
verdict/
├── apps/
│   ├── web/                    # frontend dashboard (Next.js)
│   └── api/                    # backend
│       └── src/
│           ├── db/             # schema.sql + typed query helpers
│           ├── engine/         # (re-exports packages/verdict-engine)
│           ├── routes/         # agents, actions, docket
│           └── chain/          # Base Sepolia execution (viem)
├── packages/
│   ├── verdict-engine/         # pure, deterministic decision logic
│   ├── contracts/              # optional Solidity (VerdictGate.sol) — see below
│   └── shared/                 # shared TypeScript types
├── scripts/
│   └── seed-demo-agents.ts     # creates Agent Alpha + Agent Shadow
├── docs/
│   └── architecture.md
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- A Base Sepolia wallet (fresh keypair — do not reuse a personal wallet)
- Base Sepolia test ETH ([Base faucet](https://www.base.org/) or Coinbase Developer Platform faucet)
- A Base Sepolia RPC URL (public endpoint, or a free-tier provider like Alchemy/Infura)
- A test USDC / ERC-20 faucet token address on Base Sepolia

### Install

```bash
git clone <this-repo>
cd verdict
npm install
```

### Configure

Create `apps/api/.env` (never commit this file):

```bash
PORT=4000
VERDICT_DB_PATH=./verdict.db
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
VERDICT_BACKEND_PRIVATE_KEY=0x...        # backend wallet, testnet only
TEST_TOKEN_ADDRESS=0x...                 # Base Sepolia test USDC / ERC-20
TEST_TOKEN_DECIMALS=6
```

### Run the backend

```bash
cd apps/api
npm run dev
```

The schema is applied automatically on startup (`initSchema()`).

### Seed demo agents

```bash
npm run seed
```

Creates **Agent Alpha** (verified, capable, clean history) and **Agent Shadow** (unverified, no declared capabilities) — idempotent, safe to re-run before the demo.

### Run the frontend

```bash
cd apps/web
npm run dev
```

---

## API Reference

| Endpoint | Purpose |
|---|---|
| `POST /agents` | Register an agent (wallet, capabilities, limit, verification status) |
| `GET /agents/:id` | Fetch agent passport |
| `POST /trust/evaluate` | Evaluate an intended action → decision + `authorization_token` if ALLOW |
| `POST /actions/execute` | Execute only with a valid, unexpired `authorization_token` |
| `GET /actions` | List all past requests |
| `GET /actions/:id` | View a single decision + audit trail |
| `POST /actions/:id/review` | Human approves/denies a REVIEW-state request; writes a Docket entry |
| `GET /docket/search?category=` | Return up to 5 similar past Docket entries |

REST, synchronous, no websockets or queues by design — fewer moving parts to fail live on stage.

---

## Security Model

- **Deterministic core.** `evaluateAction()` in `packages/verdict-engine` is a pure function — no network calls, no database access, no LLM. Same input, same output, every time.
- **No bypass.** `/actions/execute` cannot run without a valid, single-use `authorization_token` issued by `/trust/evaluate`. There is no other path to execution.
- **AI never decides.** The Docket may use AI to generate a plain-language summary of a case, but the verdict on any REVIEW request is always a human's decision, recorded as-is.
- **Testnet only.** All funds and transactions in this hackathon build are Base Sepolia testnet — no real funds are ever at risk.

See `docs/architecture.md` for the full risk/mitigation table.

---

## What This Is Not (Scope)

Deliberately **not** built for this hackathon: a decentralized reputation network, multi-chain support, an agent marketplace, DAO governance, LLM judge-panel voting, IPFS storage, semantic/embedding-based Docket search, an on-chain precedent registry, or multi-agent appeal workflows. Every one of these is a plausible future direction, not a requirement to prove the core idea: **a pre-action gate that can genuinely say no.**

---

## Team

Built by a team of 4 for the Orion Agents Builder Hackathon:
- **Verdict Engine / Security Logic**
- **Backend / API / Database**
- **Blockchain / Enforcement**
- **Frontend / UX / Demo**

## License

MIT (or update to match your hackathon submission requirements).
