# TrenGuard project rules

- Treat `Prooforge Spec - TesterArmy.md` as the source of truth supplied for
  this workspace.
- Implement one phase at a time. Do not begin Phase 2 until Phase 1's healthy
  baseline acceptance gate passes and the user approves it.
- Keep the core benchmark local, deterministic, and free of model credentials.
- Do not add TesterArmy `e2e` integration until its current public API is
  re-checked and an optional adapter can remain independent of Playwright.
- Keep secrets, `.env` files, browser recordings, and local order data out of
  source control.
- Report only checks that were actually run.
