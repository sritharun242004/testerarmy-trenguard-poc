# TrenGuard

## Product Research, Technical Specification, Architecture, and Claude Code Build Instructions

**Document version:** 1.0\
**Prepared:** 19 October 2026\
**Project type:** Hiring-focused engineering PoC\
**Primary audience:** Claude Code, project implementer, technical
reviewers\
**Target ecosystem:** TesterArmy's open-source `e2e` framework\
**Recommended implementation window:** 5--10 focused days for a credible
MVP; additional time for rigorous experiments

------------------------------------------------------------------------

# 1. Executive Summary

TrenGuard is a reproducible benchmark for measuring whether end-to-end
(E2E) tests actually detect meaningful application regressions---and
whether recorded/replayed agent actions remain safe when the application
or its data changes.

The core question is:

> **When an AI coding agent says a feature works and its E2E test
> passes, what evidence do we have that the test would catch a real
> regression?**

TrenGuard answers this by combining:

1.  A small, deterministic demo application with known behavior.
2.  Controlled fault injection ("mutations") that introduce known
    regressions.
3.  A test runner that executes a baseline suite against the healthy
    application and mutated variants.
4.  Outcome classification that distinguishes detected bugs, missed
    bugs, false failures, and inconclusive infrastructure failures.
5.  An optional replay-safety experiment using TesterArmy's `e2e`
    framework to assess whether replayed actions remain valid when list
    contents, account identity, or application state changes.
6.  A report that links every conclusion to test results and evidence.

This is not intended to be another generic AI testing dashboard or a
replacement for `e2e`. It is a small, measurable research and
engineering tool that evaluates the quality and reliability of
verification.

## Recommended project positioning

**Name:** TrenGuard\
**Tagline:** *Measure whether your tests catch the bugs that matter.*\
**Repository:** `testerarmy-trenguard-poc`

**Primary PoC:** Adversarial verification / mutation benchmark for E2E
tests.\
**Stretch feature:** Replay-safety experiments with `e2e`.\
**Avoid:** Building a generic chatbot, generic test generator, or
unsupported claims that TrenGuard proves software is correct.

------------------------------------------------------------------------

# 2. Company and Product Context

## 2.1 Why this problem matters to TesterArmy

TesterArmy's public hiring post says AI agents now write a substantial
amount of code, but there is not yet a good way to check that the code
actually works. Its open-source project, `e2e`, combines agent-driven
actions with deterministic locators and assertions, and supports web and
mobile testing.

Public references to review before implementation:

-   `e2e` repository: https://github.com/tester-army/e2e
-   Introduction to `e2e`: https://tester.army/blog/introducing-e2e
-   Replay/cache documentation:
    https://github.com/tester-army/e2e/blob/main/docs/cache.mdx
-   Contributor guide:
    https://github.com/tester-army/e2e/blob/main/CONTRIBUTING.md
-   Agent instructions:
    https://github.com/tester-army/e2e/blob/main/AGENTS.md
-   Current issues: https://github.com/tester-army/e2e/issues
-   Current pull requests: https://github.com/tester-army/e2e/pulls

Re-check these links at build time. The framework is actively developed;
public APIs, issues, docs, and PR status may change.

## 2.2 Relevant `e2e` concepts

The public documentation describes a framework that combines:

-   Natural-language agent actions such as `agent.act(...)`.
-   Deterministic locators and assertions.
-   Browser and mobile execution engines.
-   Replay caching for previously verified agent actions.
-   Handoffs from replay to a live agent when replay cannot safely
    continue.
-   Test reports and trace information.

The cache documentation explains that recorded actions are associated
with a later verification step. Replay checks the starting context,
locates controls, performs actions, and checks resulting state. If
replay cannot safely establish that the expected behavior occurred, it
can stop or hand control to the agent, depending on configuration.

These features make replay safety and test effectiveness relevant
research areas. TrenGuard must **evaluate** behavior rather than assume
that `e2e` is defective.

## 2.3 Product hypothesis

A passing test suite is not sufficient evidence of strong verification.
Tests may: - Assert only that a success message appears. - Miss
persistence, authorization, calculation, or state-transition bugs. -
Pass on the healthy application but also pass after a meaningful bug is
introduced. - Fail because of environmental instability rather than an
application regression. - Reuse recorded actions after context changes
in a way that requires careful validation.

TrenGuard tests these hypotheses experimentally.

## 2.4 What is fact and what is hypothesis?

**Publicly documented facts:** `e2e` combines agent actions and
deterministic assertions; it has a replay cache; the project supports
web and mobile; its repository is actively developed.

**TrenGuard hypotheses to test:** stronger outcome assertions improve
regression detection; specific state/context changes expose unsafe
replay assumptions; some tests pass despite injected business-logic
regressions; hybrid strategies can reduce model calls while preserving
detection rates.

Do not state these hypotheses as proven until experiments support them.

------------------------------------------------------------------------

# 3. Goals, Non-Goals, and Success Criteria

## 3.1 Goals

1.  Provide a one-command, reproducible local benchmark.
2.  Start with one small web application and 5--8 controlled mutations.
3.  Run the same test scenarios against a healthy baseline and mutated
    variants.
4.  Classify results accurately and avoid counting crashes/timeouts as
    successful detections.
5.  Produce a machine-readable JSON report and a human-readable Markdown
    summary.
6.  Include evidence for each result: scenario ID, mutation ID, run
    status, assertion outcome, error, duration, and relevant logs.
