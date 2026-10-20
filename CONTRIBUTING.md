# Contributing to TrenGuard

TrenGuard is an experiment-first local benchmark. Changes should preserve
determinism, explicit evidence, and honest scope.

## Development loop

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm proofforge run --config proofforge.config.ts
```

Use Node 22.19.0+ for the core project. The optional TesterArmy adapter needs
Node `^22.22.3 || >=24.8.0` and the pinned packages documented in
`docs/REPLAY_SAFETY.md`.

## Rules

- Keep mutation definitions reviewed TypeScript; do not execute arbitrary
  commands from configuration.
- Keep trials isolated and sequential unless isolation is proven first.
- Add a test for every behavior change.
- Never count a timeout, runner crash, missing oracle, or unrelated assertion
  failure as a detection.
- Do not commit `data/`, `artifacts/`, `.e2e/`, test recordings, `.env` files,
  credentials, or local order data.
- Keep the Playwright benchmark independent from optional TesterArmy/model
  credentials.
