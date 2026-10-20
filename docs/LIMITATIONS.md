# TrenGuard limitations

- The persistence implementation is a local JSON file, selected to keep the
  first slice cheap and deterministic. It is not a production database.
- The Vercel configuration serves the UI routes, but the local JSON API is not
  a durable hosted persistence solution. Choose and document a hosted storage
  adapter before using Vercel as a benchmark target.
- The browser tests and benchmark runner use only Chromium.
- The mutation catalog is intentionally small and reviewed; it is not a
  representative sample of all possible regressions.
- The optional TesterArmy `e2e` adapter passes under the supported local Node
  24 runtime, but it uses deterministic locators/assertions only. No live
  agent/replay result is claimed.
- The current rates are descriptive observations from one local run, not
  confidence intervals or universal quality estimates.
- The fixture set is intentionally small and cannot support universal claims
  about test quality.