7.  Demonstrate at least one weak test that misses a real regression and
    one stronger test that catches it.
8.  Keep the MVP deterministic and cheap; no paid model/API key should
    be required for the core benchmark.
9.  Make integration with TesterArmy `e2e` possible without hard-coding
    assumptions about unstable APIs.
10. Document limitations, reproduction instructions, and next
    experiments.

## 3.2 Non-goals for MVP

-   Proving an application is correct.
-   Automatically finding every possible bug.
-   Replacing TesterArmy `e2e`.
-   Building a production multi-tenant SaaS platform.
-   Running untrusted pull-request code or mutations against production
    systems.
-   Requiring cloud infrastructure, paid LLM APIs, or mobile simulators.
-   Building a general-purpose test-generation agent.
-   Claiming statistical significance from a tiny number of trials.
-   Modifying TesterArmy's repository directly as part of the standalone
    PoC.
-   Treating LLM-generated explanations as ground truth.

## 3.3 MVP success criteria

The MVP is complete when:

-   [ ] A fresh clone can install dependencies and run the demo using
    documented commands.
-   [ ] The healthy application passes the baseline test suite.
-   [ ] At least five deterministic mutations are implemented.
-   [ ] At least one deliberately weak test misses a known regression.
-   [ ] At least one stronger test detects that same regression.
-   [ ] Results distinguish `DETECTED`, `MISSED`, `FALSE_FAILURE`, and
    `INCONCLUSIVE`.
-   [ ] JSON and Markdown reports are generated.
-   [ ] Each report result links to the scenario, mutation, and
    evidence.
-   [ ] Re-running the same experiment with the same seed yields
    equivalent classification.
-   [ ] No secret, credential, or production data is required.
-   [ ] The README contains architecture, setup, sample output,
    limitations, and demo instructions.

## 3.4 Stretch success criteria

-   [ ] Optional `e2e` runner adapter.
-   [ ] Replay-context experiment with changed list order or account.
-   [ ] Repeated runs and aggregate confidence intervals for
    timing/detection metrics.
-   [ ] A small dashboard generated from report JSON.
-   [ ] A comparison between weak UI-only assertions and stronger
    business-outcome assertions.
-   [ ] A CI workflow running the deterministic benchmark.

------------------------------------------------------------------------

# 4. The Product Concept

## 4.1 User story

As an engineer reviewing AI-generated code, I want to know whether my
E2E tests detect realistic regressions, so that a green test run is
meaningful evidence rather than false confidence.

## 4.2 Core workflow

1.  Start the demo application in a known state.
2.  Run the baseline suite.
3.  Verify that the healthy application is behaving as expected.
4.  Select a mutation, for example "show checkout success without
    persisting an order."
5.  Create an isolated mutated application instance or switch a
    controlled feature flag.
6.  Run the same test scenario against the mutated behavior.
7.  Classify the result using explicit rules.
8.  Save test output, timing, errors, and evidence.
9.  Repeat for all configured mutations.
10. Generate a report that explains what the suite detected and missed.

## 4.3 Example

The demo application is a small checkout/order-management app.

Healthy behavior: - A customer submits an order. - The server persists
the order. - The confirmation screen appears. - The order appears in
order history after reload.

Injected regression: - The UI still displays "Order confirmed." - The
server does not persist the order.

Weak test: - Clicks "Place order." - Asserts that the confirmation
banner is visible. - This test may pass even though the order is
missing.

Strong test: - Places the order. - Navigates to order history or queries
an explicitly allowed test oracle. - Verifies the order exists with the
correct total and line items. - This should fail against the mutated
implementation.

This is the central demo. It illustrates why a successful UI action is
not equivalent to a verified business outcome.

------------------------------------------------------------------------

# 5. Scope and Feature Priorities

## P0 --- Required for first usable version

1.  Demo application.
2.  Mutation registry and mutation runner.
3.  Baseline test scenarios.
4.  Deterministic execution and state reset.
5.  Result classifier.
6.  JSON report schema.
7.  Markdown report generator.
8.  CLI commands.
9.  Unit and integration tests.
10. README and architecture documentation.

## P1 --- Required to make the PoC compelling

1.  Weak-versus-strong assertion comparison.
2.  At least five mutation types.
3.  Evidence-linked result details.
4.  Repeated-run support.
5.  Clear handling of timeouts and infrastructure failures.
6.  Benchmark summary with detection rate and false-failure rate.
7.  CI execution.

## P2 --- Stretch, only after P0/P1 are reliable

1.  TesterArmy `e2e` adapter.
2.  Replay-safety experiment.
3.  Optional local dashboard.
4.  Test impact selection from code changes.
5.  Cost/latency optimization.
6.  Cross-browser or mobile experiments.

Do not start with the dashboard or multi-agent orchestration. The core
value is the correctness of the experiment and the validity of its
conclusions.

------------------------------------------------------------------------

# 6. Architecture

## 6.1 High-level architecture

