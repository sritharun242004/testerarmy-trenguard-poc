import type { MutationId } from '../mutations.js';

export type RunStatus = 'PASS' | 'FAIL' | 'ERROR' | 'TIMEOUT' | 'SKIPPED' | 'CANCELLED';
export type MutationOutcome = 'DETECTED' | 'MISSED' | 'FALSE_FAILURE' | 'INCONCLUSIVE' | 'NOT_APPLICABLE';

export interface AssertionEvidence {
  id: string;
  passed: boolean;
  message?: string;
}

export interface OracleEvidence {
  expectedSignal: string | null;
  observed: boolean;
  source: string;
  details: Record<string, string | number | boolean | null>;
}

export interface RunResult {
  runId: string;
  experimentId: string;
  scenarioId: string;
  mutationId: MutationId | null;
  repetition: number;
  startedAt: string;
  durationMs: number;
  status: RunStatus;
  runner: 'playwright' | 'e2e';
  assertions: AssertionEvidence[];
  error: string | null;
  evidence: {
    runnerOutput: string;
    runnerError: string;
    appHealth: string;
    oracle: OracleEvidence;
  };
  environment: {
    node: string;
    platform: string;
    baseUrl: string;
  };
  seed: string;
  rawExitCode: number | null;
  mutationOutcome?: MutationOutcome;
  reasonCode?: string;
}

export interface MetricValue {
  numerator: number;
  denominator: number;
  rate: number | null;
}

export interface BenchmarkMetrics {
  detectionRate: MetricValue;
  survivalRate: MetricValue;
  falseFailureRate: MetricValue;
  inconclusiveRate: MetricValue;
  counts: Record<MutationOutcome, number>;
}

export interface ExperimentReport {
  schemaVersion: '1.0';
  experiment: {
    id: string;
    name: string;
    seed: string;
    runner: 'playwright' | 'e2e';
    startedAt: string;
    durationMs: number;
    repetitions: number;
    scenarios: string[];
    mutations: MutationId[];
  };
  results: RunResult[];
  metrics: BenchmarkMetrics;
  limitations: string[];
}
