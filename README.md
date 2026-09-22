# FGP-Backend: Authoritative Modular Monolith

Authoritative backend service for the **Fantasy Gaming Platform (FGP)**.

FGP-Backend serves as the single source of truth for:
- Virtual demo credits and append-only ledger accounting
- Deterministic game engine rules and provably fair outcome generation
- Synchronous round lifecycle state management
- Real-time player entry resolution and crash multiplier curves
- Versioned game configuration governance with multi-stage approval and rollback

> **IMPORTANT SCOPE CONSTRAINT:**
> FGP operates strictly with **virtual/demo credits**. There are **no real-money deposits, withdrawals, payment gateways, or real-money wagering**.

---

## 1. Core Architecture

FGP-Backend is structured as a hardened Modular Monolith built with **Fastify**, **TypeScript**, and **Prisma ORM** targeting **PostgreSQL 16**.

```
src/
├── app/                  # Fastify server bootstrap, plugins, configuration, probes (/health, /ready)
├── infrastructure/
│   ├── database/         # Prisma client singleton and database health checks
│   ├── events/           # Event bus for round lifecycle and settlement events
│   ├── repositories/     # Repository container (authoritative Prisma + isolated in-memory test adapters)
│   └── websocket/        # Real-time WebSocket subscriptions and game state push
├── modules/
│   ├── auth/             # Argon2 password hashing, JWT access/refresh token issuing, RBAC
│   ├── configurations/   # Versioned game config governance (Draft -> Validate -> Preview -> Approve -> Publish)
│   ├── games/            # Authoritative game catalog and engine execution
│   ├── ledger/           # Virtual credit accounts and immutable double-entry ledger transactions
│   ├── rounds/           # Synchronous round lifecycle state machine (commit-reveal provably fair)
│   └── settlements/      # Concurrency-safe entry placement, crash cashout, and reward settlements
└── shared/               # Domain constants, error hierarchies, validation schemas, and types
```

---

## 2. Platform Games Catalog

The platform registers and authors outcomes for **exactly 18 deterministic game engines**:

**Prediction Games (6):**
1. `color_pred` - Color Prediction (Red, Green, Violet)
2. `number_pred` - Number Prediction (0–9)
3. `odd_even` - Odd or Even parity
4. `hi_lo` - High / Low comparative prediction
5. `dice` - Authoritative 6-sided dice roll
6. `number_wheel` - Segmented multiplier wheel

**Casino & Card Games (6):**
7. `spin_wheel` - Continuous wheel spinner
8. `slot_machine` - Multi-reel classic slot machine
9. `roulette` - Single-zero European roulette (37 pockets)
10. `blackjack` - Authoritative Blackjack card engine
11. `baccarat` - Classic Baccarat card engine
12. `rummy` - Deterministic Rummy card engine

**Real-Time Games (2):**
13. `crash` - Real-time exponential multiplier crash engine
14. `space_crash` - Space-themed real-time crash engine

**Mini Games (4):**
15. `mines` - Interactive grid with hidden mines
16. `plinko` - Multi-row peg drop probability engine
17. `balloon` - Pressure-inflation pump game
18. `step_path` - Progressive step multiplier minefield

---

## 3. Concurrency, Locking & Integrity

- **Row-Level Concurrency Control**: All financial operations lock account rows using `SELECT ... FOR UPDATE` within PostgreSQL transactions to eliminate race conditions, double-spend, and negative balances.
- **Atomic Entry & Debit**: Player entry creation and ledger debit occur in a single atomic database transaction.
- **Idempotency Guarantee**: All entries, settlements, and credit adjustments require unique idempotency keys to safely tolerate network retries without double-execution.
- **Immutable Ledger**: Credit balances are never updated in isolation; every mutation generates a corresponding append-only `ledger_transactions` audit record.

---

## 4. Provably Fair Commit-Reveal (P0-8)

To guarantee outcome integrity:
1. When a round opens (`SCHEDULED` -> `OPEN`), the system generates a cryptographically random `serverSeed` and computes `serverSeedHash = SHA256(serverSeed)`.
2. **Confidentiality Pre-Declaration**: During `OPEN`, `LOCKED`, and `RESULT_PENDING`, the raw `serverSeed` and deterministic outcomes (e.g. `crashPoint`) are concealed from all public client responses. Only the immutable `serverSeedHash` is exposed.
3. **Public Disclosure**: Upon transitioning to `RESULT_DECLARED`, `SETTLED`, or `COMPLETED`, the raw `serverSeed` is revealed, allowing players to verify that the outcome matches `SHA256(serverSeed)`.

---

## 5. Round Lifecycle State Machine

Rounds progress strictly through deterministic linear transitions:

```
SCHEDULED ──> OPEN ──> LOCKED ──> RESULT_PENDING ──> RESULT_DECLARED ──> SETTLED ──> COMPLETED
```

- `OPEN`: Player entries are accepted; server seed hash is committed.
- `LOCKED`: Entry window is closed; no further entries permitted.
- `RESULT_PENDING`: RNG calculation underway.
- `RESULT_DECLARED`: Authoritative result declared; server seed disclosed.
- `SETTLED`: Winnings credited to player accounts via ledger transactions.
- `COMPLETED`: Round archived.

---

## 6. Health & Readiness Probes

- **Liveness (`GET /health`)**: Returns `200 OK` if the Fastify process is running.
- **Readiness (`GET /ready`)**: Authoritative subsystem health check.
  - Returns `200 OK` (`status: "ready"`) when PostgreSQL connectivity is verified and all 18 game engines are loaded.
  - Returns `503 Service Unavailable` (`status: "unready"`) if PostgreSQL is unreachable or engine initialization fails.

---

## 7. Environment & Repository Modes

In production (`NODE_ENV=production`), the application strictly forbids in-memory fallback and mandates PostgreSQL / Prisma repositories.

In-memory repositories are isolated strictly for unit tests and explicitly configured test adapters (`REPOSITORY_MODE=memory`), which is actively rejected if `NODE_ENV=production`.

### Required Environment Variables

See `.env.example` for comprehensive documentation:
- `PORT` (Default: `3000`)
- `DATABASE_URL` (PostgreSQL connection string)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

---

## 8. Development & Testing

```bash
# Install dependencies
npm install

# Run all test suites
npm test

# Run isolated unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Typecheck and lint
npm run lint

# Build production bundle
npm run build
```

---

## 9. Docker Deployment

Deploy with Docker Compose:

```bash
docker compose up -d --build
```