``` text
                         ┌────────────────────────┐
                         │      TrenGuard CLI     │
                         │ run / report / list    │
                         └───────────┬────────────┘
                                     │
                         ┌───────────▼────────────┐
                         │    Experiment Runner   │
                         │ seed, isolation, runs  │
                         └──────┬─────────┬───────┘
                                │         │
                 ┌──────────────▼─┐     ┌─▼────────────────┐
                 │ Mutation       │     │ Test Runner       │
                 │ Registry       │     │ Adapter Interface │
                 └──────┬─────────┘     └─────┬────────────┘
                        │                     │
                 ┌──────▼─────────┐    ┌──────▼────────────┐
                 │ Demo App       │    │ Native test suite │
                 │ healthy/mutated│    │ optional e2e      │
                 └──────┬─────────┘    └──────┬────────────┘
                        │                     │
                        └──────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ Result Classifier  │
                         │ evidence + status  │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ Result Store       │
                         │ JSON + artifacts   │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ Report Generator   │
                         │ Markdown / JSON    │
                         └────────────────────┘
```

## 6.2 Recommended implementation stack

Use a TypeScript-first monorepo or a simple single repository.

-   **Runtime:** Node.js LTS compatible with selected dependencies.
-   **Language:** TypeScript, strict mode.
-   **Package manager:** pnpm.
-   **Demo UI:** Vite + React.
-   **Demo API:** Node.js with a lightweight framework such as Fastify,
    or a simple Vite server/API arrangement.
-   **Persistence:** SQLite for order persistence and test data; an
    in-memory implementation is acceptable only if the persistence
    mutation is still testable across reloads/process boundaries.
-   **Browser tests:** Playwright for a dependency-free deterministic
    baseline.
-   **Optional target integration:** TesterArmy `e2e`, installed as a
    separate optional adapter after inspecting current docs and API.
-   **Validation:** Zod or equivalent schema validation for
    configuration and report objects.
-   **Unit tests:** Vitest.
-   **Lint/format:** ESLint and Prettier, or the project's consistent
    equivalents.
-   **Reports:** JSON and Markdown.
-   **CI:** GitHub Actions.

Do not add a database server, queue, Redis, vector database, or LLM
framework unless a measured requirement justifies it.

## 6.3 Suggested repository structure

``` text
proofforge/
├── apps/
│   └── demo-app/
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── api/
│       │   ├── mutations/
│       │   └── test-support/
│       ├── tests/
│       └── package.json
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── config/
│   │       ├── experiment/
│   │       ├── mutation/
│   │       ├── classifier/
│   │       ├── metrics/
│   │       ├── evidence/
│   │       ├── reports/
│   │       └── types/
│   ├── runner-playwright/
│   │   └── src/
│   └── runner-e2e/
│       └── src/
├── experiments/
│   ├── checkout-baseline.ts
│   ├── mutation-catalog.ts
│   └── replay-safety.ts
├── schemas/
│   ├── experiment.schema.json
│   └── result.schema.json
├── artifacts/
│   └── .gitkeep
├── docs/
│   ├── ARCHITECTURE.md
│   ├── EXPERIMENTS.md
│   ├── METRICS.md
│   └── LIMITATIONS.md
├── scripts/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── proofforge.config.ts
├── README.md
├── CLAUDE.md
└── LICENSE
```

Claude Code may simplify this structure if a smaller structure improves
maintainability. Do not create empty abstractions or packages without a
concrete use.

------------------------------------------------------------------------

# 7. Domain Model and Type Contracts

Use explicit types. Avoid loosely typed JSON objects flowing through the
core.

## 7.1 Core entities

### ExperimentConfig

Fields: - `id`: stable experiment identifier. - `name`: human-readable
name. - `seed`: integer or string used for deterministic selection. -
`baseUrl`: demo app base URL. - `scenarios`: list of scenario IDs. -
`mutations`: list of mutation IDs. - `repetitions`: positive integer,
default 1. - `runner`: `playwright` or optional `e2e`. - `timeouts`:
startup, navigation, scenario, and shutdown timeouts. - `artifactDir`:
output directory. - `failOnInconclusive`: boolean controlling CLI exit
behavior.

Validate all values at startup. Fail with an actionable error if
configuration is invalid.

### ScenarioDefinition

Fields: - `id` - `title` - `description` - `preconditions` - `steps` or
a runner-specific implementation reference. - `expectedOutcomes` -
`requiredEvidence` - `tags` - `timeoutMs`

A scenario should express a user-visible journey and one or more
outcomes that can be independently verified.

### MutationDefinition

Fields: - `id` - `title` - `description` - `category` - `riskLevel` -
`target` - `apply` - `revert` or a documented isolated-reset strategy -
`expectedAffectedScenarios` - `expectedFailureSignal` -
`deterministic` - `enabled`

A mutation must have an explicit expected effect. Do not accept
arbitrary source-code patches from an untrusted input file.

### RunResult

Fields: - `runId` - `experimentId` - `scenarioId` - `mutationId` (null
for healthy baseline) - `repetition` - `startedAt` - `durationMs` -
`status` - `runner` - `assertions` - `error` - `evidence` -
`environment` - `seed` - `rawExitCode` when available

### Result status enum

Use a small, explicit set:

-   `PASS`: scenario completed and its required assertions passed.
-   `FAIL`: scenario ran and a required assertion failed.
-   `ERROR`: runner or test code failed in a way that is not an ordinary
    assertion failure.
-   `TIMEOUT`: configured execution deadline was reached.
-   `SKIPPED`: scenario was intentionally not executed.
-   `CANCELLED`: experiment was interrupted.

Do not conflate a test-run status with the higher-level mutation
classification.

### MutationOutcome enum

-   `DETECTED`: the mutation was applied and a valid test failure
    detected its expected regression.
-   `MISSED`: the mutation was applied, but the relevant test passed.
-   `FALSE_FAILURE`: a scenario failed on the healthy baseline under
    equivalent conditions.
