# TesterArmy Technical Fit for TrenGuard Hiring

**Research snapshot:** 2026-10-20

**Purpose:** Assess whether TesterArmy/e2e is a technically relevant open-source
benchmark for hiring an engineer to build or extend TrenGuard, and identify the
engineering problems that should shape the hiring exercise.

## Executive summary

TesterArmy/e2e is a strong technical fit for TrenGuard as a **public design and
implementation reference**, not as a dependency or a replacement for the core
benchmark. It exercises the same broad problem area—natural-language browser or
mobile automation, semantic observation, action execution, model/tool-loop
integration, deterministic replay, and structured evidence—but its scope is
larger than TrenGuard's current local benchmark.

The best hiring signal is therefore a focused extension around one of the hard
boundaries: deterministic replay and cache invalidation, semantic observation
and stale-state recovery, engine/executor interfaces, or trustworthy reporting.
The candidate should work against TrenGuard's local deterministic fixtures and
mutation corpus, with any TesterArmy integration remaining an optional adapter.

## Scope and source-of-truth constraints

The local project rules and TrenGuard specification remain authoritative:

- `CLAUDE.md` requires one phase at a time and prohibits starting Phase 2 until
  the Phase 1 healthy-baseline acceptance gate passes and the user approves it.
- The benchmark must remain local, deterministic, and free of model credentials.
- TesterArmy `e2e` integration must not be added until its current public API is
  re-checked and any adapter can remain independent of Playwright.
- Secrets, `.env` files, browser recordings, and local order data must stay out
  of source control.

This note records research and does not change the implementation phase or add
an integration.

## Public TesterArmy facts verified during research

### Repository and project contract

The current public repository is `tester-army/e2e`:

- Repository: <https://github.com/tester-army/e2e>
- README: <https://raw.githubusercontent.com/tester-army/e2e/main/README.md>
- Contributor/agent contract: <https://raw.githubusercontent.com/tester-army/e2e/main/AGENTS.md>
- Current recursive tree queried: <https://api.github.com/repos/tester-army/e2e/git/trees/main?recursive=1>

The README presents the project as an open-source framework for testing web and
mobile applications with natural-language agents. It describes agent-driven
interaction, semantic locators and assertions, browser/device support, and
record/replay-oriented workflows.

The repository contract states that the package APIs and emitted TypeScript
declarations are the code contract. It directs API changes toward source,
tests, and generated declarations, and requires documentation updates when
behavior or public API changes. The repository is a pnpm monorepo with separate
`packages/e2e`, `packages/web`, and `packages/mobile` areas. The contributor
guidance identifies Apache-2.0 licensing, no CLA/DCO requirement, and security
review expectations.

The latest commit observed in the public API snapshot was:

- Commit: <https://github.com/tester-army/e2e/commit/ee901b9e305951fdfebf18be8fa8e484c64a19b5>
- Commit date: 2026-10-19

### Published packages and compatibility

The npm registry metadata observed during research reported:

- `@e2e-dev/e2e` `0.21.2`: <https://registry.npmjs.org/@e2e-dev%2Fe2e/latest>
- `@e2e-dev/web` `0.15.2`: <https://registry.npmjs.org/@e2e-dev%2Fweb/latest>
- `@e2e-dev/mobile` `0.12.3`: <https://registry.npmjs.org/@e2e-dev%2Fmobile/latest>

The package metadata reported a Node engine floor of `^22.22.3 || >=24.8.0`
for the current package line. The web package uses `playwright-core` as its
browser implementation dependency and exposes the core/web integration. The
mobile package exposes the agent-device integration and supports iOS/Android
device-oriented workflows.

The important TrenGuard implication is that package compatibility must be
checked against the actual runtime and exact package versions before an adapter
is accepted. The current workspace's default Node is recorded as `22.19.0`,
below the published floor, while Node `24.19.0` is available locally.

### Core architecture and extension points

The public API and source organization show a layered architecture:

1. **Core `e2e` package:** platform-neutral agent, engine, runner, context,
   actions, locators, assertions, errors, caching, and reporting contracts.
2. **Web package:** browser-backed execution and semantic page observation,
   built around Playwright primitives.
