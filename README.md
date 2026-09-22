<p align="center">
  <img src="apps/web/public/logo.png" alt="Verdict logo" width="120" />
</p>

# Verdict

**Verify the agent. Evaluate the action. Render the verdict.**

Verdict is a pre-action security gate for autonomous agents. Before an agent performs a sensitive action — a transfer, a payment, a swap — Verdict checks its identity, capabilities, policy limits, and risk signals, then returns **ALLOW**, **REVIEW**, or **REJECT**. A rejected action is genuinely blocked; it never produces an executable transaction. An allowed action is executed for real, live, on Base Sepolia.

Built for the **Orion Agents Builder Hackathon**.

- **Live app:** [https://verdict-web-pink.vercel.app](https://verdict-web-pink.vercel.app)
- **Live API:** [https://verdictapi-production.up.railway.app](https://verdictapi-production.up.railway.app)
- **Source:** [https://github.com/LumenpactHQ/verdict](https://github.com/LumenpactHQ/verdict)
- **X:** [https://x.com/VerdictII](https://x.com/VerdictII)

---

## The Problem

AI agents are gaining the ability to act independently — sending funds, calling contracts, making decisions with no human in the loop. Autonomous action creates a trust problem: there's currently no standard way to verify that an agent is who it claims to be, is authorized for the action it's attempting, or is behaving within safe bounds before it acts.

---

## The Solution

Verdict sits in front of any sensitive agent action as a pre-action gate:

1. **Verifies identity** — is this a known, registered agent?
2. **Checks capabilities** — is this agent authorized for this type of action?
3. **Evaluates policy** — does the amount fall within the agent's configured limits?
4. **Checks risk/reputation** — any flags, unknown recipients, or anomalies?
5. **Returns a decision** — **ALLOW**, **REVIEW**, or **REJECT**.

An **ALLOW** triggers real execution on Base Sepolia — no simulation, no mocked hash. A **REJECT** is genuinely blocked: no token is ever issued and no transaction is ever attempted. A **REVIEW** routes to a human, backed by the **Docket**: a record of similar past decisions that helps a reviewer decide faster.

The decision is always deterministic. An LLM is never the authority on ALLOW/REJECT/REVIEW — that logic is a pure, auditable, unit-tested function. No AI model decides whether money moves.

---

## Try It Live

Visit [verdict-web-pink.vercel.app/trust-check](https://verdict-web-pink.vercel.app/trust-check) and run any of the three built-in scenarios — each one fires a real request against the live backend and shows exactly what a calling agent would receive:

| Agent | Request | Result |
| :--- | :--- | :--- |
| **Agent Alpha** (verified, clean history) | Send 5 USDC to a known recipient | 🟢 **ALLOW** — real transaction executes on Base Sepolia, txHash shown with a BaseScan link |
| **Agent Shadow** (unverified, no declared capability) | Send 500 USDC | 🔴 **REJECT** — blocked before any chain call is attempted; no token is ever issued |
| **Agent Sentinel** (verified, borderline amount) | Send 35 USDC, above the soft review threshold | 🟡 **REVIEW** — routes to a human reviewer, backed by Docket precedents; approving issues a fresh token and executes for real |

You can also register your own agent at [/register](https://verdict-web-pink.vercel.app/register) — pick a wallet address, declare capabilities, and set spending limits. Your agent is evaluated by the exact same deterministic engine as the three demo agents. To protect the shared testnet wallet from being drained by public visitors, live on-chain execution is reserved for the three demo agents; every other registered agent still gets a fully real, fully authentic policy evaluation — identity, capability, and limit checks all run for real — it simply won't trigger a live transfer.

### A note on how the demo agents work

Verdict doesn't watch wallets or infer intent — it's a gate that something else calls. In this demo, the three scenario buttons simulate the exact HTTP request a real autonomous agent would send when it decided to act. The gate's evaluation, enforcement, and on-chain execution downstream of that request are 100% real.

---

## Proof of Work: Verified Base Sepolia Transactions

These are real, independently verifiable transactions executed by Verdict's live deployment — not simulated:

- [`0x4fca7c17ab7c75406cd3b6814b8a03ef6c289511040f1b8639dcc10330131a97`](https://sepolia.basescan.org/tx/0x4fca7c17ab7c75406cd3b6814b8a03ef6c289511040f1b8639dcc10330131a97) — 5 USDC transfer, Block 47037468 — [view on BaseScan](https://sepolia.basescan.org/tx/0x4fca7c17ab7c75406cd3b6814b8a03ef6c289511040f1b8639dcc10330131a97)
- [`0x7699fcf8e4282517f176e6cb8a53b0277ccba582c3ba5eac4f6c1748178618a1`](https://sepolia.basescan.org/tx/0x7699fcf8e4282517f176e6cb8a53b0277ccba582c3ba5eac4f6c1748178618a1) — 5 USDC transfer, Block 47035796 — [view on BaseScan](https://sepolia.basescan.org/tx/0x7699fcf8e4282517f176e6cb8a53b0277ccba582c3ba5eac4f6c1748178618a1)

An earlier local benchmark also ran 10 consecutive live executions with zero failures, averaging ~2.5 seconds confirmation time — well within any reasonable interactive budget. Full logs and BaseScan links for that run are preserved in the project's development history.

---

## Architecture

```text
Agent (or the demo UI, simulating one)
       │
       ▼
POST /trust/evaluate ──► Verdict Engine (pure, deterministic)
                           │
                           │ ALLOW / REVIEW / REJECT
                           │
       ├── ALLOW ──► authorization_token issued ──► POST /actions/execute ──► Base Sepolia transfer
       ├── REVIEW ─► Docket queried for similar past cases ──► human reviews ──► POST /actions/:id/review
       └── REJECT ─► nothing issued, nothing executable
```

Execution is only ever reachable through a valid, single-use `authorization_token` produced by `/trust/evaluate`. There is no other path to on-chain execution — this is what makes a REJECT a real block, not a cosmetic warning.

### Execution path (Option A, locked for the live demo)

`executeTransfer()` supports two modes: a direct backend-wallet-to-recipient ERC-20 transfer (Option A), or routing through a deployed VerdictGate.sol contract (Option B, `packages/contracts/`) for on-chain gate enforcement. The live demo runs on Option A — chosen deliberately to minimize failure surface at the one step in the demo that has to work every time. Option B is fully built, unit-tested, and deployed to Base Sepolia as a documented extension; switching to it is a single environment variable (`VERDICT_GATE_ADDRESS`).

---

## Tech Stack

| Layer | Choice |
| :--- | :--- |
| **Frontend** | Next.js + TypeScript + Tailwind, deployed on Vercel |
| **Backend** | Node.js + TypeScript + Express + better-sqlite3, deployed on Railway (Docker) |
| **Database** | SQLite on a persistent volume |
| **Blockchain** | Base Sepolia (testnet) |
| **Web3 library** | viem |
| **Smart contract (optional)** | Solidity VerdictGate.sol, Hardhat-tested, deployed to Base Sepolia |

---

## Project Structure

```text
verdict/
├── apps/
│   ├── web/                     # frontend (Next.js) — Vercel
│   └── api/                     # backend (Express) — Railway
│       └── src/
│           ├── db/              # schema.sql, migrations, seed data
│           ├── engine/          # isolated call site for the decision engine
│           ├── routes/          # agents, trust, actions, docket
│           └── chain/           # Base Sepolia execution (viem)
├── packages/
│   ├── verdict-engine/          # pure, deterministic decision logic + unit tests
│   ├── contracts/               # optional Solidity VerdictGate.sol (Option B)
│   └── shared/                  # shared TypeScript types
├── scripts/                     # seeding, reset/snapshot, live-chain benchmark, regression suites
├── Dockerfile                   # multi-stage build used for the Railway deployment
└── README.md
```

---

## Security Model

- **Deterministic core.** `evaluateAction()` in `packages/verdict-engine` is a pure function — no network calls, no database access, no LLM. Same input, same output, every time. Fully unit-tested.
- **Single-use, expiring, bound tokens.** Every `authorization_token` is cryptographically random, tied to one specific action request, expires after a short window, and is atomically consumed on execution — verified by a dedicated bypass test suite covering missing, reused, expired, mismatched, and REJECT-sourced tokens.
- **Concurrency-safe.** A pre-execution atomic claim step prevents two simultaneous requests from both executing against the same token — verified under a real concurrent-request test, confirming the chain function is invoked exactly once.
- **Fails safe on chain errors.** If the on-chain call fails (RPC issue, insufficient balance), the token is not consumed and the action rolls back to a retryable state — verified with a forced-failure test.
- **No fake success states.** Execution failures always surface a real error; there is no fallback path that can produce a synthetic transaction hash.
- **AI never decides.** The Docket may optionally use an LLM to generate a plain-language summary of a case for a human reviewer, but the ALLOW/REVIEW/REJECT verdict itself is never touched by a model.

---

## Getting Started (running it yourself)

### Prerequisites

- Node.js 18+ and npm
- A Base Sepolia wallet with test ETH and test USDC (see [Coinbase Developer Platform Faucet](https://portal.cdp.coinbase.com/products/faucet))
- A Base Sepolia RPC URL (the public endpoint works: `https://sepolia.base.org`)

### Install & configure

```bash
git clone https://github.com/LumenpactHQ/verdict.git
cd verdict
npm install
```

Create `apps/api/.env`:

```env
PORT=4000
VERDICT_DB_PATH=./verdict.db
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
VERDICT_BACKEND_PRIVATE_KEY=0x... # testnet-only wallet, never a personal key
TEST_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e # Base Sepolia USDC
TEST_TOKEN_DECIMALS=6
VERDICT_GATE_ADDRESS= # leave empty for Option A
BASESCAN_API_KEY=your_key_here
```

### Run

```bash
npm run db:reset # seeds Agent Alpha, Shadow, Sentinel
npm run dev:api  # starts the backend on :4000
npm run dev:web  # starts the frontend on :3000
```

### Test

```bash
npm run test:api      # Step 5 API contract (16 checks)
npm run test:security # token-bypass & isolation suite
npm run test:chain    # failure rollback & concurrency
npm run test:rehearse # full end-to-end demo cycle
npm run test:live     # 10 consecutive REAL Base Sepolia executions (requires funded wallet)
```

---

## API Reference

| Endpoint | Purpose |
| :--- | :--- |
| `POST /agents` | Register an agent (wallet, capabilities, limits, verification status) |
| `GET /agents` | List all registered agents |
| `GET /agents/:id` | Fetch a single agent passport |
| `POST /trust/evaluate` | Evaluate an intended action → decision + authorizationToken if ALLOW |
| `POST /actions/execute` | Execute only with a valid, unexpired authorizationToken (real chain call for the 3 demo agents; evaluation-only guardrail for self-registered agents) |
| `GET /actions` | List all past requests, newest first |
| `GET /actions/:id` | View a single decision, its full audit trail |
| `POST /actions/:id/review` | Human approves/denies a REVIEW-state request; issues a fresh token on approval |
| `GET /docket/search?category=` | Return similar past Docket entries |

---

## Known Limitations & Honest Caveats

- **"Known recipient"** is currently a small hardcoded allowlist for demo purposes, not a real reputation/history system. A production version would need genuine on-chain history tracking.
- **Self-registered agents** are evaluation-only on the live public deployment, by design, to protect the shared testnet wallet from being drained. The policy engine itself runs identically for every agent, demo or custom.
- **The Docket's semantic search** is basic (category matching), not embedding-based, per the original scope.

---

## What This Is Not (Scope)

Deliberately not built for this hackathon: a decentralized reputation network, multi-chain support, an agent marketplace, DAO governance, LLM judge-panel voting, IPFS storage, an on-chain precedent registry, or multi-agent appeal workflows.

---

## License

MIT