-   `INCONCLUSIVE`: the run timed out, crashed, mutation failed to
    apply, or environment validity could not be established.
-   `NOT_APPLICABLE`: the scenario was not expected to detect this
    mutation.

The classifier must explain its decision with structured reason codes
and evidence.

------------------------------------------------------------------------

# 8. Mutation Catalog

Start with six deterministic mutations. Add others only after the
experiment runner is stable.

## M1 --- Confirmation without persistence (highest priority)

**Category:** state persistence\
**Healthy behavior:** an order is written to SQLite and appears in order
history after navigation/reload.\
**Mutated behavior:** API returns apparent success, but no order is
persisted.\
**Expected weak-test behavior:** a test checking only the confirmation
banner may pass.\
**Expected strong-test behavior:** a test checking order history and
total fails.\
**Evidence:** API response, order-history UI, test assertion,
database/test-oracle state.

## M2 --- Incorrect total calculation

**Category:** business logic\
**Healthy behavior:** subtotal, tax/discount, and total follow a
documented deterministic rule.\
**Mutated behavior:** total excludes one line item or applies a discount
incorrectly.\
**Expected detection:** a test checks the exact expected total derived
from the known fixture.\
**Safety:** use fixed test data and currency rounding rules.

## M3 --- Unauthorized access

**Category:** authorization\
**Healthy behavior:** a normal user cannot access an admin-only route or
action.\
**Mutated behavior:** route/API permits an unauthorized action.\
**Expected detection:** test verifies both UI behavior and server-side
authorization.\
**Safety:** local fixture users only; never test against production
systems.

## M4 --- Search omission

**Category:** data correctness\
**Healthy behavior:** a known fixture item appears for a query that
should match it.\
**Mutated behavior:** one result is omitted.\
**Expected detection:** test checks the expected result set, not merely
that a result container exists.

## M5 --- Save appears successful but does not save

**Category:** persistence\
**Healthy behavior:** edited profile/settings persist after reload.\
**Mutated behavior:** success status appears, but the update is
dropped.\
**Expected detection:** test reloads and verifies the saved value.

## M6 --- Wrong-record action

**Category:** identity/selection\
**Healthy behavior:** delete or update applies to the selected record.\
**Mutated behavior:** action targets a different record under a
controlled condition.\
**Expected detection:** verify both the intended record and unaffected
neighboring records.

## Mutation implementation principles

-   Prefer explicit feature flags or dependency injection over
    dynamically rewriting source files.
-   Each mutation must be independently enabled and disabled.
-   The healthy baseline must use the same application build and data
    setup as the mutated run except for the mutation itself.
-   Reset state between runs.
-   Record whether a mutation was successfully activated.
-   Include a test that proves each mutation changes the intended
    behavior.
-   Avoid mutations that cause broad app crashes unless crash handling
    itself is the experiment.
-   Mutation IDs must remain stable across releases.

------------------------------------------------------------------------

# 9. Test Scenarios

Create tests that deliberately vary in verification strength.

## S1 --- Weak checkout test

Steps: 1. Open the checkout page. 2. Place an order using deterministic
fixture data. 3. Assert that the confirmation banner is visible.

This test is intentionally insufficient for persistence. Label it
`weak-example` in reports so no one mistakes it for recommended
practice.

## S2 --- Strong checkout test

Steps: 1. Reset test data. 2. Open checkout. 3. Place an order. 4.
Assert confirmation. 5. Navigate to order history or reload. 6. Assert
the order exists with the expected line items and total. 7. Assert no
duplicate order was created.

## S3 --- Settings persistence test

1.  Open profile/settings.
2.  Change a known field.
3.  Save.
4.  Reload.
5.  Verify persisted value.

## S4 --- Authorization test

1.  Sign in as a normal fixture user.
2.  Attempt a protected operation.
3.  Verify the API rejects it and the state remains unchanged.

## S5 --- Search correctness test

1.  Seed known records.
2.  Search for a query with an expected result set.
3.  Verify expected records are present and known nonmatches are absent.

## S6 --- Wrong-record isolation test

1.  Seed at least three records with stable IDs.
2.  Perform an update/delete on one.
3.  Verify the intended record changed and other records remain intact.

## Test quality requirements

-   Each test must have a deterministic starting state.
-   Each assertion must be connected to a documented expected outcome.
-   Test IDs must be stable.
-   No test should rely on wall-clock timing where a condition-based
    wait is available.
-   Test data should be unique or reset per run to avoid cross-run
    contamination.
-   Keep assertions close to the action they verify when that makes
    causality clearer.
-   The weak test is a deliberate control group, not a pattern to copy
    into production.

------------------------------------------------------------------------

# 10. Metrics and Correct Evaluation

The quality of the benchmark depends on correct classification. This
section is mandatory; do not simplify it into "passed mutations / total
mutations" without accounting for invalid runs.

## 10.1 Mutation detection rate

For valid, applicable mutation trials:

`Detection Rate = Detected / (Detected + Missed)`

Exclude `INCONCLUSIVE`, `FALSE_FAILURE`, and `NOT_APPLICABLE` from the
denominator. Report their counts separately.

## 10.2 Mutation survival rate

`Survival Rate = Missed / (Detected + Missed)`

This shows the proportion of valid injected regressions that escaped the
test suite.

## 10.3 False-failure rate

`False-Failure Rate = Healthy baseline failures / Valid healthy baseline trials`

