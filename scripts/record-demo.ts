import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect, type Browser, type Locator, type Page } from '@playwright/test';

import { classifyMutation } from '../src/benchmark/classifier.js';
import { calculateMetrics } from '../src/benchmark/metrics.js';
import { readReport } from '../src/benchmark/report.js';
import { findMutation } from '../src/mutations.js';

// Deliberately local-only: a hosted cookie-backed demo is a different experiment.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts/demo');
const latest = path.join(root, 'artifacts/latest');
const viewport = { width: 1600, height: 900 };
const targetSeconds = 105;
const args = new Set(process.argv.slice(2));
assert([...args].every((arg) => ['--benchmark', '--headless'].includes(arg)),
  'Usage: pnpm exec tsx scripts/record-demo.ts [--benchmark] [--headless]');

// Only runtime essentials are inherited; no model credentials or user app settings.
const childEnv: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
for (const key of ['TMPDIR', 'LANG', 'LC_ALL', 'SystemRoot']) {
  if (process.env[key]) childEnv[key] = process.env[key];
}
const children: ChildProcess[] = [];
const commands: Array<{ command: string; args: string[] }> = [];
const scenes: Array<{ name: string; startSeconds: number; endSeconds: number; url: string }> = [];
const interrupted = new AbortController();
const onSignal = () => interrupted.abort(new Error('Recording interrupted.'));
process.once('SIGINT', onSignal);
process.once('SIGTERM', onSignal);

