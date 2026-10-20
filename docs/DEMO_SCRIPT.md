# TrenGuard demo script

Target duration: 90–120 seconds.

## 0–15 seconds: frame the problem

“AI agents can write code and tests, but a green test can still miss a broken
business outcome. TrenGuard measures whether a test catches the regression it
is supposed to catch.”

## 15–35 seconds: show healthy checkout

Run the healthy checkout flow. Place the fixed order, open order history, show
the exact `$25.98` total, and reload.

```bash
pnpm test -- --grep 'S2 strong-example'
```

Mention that the core flow is local, deterministic, and does not require model
credentials.

## 35–55 seconds: show the weak test miss

Run M1. The app reports `M1_ACTIVE`; checkout still shows `Order confirmed`,
but the order is absent from history. The weak scenario is classified as
`MISSED` because it checks only the confirmation status.

```bash
pnpm test:mutation:m1
```

## 55–75 seconds: show the strong test detection

Point at the strong order-history assertion. It fails against the same M1
mutation because the business outcome is missing. The benchmark classifies it
as `DETECTED` only after the independent order oracle confirms the expected
signal.

## 75–95 seconds: show the report

```bash
pnpm proofforge run --config proofforge.config.ts
```

Open:

- `artifacts/latest/summary.md`
- `artifacts/latest/dashboard.html`

Show exact counts, denominators, M1 weak-versus-strong results, and an evidence
file. Lead with the concrete M1 contrast; present percentages as descriptive
results for this fixture and mutation catalog.

## 95–120 seconds: connect to TesterArmy

“TesterArmy makes agent interaction practical. TrenGuard measures whether the
resulting test provides trustworthy evidence.”

If using the optional adapter, run it under a supported Node runtime:

```bash
PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH" pnpm test:e2e:optional
```

Be precise: this deterministic adapter proves public API compatibility. A live
replay-safety result requires an agent model/subscription and should only be
shown after it has actually been run.