Report the numerator and denominator. If the healthy baseline is not
valid, the corresponding mutation outcomes should not be counted as
reliable.

## 10.4 Inconclusive rate

`Inconclusive Rate = Inconclusive trials / All applicable trials`

A high inconclusive rate means the benchmark may be measuring
infrastructure instability rather than test quality.

## 10.5 Execution cost

Record: - Wall-clock duration. - Number of browser/test actions where
available. - Number of LLM/model calls when the runner exposes it. -
Token counts only if actually available from the runner. - Approximate
provider cost only if pricing and token data are known.

Never invent cost or token measurements. If unavailable, report `null`
with a reason.

## 10.6 Replay-safety metrics (stretch)

For each replay trial, record: - Original test context. - Changed
context. - Whether replay was attempted. - Whether replay completed,
handed off, missed, or failed. - Whether the final outcome was
correct. - Whether a wrong entity/action was selected. - Model calls and
duration where available.

A replay that safely refuses to continue is preferable to a replay that
silently performs the wrong action. Do not optimize for replay success
rate alone.

## 10.7 Statistical caution

-   A handful of mutations is a demo, not a universal estimate of
    software quality.
-   Display exact counts beside percentages.
-   Repeated trials can estimate nondeterminism but do not make a biased
    mutation set representative.
-   Report confidence intervals only when enough independent trials
    exist and the chosen method is documented.
-   Do not compare two strategies unless they use equivalent application
    states, mutation sets, and success criteria.

------------------------------------------------------------------------

# 11. Result Classification Algorithm

Implement the classifier as a pure function with unit tests.

Conceptual algorithm:

1.  Validate that the mutation activated successfully.
2.  Validate that the healthy baseline for the relevant scenario is
    valid.
3.  Check that the run completed without a timeout, cancellation, or
    infrastructure error.
4.  Check whether the expected failure signal occurred.
5.  If the expected regression was detected by a relevant assertion,
    classify `DETECTED`.
6.  If the mutated run completed and required assertions passed despite
    the mutation, classify `MISSED`.
7.  If the healthy baseline failed under equivalent conditions, classify
    `FALSE_FAILURE` or mark the scenario/environment invalid, according
    to the experiment protocol.
8.  If the runner failed, mutation failed to apply, or the outcome
    cannot be interpreted, classify `INCONCLUSIVE`.
9.  Save a reason code and supporting evidence.

Potential reason codes: - `EXPECTED_ASSERTION_FAILED` -
`MUTATION_SURVIVED` - `BASELINE_INVALID` - `MUTATION_NOT_APPLIED` -
`RUNNER_ERROR` - `TIMEOUT` - `CANCELLED` -
`UNEXPECTED_ASSERTION_FAILURE` - `ENVIRONMENT_MISMATCH` -
`NO_REQUIRED_EVIDENCE`

The classifier must not rely on matching arbitrary English error strings
alone. Prefer structured assertion IDs, mutation activation markers, and
known result types.

------------------------------------------------------------------------

# 12. CLI Requirements

Recommended commands:

``` bash
pnpm install
pnpm dev
pnpm proofforge run --config proofforge.config.ts
pnpm proofforge report --input artifacts/latest/results.json
pnpm proofforge list-mutations
pnpm proofforge validate-config
pnpm test
pnpm lint
pnpm typecheck
```

Exact command wiring can be adapted to the package manager and CLI
implementation.

## `run`

Options: - `--config <path>` - `--seed <value>` - `--scenario <id>`
(repeatable) - `--mutation <id>` (repeatable) - `--repetitions <n>` -
`--runner playwright|e2e` - `--output <dir>` - `--no-dashboard` -
`--fail-on-inconclusive`

Requirements: - Validate config before starting. - Start or verify the
demo app. - Use isolated test data per trial. - Capture logs and
timing. - Stop child processes reliably on success, failure, timeout, or
interruption. - Write partial results if interrupted. - Print a concise
summary and report path.

## `report`

-   Read and schema-validate result JSON.
-   Generate Markdown summary.
-   Include totals and denominators.
-   Include per-mutation outcome tables.
-   Link to evidence using relative paths.
-   Fail clearly if the input schema is invalid.

## Exit codes

Define and document exit codes. Suggested: - `0`: experiment completed
and all configured quality gates passed. - `1`: experiment completed but
a configured quality gate failed. - `2`: invalid configuration or
command usage. - `3`: infrastructure/runner failure prevented a valid
experiment.

A mutation being detected is normally a successful benchmark outcome,
not a CLI failure. The benchmark's purpose is to reveal test
effectiveness, not to make every mutation fail the overall process.

------------------------------------------------------------------------

# 13. Report Design

Generate `artifacts/<experiment-id>/results.json` and `summary.md`.

## Summary report sections

1.  Experiment metadata and software versions.
2.  Overall result counts.
3.  Mutation detection rate and survival rate with exact denominators.
4.  False failures and inconclusive runs.
5.  Per-scenario results.
6.  Per-mutation results.
7.  Weak-test versus strong-test comparison.
8.  Execution time and model-call data where available.
9.  Evidence paths and relevant logs.
10. Limitations and reproducibility command.

Example table:

  -----------------------------------------------------------------------
  Mutation          Weak test         Strong test       Classification
  ----------------- ----------------- ----------------- -----------------
  Confirmation      Pass              Fail on           Weak test missed;
  without                             order-history     strong test
  persistence                         assertion         detected

  Incorrect total   Pass/Fail based   Pass/Fail based   Derived from
                    on actual run     on actual run     observed evidence

  Settings not      Pass/Fail based   Pass/Fail based   Derived from
  persisted         on actual run     on actual run     observed evidence
  -----------------------------------------------------------------------

