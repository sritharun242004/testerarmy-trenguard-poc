# TrenGuard experiments

The deterministic runner executes a healthy baseline first, then each selected
mutation in a fresh app process and data file. The current catalog contains
M1-M6 and the runner classifies applicable trials as detected, missed, false
failure, inconclusive, or not applicable.

## Scenario S1: weak checkout test

`tests/checkout.spec.ts` places the fixed order and checks only the
`Order confirmed` status. It is intentionally insufficient for persistence.
The test is a control group for the later confirmation-without-persistence
mutation.

## Scenario S2: strong checkout test

The strong test places the same fixture order, checks the confirmation, opens
order history, verifies the exact item, quantity, customer, and `$25.98` total,
checks that there is exactly one order, and reloads the page before checking
the total again.

## Reset protocol

Every checkout test calls `POST /api/reset` before it starts. The reset
scenario also creates an order, resets it, and verifies an empty order history.
This makes cross-test contamination observable instead of relying on test
ordering or a wall-clock delay.

## M1-M6 mutation catalog

| Mutation | Expected scenario | Expected signal |
| --- | --- | --- |
| M1 | S2 | Missing order after reload |
| M2 | S2 | Total mismatch |
| M3 | S4 | Unauthorized action allowed |
| M4 | S5 | Expected result missing |
| M5 | S3 | Profile value missing after reload |
| M6 | S6 | Wrong record changed |

Each mutation is an explicit environment-selected behavior switch. Unknown
mutation IDs fail closed, and each trial gets a fresh temporary data file.

## M1: confirmation without persistence

Run the mutation proof with:

```bash
pnpm test:mutation:m1
```

The command starts a separate app process with `PROOFFORGE_MUTATION=M1`.
The `/health` response must identify `M1_ACTIVE`. Checkout still responds with
`Order confirmed`, but `GET /api/orders` remains empty and order history shows
`No orders yet`.

The M1 test proves the mutation changed the intended behavior. The weak test's
confirmation assertion would still pass under M1; the strong test's order
history assertion would fail under M1. The mutation proof intentionally checks
the expected broken outcome instead of making the overall command fail on a
known injected regression.

## Full run and reports

Run:

```bash
pnpm proofforge run --config proofforge.config.ts
```

The command writes `artifacts/latest/results.json`, `summary.md`,
`dashboard.html`, and per-trial evidence JSON. The JSON report is the source
for the Markdown and dashboard outputs; no example result is embedded in the
generator.

## Execution limits and CI diagnostics

The runner launches Node directly rather than waiting on package-manager
wrappers. Each trial logs its start and final status. The optional `timeouts`
object in `proofforge.config.ts` accepts positive integer milliseconds:

| Setting | Default | Boundary |
| --- | --- | --- |
| `startupMs` | 10000 | App readiness, including stalled health response bodies |
| `scenarioMs` | 60000 | Scenario process and output-pipe completion |
| `requestMs` | 5000 | Each oracle or health HTTP request |
| `shutdownMs` | 2000 | Each graceful/forced child-shutdown wait |

Timeouts and failed cleanup are not detections. SIGINT/SIGTERM stop new trials,
clean up the current trial, and write the results gathered so far. Do not treat
a partial report as a full matrix run.

GitHub Actions has a ten-minute benchmark-step limit and a fifteen-minute core
job limit. The workflow retains fixture-only report/evidence files as a
seven-day Actions artifact, including available evidence after failure. It
does not upload environment files, local data stores, or recordings. Local
generated artifacts remain git-ignored.

## What is not claimed

The rates describe only this small deterministic fixture and mutation set. They
are not a universal estimate of software quality or a correctness proof.
