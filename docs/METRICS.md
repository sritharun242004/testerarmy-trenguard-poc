# TrenGuard metrics

TrenGuard reports descriptive metrics for the configured fixture and mutation
catalog. They are not a correctness proof or a universal estimate of test
quality.

## Detection rate

```text
Detected / (Detected + Missed)
```

Only applicable trials with an observed expected mutation signal are eligible
for this denominator. `FALSE_FAILURE`, `INCONCLUSIVE`, and
`NOT_APPLICABLE` are excluded.

## Survival rate

```text
Missed / (Detected + Missed)
```

This is the proportion of valid injected regressions that passed the selected
scenario despite the independently observed mutation signal.

## False-failure rate

```text
Healthy baseline failures / Healthy baseline trials
```

A failing healthy baseline invalidates interpretation for that scenario. The
runner still records the failure and does not silently call it a detection.

## Inconclusive rate

```text
Inconclusive applicable trials / All applicable trials
```

Timeouts, runner errors, cancelled runs, failed activation, missing expected
signals, and unrelated assertion failures are not detections.

## Evidence contract

Every trial records:

- scenario ID and mutation ID;
- activation marker from `/health`;
- run status and raw exit code;
- structured assertion evidence;
- expected oracle signal and whether it was observed;
- oracle source and details;
- runner output/error path;
- duration, environment, and seed.

The classifier requires the expected signal for an applicable mutation before a
failure can be classified as `DETECTED`. A failing test without that signal is
`INCONCLUSIVE` with `EXPECTED_SIGNAL_NOT_OBSERVED` or an unrelated-failure
reason.

## Cost reporting

The core Playwright runner records wall-clock duration. It does not use a model,
so model calls, tokens, and provider cost are not estimated. The optional
TesterArmy adapter reports its own runner usage separately when it exposes it.