3. **Mobile package:** agent-device-backed execution for iOS and Android.
4. **Extensibility:** engine definitions, custom executors, reporters, and
   fixtures allow integrations without changing the core runner.

Relevant public documentation:

- Main docs: <https://tester-army.github.io/e2e/>
- Agent API: <https://tester-army.github.io/e2e/docs/api/e2e/agent/>
- Engine API: <https://tester-army.github.io/e2e/docs/api/e2e/engine/>
- Runner API: <https://tester-army.github.io/e2e/docs/api/e2e/runner/>
- Operation context: <https://tester-army.github.io/e2e/docs/api/e2e/context/>
- Reporter API: <https://tester-army.github.io/e2e/docs/api/e2e/reporter/>
- Error types: <https://tester-army.github.io/e2e/docs/api/e2e/errors/>
- Custom executors: <https://tester-army.github.io/e2e/docs/advanced/custom-executors/>
- Custom reporters: <https://tester-army.github.io/e2e/docs/advanced/reporter/>
- Web testing: <https://tester-army.github.io/e2e/docs/guides/web-testing/>
- Mobile testing: <https://tester-army.github.io/e2e/docs/guides/mobile-testing/>
- Testing without AI: <https://tester-army.github.io/e2e/docs/guides/testing-without-ai/>

Relevant upstream source areas identified from the public tree include:

- `packages/e2e/src/engine/`
- `packages/e2e/src/operation-context.ts`
- `packages/e2e/src/step-cache.ts`
- `packages/e2e/src/cache/`
- `packages/e2e/src/report/`
- `packages/e2e/src/run/`
- `packages/web/src/`
- `packages/mobile/src/`

The extension shape is particularly relevant to TrenGuard: a TrenGuard
adapter can target an engine/executor or reporter boundary rather than importing
Playwright internals into the core benchmark.

### Semantic observation and action execution

The web implementation observes pages through a semantic representation rather
than requiring the model to reason directly over arbitrary raw DOM. The source
areas and docs cover semantic nodes, locators, actions, assertions, snapshots,
nested frames, and browser handles.

The implementation includes explicit handling for nested frames and bounds the
frame traversal depth. It also separates observation from execution through
engine and browser abstractions. This is a useful design reference for
TrenGuard's mutation classifier: the benchmark can evaluate whether a proposed
action is robust to semantic changes instead of only checking one happy-path
selector.

### Step cache, record/replay, and hosted sessions

The public docs expose these related workflows:

- Step cache: <https://tester-army.github.io/e2e/docs/advanced/step-cache/>
- Record and replay: <https://tester-army.github.io/e2e/docs/guides/record-and-replay/>
- Hosted sessions: <https://tester-army.github.io/e2e/docs/guides/hosted-sessions/>
- Environment variables: <https://tester-army.github.io/e2e/docs/guides/environment-variables/>

The observed cache design separates logical action identity, contextual
anchors, route/page identity, and execution outcomes. Replay can reuse a
recorded successful step without another model call; live execution remains
available for actions such as assertions, waits, extraction, or actions whose
context no longer matches. The design also contains handoff/recovery behavior
for mismatched control or end-state conditions.

The public issue tracker contains a directly relevant open issue:

- Issue #1213: <https://github.com/tester-army/e2e/issues/1213>

The issue discusses making hosted sessions honor the action replay cache and
keeping cache identity stable across session boundaries. This is evidence that
replay identity and session continuity are active engineering concerns, not
merely documentation topics.

The important design risks for a TrenGuard adapter are cache trust, stale
anchors, changed application data, route identity, secret handling, and
proving that replay did not accidentally invoke the model again.

### Reporting and evidence

The public API includes reporter contracts and built-in report formats. The
source tree includes report builders and run artifact handling under:

- `packages/e2e/src/report/`
- `packages/e2e/src/run/`

The documented reporting surface includes structured output, human-readable
reports, and artifacts such as traces, screenshots, and run metadata. The
reporting design is relevant to TrenGuard because a hiring benchmark needs to
show not only pass/fail but also mutation, action, replay, model-call, and
failure-classification evidence.

### Current public activity observed

The open-issues API snapshot included active work around the cache/session
boundary. The latest pull request observed was:

- PR #1272: <https://github.com/tester-army/e2e/pull/1272>
- Title: `feat: add 3 new agents to the agent registry`
- Created: 2026-10-20

