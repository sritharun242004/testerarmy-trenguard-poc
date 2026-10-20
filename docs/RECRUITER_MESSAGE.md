# Recruiter handoff

## Subject

`TrenGuard — a green checkout test that misses a missing order`

## Message

Hi [Name],

I built **TrenGuard** around a concrete verification failure: checkout shows
`Order confirmed`, but no order is saved. Under the injected M1 regression,
the banner-only S1 test passes (**MISSED**); S2 checks persisted history and
the total after reload and catches it (**DETECTED**). In the recorded trial,
S2 fails at its first history assertion, before reload. A separate order API
check confirms zero persisted orders in both trials.

The local Playwright benchmark runs isolated healthy and mutated trials without
model credentials. One curated run detected **6/7 applicable scenario–mutation
pairs (85.7%)**, with **0/6 healthy-baseline false failures** and **0/7
inconclusive pairs**. Those counts describe this fixture and six-mutation
catalog—not universal accuracy or TesterArmy performance.

- [Repository and reproduction steps](https://github.com/sritharun242004/testerarmy-trenguard-poc)
- [Readable report summary and sanitized M1 evidence](https://github.com/sritharun242004/testerarmy-trenguard-poc/blob/main/docs/SAMPLE_REPORT.md)
- [S1/S2 source](https://github.com/sritharun242004/testerarmy-trenguard-poc/blob/main/benchmark-tests/scenarios.spec.ts#L8-L29)
- [Verified Linux CI run](https://github.com/sritharun242004/testerarmy-trenguard-poc/actions/runs/39433113320)
- [Live storefront walkthrough](https://testerarmy-trenguard-poc.vercel.app/checkout)
  — cookie-backed browser state, not the local benchmark report.

The optional TesterArmy `e2e` example uses deterministic locators/assertions
with caching off. It is not an `agent.act()` or replay evaluation, and no
defect in TesterArmy has been proven.

My next experiment would use one fixed `agent.act()` checkout instruction
with banner-only versus persisted-history-after-reload verification, each on
healthy and M1 apps with fresh state and caching off. Comparing those outcomes
with the independent order API count would test whether the same contrast
holds for agent-driven checkout.

Best,
Tharun

## Before sending

The linked CI run passed both jobs, and its downloaded report matches the
local 42-trial classifications. Recheck the latest main-branch status and
public README/sample links before sending. The optional compatibility scope
is documented in [REPLAY_SAFETY.md](REPLAY_SAFETY.md).

Video is last: add a link only after the recording exists and has been verified.
