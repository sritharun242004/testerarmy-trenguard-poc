# TrenGuard architecture

TrenGuard uses a static browser UI, a small JSON API, and a sequential
experiment runner. Each trial starts an isolated app process with a fresh
temporary JSON data file.

```text
Playwright tests ───────────────┐
                                ▼
                     Loopback HTTP server
                     │       │
                     │       └── public/index.html + app.js + styles.css
                     ▼
               Mutation activation
                      ▼
                  OrderStore ─── trial data file
                      ▼
              Scenario runner + classifier
                      ▼
                JSON / Markdown / HTML
```

## Application boundary

- `src/fixtures.ts` owns the stable catalog and checkout input. Prices are
  integer cents, so the strong test has no floating-point ambiguity.
- `src/mutations.ts` owns the reviewed M1-M6 mutation registry. A mutation is
  activated only by the explicit `PROOFFORGE_MUTATION` environment variable;
  an unknown ID fails closed at startup. The `/health` marker makes activation
  observable.
- `src/store.ts` owns the order record shape, deterministic order IDs, and
  atomic JSON-file writes. `reset()` replaces the order collection with an
  empty collection and preserves the fixture catalog. Mutations reuse the same
  business paths while changing one explicit behavior.
- `src/server.ts` binds to `127.0.0.1` by default and exposes `/health`,
  `/api/fixtures`, orders, profile, authorization, search, records, and
  `/api/reset`.
- `src/benchmark/runner.ts` executes baseline and mutation trials sequentially,
  captures health markers and runner evidence, and cleans up child processes.
- `src/benchmark/process.ts` launches Node directly, drains bounded diagnostic
  output, and owns the child process group on POSIX. Startup, scenario execution,
  oracle requests, and shutdown have deadlines. An exited test process whose
  descendants retain output pipes cannot leave the runner waiting forever.
  Cleanup failures invalidate the trial instead of preserving a pass.
- `src/benchmark/classifier.ts` is a pure classifier that does not count
  baseline failures, runner errors, or timeouts as detections.
- `src/benchmark/metrics.ts`, `report.ts`, and `dashboard.ts` generate
  observed metrics and evidence-linked artifacts.
- `public/app.js` renders checkout and order history from the API. It does not
  calculate the persisted order total; it displays the server's recorded
  result and the client-side expected preview separately.
- `tests/` drives the real browser flow with Playwright role and label
  locators.

## Vercel boundary

The static UI and all six client routes are served on Vercel. The separate
`api/demo.ts` handler provides a recruiter walkthrough using one-hour,
browser-scoped cookie state. The UI explicitly labels this as a demo, not the
benchmark. Cookie values are bounded and validated, but unsigned and not
authoritative; there are no real accounts or payments.

The local benchmark still uses `OrderStore` and JSON files, never the cookie
adapter. Hosted benchmark claims would require durable server-side storage
and independent verification. See `VERCEL_DEMO.md` for deployment boundaries.

## Deliberate omissions

There is no SQLite service, hosted durable store, LLM-based classifier, or
required TesterArmy `e2e` dependency. The optional adapter remains separate
and is preflight-gated.
