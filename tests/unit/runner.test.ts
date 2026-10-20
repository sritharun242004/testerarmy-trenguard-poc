import assert from 'node:assert/strict';
import childProcess, { type ChildProcess, type SpawnOptions } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import { runBenchmark, type BenchmarkRunOptions } from '../../src/benchmark/runner.js';
import { BenchmarkProcess } from '../../src/benchmark/process.js';

const fixture = path.resolve('tests/unit/fixtures/runner-child.mjs');

test('scenario deadline includes inherited pipes after the runner exits', { timeout: 15_000 }, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'proofforge-runner-test-'));
  const children: ChildProcess[] = [];
  const keepers: Array<{ pid: number; url: string }> = [];
  const spawn = childProcess.spawn;
  t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: SpawnOptions) => {
    const scenario = args.includes('test');
    const child = scenario ? spawn(process.execPath, [fixture, 'open-pipe'], options) : spawn(command, args, options);
    children.push(child);
    if (scenario) {
      let output = '';
      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
        const match = /KEEPER (\d+) (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match && !keepers.some(({ pid }) => pid === Number(match[1]))) keepers.push({ pid: Number(match[1]), url: match[2]! });
      });
    }
    return child;
  });
  syncBuiltinESMExports();
  let watchdog: NodeJS.Timeout | undefined;
  let pending: ReturnType<typeof runBenchmark> | undefined;
  try {
    pending = runBenchmark(benchmarkOptions(directory));
    const completed = await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        watchdog = setTimeout(() => reject(new Error('Benchmark hung waiting for close after scenario exit')), 5_000);
      }),
    ]);
    assert.equal(completed.report.results[0]?.status, 'TIMEOUT');
    assert.equal(completed.report.results[0]?.rawExitCode, 0, 'retain the exited parent code even when its pipe never closed');
    assert.match(completed.report.results[0]?.error ?? '', /deadline|timed out/i);
    assert.equal(keepers.length, 1);
    await assert.rejects(fetch(keepers[0]!.url, { signal: AbortSignal.timeout(500) }));
    const evidence = JSON.parse(await readFile(path.join(directory, 'evidence/S1-baseline-r1.json'), 'utf8'));
    assert.match(evidence.runnerOutput, /1 passed/);
    assert.match(evidence.error, /deadline|timed out/i);
  } finally {
    clearTimeout(watchdog);
    for (const { pid } of keepers) { try { process.kill(pid, 'SIGKILL'); } catch {} }
    for (const child of children) child.kill('SIGKILL');
    await pending?.catch(() => {});
    t.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(directory, { recursive: true, force: true });
  }
});

for (const mode of ['app-health-hang', 'app-body-hang']) {
  test(`startup deadline aborts ${mode} and cleans up the app`, { timeout: 10_000 }, async (t) => {
    await withAppFixture(t, mode, async (options, children) => {
      options.config.timeouts!.startupMs = 400;
      const result = await runBenchmark(options);
      assert.equal(result.report.results[0]?.status, 'TIMEOUT');
      assert.match(result.report.results[0]?.error ?? '', /startup deadline/);
      assert.equal(children.length, 1, 'no scenario starts without health');
      assert(children[0]!.exitCode !== null || children[0]!.signalCode !== null);
    });
  });
}

test('app stdout and stderr are drained before readiness and retained in evidence', { timeout: 15_000 }, async (t) => {
  await withAppFixture(t, 'app-noisy', async (options) => {
    const result = await runBenchmark(options);
    assert.equal(result.report.results[0]?.status, 'PASS');
    const evidence = JSON.parse(await readFile(path.join(options.outputDir, 'evidence/S1-baseline-r1.json'), 'utf8'));
    assert.match(evidence.appOutput, /fixture ready/);
    assert.match(evidence.appError, /fixture diagnostic/);
    assert.match(evidence.appOutput, /^\[Earlier output truncated\]/);
    assert(evidence.appOutput.length <= 1_048_576);
    assert(evidence.appError.length <= 1_048_576);
  });
});

test('early app exit is an infrastructure error with startup diagnostics', { timeout: 10_000 }, async (t) => {
  await withAppFixture(t, 'crash', async (options, children) => {
    const result = await runBenchmark(options);
    assert.equal(result.report.results[0]?.status, 'ERROR');
    assert.match(result.report.results[0]?.error ?? '', /fixture startup failure/);
    assert.equal(children.length, 1);
  });
});

test('oracle body timeout stays inconclusive and preserves scenario output', { timeout: 10_000 }, async (t) => {
  await withAppFixture(t, 'app-oracle-hang', async (options) => {
    options.mutationIds = ['M1'];
    const { report } = await runBenchmark(options);
    const mutation = report.results[1]!;
    assert.equal(mutation.status, 'PASS');
    assert.equal(mutation.mutationOutcome, 'INCONCLUSIVE');
    assert.equal(mutation.evidence.oracle.source, 'oracle-error');
    assert.equal(mutation.evidence.oracle.observed, false);
    assert.equal(report.metrics.detectionRate.denominator, 0);
  });
});

