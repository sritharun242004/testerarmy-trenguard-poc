# Agent contribution notes

Read `CLAUDE.md`, `Prooforge Spec - TesterArmy.md`, and the relevant files in
`docs/` before editing.

The benchmark must remain local, deterministic, and free of model credentials.
The optional TesterArmy adapter must not become a dependency of the core
runner. Report only commands that were actually run and keep generated local
artifacts ignored unless a sanitized sample is intentionally documented.
