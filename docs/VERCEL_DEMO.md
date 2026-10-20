# TrenGuard Vercel demo

**Public URL:** https://testerarmy-trenguard-poc.vercel.app/checkout

## What is hosted

The Vercel deployment serves the TrenGuard UI from `public/` and the demo API
from `api/demo.ts`. Explicit `/api/:path*` rewrites route nested API paths to
that function; plain Vercel Functions do not use Next.js catch-all semantics.
The hosted routes cover checkout, order history,
settings, protected admin access, catalog search, record updates, reset, and
the `/health` check.

## Deployment

From the repository root, with the Vercel CLI authenticated:

```bash
npx --yes vercel@64.7.0 link --yes --project sritharun242004-testerarmy-trenguard-poc
npx --yes vercel@64.7.0 deploy --prod
```

After deployment, verify the URL:

```bash
curl -fsS https://testerarmy-trenguard-poc.vercel.app/health
```

The response should include `"status":"ok"` and `"hosted":true`.
The Vercel project retains its original name; the connected repository is now
`sritharun242004/testerarmy-trenguard-poc`.

The short domain is registered as a production domain on that project. A bare
alias initially redirected to Vercel authentication; attaching it as a project
domain made it publicly accessible without disabling preview protection.

CLI 48.4.1 could not build the project's Node 24 runtime. CLI 64.7.0 supports it
and the pnpm 12 multi-document lockfile; use the pinned CLI above without
changing any global installation. `vercel.json` pins the install command to
pnpm 12.9.1 and the output directory to `public/`.

## Hosted-state boundary

The local benchmark intentionally keeps its JSON filesystem store. Vercel
Functions do not provide a durable writable filesystem, so the hosted demo
stores its small fixture state in an HttpOnly browser cookie for up to one hour.
That makes the recruiter flow work across navigation and reloads without
requiring credentials or a database, but it has important limits:

- state is per browser, not shared between users;
- state can disappear when the cookie expires or is cleared;
- the unsigned cookie is a demo transport, not a trusted persistence layer;
- at most eight orders and 3,800 cookie bytes are accepted; further writes
  return a reset instruction rather than pretending to save;
- hosted results must not be used as benchmark evidence;
- a production deployment would need a durable database and server-side
  authorization.

The cookie has `Secure`, `HttpOnly`, and `SameSite=Lax` attributes. Do not enter
private information. The fixture admin check is not real account authorization.
Concurrent tabs can overwrite cookie state; this demo is a sequential walkthrough.
`.vercelignore` excludes local reports, recordings, research, and environment
files from the upload. `.vercel/` and all generated artifacts remain git-ignored.

The benchmark command remains local and deterministic:

```bash
pnpm benchmark
```

## Recruiter walkthrough

1. Open `/checkout`.
2. Place the TrenGuard Notebook order.
3. Open `/orders` and show the exact `$25.98` total.
4. Reload `/orders` to show the browser-scoped hosted state.
5. Reset the demo before handing the link to another person.

For mutation evidence and the 6/7 result, use the locally generated
`artifacts/latest/summary.md` and `artifacts/latest/dashboard.html`; do not
claim that the Vercel cookie demo ran the benchmark.

## Verification

Commands run during deployment preparation:

- `pnpm check` — typecheck, build, 88 Node tests, four Playwright tests, and
  one M1 mutation test passed.
- `pnpm benchmark` — rerun after the data-path isolation fix: 6/7 detected,
  1/7 missed, 0/6 false failures, 0/7 inconclusive, and 29 not applicable.
- `npx --yes vercel@64.7.0 build` — local Vercel build passed after moving
  from CLI 48.4.1. Subsequent production builds passed with explicit API rewrites.
- `npx --yes vercel@64.7.0 deploy --prod --yes` — production deployment ready.
- `pnpm exec tsx scripts/smoke-hosted.ts https://testerarmy-trenguard-poc.vercel.app`
  — passed against the public HTTPS URL in a fresh browser without Vercel login.

The live check covers checkout/reload, cookie flags, browser isolation,
settings, record updates, search, admin denial, reset after malformed cookie
state, and a 390px-wide layout. It found and verified fixes for nested function
routing and mobile navigation overflow. It is a demo smoke check, not a mutation
benchmark or production security audit.

Video work is deferred at the user's request; no finished video link is part
of this handoff.
