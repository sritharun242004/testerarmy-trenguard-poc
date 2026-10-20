# TrenGuard recruiter walkthrough

**Status:** Recorded and verified locally on 20 October 2026, after the CI repair
and evidence-led handoff were published. The MP4 is ready to attach or review;
it has not been uploaded publicly or committed to git.

A silent, captioned **actual browser-session recording**, targeting 105 seconds.
Playwright drives one fresh Chromium page through the real local app, then opens
the completed local benchmark's source, evidence and generated HTML dashboard.
Captions explain what is happening; app responses and benchmark results are real.

## Reproduce

From the repository root, with the existing dependencies, Chromium, `ffmpeg` and
`ffprobe` installed:

```bash
pnpm exec tsx scripts/record-demo.ts --benchmark
```

`--benchmark` runs `pnpm benchmark` first with disposable local persistence. Do
not run another benchmark concurrently: both use `artifacts/latest/`. To record
an already-generated report, omit `--benchmark`. The script always reads
`artifacts/latest/results.json`; it never substitutes sample report values.

Headed Chromium is the default, with headless fallback if headed launch fails.
`--headless` explicitly selects headless recording. There is no remote target:
the hosted demo and the local benchmark have different persistence semantics.

## Recording sequence

| Time | Actual browser content |
| --- | --- |
| 0–16 s | Healthy checkout; fixed customer, two notebooks, expected `$25.98` |
| 16–28 s | Place order, confirmation, then one persisted order in history |
| 28–35 s | Reload and assert the exact `$25.98` total again |
| 35–45 s | Second local instance's `/health` shows `M1_ACTIVE`; checkout still confirms |
| 45–53 s | M1 history is empty, including after reload; API independently checked |
| 53–64 s | Actual S1/S2 source from `benchmark-tests/scenarios.spec.ts` |
| 64–76 s | Actual S2/M1 assertion failure and structured oracle evidence |
| 76–86 s | Generated dashboard, verified counts and explicit denominators |
| 86–97 s | Actual M1 rows: weak `MISSED`, strong `DETECTED` |
| 97–105 s | Recruiter takeaway and the boundary around optional TesterArmy/replay work |

The benchmark finishes **before** filming. Its test failure is shown as saved
evidence, not as a test purportedly running live. The checkout interactions
themselves happen during capture. The source/evidence pages are labelled local
file viewers; evidence excerpts omit the rest of the transcript and redact
private paths. The dashboard is served verbatim from the generated file, with
only explanatory captions and temporary row highlighting added in the browser.

## Isolation and verification

- Two owned app processes use distinct ephemeral loopback ports and fresh JSON
  files under `artifacts/demo/.state-*`. The report viewer uses a third ephemeral
  loopback port. Existing app instances and user browser profiles are not used.
- App processes and benchmark trials use `PROOFFORGE_DATA_FILE` for isolated
  JSON files. The server also accepts the original `PROOFORGE_DATA_FILE` spelling
  for compatibility, but the canonical spelling takes precedence. A process-level
  regression test verifies two servers do not share state.
- Child processes inherit runtime essentials only, without model credentials or
  app settings. Fresh browser context; no login, saved profile or storage state.
  Browser requests are restricted to the three owned local origins. External
  font requests are blocked, so the app uses its existing system-font fallbacks.
- The script checks all six healthy baselines, the default 42-trial catalog,
  activation markers, classifications, expected signals and recalculated
  metrics. It verifies S1/M1 passed and was `MISSED`, S2/M1 failed and was
  `DETECTED`, and the saved failure says expected one order, received zero.
- Every dashboard row and rate is compared with `results.json` before aggregate
  counts are captioned. The rates describe this fixture/catalog, not universal
  test quality. Live agent replay safety is not claimed.
- Exactly one recorded page is kept throughout. Readability holds target 105
  seconds; assertions use condition-based waits. A scene that overruns its
  reading budget aborts instead of silently retiming footage.
- `finally` closes the browser, report server and owned process groups, removes
  temporary state and checks the owned endpoints are no longer listening.
  SIGINT/SIGTERM trigger this cleanup. An exclusive `.recording-lock` prevents
  simultaneous recorders; after an uncatchable kill, inspect leftover processes
  before removing that stale lock and rerunning.

## Outputs (ignored)

All recording artifacts stay under the already-ignored `artifacts/demo/`:

- `trenguard-demo.mp4` — H.264, 1600 × 900, `yuv420p`, fast-start, silent.
- `trenguard-demo.webm` — original continuous Playwright capture.
- `frames/` — eleven PNG frames extracted **from the MP4**, not staged screenshots.
- `ffprobe.json` — measured streams and duration; the script requires 90–120 s.
- `recording.json` — scene timing, actual child commands, benchmark timestamp,
  SHA-256 input hashes, metrics, browser mode and verified cleanup.
- `inputs/` — frozen dashboard, source, sanitized report/evidence and local viewers.
- `benchmark.log` — actual benchmark command output when `--benchmark` is used.

Conversion uses the installed `ffmpeg` with `libx264`, CRF 18 and `+faststart`.
It does not stitch scenes, change playback speed, extend frames, add audio or
render a marketing animation. `ffprobe` verifies the MP4's length, codec,
resolution and absence of audio. Reproduction repeats the same actions and
checks; encoded bytes, process ports and wall-clock timing can differ.

## Executed verification

Executed from the repository root:

```bash
pnpm exec tsx scripts/record-demo.ts
pnpm typecheck
ffprobe -v error -show_entries format=duration,size:stream=codec_type,codec_name,width,height,pix_fmt -of json artifacts/demo/trenguard-demo.mp4
ffmpeg -v error -i artifacts/demo/trenguard-demo.mp4 -f null -
```

- Capture completed in headed Chromium with one recorded page, no page errors,
  and verified cleanup of all three owned local servers.
- Input was the already-completed local benchmark starting
  `2026-10-20T13:38:19.219Z`. This invocation did **not** rerun the benchmark.
  `recording.json` stores the input hashes and records that distinction.
- Measured output: **113.52 seconds**, **1600 × 900**, H.264, `yuv420p`,
  one video stream, no audio, **4,321,544 bytes**. The 105-second scene schedule
  is distinct from the measured encoded duration.
- Inspected all eleven extracted MP4 frames plus a frame at 112.5 seconds:
  healthy `$25.98` history, M1 activation/confirmation/empty history, readable
  source and assertion evidence, dashboard totals, highlighted M1 rows, and
  closing limitations. This is sampled frame inspection, not a claim of a
  manual full-length playback review.
- `pnpm typecheck` passed. The MP4, input snapshots and recording metadata
  remain ignored. `benchmark.log` is only regenerated when `--benchmark` is
  used; use this recording's metadata and input hashes for provenance.
- Full-video decoding with `ffmpeg` completed without errors.

The recorder's process-group cleanup was exercised on macOS; Windows recording
is not validated. The optional `ffmpeg` tools are needed only for recording,
not for the core benchmark or CI.
