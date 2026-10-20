import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { classifyMutation, withClassification } from './classifier.js';
import { calculateMetrics } from './metrics.js';
import { writeReport } from './report.js';
import type { ExperimentReport, OracleEvidence, RunResult, RunStatus } from './types.js';
import { findMutation, type MutationId } from '../mutations.js';
import type { ProofForgeConfig } from './config.js';

export interface BenchmarkRunOptions {
  config: ProofForgeConfig;
  scenarioIds: string[];
  mutationIds: MutationId[];
  repetitions: number;
  outputDir: string;
  seed: string;
}

export async function runBenchmark(options: BenchmarkRunOptions): Promise<{ report: ExperimentReport; paths: { jsonPath: string; markdownPath: string } }> {
  if (options.config.runner !== 'playwright') {
    throw new Error('Runner "e2e" is optional and is not wired into the benchmark runner yet. Use the standalone e2e adapter command instead.');
  }
  const experimentStartedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const evidenceDir = path.join(options.outputDir, 'evidence');
  await mkdir(evidenceDir, { recursive: true });
  const results: RunResult[] = [];

  for (let repetition = 1; repetition <= options.repetitions; repetition += 1) {
    const baselineResults = new Map<string, RunResult>();

    for (const scenarioId of options.scenarioIds) {
      const result = await runTrial({
        scenarioId,
        mutationId: null,
        repetition,
        expectedMutationId: null,
        options,
        evidenceDir,
      });
      results.push(result);
      baselineResults.set(scenarioId, result);
    }

    for (const mutationId of options.mutationIds) {
      const definition = findMutation(mutationId);
      if (!definition) throw new Error(`Mutation ${mutationId} is not registered.`);

      for (const scenarioId of options.scenarioIds) {
        const result = await runTrial({
          scenarioId,
          mutationId,
          repetition,
          expectedMutationId: mutationId,
          options,
          evidenceDir,
        });
        const baseline = baselineResults.get(scenarioId);
        if (!baseline) throw new Error(`Missing baseline for ${scenarioId}.`);
        const classification = classifyMutation({
          mutationActivated: result.evidence.appHealth.includes(`"mutationId":"${mutationId}"`),
          applicable: definition.expectedAffectedScenarios.includes(scenarioId),
          baselineStatus: baseline.status,
          mutatedStatus: result.status,
          expectedSignalObserved: result.evidence.oracle.observed,
        });
        results.push(withClassification(result, classification));
      }
    }
  }

  const report: ExperimentReport = {
    schemaVersion: '1.0',
    experiment: {
      id: options.config.id,
      name: options.config.name,
      seed: options.seed,
      runner: options.config.runner,
      startedAt: experimentStartedAt,
      durationMs: Date.now() - startedAtMs,
      repetitions: options.repetitions,
      scenarios: options.scenarioIds,
      mutations: options.mutationIds,
    },
    results,
    metrics: calculateMetrics(results),
    limitations: [
      'This report measures only the configured deterministic fixture and mutation catalog.',
      'The benchmark is not a proof of application correctness or statistical estimate of general test quality.',
      'Execution cost records wall-clock duration only; no model calls are used by the Playwright runner.',
      'TesterArmy e2e integration is optional and is not included in this Playwright report.',
    ],
  };

  return { report, paths: await writeReport(options.outputDir, report) };
}

interface TrialOptions {
  scenarioId: string;
  mutationId: MutationId | null;
  repetition: number;
  expectedMutationId: MutationId | null;
  options: BenchmarkRunOptions;
  evidenceDir: string;
}

