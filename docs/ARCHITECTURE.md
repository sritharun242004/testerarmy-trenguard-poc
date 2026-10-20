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

The browser assets are static and the route rewrites in `vercel.json` support
the two client routes on Vercel. Phase 1's JSON file is local-only because a
serverless filesystem is not a durable persistence layer. A future hosted
adapter must provide a durable store and use the same `OrderRecord` contract;
it must not silently replace the strong persistence oracle with a UI-only
success response.

## Deliberate omissions

There is no SQLite service, hosted durable store, LLM-based classifier, or
required TesterArmy `e2e` dependency. The optional adapter remains separate
and is preflight-gated.
