# TrenGuard limitations

- The persistence implementation is a local JSON file, selected to keep the
  first slice cheap and deterministic. It is not a production database.
- The Vercel demo uses an HttpOnly browser cookie for short-lived per-browser
  state. It is suitable for a recruiter walkthrough, but it is not durable
  multi-user storage and must not be presented as the production persistence
  implementation or hosted benchmark oracle.
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
