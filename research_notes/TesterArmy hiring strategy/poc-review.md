# TrenGuard hiring strategy / PoC review

Research snapshot: 20 October 2026. I inspected the supplied specification,
the current workspace, the generated benchmark artifacts, and current public
TesterArmy/e2e materials. “Observed facts” below are tied to a workspace path
or public URL. “Inferences” are judgments about hiring impact, not published
TesterArmy requirements.

## 1. Does the current PoC demonstrate a compelling, relevant engineering thesis?

### Takeaway

**Judgment:** The central experiment is genuinely relevant and would likely
earn positive attention in an initial technical review. It demonstrates that
the author understands the difference between a green UI check and evidence of
a correct business outcome. As a hiring submission today, however, it is a
strong local PoC rather than a finished open-source engineering artifact: the
experiment is the strongest part, while the packaging, contract rigor, and
TesterArmy-specific evidence are not yet at the same level.

### Cited Findings

- The supplied specification defines TrenGuard as a deterministic benchmark
  that runs a healthy application and controlled mutations, then separates
  detected bugs, missed bugs, false failures, and inconclusive infrastructure
  failures. It explicitly makes the weak-confirmation-versus-strong-business-
  outcome contrast the central demo. — [`Prooforge Spec - TesterArmy.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/Prooforge%20Spec%20-%20TesterArmy.md)

- The workspace implements the stated core shape: a local demo application,
  six reviewed mutations, Playwright scenarios, a runner, a classifier,
  metrics, JSON/Markdown reports, evidence files, and a dashboard generator.
  The repository map and quickstart document these surfaces. — [`README.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/README.md),
  [`src/benchmark/runner.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/benchmark/runner.ts),
  [`src/mutations.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/mutations.ts)

- The six mutations cover persistence, business logic, authorization, data
  correctness, profile persistence, and wrong-record selection. They are
  activated through explicit environment-selected behavior switches and expose
  a health marker instead of rewriting source files. — [`src/mutations.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/mutations.ts),
  [`src/server.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/server.ts)

- Trial isolation is concrete rather than aspirational: the benchmark starts a
  separate app process, allocates a temporary data file, uses a loopback URL,
  checks the mutation health response, and removes the process and temporary
  directory afterward. — [`src/benchmark/runner.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/benchmark/runner.ts),
  [`docs/ARCHITECTURE.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/ARCHITECTURE.md)

- The weak test checks only the confirmation status. The strong test checks the
  exact product, quantity, customer, total, order count, and the result after a
  reload. The dedicated M1 proof also verifies that the mutated app returns a
  confirmation while its order history remains empty. — [`tests/checkout.spec.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/tests/checkout.spec.ts),
  [`benchmark-tests/scenarios.spec.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/benchmark-tests/scenarios.spec.ts),
  [`mutation-tests/m1.spec.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/mutation-tests/m1.spec.ts)

- The latest benchmark run performed during this review completed with 6
  detected and 1 missed valid mutation trial, 0 false failures, and 0
  inconclusive trials: 85.7% detection and 14.3% survival over a denominator of
  7 valid applicable trials. It used one repetition and recorded 29
  not-applicable scenario/mutation combinations. The report itself labels the
  result as descriptive for the configured fixture and mutation catalog rather
  than a universal quality estimate. — [`artifacts/latest/summary.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/artifacts/latest/summary.md)

- The most valuable result is not the percentage: S1 is `MISSED` for M1 while
  S2 is `DETECTED`. This is a crisp, explainable demonstration that a test can
  pass while the order is not persisted, and that an independent outcome check
  catches the regression. — [`artifacts/latest/summary.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/artifacts/latest/summary.md),
  [`docs/EXPERIMENTS.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/EXPERIMENTS.md)