This is an illustrative layout, not pre-filled benchmark results. The
generated report must use actual observed outcomes.

## Dashboard (optional)

Only build a dashboard after CLI and reports work.

If built, show: - Detection and survival rates. - Counts by outcome. -
Mutation-by-scenario matrix. - Run durations. - Evidence links. - A
clear indicator for inconclusive trials.

Do not use a single "AI confidence" number without a documented,
calibrated method.

------------------------------------------------------------------------

# 14. Optional TesterArmy `e2e` Integration

This is an important stretch feature, but it must not block the
deterministic MVP.

## 14.1 Integration approach

1.  Inspect current `e2e` documentation, examples, package exports, and
    installed version.
2.  Create a small standalone `e2e` test file using the currently
    documented API.
3.  Keep the baseline Playwright adapter working independently.
4.  Implement a `RunnerAdapter` interface.
5.  Add an `e2e` adapter that invokes the framework through a supported
    public interface or CLI.
6.  Parse structured reports where possible; do not depend on unstable
    console formatting.
7.  Record framework version and runner configuration in every
    experiment.
8.  If model credentials are absent, skip the agent integration with a
    clear message; the core benchmark must still run.

## 14.2 Adapter contract

Conceptual interface:

``` ts
interface RunnerAdapter {
  readonly name: string;

  runScenario(input: {
    scenarioId: string;
    baseUrl: string;
    mutationId?: string;
    runId: string;
    timeoutMs: number;
    artifactDir: string;
  }): Promise<RunnerResult>;
}
```

Keep this interface small. Add fields only when a real adapter needs
them.

## 14.3 `e2e` example

Use the current documentation to validate exact API names before coding.
A conceptual test could resemble:

``` ts
import { expect, test } from 'e2e';

test('order is persisted after checkout', async ({ app, agent, screen }) => {
  await app.open('/checkout');
  await agent.act('place the order using the pre-seeded checkout');
  await expect(screen.getByRole('status')).toContainText('Order confirmed');
  await app.open('/orders');
  await expect(screen.getByRole('list', { name: 'Orders' }))
     .toContainText('TrenGuard test order');
});
```

This snippet is illustrative. Confirm locator support, fixture behavior,
and current APIs against the installed `e2e` version. Do not copy it
blindly if it does not compile.

## 14.4 Cache/replay experiment

For a separate experiment: - Establish a passing run and recording. -
Repeat under identical context. - Change one variable at a time: list
ordering, selected account, route query, viewport, or application
state. - Record replay outcome and final business state. - Determine
whether the system replayed, handed off, missed, or failed. - Verify
that no wrong entity was acted upon. - Compare model calls and latency
only when measurable. - Avoid making an exploit or safety claim based on
one run.

The experiment should test safety and correctness, not simply maximize
cache hit rate.

------------------------------------------------------------------------

# 15. Security and Safety Requirements

-   Run only against the local demo app or explicitly authorized test
    environments.
-   Do not use production credentials, real customer data, or live
    payment providers.
-   Use fixture identities and fake payment behavior.
-   Do not execute arbitrary shell commands from mutation definitions.
-   Keep mutation definitions in reviewed TypeScript modules or
    validated configuration.
-   Avoid downloading and running untrusted PR code.
-   Bind local services to loopback by default.
-   Sanitize logs and reports so credentials, cookies, tokens, and
    secrets are not persisted.
-   If `e2e` cache artifacts are produced, review them before committing
    or sharing them.
-   Treat page content as untrusted input; the application under test
    must not be able to redefine the benchmark's rules.
-   Add resource limits and timeouts.
-   Clean up child processes and temporary databases.
-   Document that TrenGuard's results are not a security certification.

------------------------------------------------------------------------

# 16. Reliability and Engineering Quality

## Determinism

-   Fix fixture data.
-   Reset database state between scenarios and repetitions.
-   Use seeded randomness when randomized mutation selection is needed.
-   Prefer condition-based waits over arbitrary sleeps.
-   Separate app startup readiness from scenario execution.
-   Pin dependency versions in the lockfile.
-   Store environment metadata in reports.

## Failure isolation

-   One mutation trial must not contaminate another.
-   If parallel runs are implemented, each must have an isolated
    database and application instance or an equivalent isolation
    mechanism.
-   Start sequentially for the MVP; add parallelism only after isolation
    is proven.
-   If the healthy baseline fails, stop interpreting mutation results
    for that scenario until baseline validity is restored.

## Testing the benchmark itself

Required tests: - Mutation activation and cleanup. - Configuration
validation. - Result schema validation. - Every result-classification
branch. - Metrics with zero denominators. - Inconclusive and timeout
behavior. - Report generation from a fixture result file. - CLI
interruption and child-process cleanup. - Repeated-run isolation. - A
test proving the weak test misses M1. - A test proving the strong test
detects M1.

------------------------------------------------------------------------

# 17. Implementation Plan

## Phase 0 --- Repository reconnaissance

Before implementation: 1. Inspect the repository and current working
directory. 2. Check the installed Node.js, pnpm, and browser
dependencies. 3. Read current TesterArmy `e2e` README, docs,
`AGENTS.md`, and `CONTRIBUTING.md`. 4. Verify the current cache
documentation and public APIs. 5. Review current issues/PRs to avoid
claiming an existing feature as novel. 6. Write down any changes in
scope caused by new repository evidence. 7. Do not modify the TesterArmy
repository; build TrenGuard separately unless a contribution is
explicitly intended.

