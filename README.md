<p align="center">
  <img src="./assets/logo.png" alt="Verdict Logo" width="130" />
</p>

# Verdict

**Verify the agent. Evaluate the action. Render the verdict.**

Verdict is a pre-action security gate for autonomous agents. Before an agent performs a sensitive action, Verdict checks its identity, capabilities, policy limits, and risk signals — then returns **ALLOW**, **REVIEW**, or **REJECT**. A rejected action is genuinely blocked; it never produces an executable transaction.

Built for the **Orion Agents Builder Hackathon**.

---

## Live Deployment & Proof of Work

| Component | Target | URL / Identifier |
|---|---|---|
| **Web Dashboard** | Vercel (Production) | [https://verdict-web-pink.vercel.app](https://verdict-web-pink.vercel.app) |
| **Engine API** | Fly.io (Production) | [https://verdict-engine-api.fly.dev](https://verdict-engine-api.fly.dev) |
| **Verified On-Chain Tx** | Base Sepolia | [`0x4fca7c17ab7c75406cd3b6814b8a03ef6c289511040f1b8639dcc10330131a97`](https://sepolia.basescan.org/tx/0x4fca7c17ab7c75406cd3b6814b8a03ef6c289511040f1b8639dcc10330131a97) |
| **Backend Wallet** | Base Sepolia | [`0x76480e84ae650405E98905Df19Efd9dFf2969882`](https://sepolia.basescan.org/address/0x76480e84ae650405E98905Df19Efd9dFf2969882) |
| **Smart Contract Gate** | Base Sepolia | [`0x4Fd9E11d0Ae7Ab6A96Bb4cA183D3d7f5C929a5c9`](https://sepolia.basescan.org/address/0x4Fd9E11d0Ae7Ab6A96Bb4cA183D3d7f5C929a5c9) |

> **Proof of Work**: The transaction hash above was produced by a live on-chain execution triggered from Verdict's single-use cryptographic authorization token on Base Sepolia (Block 47037468, transferring 5 USDC to `0x8f2c069b2d8e4f16a04efc381c815ecdf3487c91`).

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

## Demo & Interactive Gate

The demo includes both simulated autonomous scenarios and a self-service registration onboarding flow:

### 1. Simulated Agent Scenarios

These pre-built scenarios simulate what incoming requests from real autonomous agents look like when calling `POST /trust/evaluate`:

| Scenario | Agent | Request | Result |
|---|---|---|---|
| **A: Alpha** | Agent Alpha (verified, clean history) | Send 5 USDC to known recipient | 🟢 **ALLOW** — Token minted and real ERC-20 transfer executes on Base Sepolia |
| **B: Shadow** | Agent Shadow (unverified, no capabilities) | Send 500 USDC | 🔴 **REJECT** — Blocked by security gate; no authorization token is issued |
| **C: Sentinel** | Agent Sentinel (verified, 25 USDC threshold) | Send 35 USDC | 🟡 **REVIEW** — Exceeds soft threshold; routes to human sign-off backed by Docket precedents |

### 2. Self-Service Agent Registration (`/register`)

Anyone can register an autonomous agent with custom limits and test it against the live gate:
- Form fields: Display Name, EVM Wallet Address (or auto-generate), Verification Status, Declared Capabilities (`transfer`, `payment`, `swap`), Hard Transaction Limit, and Soft Review Threshold.
- On submit: Calls `POST /agents` against the live Fly.io database and immediately opens the agent in **Trust Check**.
- Interactive Parameter Configurator: Test custom action types, amounts, and recipients to see the deterministic engine render ALLOW, REJECT, or REVIEW in real time.

> **Safety Guardrail**: Self-registered agents are evaluated with 100% authentic deterministic policy logic against the live database and issued real single-use authorization tokens. To prevent public visitors from draining or spamming the shared testnet faucet wallet, on-chain execution (`POST /actions/execute`) is strictly restricted to the 3 demo agents (`agent-alpha`, `agent-shadow`, `agent-sentinel`). The UI clearly indicates this guardrail while showing the real minted token.

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

### Blockchain Execution Layer (Option A & Option B)

- **Live Demo (Option A — Active Default)**: Executes direct ERC-20 transfers from the backend wallet to recipient on Base Sepolia (`VERDICT_GATE_ADDRESS=""`), ensuring fast and reliable demo execution.
- **On-Chain Smart Contract Gate (Option B — Deployed Extension)**: A custom `VerdictGate.sol` contract (Ownable + ReentrancyGuard) is deployed on Base Sepolia at [`0x4Fd9E11d0Ae7Ab6A96Bb4cA183D3d7f5C929a5c9`](https://sepolia.basescan.org/address/0x4Fd9E11d0Ae7Ab6A96Bb4cA183D3d7f5C929a5c9). The backend supports dual-mode routing and will instantly route through the smart contract if `VERDICT_GATE_ADDRESS` is set.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend API | Node.js 22 + TypeScript + Express + better-sqlite3 |
| Hosting | Vercel (Frontend) + Fly.io (Backend with persistent storage) |
| Blockchain | Base Sepolia (testnet) |
| Web3 Library | viem |
| Database | SQLite with WAL mode, transactions, and automated migrations |

---

## Frontend Architecture & Implementation

The Verdict frontend (`apps/web`) implements a custom dark-mode glassmorphism design system (`.glass-panel`, `.glass-panel-subtle`) defined in `apps/web/src/app/globals.css`.

### The 6 Screens Built

| Screen | Route | Purpose & Capabilities |
|---|---|---|
| **1. Landing / Hero** | `/` | Entry point with metallic typography, hackathon testnet badge, 5-gate pipeline visualizer, and direct demo CTA triggers. |
| **2. Trust Check** | `/trust-check` | Interactive evaluation gate for Alpha, Shadow, Sentinel, and custom self-registered agents with live status badges and checklist pacing. |
| **3. Agent Registration** | `/register` | Self-service onboarding for custom autonomous agents into SQLite with capability selection and policy limits. |
| **4. Operations Dashboard** | `/dashboard` | Real-time system metrics (total evaluated, pass rate, blocked actions, pending review), active roster, and Base Sepolia network status. |
| **5. Agent Passports** | `/agents`, `/agents/[id]` | Agent directory and detailed identity cards showing wallet addresses, verification status, limits, and enforcement records. |
| **6. Immutable Audit Log** | `/audit-log` | Forensic ledger showing chronological action evaluation events, cryptographic token issuance records, and BaseScan transaction links. |

---

## Deployment Guide

### 1. Fly.io Backend Deployment

The backend runs as an Express + SQLite server inside a multi-stage Docker container deployed to Fly.io:

```bash
# Authenticate with Fly.io
fly auth login

# Launch from repository root (includes npm workspaces: packages/shared + apps/api)
fly launch

# Create persistent volume for SQLite database (/data)
fly volumes create verdict_data --size 1 --region iad

# Set production environment secrets (never committed to git)
fly secrets set \
  NODE_ENV=production \
  VERDICT_DB_PATH=/data/verdict.db \
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
  VERDICT_BACKEND_PRIVATE_KEY=0x... \
  TEST_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  TEST_TOKEN_DECIMALS=6 \
  CORS_ORIGIN="https://verdict-web-pink.vercel.app,http://localhost:3000"

# Deploy container image
fly deploy
```

### 2. Vercel Frontend Deployment

The Next.js frontend is deployed on Vercel:
1. Import repository `LumenpactHQ/verdict` in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Add Environment Variable:
   - `API_BASE_URL` = `https://verdict-engine-api.fly.dev` (mapped to `NEXT_PUBLIC_API_URL` via `next.config.mjs`).
4. Deploy.

---

## Local Development & Testing

### Install Dependencies

```bash
git clone https://github.com/LumenpactHQ/verdict.git
cd verdict
npm install
```

### Run Locally

```bash
# Run backend (port 4000)
npm run dev --workspace=apps/api

# Run frontend (port 3000)
npm run dev --workspace=apps/web
```

### Full Regression Suite

```bash
# 1. API Contract Verification (16 tests)
npm run test:api

# 2. Security Invariants & Token-Bypass Suite (12 checks)
npm run test:security

# 3. Chain Failure Resilience & Concurrency Double-Spend Prevention (15 checks)
npm run test:chain

# 4. End-to-End Demo Rehearsal (5 repetitions)
npm run test:rehearse
```

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | `GET` | Service liveness probe |
| `/agents` | `GET` | List all registered agent passports |
| `/agents` | `POST` | Register a new agent (wallet, capabilities, limit, review threshold) |
| `/agents/:id` | `GET` | Fetch agent passport details |
| `/trust/evaluate` | `POST` | Evaluate an intended action → decision + single-use `authorization_token` |
| `/actions/execute` | `POST` | Execute on-chain transfer with valid, unexpired token (guarded to demo agents) |
| `/actions` | `GET` | List all past action evaluation requests |
| `/actions/:id` | `GET` | View a single decision + complete immutable audit trail |
| `/actions/:id/review` | `POST` | Human approves/denies a REVIEW request and appends to the Docket |
| `/docket/search?category=` | `GET` | Return similar past Docket entries for reviewer precedent |

---

## Security Model

- **Deterministic core.** `evaluateAction()` in `packages/verdict-engine` is a pure function — no external network calls, no database access, no LLM in the critical path. Same input, same output, every time.
- **No bypass.** `/actions/execute` cannot run without a valid, single-use `authorization_token` issued by `/trust/evaluate`. The token is checked atomically against SQLite, claimed before the chain call, and consumed immediately upon success.
- **Concurrency safe.** Atomic status transition (`APPROVED` → `EXECUTING` → `EXECUTED`) prevents race conditions and double-spending.
- **Chain failure resilience.** If a network or RPC call reverts during on-chain execution, the status rolls back to `APPROVED` with `token_consumed = 0`, preserving retryability without leaking authorization.
- **AI never decides.** The Docket may use AI to summarize cases, but the verdict on any REVIEW request is strictly human-signed and auditable.
- **Testnet safety.** All on-chain interactions occur on Base Sepolia.

---

## Team

Built by a team of 4 for the Orion Agents Builder Hackathon:
- **Verdict Engine / Security Logic**
- **Backend / API / Database**
- **Blockchain / Enforcement**
- **Frontend / UX / Demo**

## License

MIT