The latest commit and PR activity indicate that the public API and package
behavior are still moving. Any adapter should pin exact versions and keep the
integration optional.

## TrenGuard facts verified in the workspace

### Product and phase scope

Relevant local files:

- `CLAUDE.md`
- `Prooforge Spec - TesterArmy.md`
- `README.md`
- `docs/RESEARCH_NOTES.md`
- `research_notes/TesterArmy hiring strategy/researcher.md`

TrenGuard is currently a hiring PoC for a local deterministic benchmark. The
benchmark runs a fixed checkout/order-style flow against a local app and
classifies behavior against controlled UI mutations. The intended first phase
is the healthy deterministic baseline; external or model-backed integrations
are optional follow-on work.

### Existing benchmark architecture

Relevant implementation areas:

- `src/benchmark/types.ts`
- `src/benchmark/runner.ts`
- `src/benchmark/classifier.ts`
- `src/benchmark/metrics.ts`
- `src/benchmark/report.ts`
- `tests/`
- `fixtures/`
- `mutations/`
- `scripts/`

The local flow is designed around a fresh app/test-data state, a sequential
runner, Playwright-based browser steps, mutation classification, and a
machine-readable report. This is a better hiring substrate than directly
depending on a hosted or model-backed automation service because it makes
failures reproducible and keeps credentials out of the benchmark.

### Existing baseline evidence

The workspace already contains baseline documentation and artifacts under
`docs/` and `artifacts/`. The recorded baseline summary is:

- 7 mutation scenarios total
- 6 detected
- 1 survived
- 85.7% mutation detection
- 0 false positives
- 0 inconclusive cases
- 29 `NOT_APPLICABLE` mutation entries across the scenario matrix
- One recorded run of approximately 98 seconds

These are existing workspace records, not a new run performed for this note.
The Phase 1 acceptance gate should continue to treat the local baseline as the
source of truth until it is re-run and accepted according to the project spec.

### Existing optional adapter evidence

The workspace contains an experimental adapter path and related notes:

- `src/adapters/testerarmy/`
- `tests/checkout.spec.ts`
- `docs/REPLAY_SAFETY.md`
- `docs/LIMITATIONS.md`
- `.e2e/`

The adapter is configured to use a local app, Chromium, no cache, and a JSON
reporter. The checkout test opens the app before browser evaluation and then
reopens the app after resetting data. Earlier notes recorded an initial ordering
failure when browser evaluation occurred before `app.open()`; the current test
ordering corrected that issue.

The workspace notes record a successful one-test adapter run under Node 24 with
zero model calls and a generated `.e2e` report. This is existing local evidence
read from the workspace, not a new test run performed during this research
session.

There is an internal documentation inconsistency to resolve before relying on
the adapter as an acceptance gate: `docs/LIMITATIONS.md` still describes the
current Node environment as unavailable, while `docs/REPLAY_SAFETY.md` records
the Node 24 run as successful. The package engine floor and the exact command,
runtime, and package versions should be recorded in one authoritative note.

## Technical comparison

| Concern | TesterArmy/e2e | TrenGuard today | Hiring implication |
|---|---|---|---|
| Primary purpose | General web/mobile agent automation framework | Local deterministic mutation benchmark | Use TesterArmy as reference; keep TrenGuard as the evaluation harness |
| Execution | Browser/device engines, agent loops, custom executors | Local Playwright flow and benchmark runner | Candidate should understand an engine boundary without coupling core code to Playwright |
| Observation | Semantic nodes, locators, frames, handles | Scenario-specific browser actions and mutation assertions | Test semantic robustness as an optional adapter or focused benchmark extension |
| Replay | Step cache, record/replay, hosted-session identity | Adapter uses `no-cache`; replay safety is documented experimentally | Make replay identity, zero-model replay, stale cache, and handoff measurable |
| Determinism | Supports deterministic/non-AI execution but also model-backed workflows | Core requirement | Keep external integration out of baseline acceptance |
| Evidence | Reporters, JSON/human formats, traces and artifacts | JSON report, metrics, mutation classification, artifacts | Require a report that explains why a mutation was detected or missed |
| Platform scope | Web plus mobile | Local web benchmark | Do not expand to mobile until the local web baseline is healthy |
| Compatibility | Moving pre-1.0 package line; current Node floor is explicit | Local project runtime and pinned dependencies | Pin versions and verify the runtime before adapter work |
| Security | Cache, secrets, hosted sessions, browser/device access | No model credentials; local-only requirement | Candidate must preserve secret isolation and avoid committing recordings/data |