async function runTrial(input: TrialOptions): Promise<RunResult> {
  const runId = `${input.scenarioId}-${input.mutationId ?? 'baseline'}-r${input.repetition}`;
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const port = await findFreePort();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'proofforge-trial-'));
  const dataFile = path.join(tempDir, 'orders.json');
  const baseUrl = `http://127.0.0.1:${port}`;
  let app: ChildProcess | undefined;
  let appHealth = '';
  let oracle: OracleEvidence = emptyOracle();

  try {
    app = spawn('pnpm', ['exec', 'tsx', 'src/server.ts', '--port', String(port)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PROOFFORGE_DATA_FILE: dataFile,
        ...(input.mutationId ? { PROOFFORGE_MUTATION: input.mutationId } : { PROOFFORGE_MUTATION: '' }),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const health = await waitForHealth(baseUrl);
    appHealth = JSON.stringify(health);
    if (input.expectedMutationId && health.mutationId !== input.expectedMutationId) {
      return await finishResult({
        runId,
        input,
        startedAt,
        startedAtMs,
        status: 'ERROR',
        error: `Mutation activation mismatch: expected ${input.expectedMutationId}, received ${health.mutationId ?? 'none'}.`,
        output: '',
        runnerError: '',
        appHealth,
      });
    }

    const runner = await runPlaywright(input.scenarioId, baseUrl);
    oracle = await inspectOracle(baseUrl, input.scenarioId, input.mutationId);
    return await finishResult({
      runId,
      input,
      startedAt,
      startedAtMs,
      status: runner.status,
      error: runner.error,
      output: runner.output,
      runnerError: runner.runnerError,
      appHealth,
      rawExitCode: runner.rawExitCode,
      durationMs: runner.durationMs,
      assertions: runner.assertions,
      oracle,
    });
  } catch (error: unknown) {
    return await finishResult({
      runId,
      input,
      startedAt,
      startedAtMs,
      status: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
      output: '',
      runnerError: '',
      appHealth,
      oracle,
    });
  } finally {
    if (app) await stopProcess(app);
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function finishResult(input: {
  runId: string;
  input: TrialOptions;
  startedAt: string;
  startedAtMs: number;
  status: RunStatus;
  error: string | null;
  output: string;
  runnerError: string;
  appHealth: string;
  rawExitCode?: number | null;
  durationMs?: number;
  assertions?: RunResult['assertions'];
  oracle?: OracleEvidence;
}): Promise<RunResult> {
  const evidencePath = path.join(input.input.evidenceDir, `${input.runId}.json`);
  await writeFile(evidencePath, `${JSON.stringify({
    runId: input.runId,
    scenarioId: input.input.scenarioId,
    mutationId: input.input.mutationId,
    appHealth: input.appHealth,
    runnerOutput: input.output,
    runnerError: input.runnerError,
    error: input.error,
    oracle: input.oracle ?? emptyOracle(),
  }, null, 2)}\n`, 'utf8');

  return {
    runId: input.runId,
    experimentId: input.input.options.config.id,
    scenarioId: input.input.scenarioId,
    mutationId: input.input.mutationId,
    repetition: input.input.repetition,
    startedAt: input.startedAt,
    durationMs: input.durationMs ?? Date.now() - input.startedAtMs,
    status: input.status,
    runner: 'playwright',
    assertions: input.assertions ?? [{ id: `${input.input.scenarioId}.runner`, passed: input.status === 'PASS' }],
    error: input.error,
    evidence: {
      runnerOutput: path.relative(input.input.options.outputDir, evidencePath),
      runnerError: input.runnerError,
      appHealth: input.appHealth,
      oracle: input.oracle ?? emptyOracle(),
    },
    environment: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      baseUrl: input.input.options.config.baseUrl,
    },
    seed: input.input.options.seed,
    rawExitCode: input.rawExitCode ?? null,
  };
}

function emptyOracle(): OracleEvidence {
  return {
    expectedSignal: null,
    observed: false,
    source: 'none',
    details: {},
  };
}

async function inspectOracle(baseUrl: string, scenarioId: string, mutationId: MutationId | null): Promise<OracleEvidence> {
  if (!mutationId) return emptyOracle();

  try {
    if (mutationId === 'M1' && (scenarioId === 'S1' || scenarioId === 'S2')) {
      const payload = await fetchJson<{ orders?: unknown[] }>(`${baseUrl}/api/orders`);
      const observed = Array.isArray(payload.orders) && payload.orders.length === 0;
      return {
        expectedSignal: 'ORDER_MISSING_AFTER_RELOAD',
        observed,
        source: 'GET /api/orders',
        details: { orderCount: Array.isArray(payload.orders) ? payload.orders.length : null },
      };
    }

    if (mutationId === 'M2' && scenarioId === 'S2') {
      const payload = await fetchJson<{ orders?: Array<{ totalCents?: unknown }> }>(`${baseUrl}/api/orders`);
      const total = payload.orders?.[0]?.totalCents;
      const observed = typeof total === 'number' && total !== 2598;
      return { expectedSignal: 'TOTAL_MISMATCH', observed, source: 'GET /api/orders', details: { totalCents: typeof total === 'number' ? total : null, expectedTotalCents: 2598 } };
    }

    if (mutationId === 'M3' && scenarioId === 'S4') {
      const response = await fetch(`${baseUrl}/api/admin/summary`);
      return { expectedSignal: 'UNAUTHORIZED_ACTION_ALLOWED', observed: response.status === 200, source: 'GET /api/admin/summary', details: { status: response.status } };
    }

    if (mutationId === 'M4' && scenarioId === 'S5') {
      const payload = await fetchJson<{ products?: unknown[] }>(`${baseUrl}/api/products/search?q=pen`);
      const observed = Array.isArray(payload.products) && payload.products.length === 0;
      return { expectedSignal: 'EXPECTED_RESULT_MISSING', observed, source: 'GET /api/products/search?q=pen', details: { resultCount: Array.isArray(payload.products) ? payload.products.length : null } };
    }

    if (mutationId === 'M5' && scenarioId === 'S3') {
      const payload = await fetchJson<{ profile?: { preferredName?: unknown } }>(`${baseUrl}/api/profile`);
      const preferredName = payload.profile?.preferredName;
      const observed = preferredName !== 'Ada Verified';
      return { expectedSignal: 'PROFILE_VALUE_MISSING_AFTER_RELOAD', observed, source: 'GET /api/profile', details: { preferredName: typeof preferredName === 'string' ? preferredName : null, expectedPreferredName: 'Ada Verified' } };
    }

    if (mutationId === 'M6' && scenarioId === 'S6') {
      const payload = await fetchJson<{ records?: Array<{ id?: unknown; status?: unknown }> }>(`${baseUrl}/api/records`);
      const records = Array.isArray(payload.records) ? payload.records : [];
      const selected = records.find((record) => record.id === 'record-002')?.status;
      const neighbor = records.find((record) => record.id === 'record-003')?.status;
      const observed = selected === 'queued' && neighbor === 'ready';
      return { expectedSignal: 'WRONG_RECORD_CHANGED', observed, source: 'GET /api/records', details: { selectedStatus: typeof selected === 'string' ? selected : null, neighborStatus: typeof neighbor === 'string' ? neighbor : null } };
    }
  } catch (error: unknown) {
    return { expectedSignal: expectedSignalFor(mutationId, scenarioId), observed: false, source: 'oracle-error', details: { error: error instanceof Error ? error.message : String(error) } };
  }

  return { expectedSignal: expectedSignalFor(mutationId, scenarioId), observed: false, source: 'not-applicable', details: {} };
}

function expectedSignalFor(mutationId: MutationId, scenarioId: string): string | null {
  const key = `${mutationId}:${scenarioId}`;
  return {
    'M1:S1': 'ORDER_MISSING_AFTER_RELOAD',
    'M1:S2': 'ORDER_MISSING_AFTER_RELOAD',
    'M2:S2': 'TOTAL_MISMATCH',
    'M3:S4': 'UNAUTHORIZED_ACTION_ALLOWED',
    'M4:S5': 'EXPECTED_RESULT_MISSING',
    'M5:S3': 'PROFILE_VALUE_MISSING_AFTER_RELOAD',
    'M6:S6': 'WRONG_RECORD_CHANGED',
  }[key] ?? null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Oracle request failed with ${response.status}.`);
  return await response.json() as T;
}

async function runPlaywright(scenarioId: string, baseUrl: string): Promise<{
  status: RunStatus;
  error: string | null;
  output: string;
  runnerError: string;
  rawExitCode: number | null;
  durationMs: number;
  assertions: RunResult['assertions'];
}> {
  const startedAt = Date.now();
  const processResult = await spawnAndCapture('pnpm', [
    'exec',
    'playwright',
    'test',
    '--config=playwright.benchmark.config.ts',
    '--grep',
    scenarioId,
    '--reporter=line',
  ], {
    ...process.env,
    PROOFFORGE_BASE_URL: baseUrl,
  });
  const parsed = parsePlaywrightReport(processResult.stdout);
  const status = parsed?.status ?? (processResult.exitCode === 0 ? 'PASS' : 'FAIL');
  return {
    status,
    error: parsed?.error ?? (status === 'PASS' ? null : processResult.stderr || 'Playwright scenario failed.'),
    output: processResult.stdout,
    runnerError: processResult.stderr,
    rawExitCode: processResult.exitCode,
    durationMs: Date.now() - startedAt,
    assertions: [{ id: `${scenarioId}.playwright`, passed: status === 'PASS', ...(parsed?.error ? { message: parsed.error } : {}) }],
  };
}

function parsePlaywrightReport(output: string): { status: RunStatus; error: string | null } | null {
  try {
    if (/\bfailed\b|\bfailed \(/i.test(output)) return { status: 'FAIL', error: output.trim() };
    if (/\bskipped\b/i.test(output)) return { status: 'SKIPPED', error: output.trim() };
    if (/\bpassed\b|\bpassed \(/i.test(output)) return { status: 'PASS', error: null };
    return null;
  } catch {
    return null;
  }
}

function collectTests(value: unknown): Array<{ status: string; error: string | null }> {
  const found: Array<{ status: string; error: string | null }> = [];
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    const record = candidate as Record<string, unknown>;
    if (Array.isArray(record.tests)) {
      for (const test of record.tests) {
        if (!test || typeof test !== 'object') continue;
        const testRecord = test as Record<string, unknown>;
        const results = Array.isArray(testRecord.results) ? testRecord.results : [];
        const latest = results.at(-1);
        const latestRecord = latest && typeof latest === 'object' ? latest as Record<string, unknown> : undefined;
        const errorValue = latestRecord?.error;
        found.push({
          status: typeof latestRecord?.status === 'string' ? latestRecord.status : typeof testRecord.status === 'string' ? testRecord.status : 'failed',
          error: typeof errorValue === 'object' && errorValue && 'message' in errorValue && typeof errorValue.message === 'string'
            ? errorValue.message
            : null,
        });
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return found;
}

async function waitForHealth(baseUrl: string): Promise<{ status: string; mutationId: string | null; mutationMarker: string }> {
  const deadline = Date.now() + 10_000;
  let lastError = 'Health check did not respond.';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return await response.json() as { status: string; mutationId: string | null; mutationMarker: string };
      lastError = `Health check returned ${response.status}.`;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(100);
  }
  throw new Error(lastError);
}

async function findFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a local port.'));
        return;
      }
      const { port } = address;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function spawnAndCapture(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ stdout, stderr, exitCode }));
  });
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('close', () => resolve())),
    sleep(2_000).then(() => { child.kill('SIGKILL'); }),
  ]);
}
