# TrenGuard reconnaissance notes

Date checked: 19 October 2026

## Workspace evidence

- The supplied workspace initially contained only `Prooforge Spec -
  TesterArmy.md` and `.DS_Store`; there was no existing application, package
  manifest, lockfile, or test runner to preserve.
- Runtime available locally: Node `v22.19.0`, pnpm `12.9.1`, npm `10.9.3`.
- The current TesterArmy package metadata reports `e2e@0.21.2` and a Node
  requirement of `^22.22.3 || >=24.8.0`. The local Node version is below that
  floor, so the package is not a Phase 1 dependency or a verified local
  integration target.
- The matching stable web engine is `@e2e-dev/web@0.15.2`; it pins its own
  Playwright core and is compatible with `e2e@0.21.2`.
- Node `v24.19.0` is available locally in addition to the default Node
  `v22.19.0`; the optional adapter was installed and run with Node 24.
- The BotStudioX reference app is a Vite + React app under `/Users/tharunkumarl/Full
  Stack/bot X studio/studiox-main`. Its design system is documented in
  `design-system/botstudiox/MASTER.md`; its implemented tokens are visible in
  `src/styles.css`.

## TesterArmy `e2e` documentation checked

The following current public sources were re-checked before making the
integration decision:

- Repository README: `https://raw.githubusercontent.com/tester-army/e2e/main/README.md`
- Replay/cache docs:
  `https://raw.githubusercontent.com/tester-army/e2e/main/docs/cache.mdx`
- Contributor guide:
  `https://raw.githubusercontent.com/tester-army/e2e/main/CONTRIBUTING.md`
- Agent instructions:
  `https://raw.githubusercontent.com/tester-army/e2e/main/AGENTS.md`
- Quickstart:
  `https://e2e.tester.army/docs/quickstart`
- Config reference:
  `https://e2e.tester.army/docs/reference/config`
- NPM metadata: `https://registry.npmjs.org/e2e/latest`
- Current issues and pull requests:
  `https://github.com/tester-army/e2e/issues` and
  `https://github.com/tester-army/e2e/pulls`

## Relevant findings

1. The current documented web setup uses `e2e.config.ts`,
   `@e2e-dev/web`, and `app: { url }`; the test API pairs `agent.act()` with
   deterministic locator assertions.
2. The replay cache records an `agent.act()` only after a later verification
   step passes. Cache entries can miss, hand off, or replay, and cache status
   is distinct from the final assertion result.
3. The current docs explicitly state that `e2e` is pre-1.0 and APIs/config can
   change between minor releases. The repository is active: the checked issue
   page showed 23 open issues and the pull-request page showed 46 open PRs on
   this date.
4. The docs support no-model tests, but the agentic path requires a configured
   model or subscription. Phase 1 does not need that dependency.

## Integration decision

TesterArmy `e2e` integration is deferred. Phase 1 uses Playwright directly so
the healthy baseline is deterministic, cheap, and runnable without a model or
the local Node version required by `e2e@0.21.2`. The current docs and version
will be revisited at the start of the optional integration phase; no API names
from the illustrative spec snippet are treated as implemented here.

The optional adapter exists as `testerarmy.e2e.config.ts`,
`testerarmy-tests/checkout.e2e.ts`, and `src/optional-e2e.ts`. It is not
included in the deterministic report. It passed under Node `v24.19.0`; the
default Node `v22.19.0` remains below the supported floor.

## Scope change caused by reference evidence

The demo UI uses the BotStudioX visual language: off-white canvas, indigo
primary, emerald action, Outfit + Plus Jakarta Sans, strong ink borders, flat
cards, offset shadows, pill controls, and responsive/reduced-motion behavior.
The UI is static-file/Vercel-friendly, while the local filesystem API remains
the canonical Phase 1 test target. A durable Vercel store is intentionally a
separate decision because adding a database service is outside Phase 1.