## Hard engineering problems worth hiring for

These are the strongest technical-fit areas for a TrenGuard candidate:

1. **Deterministic replay and cache invalidation**
   - Define a stable logical action identity.
   - Include route, semantic anchors, relevant data state, and end-state
     conditions in replay validation.
   - Prove whether a step was replayed or executed live.
   - Prevent stale or untrusted cache entries from silently producing false
     passes.

2. **Semantic observation under UI mutation**
   - Distinguish meaningful semantic changes from harmless DOM changes.
   - Recover when a locator or anchor becomes stale.
   - Handle nested frames and bounded observation without hiding failures.
   - Turn the result into a mutation-classification signal.

3. **Engine/executor boundary design**
   - Keep TrenGuard's core benchmark independent of Playwright internals.
   - Provide a small optional adapter that can use a public TesterArmy API.
   - Make custom execution and reporting replaceable without forking the
     benchmark runner.

4. **Trustworthy evidence and failure taxonomy**
   - Record action identity, observed state, mutation, model-call count, replay
     status, screenshots/traces where appropriate, and final classification.
   - Separate product failure, adapter failure, environment failure, and
     `NOT_APPLICABLE` mutation cases.
   - Make reports useful to a reviewer without requiring model credentials.

5. **Runtime and integration discipline**
   - Verify exact Node/package compatibility before debugging behavior.
   - Pin the public package versions used by the adapter.
   - Keep local app startup, data reset, browser lifecycle, and report output
     explicit and repeatable.

## Recommended hiring exercise

Use a bounded, local-only task rather than asking a candidate to implement a
general autonomous agent:

> Extend the TrenGuard benchmark with a replay-safety or semantic-recovery
> capability. The implementation must run against the existing local fixture,
> preserve the deterministic baseline, produce a machine-readable evidence
> report, and keep TesterArmy integration optional.

Suggested acceptance criteria:

- The healthy baseline still passes with no new credentials.
- At least two controlled mutations exercise the new behavior.
- The report distinguishes live execution from cache replay and records model
  calls as zero for the deterministic path.
- A stale or mismatched replay is rejected or handed off rather than silently
  accepted.
- The implementation is isolated behind a clear adapter/engine/reporter
  boundary.
- The candidate documents runtime/package versions and the exact verification
  command.

Good follow-up questions for the interview:

- What makes an action identity stable across sessions but sensitive to changed
  page state?
- Which parts of a semantic observation are safe to cache?
- How would you distinguish a stale cache hit from a genuine product failure?
- How can the benchmark prove that replay avoided a model call?
- Where should browser/device-specific code live so the benchmark remains
  portable?
- What evidence would make a mutation result `DETECTED`, `SURVIVED`,
  `FALSE_POSITIVE`, or `NOT_APPLICABLE`?

## Recommendation

Proceed with TesterArmy as a **research reference and optional adapter target**.
Do not make it a Phase 1 dependency or acceptance requirement. First preserve
and verify the local TrenGuard baseline. Then use a small pinned adapter or a
TesterArmy-inspired replay/semantic-recovery task to evaluate engineering
judgment, state modeling, failure analysis, and evidence quality.

## Verification record

Research performed:

- Read the local researcher instructions in
  `research_notes/TesterArmy hiring strategy/researcher.md`.
- Inspected the TrenGuard specification, project rules, README, source layout,
  tests, fixtures, mutations, scripts, baseline notes, replay-safety notes,
  limitations, and existing `.e2e` artifacts.
- Fetched the current public TesterArmy README and contributor contract.
- Queried the public repository tree, package metadata, open issue/PR activity,
  latest commit, package metadata, and official documentation pages.
- Read relevant upstream source areas for engine contracts, operation context,
  step caching, reporting, run artifacts, web observation, and mobile APIs.

No new benchmark, adapter, or test command was run while writing this research
note. Existing run results are labeled as workspace evidence above.
