import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { classifyMutation } from '../../src/benchmark/classifier.js';
import { calculateMetrics } from '../../src/benchmark/metrics.js';
import { readReport, writeReport } from '../../src/benchmark/report.js';
import { OrderStore } from '../../src/store.js';
import type { RunResult } from '../../src/benchmark/types.js';

test('classifier covers detected, missed, false-failure, and inconclusive outcomes', () => {
  assert.equal(classifyMutation({ mutationActivated: true, applicable: true, baselineStatus: 'PASS', mutatedStatus: 'FAIL', expectedSignalObserved: true }).outcome, 'DETECTED');
  assert.equal(classifyMutation({ mutationActivated: true, applicable: true, baselineStatus: 'PASS', mutatedStatus: 'PASS', expectedSignalObserved: true }).outcome, 'MISSED');
  assert.equal(classifyMutation({ mutationActivated: true, applicable: true, baselineStatus: 'FAIL', mutatedStatus: 'FAIL', expectedSignalObserved: true }).outcome, 'FALSE_FAILURE');
  assert.equal(classifyMutation({ mutationActivated: true, applicable: true, baselineStatus: 'PASS', mutatedStatus: 'TIMEOUT', expectedSignalObserved: true }).outcome, 'INCONCLUSIVE');
  assert.equal(classifyMutation({ mutationActivated: true, applicable: false, baselineStatus: 'PASS', mutatedStatus: 'PASS', expectedSignalObserved: false }).outcome, 'NOT_APPLICABLE');
  assert.equal(classifyMutation({ mutationActivated: false, applicable: true, baselineStatus: 'PASS', mutatedStatus: 'FAIL', expectedSignalObserved: false }).outcome, 'INCONCLUSIVE');
  assert.equal(classifyMutation({ mutationActivated: true, applicable: true, baselineStatus: 'PASS', mutatedStatus: 'FAIL', expectedSignalObserved: false }).outcome, 'INCONCLUSIVE');
});

test('metrics preserve zero denominators as null rates', () => {
  const metrics = calculateMetrics([]);
  assert.equal(metrics.detectionRate.rate, null);
  assert.equal(metrics.survivalRate.rate, null);
  assert.equal(metrics.falseFailureRate.rate, null);
  assert.equal(metrics.inconclusiveRate.rate, null);
});

test('metrics use only detected and missed trials for detection rate', () => {
  const results: RunResult[] = [
    makeResult({ mutationId: null, status: 'PASS' }),
    makeResult({ mutationId: 'M1', status: 'FAIL', mutationOutcome: 'DETECTED' }),
    makeResult({ mutationId: 'M2', status: 'PASS', mutationOutcome: 'MISSED' }),
    makeResult({ mutationId: 'M3', status: 'ERROR', mutationOutcome: 'INCONCLUSIVE' }),
    makeResult({ mutationId: 'M4', status: 'PASS', mutationOutcome: 'NOT_APPLICABLE' }),
  ];
  const metrics = calculateMetrics(results);
  assert.deepEqual(metrics.detectionRate, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(metrics.inconclusiveRate, { numerator: 1, denominator: 3, rate: 1 / 3 });
});

test('store isolates non-persisting orders, profile updates, and wrong-record actions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'proofforge-store-test-'));
  const filePath = path.join(directory, 'orders.json');
  try {
    const store = new OrderStore(filePath);
    await store.initialize();
    await store.createOrder({ customerName: 'Ada Lovelace', productId: 'proofforge-notebook', quantity: 2 }, { persist: false });
    assert.deepEqual(store.listOrders(), []);

    await store.updateProfile({ preferredName: 'Ada Verified' }, { persist: false });
    const reloaded = new OrderStore(filePath);
    await reloaded.initialize();
    assert.equal(reloaded.getProfile().preferredName, 'Ada');

    await reloaded.updateRecord('record-002', 'ready', { wrongRecordAction: true });
    const records = reloaded.listRecords();
    assert.equal(records.find((record) => record.id === 'record-002')?.status, 'queued');
    assert.equal(records.find((record) => record.id === 'record-003')?.status, 'ready');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('report round-trips through the runtime validator', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'proofforge-report-test-'));
  try {
    const report = {
      schemaVersion: '1.0' as const,
      experiment: {
        id: 'unit',
        name: 'Unit report',
        seed: 'seed',
        runner: 'playwright' as const,
        startedAt: new Date(0).toISOString(),
        durationMs: 1,
        repetitions: 1,
        scenarios: ['S1'],
        mutations: ['M1' as const],
      },
      results: [makeResult({
        mutationId: 'M1',
        status: 'FAIL',
        mutationOutcome: 'DETECTED',
        reasonCode: 'EXPECTED_ASSERTION_FAILED',
        evidence: {
          runnerOutput: 'output',
          runnerError: '',
          appHealth: '{"mutationId":"M1"}',
          oracle: { expectedSignal: 'ORDER_MISSING_AFTER_RELOAD', observed: true, source: 'GET /api/orders', details: { orderCount: 0 } },
        },
      })],
      metrics: calculateMetrics([makeResult({ mutationId: 'M1', status: 'FAIL', mutationOutcome: 'DETECTED' })]),
      limitations: ['unit'],
    };
    const paths = await writeReport(directory, report);
    assert.equal((await readReport(paths.jsonPath)).schemaVersion, '1.0');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function makeResult(input: Partial<RunResult>): RunResult {
  return {
    runId: 'unit',
    experimentId: 'unit',
    scenarioId: 'S1',
    mutationId: null,
    repetition: 1,
    startedAt: new Date(0).toISOString(),
    durationMs: 1,
    status: 'PASS',
    runner: 'playwright',
    assertions: [],
    error: null,
    evidence: { runnerOutput: '', runnerError: '', appHealth: '', oracle: { expectedSignal: null, observed: false, source: 'none', details: {} } },
    environment: { node: 'test', platform: 'test', baseUrl: 'http://localhost' },
    seed: 'test',
    rawExitCode: 0,
    ...input,
  };
}