test('shutdown escalates for a live app that ignores SIGTERM and awaits exit', { timeout: 10_000 }, async (t) => {
  await withAppFixture(t, 'app-ignore-term', async (options, children) => {
    const result = await runBenchmark(options);
    assert.equal(result.report.results[0]?.status, 'PASS');
    assert.equal(children[0]?.signalCode, 'SIGKILL');
  });
});

test('failed app cleanup is bounded and recorded instead of a successful trial', { timeout: 10_000, skip: process.platform === 'win32' }, async (t) => {
  await withAppFixture(t, 'app-ignore-term', async (options, children) => {
    const kill = process.kill;
    t.mock.method(process, 'kill', (pid: number, signal: NodeJS.Signals | number) => {
      if (children[0]?.pid && pid === -children[0].pid) return true; // OS accepted a signal but no close arrives.
      return kill(pid, signal);
    });
    const result = await runBenchmark(options);
    assert.equal(result.report.results[0]?.status, 'ERROR');
    assert.match(result.report.results[0]?.error ?? '', /App cleanup failed.*SIGKILL/);
    const evidence = JSON.parse(await readFile(path.join(options.outputDir, 'evidence/S1-baseline-r1.json'), 'utf8'));
    assert.match(evidence.error, /cleanup failed/);
    assert.match(evidence.runnerOutput, /1 passed/);
  });
});

test('spawn errors and already signalled children settle without hanging', { timeout: 10_000 }, async () => {
  const missing = new BenchmarkProcess(path.join(os.tmpdir(), 'proofforge-nonexistent-executable'), [], process.env);
  const failed = await missing.capture(1_000, 100, new AbortController().signal);
  assert.match(failed.error ?? '', /ENOENT/);
  assert.equal(failed.timedOut, false);
  assert.equal(failed.cleanupError, null);

  const child = new BenchmarkProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], process.env);
  child.child.kill('SIGKILL');
  const stopped = await child.capture(1_000, 100, new AbortController().signal);
  assert.equal(stopped.signal, 'SIGKILL');
  await child.stop(100);
});

test('interruption aborts startup, cleans up, writes partial evidence, and removes handlers', { timeout: 10_000 }, async (t) => {
  const exitCode = process.exitCode;
  const before = process.listenerCount('SIGTERM');
  try {
    await withAppFixture(t, 'app-health-hang', async (options, children) => {
      options.scenarioIds = ['S1', 'S2'];
      const pending = runBenchmark(options);
      // Wait for the app to exist before interrupting, rather than using a sleep.
      await new Promise<void>((resolve) => {
        const spawn = childProcess.spawn;
        t.mock.method(childProcess, 'spawn', (...args: Parameters<typeof spawn>) => {
          const child = spawn(...args);
          child.once('spawn', () => { process.emit('SIGTERM'); resolve(); });
          return child;
        });
        syncBuiltinESMExports();
      });
      const result = await pending;
      assert.equal(result.report.results.length, 1);
      assert.equal(result.report.results[0]?.status, 'CANCELLED');
      assert.equal(children.length, 1);
      assert(children[0]!.exitCode !== null || children[0]!.signalCode !== null);
      assert.equal(process.exitCode, 143);
    });
    assert.equal(process.listenerCount('SIGTERM'), before);
  } finally {
    process.exitCode = exitCode;
  }
});

async function withAppFixture(t: TestContext, mode: string, run: (options: BenchmarkRunOptions, children: ChildProcess[]) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'proofforge-runner-test-'));
  const children: ChildProcess[] = [];
  const spawn = childProcess.spawn;
  t.mock.method(childProcess, 'spawn', (_command: string, args: string[], options: SpawnOptions) => {
    const child = spawn(process.execPath, [fixture, args.includes('test') ? 'pass' : mode], {
      ...options,
      env: { ...options.env, PORT: options.env?.PORT ?? args[args.indexOf('--port') + 1] },
    });
    children.push(child);
    return child;
  });
  syncBuiltinESMExports();
  try {
    await run(benchmarkOptions(directory), children);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    for (const child of children) child.kill('SIGKILL');
    await rm(directory, { recursive: true, force: true });
  }
}

function benchmarkOptions(outputDir: string): BenchmarkRunOptions {
  return {
    config: {
      id: 'runner-regression', name: 'Runner regression', seed: 'fixed', runner: 'playwright',
      baseUrl: 'http://127.0.0.1:4175', scenarios: ['S1'], mutations: [], repetitions: 1,
      artifactDir: 'artifacts/runner-regression', failOnInconclusive: true,
      // Passed through a variable so this reproduction also runs on the original runner.
      ...{ timeouts: { startupMs: 2_000, scenarioMs: 1_000, shutdownMs: 250, requestMs: 200 } },
    },
    scenarioIds: ['S1'], mutationIds: [], repetitions: 1, outputDir, seed: 'fixed',
  };
}
