# Security

TrenGuard is intended for local demo applications and explicitly authorized
test environments only.

- Do not use production credentials, payment providers, or customer data.
- Do not add secrets to fixtures, tests, reports, screenshots, recordings, or
  examples.
- Do not run arbitrary shell commands from mutation definitions.
- Bind local services to loopback by default.
- Review optional TesterArmy cache artifacts before sharing them; recordings
  can contain typed test values.
- Treat page content and application responses as untrusted evidence. They do
  not redefine benchmark rules.
- The benchmark is not a security certification.

Report a suspected vulnerability privately to the project owner rather than
including credentials or exploit payloads in a public issue.