function sanitize(value: string): string {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replaceAll(root, '[project]')
    .replaceAll(process.env.HOME ?? '/Users/unknown', '[home]')
    .replace(/\/(?:private\/)?(?:var\/folders|tmp)\/[^\s"<>]+/g, '[temporary-path]');
}

function launch(command: string, commandArgs: string[], env = childEnv): ChildProcess {
  interrupted.signal.throwIfAborted();
  commands.push({ command: sanitize(command), args: commandArgs.map(sanitize) });
  const child = spawn(command, commandArgs, {
    cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  return child;
}

async function execute(command: string, commandArgs: string[], timeoutMs = 120_000, env = childEnv): Promise<string> {
  const child = launch(command, commandArgs, env);
  let stdout = '';
  let stderr = '';
  child.stdout!.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  child.stderr!.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  return await new Promise<string>((resolve, reject) => {
    const cancel = () => { void stop(child).catch(() => {}); reject(new Error(`${command} cancelled or timed out.`)); };
    const timer = setTimeout(cancel, timeoutMs);
    interrupted.signal.addEventListener('abort', cancel, { once: true });
    const clean = () => { clearTimeout(timer); interrupted.signal.removeEventListener('abort', cancel); };
    child.once('error', (error) => { clean(); reject(error); });
    child.once('close', (code) => {
      clean();
      if (code === 0) resolve(stdout);
      else reject(new Error(sanitize(`${command} exited ${code}\n${stdout}\n${stderr}`)));
    });
  });
}

async function stop(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  const signalGroup = (signal: NodeJS.Signals) => {
    try { process.kill(-child.pid!, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  // The pnpm benchmark wrapper can exit before descendants; stop its group too.
  signalGroup('SIGTERM');
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try { process.kill(-child.pid, 0); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return; throw error; }
    await sleep(50);
  }
  signalGroup('SIGKILL');
  await sleep(100);
}

async function freePort(): Promise<number> {
  const reservation = net.createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  assert(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function json(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
  assert(response.ok, `Local request failed: ${url}`);
  return await response.json() as Record<string, unknown>;
}

async function startApp(temp: string, mutation: 'M1' | null): Promise<string> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const label = mutation ?? 'healthy';
  const child = launch(process.execPath, ['--import', 'tsx', 'src/server.ts', '--port', String(port)], {
    ...childEnv, HOST: '127.0.0.1', PORT: String(port),
    PROOFFORGE_DATA_FILE: path.join(temp, `${label}.json`),
    PROOFFORGE_MUTATION: mutation ?? '',
  });
  let log = '';
  let spawnError: Error | undefined;
  child.once('error', (error) => { spawnError = error; });
  child.stdout!.on('data', (chunk: Buffer) => { log += chunk.toString(); });
  child.stderr!.on('data', (chunk: Buffer) => { log += chunk.toString(); });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    interrupted.signal.throwIfAborted();
    if (spawnError) throw spawnError;
    assert(child.exitCode === null, sanitize(`${label} app exited: ${log}`));
    // Wait for our child's listen message, rather than accepting a port race's server.
    if (log.includes(`listening at ${base}`)) {
      const health = await json(`${base}/health`);
      assert.equal(health.mutationId, mutation);
      assert.equal(health.mutationMarker, mutation ? 'M1_ACTIVE' : 'HEALTHY_BASELINE');
      assert.deepEqual((await json(`${base}/api/orders`)).orders, []);
      return base;
    }
    await sleep(100, undefined, { signal: interrupted.signal });
  }
  throw new Error(sanitize(`${label} app did not become ready: ${log}`));
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function viewer(title: string, provenance: string, content: string): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>body{margin:0;padding:40px 80px 150px;background:#fffdf5;color:#1e293b;font:18px system-ui}
    main{max-width:1300px;margin:auto}h1{font-size:36px;letter-spacing:-1px;margin:12px 0 20px}
    p{color:#475569;font-size:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;
    padding:22px;border:2px solid #1e293b;border-radius:12px;font:18px/1.55 ui-monospace,monospace}
    .columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}h2{font-size:21px}mark{background:#fef08a;color:inherit}</style>
    <main><p>${escapeHtml(provenance)}</p><h1>${escapeHtml(title)}</h1>${content}</main></html>`;
}

async function loadEvidence() {
  const report = await readReport(path.join(latest, 'results.json'));
  assert.equal(report.experiment.runner, 'playwright');
  assert.equal(report.experiment.repetitions, 1, 'This walkthrough expects the default single-repetition catalog.');
  assert.deepEqual(report.experiment.scenarios, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  assert.deepEqual(report.experiment.mutations, ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
  assert.equal(report.results.length, 42);
  assert.equal(new Set(report.results.map((run) => `${run.scenarioId}:${run.mutationId}`)).size, 42);
  const baselines = report.results.filter((run) => run.mutationId === null);
  assert.equal(baselines.length, 6);
  assert(baselines.every((run) => run.status === 'PASS' && run.rawExitCode === 0));
  for (const run of report.results) {
    assert(report.experiment.scenarios.includes(run.scenarioId));
    if (!run.mutationId) continue;
    const mutation = findMutation(run.mutationId);
    assert(mutation);
    const health = JSON.parse(run.evidence.appHealth) as { mutationId: string; mutationMarker: string };
    assert.equal(health.mutationId, mutation.id);
    assert.equal(health.mutationMarker, `${mutation.id}_ACTIVE`);
    const applicable = mutation.expectedAffectedScenarios.includes(run.scenarioId);
    const classification = classifyMutation({
      mutationActivated: true, applicable, baselineStatus: 'PASS', mutatedStatus: run.status,
      expectedSignalObserved: run.evidence.oracle.observed,
    });
    assert.equal(run.mutationOutcome, classification.outcome);
    assert.equal(run.reasonCode, classification.reasonCode);
    assert.equal(run.mutationOutcome, !applicable ? 'NOT_APPLICABLE'
      : run.scenarioId === 'S1' && run.mutationId === 'M1' ? 'MISSED' : 'DETECTED');
    if (applicable) assert.equal(run.evidence.oracle.expectedSignal, mutation.expectedFailureSignal);
  }
  assert.deepEqual(report.metrics, calculateMetrics(report.results), 'Stored metrics must match the observed trials.');
  const weak = report.results.find((run) => run.scenarioId === 'S1' && run.mutationId === 'M1')!;
  const strong = report.results.find((run) => run.scenarioId === 'S2' && run.mutationId === 'M1')!;
  assert.equal(weak.status, 'PASS');
  assert.equal(weak.rawExitCode, 0);
  assert.equal(strong.status, 'FAIL');
  assert.equal(strong.rawExitCode, 1);
  for (const run of [weak, strong]) {
    assert.equal(run.evidence.oracle.source, 'GET /api/orders');
    assert.deepEqual(run.evidence.oracle.details, { orderCount: 0 });
  }
  assert.equal(strong.evidence.runnerOutput, 'evidence/S2-M1-r1.json');
  const evidenceText = await readFile(path.join(latest, strong.evidence.runnerOutput), 'utf8');
  const evidence = JSON.parse(evidenceText) as { runId: string; appHealth: string; oracle: unknown; runnerOutput: string };
  assert.equal(evidence.runId, strong.runId);
  assert.deepEqual(evidence.oracle, strong.evidence.oracle);
  assert.equal(evidence.appHealth, strong.evidence.appHealth);
  const transcript = sanitize(evidence.runnerOutput);
  assert.match(transcript, /toHaveCount/);
  assert.match(transcript, /Expected: 1/);
  assert.match(transcript, /Received: 0/);
  const failureStart = transcript.indexOf('Error:');
  assert(failureStart >= 0);
  const failure = transcript.slice(failureStart).split('\n').slice(0, 12).join('\n');

  const source = await readFile(path.join(root, 'benchmark-tests/scenarios.spec.ts'), 'utf8');
  const sourceLines = source.split('\n');
  const first = sourceLines.findIndex((line) => line.startsWith("test('S1 "));
  const last = sourceLines.findIndex((line) => line.startsWith("test('S3 "));
  assert(first >= 0 && last > first);
  const excerpt = sourceLines.slice(first, last).map((line, index) => {
    const text = `${String(first + index + 1).padStart(2)}  ${line}`;
    return /toHaveCount\(1\)|toHaveText\('\$25.98'\)/.test(line)
      ? `<mark>${escapeHtml(text)}</mark>` : escapeHtml(text);
  }).join('\n');
  const pages = new Map<string, string>();
  const dashboard = await readFile(path.join(latest, 'dashboard.html'), 'utf8');
  assert.equal(sanitize(dashboard), dashboard, 'Dashboard must not expose private paths.');
  pages.set('/dashboard.html', dashboard); // Serve the generated file verbatim.
  pages.set('/source', viewer('The difference is the assertion.',
    'Actual repository source · benchmark-tests/scenarios.spec.ts · S1 and S2 excerpt',
    `<pre style="font-size:17px;line-height:1.35">${excerpt}</pre>`));
  pages.set('/evidence', viewer('A failed assertion + an independent oracle.',
    `Actual generated evidence · artifacts/latest/${strong.evidence.runnerOutput} · excerpts; private paths redacted`,
    `<div class="columns"><section><h2>Observed assertion failure</h2><pre>${escapeHtml(failure)}</pre></section>
    <section><h2>Structured evidence from the same trial</h2><pre>${escapeHtml(JSON.stringify({
      runId: evidence.runId, appHealth: JSON.parse(evidence.appHealth), oracle: evidence.oracle,
    }, null, 2))}</pre></section></div>`));
  await mkdir(path.join(output, 'inputs'), { recursive: true });
  await writeFile(path.join(output, 'inputs/results.json'), sanitize(JSON.stringify(report, null, 2)));
  await writeFile(path.join(output, 'inputs/S2-M1-r1.json'), sanitize(evidenceText));
  await writeFile(path.join(output, 'inputs/scenarios.spec.ts'), source);
  for (const [route, html] of pages) {
    await writeFile(path.join(output, 'inputs', route === '/dashboard.html' ? 'dashboard.html' : `${route.slice(1)}.html`), html);
  }
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  return { report, weak, strong, pages, hashes: {
    results: hash(await readFile(path.join(latest, 'results.json'), 'utf8')),
    dashboard: hash(dashboard), evidence: hash(evidenceText), source: hash(source),
  } };
}

async function caption(page: Page, title: string, detail: string): Promise<void> {
  await page.evaluate(({ title, detail }) => {
    let host = document.getElementById('trenguard-recording-caption');
    if (!host) {
      host = document.createElement('div');
      host.id = 'trenguard-recording-caption';
      host.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;pointer-events:none';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>:host{all:initial}.caption{box-sizing:border-box;height:118px;padding:16px 44px;
        background:#152434;color:#fff;border-top:4px solid #a78bfa;font-family:system-ui,sans-serif}
        small{display:block;color:#c4b5fd;font-size:12px;letter-spacing:1px;margin-bottom:7px}
        strong{display:block;font-size:23px;font-weight:650;line-height:1.25}p{margin:6px 0 0;font-size:18px;color:#e2e8f0}</style>
        <div class="caption"><small></small><strong></strong><p></p></div>`;
      document.body.append(host);
      document.body.style.paddingBottom = '140px';
      document.documentElement.style.scrollPaddingBottom = '145px';
    }
    host.shadowRoot!.querySelector('small')!.textContent =
      `LOCAL BENCHMARK · ${location.host}${location.pathname} · HOSTED DEMO IS SEPARATE`;
    host.shadowRoot!.querySelector('strong')!.textContent = title;
    host.shadowRoot!.querySelector('p')!.textContent = detail;
  }, { title, detail });
}

async function click(locator: Locator): Promise<void> {
  await locator.hover();
  await sleep(350, undefined, { signal: interrupted.signal });
  await locator.click();
}

async function main(): Promise<void> {
  await mkdir(output, { recursive: true });
  // Prevent two recorders from overwriting the same outputs or latest benchmark.
  const lock = path.join(output, '.recording-lock');
  await mkdir(lock);
  let temp: string | undefined;
  let browser: Browser | undefined;
  let server: Server | undefined;
  let completed = false;
  let metadata: Record<string, unknown> = {};
  const localUrls: string[] = [];
  try {
    temp = await mkdtemp(path.join(output, '.state-'));
    await execute('ffmpeg', ['-version']);
    await execute('ffprobe', ['-version']);
    if (args.has('--benchmark')) {
      console.log('Running pnpm benchmark with disposable local persistence…');
      const log = await execute('pnpm', ['benchmark'], 600_000);
      await writeFile(path.join(output, 'benchmark.log'), sanitize(log));
      // Reap any wrapper descendants before starting the recording's own apps.
      await Promise.all(children.map(stop));
    }
    const evidence = await loadEvidence();
    console.log(`Verified benchmark: ${JSON.stringify(evidence.report.metrics.counts)}`);
    const healthy = await startApp(temp, null);
    const mutated = await startApp(temp, 'M1');
    assert.notEqual(healthy, mutated);
    server = createServer((request, response) => {
      const content = evidence.pages.get(request.url ?? '/');
      response.writeHead(content ? 200 : 404, {
        'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      });
      response.end(content ?? 'Not found');
    });
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert(address && typeof address !== 'string');
    const reports = `http://127.0.0.1:${address.port}`;
    localUrls.push(healthy, mutated, reports);
    let headless = args.has('--headless');
    try { browser = await chromium.launch({ headless }); }
    catch (error) {
      if (headless) throw error;
      console.log('Headed launch unavailable; using a fresh headless Chromium context.');
      headless = true;
      browser = await chromium.launch({ headless });
    }
    const context = await browser.newContext({
      viewport, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC',
      serviceWorkers: 'block', recordVideo: { dir: path.join(output, 'raw'), size: viewport },
    });
    const blocked = new Set<string>();
    await context.route('**/*', async (route) => {
      const origin = new URL(route.request().url()).origin;
      if (localUrls.includes(origin)) await route.continue();
      else { blocked.add(origin); await route.abort(); }
    });
    const page = await context.newPage(); // Exactly one recorded page for every scene.
    const start = performance.now();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(sanitize(error.message)));
    page.setDefaultTimeout(8_000);
    page.setDefaultNavigationTimeout(10_000);
    const video = page.video();
    assert(video);
    const beat = async (name: string, endSeconds: number, action: () => Promise<void>) => {
      interrupted.signal.throwIfAborted();
      const startSeconds = (performance.now() - start) / 1000;
      console.log(`Scene ${startSeconds.toFixed(1)}s → ${endSeconds}s: ${name}`);
      await action();
      assert.equal(context.pages().length, 1);
      assert.deepEqual(pageErrors, []);
      assert(!/\/Users\/|\/home\/|\/var\/folders\/|\[project\]/.test(await page.locator('body').innerText()),
        'Unexpected private path in visible browser content.');
      const remaining = endSeconds * 1000 - (performance.now() - start);
      assert(remaining >= 1_000, `Scene ${name} overran its reading budget; recording aborted rather than retimed.`);
      await sleep(remaining, undefined, { signal: interrupted.signal });
      scenes.push({ name, startSeconds, endSeconds, url: page.url() });
    };
    await beat('The problem', 8, async () => {
      await page.goto(`${healthy}/checkout`);
      await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
      await caption(page, 'A green test can still miss a broken business outcome.',
        'TrenGuard measures whether tests catch controlled regressions. This is the actual local app.');
    });
    await beat('Fixed checkout', 16, async () => {
      await page.getByLabel('Quantity for TrenGuard Notebook').fill('2');
      await expect(page.getByLabel('Customer name')).toHaveValue('Ada Lovelace');
      await expect(page.locator('#expected-total')).toHaveText('$25.98');
      await page.locator('#checkout-form').evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await caption(page, 'Healthy baseline: two notebooks, exactly $25.98.',
        'Fixed fixture data. Local JSON persistence. No model credentials or payment service.');
    });
    await beat('Healthy confirmation', 22, async () => {
      await click(page.getByRole('button', { name: 'Place order', exact: true }));
      await expect(page.getByRole('status')).toContainText('Order confirmed');
      await page.getByRole('status').evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await caption(page, 'The checkout confirms the order.', 'Now verify the business outcome, not just the success message.');
    });
    await beat('Healthy order history', 28, async () => {
      await click(page.getByRole('link', { name: 'Order history', exact: true }));
      await expect(page.getByRole('listitem')).toHaveCount(1);
      await expect(page.getByRole('listitem')).toContainText('2 × $12.99 · Ada Lovelace');
      await expect(page.getByTestId('order-total')).toHaveText('$25.98');
      await caption(page, 'One order. Correct customer, quantity and total.', 'Order history is populated from the server’s persisted state.');
    });
    await beat('Healthy reload', 35, async () => {
      await page.reload();
      await expect(page.getByRole('listitem')).toHaveCount(1);
      await expect(page.getByTestId('order-total')).toHaveText('$25.98');
      const orders = (await json(`${healthy}/api/orders`)).orders as Array<{ totalCents: number }>;
      assert.equal(orders.length, 1);
      assert.equal(orders[0]!.totalCents, 2598);
      await caption(page, 'Reloaded: the same order still totals $25.98.', 'The strong check verifies persistence and checks that there is exactly one order.');
    });
    await beat('Actual M1 activation', 39, async () => {
      await page.goto(`${mutated}/health`);
      await expect(page.locator('body')).toContainText('M1_ACTIVE');
      await page.addStyleTag({ content: 'pre{font:26px/1.8 monospace;white-space:pre-wrap;margin:100px 70px}' });
      await caption(page, 'M1 is active: confirmation without persistence.', 'This /health response comes from a second isolated local app instance.');
    });
    await beat('M1 still confirms', 45, async () => {
      await page.goto(`${mutated}/checkout`);
      await page.getByLabel('Quantity for TrenGuard Notebook').fill('2');
      await click(page.getByRole('button', { name: 'Place order', exact: true }));
      await expect(page.getByRole('status')).toContainText('Order confirmed');
      await caption(page, 'The same green confirmation appears under M1.', 'The weak S1 test stops here. A successful UI response is not proof of a saved order.');
      await page.getByRole('status').evaluate((element) => element.scrollIntoView({ block: 'center' }));
    });
    await beat('M1 empty after reload', 53, async () => {
      await click(page.getByRole('link', { name: 'Order history', exact: true }));
      await expect(page.getByRole('heading', { name: 'No orders yet.' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('listitem')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'No orders yet.' })).toBeVisible();
      assert.deepEqual((await json(`${mutated}/api/orders`)).orders, []);
      await caption(page, 'Reloaded under M1: no orders were saved.', 'The app said “confirmed”, but both order history and GET /api/orders are empty.');
    });
    await beat('Real test source', 64, async () => {
      await page.goto(`${reports}/source`);
      await caption(page, 'S1 checks the message. S2 checks the outcome.',
        'Actual benchmark source: one persisted order, exact line items and $25.98 after reload.');
    });
    await beat('Real failure and oracle evidence', 76, async () => {
      await page.goto(`${reports}/evidence`);
      await caption(page, 'S2 fails on the missing order; the independent oracle confirms why.',
        'Evidence from the completed benchmark: expected 1, received 0; M1_ACTIVE; orderCount: 0.');
    });
    const metrics = evidence.report.metrics;
    await beat('Actual generated dashboard', 86, async () => {
      await page.goto(`${reports}/dashboard.html`);
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(evidence.report.results.length);
      // Check every rendered row against results.json before displaying aggregate captions.
      for (const [index, run] of evidence.report.results.entries()) {
        await expect(rows.nth(index).locator('td')).toHaveText([
          run.scenarioId, run.mutationId ?? 'HEALTHY', run.status,
          run.mutationOutcome ?? 'BASELINE', run.reasonCode ?? '—',
        ]);
      }
      await expect(page.locator('.metric strong')).toHaveText([
        metrics.detectionRate, metrics.survivalRate, metrics.falseFailureRate, metrics.inconclusiveRate,
      ].map((metric) => metric.rate === null ? 'n/a' : `${(metric.rate * 100).toFixed(1)}%`));
      await caption(page, `Observed: ${metrics.detectionRate.numerator}/${metrics.detectionRate.denominator} detected · ${metrics.survivalRate.numerator}/${metrics.survivalRate.denominator} missed.`,
        `${evidence.report.results.length} trials · ${metrics.falseFailureRate.denominator} healthy baselines · ${metrics.counts.NOT_APPLICABLE} not applicable, excluded from detection rate.`);
    });
    await beat('Weak versus strong results', 97, async () => {
      const weakRow = page.locator('tbody tr').filter({ hasText: 'MUTATION_SURVIVED' });
      await expect(weakRow).toHaveCount(1);
      await weakRow.evaluate((element) => {
        element.scrollIntoView({ block: 'center' });
        (element as HTMLElement).style.background = '#fef3c7';
        const next = element.nextElementSibling as HTMLElement;
        next.style.background = '#d1fae5';
      });
      await caption(page, `Same M1 regression: weak S1 ${evidence.weak.mutationOutcome} · strong S2 ${evidence.strong.mutationOutcome}.`,
        `False failures: ${metrics.falseFailureRate.numerator}/${metrics.falseFailureRate.denominator}. Inconclusive: ${metrics.inconclusiveRate.numerator}/${metrics.inconclusiveRate.denominator}. These rates describe this fixture catalog only.`);
    });
    await beat('Recruiter takeaway', targetSeconds, async () => {
      await caption(page, 'AI can generate tests. TrenGuard measures the evidence they provide.',
        'TesterArmy integration is optional. Live agent replay safety is a separate, unproven follow-up.');
    });
    assert.equal(context.pages().length, 1);
    await page.close(); // End capture before context teardown can add a trailing hold.
    await context.close(); // Finalizes the single continuous Playwright video.
    const webm = path.join(output, 'trenguard-demo.webm');
    const mp4 = path.join(output, 'trenguard-demo.mp4');
    await video.saveAs(webm);
    await video.delete();
    await browser.close();
    browser = undefined;
    await execute('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm,
      '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    const probeText = await execute('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', mp4]);
    const probe = JSON.parse(probeText) as {
      format: { duration: string }; streams: Array<{ codec_type: string; codec_name: string; width: number; height: number }>;
    };
    const duration = Number(probe.format.duration);
    assert(duration >= 90 && duration <= 120, `Unexpected video length: ${duration}s`);
    assert.equal(probe.streams.length, 1, 'Silent walkthrough must have exactly one video stream.');
    assert.equal(probe.streams[0]!.codec_name, 'h264');
    assert.equal(probe.streams[0]!.width, viewport.width);
    assert.equal(probe.streams[0]!.height, viewport.height);
    await writeFile(path.join(output, 'ffprobe.json'), sanitize(probeText));
    await mkdir(path.join(output, 'frames'), { recursive: true });
    for (const second of [3, 19, 31, 37, 43, 50, 59, 70, 81, 92, 102]) {
      await execute('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(second), '-i', mp4,
        '-frames:v', '1', path.join(output, 'frames', `${String(second).padStart(3, '0')}s.png`)]);
    }
    metadata = {
      recordedAt: new Date().toISOString(), durationSeconds: duration, viewport, headless,
      browserVersion: context.browser()?.version(), singleRecordedPage: true, audio: false,
      benchmarkRunThisInvocation: args.has('--benchmark'), benchmarkStartedAt: evidence.report.experiment.startedAt,
      sourceSHA256: evidence.hashes, metrics: evidence.report.metrics, blockedExternalOrigins: [...blocked],
      scenes, commands, artifacts: ['trenguard-demo.mp4', 'trenguard-demo.webm', 'ffprobe.json', 'frames/', 'inputs/'],
    };
    completed = true;
  } finally {
    // All owned resources are attempted even if one cleanup operation fails.
    const cleanup = await Promise.allSettled([
      browser?.close(),
      server && new Promise<void>((resolve, reject) => {
        server!.closeAllConnections();
        server!.close((error) => error ? reject(error) : resolve());
      }),
      ...children.map(stop),
    ]);
    if (temp) await rm(temp, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    assert(cleanup.every((entry) => entry.status === 'fulfilled'), 'A local resource failed to clean up.');
    for (const base of localUrls) {
      let listening = false;
      try { await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) }); listening = true; } catch { /* Expected: closed. */ }
      assert(!listening, `Owned server is still listening: ${base}`);
    }
    if (completed) {
      await writeFile(path.join(output, 'recording.json'), `${JSON.stringify({ ...metadata, cleanupVerified: true }, null, 2)}\n`);
    }
  }
  console.log(`Verified recording: artifacts/demo/trenguard-demo.mp4 (${metadata.durationSeconds}s). Cleanup verified.`);
}

await main().catch((error: unknown) => {
  console.error(sanitize(error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exitCode = 1;
});
