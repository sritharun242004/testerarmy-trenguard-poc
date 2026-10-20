# TrenGuard

TrenGuard measures whether end-to-end tests verify a business outcome instead
of only checking that a success message appeared. It runs a deterministic
healthy baseline, activates controlled regressions, and reports which scenarios
detected or missed them.

The supplied specification is the source of truth for this project:
`Prooforge Spec - TesterArmy.md`. The local implementation includes the
deterministic Playwright benchmark, six reviewed mutations, classification,
metrics, JSON/Markdown reports, a static dashboard artifact, and an optional
TesterArmy `e2e` adapter with runtime preflight.

## Public project identity

- **Product name:** TrenGuard
- **Tagline:** Measure whether tests catch real regressions.
- **Planned repository:** `testerarmy-proofforge-poc`
- **Internal package and CLI:** `proofforge` (kept stable to avoid unnecessary
  renaming of the benchmark's technical interfaces)

## Application result

The demo supports this local flow:

1. Open `/checkout`.
2. Place the fixed `TrenGuard Notebook` fixture order for Ada Lovelace.
3. Open `/orders` and verify the order, line item, quantity, and `$25.98`
   total after a reload.
4. Reset state through the UI or `POST /api/reset`.

Additional deterministic surfaces support settings persistence, protected admin
access, catalog search, and selected-record isolation for S3-S6.

The app stores local orders in `data/orders.json`. The test suite resets that
file through the local API before each scenario, so the test order is stable
and does not depend on previous runs.

## Quickstart and benchmark

Requirements:

- Node.js 22.19.0 or newer for this local Phase 1 project.
- pnpm 12.9.1 (or a compatible pnpm 12 release).

```bash
pnpm install
pnpm exec playwright install chromium
pnpm check
pnpm benchmark
```

The Playwright configuration starts the app on `http://127.0.0.1:4173` and
stops it after the run. To use the application manually:

```bash
pnpm dev
# open http://127.0.0.1:4173/checkout
```

Useful checks:

```bash
pnpm check
pnpm benchmark
pnpm typecheck
pnpm build
pnpm test:unit
pnpm test:mutation:m1
pnpm test:headed
pnpm proofforge list-mutations
pnpm proofforge validate-config
pnpm proofforge report --input artifacts/latest/results.json
pnpm proofforge dashboard --input artifacts/latest/results.json
pnpm proofforge e2e-status
```

`test:headed` is useful when walking through the contrast between the two
tests. The weak test is intentionally labelled `weak-example`; it only checks
the confirmation status and is not a recommended production test pattern.

## Design direction

The UI follows the BotStudioX reference at
`/Users/tharunkumarl/Full Stack/bot X studio/studiox-main`, especially
`design-system/botstudiox/MASTER.md` and the application's `styles.css`:

- playful indigo primary with emerald action color;
- warm off-white canvas, strong ink borders, flat surfaces, and offset shadows;
- Outfit for display type and Plus Jakarta Sans for body text;
- pill navigation/buttons, 8/16/24px corner radii, and visible focus states;
- simple responsive layouts with reduced-motion support.

This is a focused product UI, not a dashboard. The visual system makes the
verification path legible without adding visual complexity to the experiment.

## Vercel hosting plan

The UI is plain static HTML/CSS/JavaScript under `public/`, which keeps the
presentation deployable as a Vercel static project without changing the local
Playwright target. `/checkout` and `/orders` are covered by `vercel.json` SPA
rewrites.

The filesystem-backed API is deliberately the Phase 1 local benchmark
implementation. Vercel's serverless filesystem is not a durable database, so
the benchmark does not claim that a Vercel preview is a reliable persistence
oracle. Before deploying a hosted benchmark, add an explicit storage adapter
(for example, a Vercel-supported database) and rerun the persistence tests
against that environment. That is a later integration decision, not hidden in
Phase 1.

## Test scenarios

| ID | Label | What it verifies |
| --- | --- | --- |
| S1 | `weak-example` | The confirmation status appears after checkout. |
| S2 | `strong-example` | The order persists with the exact line item, quantity, customer, and total after reload; exactly one order exists. |
| S3 | `settings-persistence` | The saved preferred name survives reload. |
| S4 | `authorization` | The normal fixture user is rejected from the admin summary. |
| S5 | `search-correctness` | The expected matching product is present. |
| S6 | `wrong-record-isolation` | Only the selected stable-ID record changes. |
| S-reset | reset behavior | Reset clears persisted orders and leaves the fixture catalog unchanged. |

Mutation catalog: M1 confirmation without persistence; M2 incorrect total;
M3 unauthorized admin access; M4 search omission; M5 non-persisting profile
save; M6 wrong-record action.

The full benchmark runs every configured scenario against the healthy baseline
and M1-M6. It writes:

```text
artifacts/latest/results.json
artifacts/latest/summary.md
artifacts/latest/dashboard.html
artifacts/latest/evidence/*.json
```

The weak/strong contrast can also be exercised directly against M1 with:

```bash
pnpm test:mutation:m1
```

That command starts a separate app instance with
`PROOFFORGE_MUTATION=M1`. The mutation exposes `M1_ACTIVE` through `/health`,
returns checkout success, and deliberately leaves order history empty.

The benchmark report records exact counts and denominators from the observed
run; it does not hard-code example numbers.

## Repository map

```text
src/fixtures.ts       Fixed products and checkout input.
src/mutations.ts      Stable mutation registry and M1-M6 activation contracts.
src/store.ts          File-backed order store and reset behavior.
src/server.ts         Loopback HTTP server and JSON/static routes.
src/benchmark/        Runner, classifier, metrics, reports, and dashboard.
scripts/proofforge.ts CLI for run/report/list/validation.
public/               Vercel-friendly UI assets.
tests/checkout.spec.ts Weak and strong checkout scenarios.
tests/reset.spec.ts   Reset and fixture stability checks.
tests/unit/           Mutation, store, classifier, and metrics unit tests.
benchmark-tests/      Six scenario definitions used by the runner.
mutation-tests/       M1 behavior proof against a mutated app instance.
testerarmy-tests/     Optional current-API e2e adapter example.
docs/                 Reconnaissance, architecture, and scope notes.
```

## TesterArmy e2e integration

The optional adapter is deliberately independent of the core runner. Run:

```bash
pnpm proofforge e2e-status
```

The exact `e2e@0.21.2` / `@e2e-dev/web@0.15.2` pair is installed as an optional
dev dependency. The default Node `v22.19.0` shell is below the current
TesterArmy floor, but the locally available Node `v24.19.0` passes preflight.
Run the optional adapter with a supported Node runtime:

```bash
PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH" pnpm test:e2e:optional
```

The adapter was run successfully with Node `v24.19.0`, Chromium, and no model
calls because the test uses deterministic locators/assertions only. See
`docs/REPLAY_SAFETY.md`. No credentials or model calls are required by the
core benchmark.

## Vercel limitation

The UI is static-file/Vercel-friendly, but the JSON file store is local-only.
Vercel serverless filesystems are not a durable persistence oracle. Before
using a hosted preview for benchmark claims, add a durable Vercel-supported
storage adapter and rerun the same persistence scenarios against it.