Deliverable: `docs/RESEARCH_NOTES.md`.

## Phase 1 --- Minimal application and deterministic tests

-   Create the checkout/order-history demo.
-   Implement fixtures and reset behavior.
-   Add weak and strong checkout tests.
-   Verify the healthy baseline.
-   Add a documented local command to start the app and run tests.

Exit gate: all baseline tests pass consistently from a clean checkout.

## Phase 2 --- Mutation engine

-   Define mutation registry and contracts.
-   Implement M1 first.
-   Add mutation activation checks.
-   Prove that M1 changes the intended behavior.
-   Add M2--M6 incrementally.
-   Add tests for applying and resetting each mutation.

Exit gate: mutations are independently reproducible and do not
contaminate one another.

## Phase 3 --- Experiment runner and classifier

-   Implement config validation.
-   Execute baseline then applicable mutation trials.
-   Isolate state per trial.
-   Capture status, timing, logs, and evidence.
-   Implement outcome classification and reason codes.
-   Add JSON schema and validation.

Exit gate: no invalid run is silently counted as a detection or a miss.

## Phase 4 --- Metrics and reports

-   Compute detection/survival/false-failure/inconclusive rates.
-   Generate Markdown and JSON.
-   Add weak-versus-strong comparison.
-   Show exact counts and denominators.
-   Add sample output to the README.

Exit gate: reports are reproducible and use only observed results.

## Phase 5 --- Optional `e2e` integration

-   Implement the adapter interface.
-   Run one `e2e` scenario if a supported local setup and model
    configuration are available.
-   Add replay experiments only after basic integration works.
-   Keep baseline Playwright execution independent.

Exit gate: missing model credentials do not break the core PoC.

## Phase 6 --- Polish for hiring review

-   Add CI.
-   Add architecture and experiment docs.
-   Test setup from a clean environment.
-   Record a 90--120-second demo.
-   Add a clear limitations section.
-   Create a concise technical write-up explaining the insight and
    measured results.

------------------------------------------------------------------------

# 18. Claude Code Build Instructions

The following instructions should be placed in `CLAUDE.md` or given to
Claude Code as the project-level build brief.

## 18.1 Mission

Build TrenGuard as a polished, technically rigorous, reproducible E2E
verification benchmark. Optimize for correct experiments, reliable
evidence, and maintainable TypeScript---not for the number of features
or the visual complexity of a dashboard.

## 18.2 Required working method

1.  Inspect before editing. Do not assume the repository is empty or
    overwrite existing work.
2.  Read the full product specification.
3.  Produce a short implementation plan with phases and acceptance
    criteria.
4.  Check current `e2e` docs and package APIs before integrating them.
5.  Implement one vertical slice at a time.
6.  Run tests, type checks, and lint after each meaningful change.
7.  Report commands run and actual results.
8.  Do not claim that something works unless you ran the relevant test
    or clearly state it was not run.
9.  Prefer a simple design that can be explained in an interview.
10. Never invent performance improvements or benchmark results.

## 18.3 Scope guardrails

-   Implement the deterministic Playwright baseline before `e2e`
    integration.
-   Start with the confirmation-without-persistence mutation.
-   Build the weak/strong test contrast before implementing all
    mutations.
-   Keep the first version local and single-user.
-   Do not add a database service or cloud deployment unless required.
-   Do not add an LLM to the core classifier.
-   Do not use an LLM's narrative as the source of truth for detection.
-   Do not create a dashboard before the JSON report is correct.
-   Do not silently skip failing tests.
-   Do not count a timeout as a detected mutation.
-   Do not hard-code example results into the report generator.
-   Do not patch `node_modules` or the TesterArmy repository to make the
    PoC appear successful.
-   If the installed `e2e` API differs from the illustrative snippets,
    follow the actual installed public API and document the change.

## 18.4 Required development loop

For each phase:

1.  State the intended outcome.
2.  Identify files to add/change.
3.  Implement the smallest working increment.
4.  Run focused tests.
5.  Run type checking.
6.  Run lint.
7.  Run the relevant end-to-end experiment.
8.  Summarize observed results and any unresolved issues.
9.  Update docs if behavior or commands changed.

Do not begin the next phase while the current phase has a failing
acceptance test unless the failure is explicitly documented and the user
approves proceeding.

## 18.5 Required deliverables

-   Working source code.
-   `README.md` with quickstart.
-   `CLAUDE.md` with project rules.
-   `docs/ARCHITECTURE.md`.
-   `docs/EXPERIMENTS.md`.
-   `docs/METRICS.md`.
-   `docs/LIMITATIONS.md`.
-   Automated tests.
-   `proofforge.config.ts` or equivalent example configuration.
-   Example generated JSON/Markdown report based on an actual run.
-   CI workflow.
-   Demo script for a 90--120-second walkthrough.

## 18.6 Definition of done

Do not declare the PoC complete until: - A clean install succeeds. - The
healthy baseline succeeds. - The first mutation is demonstrably
active. - The weak test misses the mutation as expected. - The strong
test catches the mutation as expected. - Classification and metrics have
automated tests. - A real report is generated from actual run results. -
The documented commands have been verified. - Limitations and known
issues are explicit.

------------------------------------------------------------------------

