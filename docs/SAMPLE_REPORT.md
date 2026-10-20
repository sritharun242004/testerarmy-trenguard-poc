# TrenGuard sample observed report

This sample is copied from the actual local run recorded at
`artifacts/latest/summary.md`. It is illustrative evidence for the current
fixture and one repetition, not a claim about general test quality.

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

Regenerate it with:

```bash
pnpm proofforge run --config proofforge.config.ts
```
