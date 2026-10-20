# TrenGuard

[![TrenGuard checks](https://github.com/sritharun242004/testerarmy-trenguard-poc/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sritharun242004/testerarmy-trenguard-poc/actions/workflows/ci.yml)

**A checkout test passes, but no order was saved. Does your test catch that?**

TrenGuard is a local, deterministic benchmark for E2E verification strength.
Its central experiment injects **M1: confirmation without persistence** into a
fixture storefront. Both tests pass against the healthy app; under M1:

| Scenario | What it checks | Observed M1 result |
| --- | --- | --- |
| **S1 — `weak-example`** | Only the `Order confirmed` success banner. | **PASS → MISSED**, despite zero persisted orders. |
| **S2 — `strong-example`** | Order history, exact item/quantity/customer/total, exactly one order, and the total again after reload. | **FAIL → DETECTED**, because the order is missing. |

S2 includes persistence verification after reload. In this recorded M1 trial it
catches the regression earlier: the first order-history assertion expects one
order and receives zero, so the reload step is not reached. The separate
`GET /api/orders` oracle confirms `orderCount: 0` for both M1 trials.

**Inspect the evidence:** [sanitized M1 excerpt](docs/SAMPLE_REPORT.md#m1-evidence)
· [S1/S2 test source](benchmark-tests/scenarios.spec.ts#L8-L29)
· [M1 definition](src/mutations.ts#L49-L61).

- **Repository:** https://github.com/sritharun242004/testerarmy-trenguard-poc
- **Read without running:** [observed report summary](docs/SAMPLE_REPORT.md).
- **Try the storefront:** https://testerarmy-trenguard-poc.vercel.app/checkout
  — a cookie-backed walkthrough, **not the local benchmark report**.

## What the recorded run shows

One curated local Playwright run, seed `proofforge-phase-4`, one repetition:

| Measure | Observed result |
| --- | --- |
| Detected / valid applicable scenario–mutation pairs | **6 / 7 = 85.7%** |
| Missed / valid applicable pairs | **1 / 7 = 14.3%** |
| Healthy-baseline false failures | **0 / 6** |
| Inconclusive applicable pairs | **0 / 7** |
| Not-applicable pairs | **29**, excluded from detection rate |

The denominator is **seven scenario–mutation pairs, not seven distinct bugs**:
M1 is evaluated with S1 and S2; M2–M6 each have one applicable scenario.
The full run executes six healthy baselines and 36 mutation pairs. See the
[pair-by-pair sample](docs/SAMPLE_REPORT.md#applicable-pairs) and
[metric definitions](docs/METRICS.md).

These are observations from one small, hand-picked fixture and catalog—not
universal accuracy, a correctness guarantee, or TesterArmy performance.
[GitHub run 39433113320](https://github.com/sritharun242004/testerarmy-trenguard-poc/actions/runs/39433113320)
also completed successfully on Linux: 42 trials with the same classifications,
plus the separate optional TesterArmy job. That is a second reproducibility
check, not a larger or more representative mutation catalog.

## Reproduce locally

From the repository root, use Node.js 22.19.0+ for the core benchmark and
pnpm 12.9.1. The optional TesterArmy example has a higher Node requirement
described below. No model credentials are needed for the core run.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm benchmark
```

`pnpm benchmark` runs `pnpm proofforge run --config proofforge.config.ts`.
The runner starts an isolated loopback app process and temporary JSON store
for each trial. It writes these **local, git-ignored** outputs:

```text
artifacts/latest/summary.md       Human-readable results
artifacts/latest/results.json     Trial statuses, classifications, and metrics
artifacts/latest/dashboard.html   Local report viewer
artifacts/latest/evidence/*.json  Health markers, runner output, and API oracle
```

Open `summary.md` or `dashboard.html` locally, then follow each result's
`evidence.runnerOutput` path in `results.json` to the evidence JSON. The
[sanitized sample](docs/SAMPLE_REPORT.md) makes the recorded summary readable
on GitHub. Local artifacts stay out of git; the CI workflow separately retains
its fixture-only report and evidence as a seven-day Actions artifact.

To isolate just the M1 contrast, including healthy S1/S2 baselines:

```bash
pnpm proofforge run --config proofforge.config.ts --scenario S1 --scenario S2 --mutation M1 --output artifacts/m1
```

Read `artifacts/m1/summary.md` for the two classifications. This focused run
has two applicable pairs; the **6/7** figure belongs to the full run above.
The CLI supports repeated `--scenario` options; see the
[argument parser](scripts/proofforge.ts) and [default config](proofforge.config.ts).
Inspect the classifications rather than relying on the process exit code alone.

Run the project's checks with:

```bash
pnpm check
```

This includes `pnpm test:mutation:m1`, a standalone proof that M1 returns
success without saving. That proof asserts the intentionally broken state;
use the benchmark command for the actual `MISSED`/`DETECTED` comparison.

## How the experiment works

1. [Scenarios S1–S6](benchmark-tests/scenarios.spec.ts) reset fixed fixture data
   before each test. S1 is a deliberately weak control, not a production pattern.
2. The [runner](src/benchmark/runner.ts) runs healthy baselines, then the
   [M1–M6 registry](src/mutations.ts): missing order, wrong total, unauthorized
   admin access, search omission, dropped profile save, and wrong-record update.
3. Each trial records its activation marker, test status, and a separate API
   oracle. For M1, that oracle reads persisted order history.
4. The [classifier](src/benchmark/classifier.ts) uses baseline status,
   applicability, activation, run status, and the observed mutation signal.
   [Metrics](src/benchmark/metrics.ts) and [reports](src/benchmark/report.ts)
   derive from those recorded results.

The local app uses a [JSON-file store](src/store.ts) and Chromium tests.
The catalog is intentionally small. See [architecture](docs/ARCHITECTURE.md),
[experiment protocol](docs/EXPERIMENTS.md), and [limitations](docs/LIMITATIONS.md).
The internal package/CLI remains `proofforge`; the configuration remains
`proofforge.config.ts`.

## TesterArmy relevance and next experiment

This PoC asks how much evidence a passing test provides about a business
outcome—a useful question for agent-generated tests. The optional
[TesterArmy checkout example](testerarmy-tests/checkout.e2e.ts) uses
**deterministic locators/assertions only** with `e2e@0.21.2` and
`@e2e-dev/web@0.15.2`. Its [config](testerarmy.e2e.config.ts) disables caching.
It is a standalone compatibility example, **not an `agent.act()` or replay
evaluation**, and is not part of the 6/7 Playwright report. **No defect in
TesterArmy has been proven.**

[Prior local compatibility notes](docs/REPLAY_SAFETY.md) record one passing
test under Node 24.19.0. The optional runtime requires Node
`^22.22.3 || >=24.8.0`; check the installed environment with:

```bash
pnpm proofforge e2e-status
```

**Next experiment (not yet run):** extend the standalone `e2e` checkout example
with one fixed `agent.act()` checkout instruction and two verifier variants:
banner-only and persisted-history-after-reload. Run each on the healthy app
and M1 with fresh state and caching off; compare test outcomes with the
independent order API count. This tests whether the observed assertion-strength
contrast carries over to an agent-driven checkout while keeping the business
outcome measurable.

## Storefront walkthrough

On the [live app](https://testerarmy-trenguard-poc.vercel.app/checkout), place
the fixed `TrenGuard Notebook` order for Ada Lovelace, open order history,
check two units and `$25.98`, then reload. The hosted
[API](api/demo.ts) keeps short-lived, per-browser state in an HttpOnly cookie;
it is a UI walkthrough, not durable multi-user storage or benchmark evidence.
The local benchmark uses the filesystem-backed API instead. See
[hosting details](docs/VERCEL_DEMO.md).

For the same walkthrough locally, run `pnpm dev` and open
`http://127.0.0.1:4173/checkout`.