- Local verification actually run for this review: `pnpm typecheck` passed;
  `pnpm build` passed; `pnpm test:unit` passed all 7 tests; a sequential rerun
  of `pnpm test` passed all 4 Playwright tests; `pnpm test:mutation:m1` passed;
  `pnpm proofforge validate-config` passed; and the full
  `pnpm proofforge run --config proofforge.config.ts` regenerated the report
  with the result above. The first full Playwright invocation had 3 tests pass
  and then hit an `ENOENT` while Playwright was disposing trace/artifact files;
  the targeted reset test passed with tracing off, and the sequential full
  rerun passed. This is evidence of a transient verification/artifact issue,
  not an assertion failure in the reset behavior. — [`package.json`](file:///Users/tharunkumarl/Full%20Stack/pocs/package.json),
  [`tests/reset.spec.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/tests/reset.spec.ts)

- The optional current-API TesterArmy run also completed under the supported
  locally available Node `v25.2.1`, with `e2e@0.21.2`,
  `@e2e-dev/web@0.15.2`, one passing Chromium test, zero model calls, and exit
  code 0. The adapter test uses the public web engine, locators, and
  assertions. — [`testerarmy-tests/checkout.e2e.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/testerarmy-tests/checkout.e2e.ts),
  [`testerarmy.e2e.config.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/testerarmy.e2e.config.ts),
  [`docs/REPLAY_SAFETY.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/REPLAY_SAFETY.md)

- The workspace documentation is internally inconsistent about that adapter:
  `README.md` and `docs/REPLAY_SAFETY.md` describe a supported-runtime pass,
  while `docs/LIMITATIONS.md` still says the adapter is unavailable in the
  current local setup. The current review run confirms that it is available
  under Node 25.2.1, while the default Node 22.19.0 shell remains below the
  current e2e floor. — [`README.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/README.md),
  [`docs/LIMITATIONS.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/LIMITATIONS.md),
  [`docs/REPLAY_SAFETY.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/REPLAY_SAFETY.md),
  [e2e README](https://raw.githubusercontent.com/tester-army/e2e/main/README.md)

- TesterArmy’s public e2e materials describe the framework as a TypeScript
  runner where deterministic locators/assertions and natural-language agent
  steps can coexist in one test. They describe a verified `agent.act` step
  being cached and replayed without a model call until the app changes, with
  handoff to the live agent when replay cannot continue safely. — [e2e overview](https://tester.army/e2e.md),
  [e2e README](https://raw.githubusercontent.com/tester-army/e2e/main/README.md),
  [cache documentation](https://raw.githubusercontent.com/tester-army/e2e/main/docs/cache.mdx)

### Inferences

- The experiment-first thesis is a better hiring signal than a generic AI
  testing dashboard would be. It shows an ability to define a falsifiable
  question, create a control group, inject known faults, preserve a baseline,
  and disclose the denominator and limitations.

- M1 should be the opening of the submission and demo. A reviewer can
  understand the failure in under two minutes without trusting a model,
  interpreting a proprietary score, or learning a large architecture first.

- The six mutations add breadth, but they do not yet establish that the
  benchmark generalizes. The honest 85.7% framing helps; presenting it as a
  quality score would undermine the strongest engineering judgment shown by the
  project.

- The optional adapter is a useful compatibility signal, especially because it
  was kept separate from the deterministic core while the public e2e API is
  still moving. It is not yet evidence that TrenGuard evaluates e2e’s central
  agent/replay behavior.

### Gaps

- There is no public role-specific TesterArmy hiring scorecard in the material
  reviewed, so the judgment is inferred from the open-source repository’s
  contracts, contribution workflow, security guidance, CI, and cross-platform
  scope rather than from an active job description. The public repository is
  active, with its GitHub API snapshot updated on 20 October 2026; the public
  YC jobs page showed no posted roles in the research snapshot. — [GitHub repository API](https://api.github.com/repos/tester-army/e2e),
  [TesterArmy open source](https://tester.army/open-source),
  [TesterArmy jobs at YC](https://www.ycombinator.com/companies/testerarmy/jobs)

- No independent reviewer has checked the benchmark’s mutation validity or
  oracle independence. The current report is a credible demonstration, not
  external validation of the benchmark methodology.

## 2. Where does it fall short of the current TesterArmy/e2e engineering bar?

### Takeaway

**Judgment:** The gap is not primarily feature count. The current PoC is behind
the public e2e bar in three specific ways: its benchmark classifier is more
permissive than its thesis requires, its e2e integration does not exercise
agent/replay behavior, and its repository is missing the CI, contract, and
open-source maintenance surfaces that make a tool reviewable by strangers.

### Cited Findings

- The public e2e repository treats emitted TypeScript declarations, JSON
  schemas plus valid/invalid fixtures, security invariants, docs, tests,
  benchmarks, and release workflows as part of its contract. Its contribution
  guide requires `pnpm check`, `pnpm test`, docs checks, and benchmark evidence
  for runner/agent/engine performance claims. — [e2e CONTRIBUTING.md](https://raw.githubusercontent.com/tester-army/e2e/main/CONTRIBUTING.md)

- The public `AGENTS.md` describes a pnpm ESM TypeScript monorepo with a public
  engine contract, separate web/mobile engines, deterministic and agentic test
  suites, benchmark apps, MCP/CLI surfaces, report schemas, and fail-closed
  security invariants. — [e2e AGENTS.md](https://raw.githubusercontent.com/tester-army/e2e/main/AGENTS.md)

- The public framework supports web, iOS simulators, Android emulators, and
  physical devices through a shared test API. Its CI guidance covers artifacts,
  JUnit output, read-only replay cache behavior, trusted model credentials, and
  separate mobile jobs. — [mobile documentation](https://e2e.tester.army/docs/mobile.md),
  [CI documentation](https://e2e.tester.army/docs/ci.md)

- The public coding-agent workflow includes an installable skill, live `e2e
  mcp` sessions, trace pages, and reports intended for agents to read while
  writing and debugging tests. — [coding-agent documentation](https://e2e.tester.army/docs/coding-agents.md)

- The PoC’s `runner` config type accepts both `'playwright'` and `'e2e'`, but
  `runBenchmark` always starts Playwright, always writes `runner: 'playwright'`,
  and does not dispatch through a `RunnerAdapter`. The e2e files are invoked by
  a separate package script and are not part of the TrenGuard benchmark report.
  — [`src/benchmark/config.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/benchmark/config.ts),
  [`src/benchmark/runner.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/benchmark/runner.ts),
  [`scripts/proofforge.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/scripts/proofforge.ts),
  [`package.json`](file:///Users/tharunkumarl/Full%20Stack/pocs/package.json)

- The e2e adapter config sets `cache: 'off'`, and the adapter test contains no
  `agent.act`, `agent.assert`, or model configuration. Therefore the successful
  optional run proves current deterministic web API compatibility only; it does
  not prove cache recording, replay, handoff, stale-recording detection, or
  wrong-entity safety. — [`testerarmy.e2e.config.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/testerarmy.e2e.config.ts),
  [`testerarmy-tests/checkout.e2e.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/testerarmy-tests/checkout.e2e.ts),
  [cache documentation](https://raw.githubusercontent.com/tester-army/e2e/main/docs/cache.mdx)

- The classifier marks every applicable mutated run with status `FAIL` as
  `DETECTED`. It does not match the mutation’s declared expected failure signal,
  assertion ID, or business oracle, so an unrelated assertion failure can be
  counted as a successful detection. The runner also extracts activation by
  searching a serialized health string rather than carrying a structured
  activation record through the result. — [`src/benchmark/classifier.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/benchmark/classifier.ts),
  [`src/benchmark/runner.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/benchmark/runner.ts),
  [`src/mutations.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/mutations.ts)

- The report reader performs a hand-written shallow shape check. The JSON
  schemas exist, but the current implementation does not validate report JSON
  against `schemas/result.schema.json` or configuration JSON against
  `schemas/experiment.schema.json`; the config validator also omits several
  fields and constraints described in the specification. — [`src/benchmark/report.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/src/benchmark/report.ts),
  [`scripts/proofforge.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/scripts/proofforge.ts),
  [`schemas/result.schema.json`](file:///Users/tharunkumarl/Full%20Stack/pocs/schemas/result.schema.json),
  [`schemas/experiment.schema.json`](file:///Users/tharunkumarl/Full%20Stack/pocs/schemas/experiment.schema.json)

- `pnpm run lint` fails with `ERR_PNPM_NO_SCRIPT`; `package.json` has no lint,
  format, or check script. A bare `pnpm lint` resolved an unrelated executable
  named `lint` and printed Android lint usage, so it was not a project lint
  check. — [`package.json`](file:///Users/tharunkumarl/Full%20Stack/pocs/package.json)

- The workspace inspection found no `.github/` workflow, `LICENSE`,
  `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `AGENTS.md`,
  `docs/METRICS.md`, or demo-script file. The supplied specification lists CI,
  a license, the metrics document, and a demo script among the expected
  hiring-facing deliverables. — [`Prooforge Spec - TesterArmy.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/Prooforge%20Spec%20-%20TesterArmy.md),
  [workspace root](file:///Users/tharunkumarl/Full%20Stack/pocs/)

- The local workspace is not currently a Git repository: `git status --short
  --branch` returned “not a git repository.” Consequently there is no local
  commit/PR history demonstrating reviewability or maintainer practice. —
  [workspace root](file:///Users/tharunkumarl/Full%20Stack/pocs/)

- The benchmark runs only Chromium and the current checked-in configuration
  uses one repetition. The limitations document explicitly discloses the
  Chromium-only scope, small mutation set, lack of live agent/replay result,
  and descriptive rather than statistical rates. — [`playwright.benchmark.config.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/playwright.benchmark.config.ts),
  [`proofforge.config.ts`](file:///Users/tharunkumarl/Full%20Stack/pocs/proofforge.config.ts),
  [`docs/LIMITATIONS.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/LIMITATIONS.md)

- `artifacts/`, `data/`, `dist/`, test results, and `.e2e/` are ignored. The
  current machine has a real report, but a fresh clone will not receive the
  shown artifact unless a sanitized sample is moved to a tracked fixture or
  generated by CI. — [`.gitignore`](file:///Users/tharunkumarl/Full%20Stack/pocs/.gitignore),
  [`artifacts/latest/summary.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/artifacts/latest/summary.md)

### Inferences

- **Most serious technical gap: the benchmark can overclaim detection.** A
  classifier that treats any failure as detection is not yet measuring the
  intended property. TesterArmy’s public project emphasizes deterministic
  checks, structured reports, and explicit behavior contracts; TrenGuard
  needs the same discipline inside its own oracle before adding more features.

- **Most serious TesterArmy-specific gap: the project currently demonstrates
  compatibility, not insight into e2e.** A no-model locator test is valuable,
  but it does not exercise the product’s differentiator: a verified agent step,
  replay, safe handoff, and final business-state validation.

- **Most serious submission gap: it is not review-ready as an open-source
  repository.** A hiring reviewer should be able to clone it, run one standard
  check command, inspect a CI result, understand contribution/security rules,
  and see a tracked sanitized example. The current workspace makes a reviewer
  reconstruct too much from ignored local artifacts and ad hoc commands.

- **Cross-platform absence is a scope limitation, not automatically a flaw.**
  The specification correctly made mobile a stretch goal. It becomes a hiring
  weakness only if the submission implies that it evaluates the full e2e
  platform rather than one deterministic web slice.

- The transient Playwright trace/artifact cleanup failure should be treated as a
  reliability issue worth fixing or explicitly isolating before submission.
  Even though the rerun passed, a reviewer running the same command once should
  not see an unexplained failure in the harness that claims to measure test
  reliability.

### Gaps

- No model-backed run or replay recording was performed in this review. The
  project’s own documentation says it does not fabricate such results, and no
  model credential was required or used. — [`docs/REPLAY_SAFETY.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/REPLAY_SAFETY.md)

- No mobile simulator/emulator was available in the inspected PoC evidence, so
  the cross-platform question remains untested rather than disproven.

- No external code review, benchmark replication, or mutation corpus review
  was available. The current judgment is based on source inspection and local
  execution.

## 3. What prioritized next steps make this a credible hiring submission?

### Takeaway

**Judgment:** Do not broaden the product first. Spend the next iteration on
truthful classification, repeatable delivery, and one small but real replay
experiment. The ideal submission is a narrow repository that a reviewer can run
from a clean clone, understand quickly, and challenge without discovering that
the headline result depends on hidden artifacts or a permissive classifier.

### Cited Findings

- The specification’s phase gates put deterministic baseline health before
  mutation work, mutation isolation before the runner/classifier, and report
  correctness before optional e2e integration. It also explicitly requires
  actual output, limitations, CI, and a 90–120 second demo for hiring polish. —
  [`Prooforge Spec - TesterArmy.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/Prooforge%20Spec%20-%20TesterArmy.md)

- TesterArmy’s public contribution workflow treats tests, schemas, docs,
  security, benchmarks, and verification evidence as one change rather than
  separate polish. Its CI docs also expect reports/artifacts to be uploaded and
  model credentials to be restricted to trusted code. — [e2e CONTRIBUTING.md](https://raw.githubusercontent.com/tester-army/e2e/main/CONTRIBUTING.md),
  [e2e AGENTS.md](https://raw.githubusercontent.com/tester-army/e2e/main/AGENTS.md),
  [e2e CI documentation](https://e2e.tester.army/docs/ci.md)

- The public cache documentation defines the evidence needed for a replay
  experiment: starting route, control matching, end-state changes, replayed/
  handed-off/missed status, and reasons such as `target-not-found`,
  `target-ambiguous`, or `end-mismatch`. — [e2e cache documentation](https://raw.githubusercontent.com/tester-army/e2e/main/docs/cache.mdx)

### Inferences

#### P0 — Make the existing claim trustworthy and cloneable

1. **Fix the classifier/oracle contract before adding mutations.** Carry a
   structured mutation activation record, expected failure signal, assertion
   IDs, and independent business-oracle evidence into `RunResult`. Require the
   expected assertion or oracle to fail for `DETECTED`; classify unrelated
   failures as `INCONCLUSIVE` or a separate invalid-trial outcome. Wire the
   existing JSON schemas into actual validation, add fixture-valid/invalid
   tests, and cover every classifier branch. Basis: the current permissive
   logic in `src/benchmark/classifier.ts` and the contract discipline in the
   public [CONTRIBUTING.md](https://raw.githubusercontent.com/tester-army/e2e/main/CONTRIBUTING.md).

   **Acceptance evidence:** a test where the mutated run fails for the wrong
   reason is not counted as detected; mutation activation failure is
   inconclusive; the report contains structured evidence and passes the schema
   validator.

2. **Add one deterministic check command and CI.** Add real `lint`, `format` or
   format-check, `typecheck`, unit, Playwright, mutation-proof, and benchmark
   scripts; add a GitHub Actions workflow that runs the credential-free core on
   a supported Node matrix. Run the benchmark with a unique output directory in
   CI and upload the JSON/Markdown/evidence artifacts. Make the Node statement
   explicit: core Playwright may run on the current Node, while current e2e
   requires Node 24.8+ or Node 22.22.3+. Basis: `package.json`, the current
   public [README](https://raw.githubusercontent.com/tester-army/e2e/main/README.md),
   and [CI guidance](https://e2e.tester.army/docs/ci.md).

   **Acceptance evidence:** a fresh clone can run one documented command and
   gets a green CI result without credentials; a clean repeated run does not
   collide in `test-results` or artifact directories.

3. **Resolve the Playwright artifact cleanup failure.** Reproduce it in a
   clean output directory, determine whether it is caused by retained tracing,
   artifact cleanup, or process lifecycle, then either fix the root cause or
   make the CI profile use a documented stable trace mode. Do not hide an
   assertion failure; preserve useful failure evidence.

4. **Complete the open-source submission surface.** Add an appropriate
   license, `CONTRIBUTING.md`, `SECURITY.md`, code of conduct, contributor/agent
   guidance, `docs/METRICS.md`, and a short demo script. Track a sanitized
   sample report under `docs/` or `examples/` instead of committing local
   orders, raw traces, or secrets. Create the actual Git repository only when
   the files and clean checks are ready, then use small reviewable commits.
   Basis: the missing workspace files and the public e2e repository’s
   [contribution](https://raw.githubusercontent.com/tester-army/e2e/main/CONTRIBUTING.md)
   and [agent guidance](https://raw.githubusercontent.com/tester-army/e2e/main/AGENTS.md).

#### P1 — Add one defensible TesterArmy-specific result

5. **Implement the e2e adapter contract for real, or narrow the claim.** Add a
   small `RunnerAdapter` interface and make `runner: 'e2e'` either dispatch to
   it or be rejected clearly. Keep Playwright independent. Parse the e2e
   report JSON rather than console text, record `e2e` and engine versions, and
   make missing credentials a skip with an explicit report status. The present
   separate test is a good starting point but must not be described as an
   integrated benchmark runner until this is true.

   **Acceptance evidence:** the same S2 trial can run through Playwright and
   through the current public e2e API, with runner identity and evidence in the
   result, while the core command remains credential-free.

6. **Run a minimal replay-safety experiment.** Use one `agent.act` followed by
   an exact locator or `agent.assert` so a recording is eligible to be written.
   Replay once with the same route/data, then change exactly one variable: list
   order, selected account, route query, or persisted state. Record cache mode,
   reason, handoff/refusal, final business state, and whether the wrong record
   was touched. Use a supported Node runtime and a separately gated credential
   path; sanitize or exclude cache artifacts from the default core run.
   Prefer a safe refusal or handoff over a high replay-success percentage. Basis:
   [cache documentation](https://raw.githubusercontent.com/tester-army/e2e/main/docs/cache.mdx)
   and the existing [`docs/REPLAY_SAFETY.md`](file:///Users/tharunkumarl/Full%20Stack/pocs/docs/REPLAY_SAFETY.md).

   **Acceptance evidence:** one actual report shows `replayed`, `handed off`,
   or `missed`, explains why, and independently verifies that no wrong entity
   was modified. If credentials are unavailable, the report says “not run” and
   the core benchmark remains green.

7. **Increase evidence quality without pretending to generalize.** Run several
   repetitions with isolated state, publish exact counts and run-to-run
   variance, and add at least one held-out mutation or independently reviewed
   mutation rationale. Keep the six current mutations, but distinguish catalog
   coverage from application correctness. Do not lead with a confidence
   interval unless the sampling protocol supports it.

#### P2 — Demonstrate breadth only after P0/P1 are green

8. **Add a small mobile proof only if the environment is available.** Reuse one
   business-outcome scenario against a minimal Expo/React Native or native
   fixture and show the shared e2e test shape. Do not claim mobile support from
   a web adapter or from unexecuted config. The target is relevant because the
   public framework advertises one API across web, iOS, and Android. — [mobile
   documentation](https://e2e.tester.army/docs/mobile.md)

9. **Add an agent-native workflow artifact.** Document how a coding agent can
   start the app, inspect it through `e2e mcp`, write a regression test, and
   read the report. This is a better alignment signal than adding a larger
   dashboard because the public project explicitly treats skills, MCP, traces,
   and reports as developer-facing surfaces. — [coding-agent documentation](https://e2e.tester.army/docs/coding-agents.md)

10. **Send a focused upstream-facing follow-up.** After the replay experiment,
    write a one-page technical note with one measured observation and one
    specific improvement opportunity for e2e, such as a report field, replay
    diagnostic, or adapter/testing seam. A small issue or contribution grounded
    in an actual reproduction will signal open-source judgment better than a
    list of speculative features.

### Gaps

- The plan assumes time for CI and repository packaging, plus access to a
  supported Node runtime and optionally a model provider. The credential-free
  P0 path should be completed even if the model-backed P1 experiment cannot be
  run.

- A mobile addition depends on simulator/emulator setup and should remain
  optional. The current public docs make that environment requirement explicit.
  — [mobile documentation](https://e2e.tester.army/docs/mobile.md)

- No plan can guarantee a hiring outcome because the current public sources do
  not expose the team’s private hiring rubric. The plan optimizes for the
  strongest observable engineering signals: reproducibility, public-contract
  discipline, safe agent boundaries, useful artifacts, and an evidence-backed
  contribution path.
