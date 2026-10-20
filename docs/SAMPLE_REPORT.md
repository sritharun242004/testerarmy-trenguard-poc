# TrenGuard sample observed report

This is a sanitized excerpt of the actual local `artifacts/latest/summary.md`,
`results.json`, and M1 evidence files. It makes the recorded results readable
on GitHub without publishing raw local artifacts. Machine-specific absolute
paths and screenshot references are omitted; counts, IDs, statuses, oracle
values, and the assertion failure below come from that run.

## Run provenance

- Experiment: `checkout-verification`
- Started: `2026-10-20T13:38:19.219Z`
- Duration: `266466 ms` (whole experiment; not a performance claim)
- Runner: `playwright`; Node `v22.19.0`; platform `darwin-arm64`
- Seed: `proofforge-phase-4`; repetitions: `1`
- Configuration: [proofforge.config.ts](../proofforge.config.ts)

These figures describe **one curated run across applicable scenario–mutation
pairs**, not universal accuracy, a statistical estimate of software quality,
or TesterArmy performance. TesterArmy's optional example is not in this report.

## Observed summary

```text
Runner: playwright
Seed: proofforge-phase-4
Repetitions: 1

Detection rate: 6 / 7 = 85.7%
Survival rate: 1 / 7 = 14.3%
False-failure rate: 0 / 6 = 0.0%
Inconclusive rate: 0 / 7 = 0.0%

DETECTED 6
MISSED 1
FALSE_FAILURE 0
INCONCLUSIVE 0
NOT_APPLICABLE 29

S1 weak-example + M1: MISSED
S2 strong-example + M1: DETECTED
```

Six healthy baselines passed. Of the 36 mutation pairs executed, seven were
applicable and 29 were classified `NOT_APPLICABLE`. Detection rate is
`DETECTED / (DETECTED + MISSED)`; false failures, inconclusive trials, and
not-applicable pairs are excluded. See [metric definitions](METRICS.md).

## Applicable pairs

| Scenario | Mutation | Run status | Classification |
| --- | --- | --- | --- |
| S1 | M1 — confirmation without persistence | PASS | MISSED |
| S2 | M1 — confirmation without persistence | FAIL | DETECTED |
| S2 | M2 — incorrect total | FAIL | DETECTED |
| S4 | M3 — unauthorized admin access | FAIL | DETECTED |
| S5 | M4 — search omission | FAIL | DETECTED |
| S3 | M5 — dropped profile save | FAIL | DETECTED |
| S6 | M6 — wrong-record action | FAIL | DETECTED |

There are six mutations, not seven: M1 has two applicable scenarios. The
[registry](../src/mutations.ts) defines applicability before execution.

## M1 evidence

The healthy `S1-baseline-r1` and `S2-baseline-r1` trials both recorded `PASS`,
exit code `0`, and `HEALTHY_BASELINE`. Under M1:

| Recorded field | S1-M1-r1 | S2-M1-r1 |
| --- | --- | --- |
| Health mutation marker | `M1_ACTIVE` | `M1_ACTIVE` |
| Run status / raw exit code | `PASS` / `0` | `FAIL` / `1` |
| Classification | `MISSED` | `DETECTED` |
| Reason | `MUTATION_SURVIVED` | `EXPECTED_ASSERTION_FAILED` |
| Oracle source | `GET /api/orders` | `GET /api/orders` |
| Oracle signal | `ORDER_MISSING_AFTER_RELOAD` | `ORDER_MISSING_AFTER_RELOAD` |
| Oracle observed / order count | `true` / `0` | `true` / `0` |

S1's runner output records `1 passed`. S2's output contains this assertion
failure (excerpt):

```text
Error: expect(locator).toHaveCount(expected) failed
Locator:  getByRole('listitem').filter({ hasText: 'TrenGuard Notebook' })
Expected: 1
Received: 0
```

[S1 checks only the confirmation](../benchmark-tests/scenarios.spec.ts#L8-L12).
[S2 verifies order history and the total after reload](../benchmark-tests/scenarios.spec.ts#L14-L29),
but this M1 trial fails at the first history assertion, before reaching reload.
`ORDER_MISSING_AFTER_RELOAD` is the stable oracle signal identifier; its name
does not mean either M1 trial reached a reload. The
[oracle implementation](../src/benchmark/runner.ts) independently reads
`GET /api/orders` after the scenario.

Local evidence paths for inspection after a full run:

```text
artifacts/latest/results.json
artifacts/latest/evidence/S1-baseline-r1.json
artifacts/latest/evidence/S2-baseline-r1.json
artifacts/latest/evidence/S1-M1-r1.json
artifacts/latest/evidence/S2-M1-r1.json
```

These raw files are git-ignored and are not hosted by the
[cookie-backed storefront demo](https://testerarmy-trenguard-poc.vercel.app/checkout).

## Reproduce

After the [README setup steps](../README.md#reproduce-locally), regenerate the
full local report with:

```bash
pnpm proofforge run --config proofforge.config.ts
```

This writes a new local report; the sample above records the identified local
run. [GitHub run 39433113320](https://github.com/sritharun242004/testerarmy-trenguard-poc/actions/runs/39433113320)
separately completed the same 42-trial matrix on Linux with matching metrics
and M1 classifications. Its benchmark took `97434 ms`; its entire core job
took 2m41s. The optional TesterArmy job also passed. These runs confirm the
observed result across those two environments, not general accuracy.
