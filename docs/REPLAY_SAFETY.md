# Optional TesterArmy e2e and replay-safety path

TrenGuard keeps the deterministic Playwright benchmark independent of
TesterArmy's `e2e` package. The optional adapter files are present, but their
execution is gated by a preflight check.

## Current verified constraint

The current stable public pair is:

- `e2e@0.21.2`
- `@e2e-dev/web@0.15.2`
- Node `^22.22.3 || >=24.8.0`

This workspace's default shell runs Node `v22.19.0`, below the TesterArmy
floor, but Node `v24.19.0` is also installed. The exact packages are installed
as optional dev dependencies. Therefore the preflight is unavailable under
the default Node shell and available under Node `v24.19.0`.

## Adapter files

- `testerarmy.e2e.config.ts` pins a no-cache Chromium target at the local
  demo URL.
- `testerarmy-tests/checkout.e2e.ts` uses the currently documented public
  `@e2e-dev/web` and `e2e` APIs for the strong checkout journey.
- `src/optional-e2e.ts` checks the Node floor and exact package versions before
  an integration runner is allowed to proceed.

After switching to a supported Node version, the optional command is:

```bash
PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH" pnpm test:e2e:optional
```

The deterministic benchmark does not depend on this command.

Verified result: Node `v24.19.0`, `e2e@0.21.2`, and
`@e2e-dev/web@0.15.2` completed the strong checkout adapter with one passing
test, Chromium `156.0.8078.4`, zero model calls, and exit code `0`. An initial
attempt failed because `browser.evaluate()` was called before `app.open()`;
the test was corrected to open the app first and rerun successfully.

## Replay experiment protocol

The replay experiment is intentionally separate from mutation detection:

1. Run a deterministic agent step with a later locator assertion so a replay
   recording can be written.
2. Repeat with identical route, account, viewport, and data state.
3. Change exactly one context variable, such as list order or persisted state.
4. Record cache mode, handoff/refusal, final business state, and any wrong
   entity selection.
5. Prefer safe refusal or handoff over a wrong successful action.

This project does not fabricate replay success, model calls, token counts, or
costs when the optional runtime and credentials are unavailable.