# 19. Suggested First Prompt for Claude Code

Copy this prompt after saving the specification as `PROOFORGE_SPEC.md`
in the repository root.

``` text
Read PROOFORGE_SPEC.md completely before coding.

You are the lead engineer implementing TrenGuard, a reproducible benchmark
for evaluating whether E2E tests detect controlled application regressions.

Begin with repository reconnaissance. Inspect existing files, package tooling,
runtime versions, and the current public TesterArmy e2e documentation. Do not
assume the repository is empty and do not overwrite existing work.

Then produce:
1. A concise implementation plan mapped to the phases and acceptance criteria
   in PROOFORGE_SPEC.md.
2. A proposed repository structure.
3. Any API or dependency assumptions that need verification.
4. The smallest first vertical slice.

Implement only Phase 1 first:
- a small checkout/order-history demo application;
- deterministic fixture data and reset behavior;
- a deliberately weak checkout test that checks the confirmation UI;
- a strong checkout test that checks persisted order history and total;
- commands to start the application and run both tests;
- unit/integration tests where appropriate.

Do not implement a dashboard, multi-agent system, or LLM-based classifier.
Do not fabricate results. Do not claim the weak/strong contrast works until
you have executed it and inspected the actual outcomes.

Use strict TypeScript, clear interfaces, minimal dependencies, secure local
defaults, and maintainable code. Run the relevant tests, type checks, and lint.
Report changed files, commands executed, actual results, and remaining issues.

Stop after Phase 1 and present the results before continuing to Phase 2.
```

After Phase 1 is accepted, tell Claude Code to implement Phase 2, then
Phase 3, and so on. This makes failures easier to diagnose than asking
it to generate the entire system in one pass.

------------------------------------------------------------------------

# 20. Demo and Hiring Narrative

## 20.1 Demo script (90--120 seconds)

1.  **0--15 sec:** Explain the problem: a passing test can still miss a
    broken feature.
2.  **15--35 sec:** Run the healthy checkout scenario and show the
    expected order.
3.  **35--55 sec:** Enable the persistence mutation and run the weak
    test.
4.  **55--75 sec:** Run the stronger test and show the order-history
    assertion failing.
5.  **75--95 sec:** Show the report: detected vs missed mutation, exact
    evidence, duration, and run status.
6.  **95--120 sec:** Explain how the benchmark can evaluate
    agent-generated tests and, as a follow-up, replay safety in `e2e`.

Use actual output from the latest run. If a step behaves differently
from expectations, show and explain the real behavior rather than
editing the result to fit the story.

## 20.2 README opening

Suggested text:

> **TrenGuard measures whether E2E tests catch the regressions they are
> supposed to prevent.**
>
> It runs a test suite against a known-good application, introduces
> controlled faults, and evaluates which regressions are detected,
> missed, or inconclusive. The goal is to measure verification
> strength---not merely whether a test turns green.

## 20.3 What to send TesterArmy

Send: - The GitHub repository. - A short demo video. - A one-page
technical summary. - Actual results from the experiment. - One specific,
evidence-backed next step for the `e2e` framework.

Do not send a long list of hypothetical features. Show a working
experiment and explain why it matters to their core problem.

------------------------------------------------------------------------

# 21. Risks, Limitations, and Future Enhancements

## Risks

**Mutation quality:** a mutation may be unrealistic or may not represent
a meaningful bug. Mitigation: document each mutation's rationale and
prove that it activates.

**Oracle bias:** the test may use the same implementation assumptions as
the app. Mitigation: derive expected results from fixed fixtures and
independent business rules.

**Flaky environment:** an unstable browser or app can create false
failures. Mitigation: baseline validation, isolated state, explicit
inconclusive outcomes, and repeated trials.

**Overfitting:** a suite can score well on a small hand-picked mutation
set. Mitigation: disclose the catalog, add mutation categories, and
avoid broad claims.

**Framework API drift:** `e2e` is actively developed. Mitigation: pin
versions, validate public APIs, and keep the adapter optional.

**Cost measurement:** provider costs may not be exposed by the runner.
Mitigation: report only values that can be measured or derived from
known inputs.

## Future enhancements

1.  Generate additional mutations from changed code, with human review.
2.  Compare several testing strategies under the same experiment.
3.  Add a replay-safety corpus covering dynamic lists, account context,
    routes, and changing data.
4.  Use a model to suggest missing assertions, then evaluate those
    assertions against held-out mutations.
5.  Select high-value tests for a code change and measure
    missed-regression risk.
6.  Extend to mobile only after web experiments are reliable.
7.  Add calibrated confidence intervals and larger repeated experiments.
8.  Explore a contribution upstream if a reproducible benchmark exposes
    a specific gap in `e2e`.

These are roadmap items, not MVP commitments.

------------------------------------------------------------------------

# 22. Final Recommendation

Build TrenGuard as an experiment-first engineering tool.

The strongest first milestone is deliberately small: - one checkout
application; - one known persistence regression; - one weak test; - one
strong test; - one accurate report showing the difference.

Then add a small mutation catalog and, only once the benchmark is
reliable, an optional `e2e` replay-safety experiment.

The key is to make the project demonstrate the same quality that it
measures: reproducibility, correct classification, transparent evidence,
explicit limitations, and no invented results.

**The thesis:** AI can generate code and tests. TrenGuard evaluates
whether those tests provide evidence that the code works.

That is a focused, relevant, and defensible engineering PoC for a team
working on AI-driven software verification.
