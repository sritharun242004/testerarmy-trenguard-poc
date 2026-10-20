import type { BenchmarkMetrics, MetricValue, MutationOutcome, RunResult } from './types.js';

function rate(numerator: number, denominator: number): MetricValue {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

export function calculateMetrics(results: readonly RunResult[]): BenchmarkMetrics {
  const counts: Record<MutationOutcome, number> = {
    DETECTED: 0,
    MISSED: 0,
    FALSE_FAILURE: 0,
    INCONCLUSIVE: 0,
    NOT_APPLICABLE: 0,
  };

  for (const result of results) {
    if (result.mutationOutcome) counts[result.mutationOutcome] += 1;
  }

  const validTrials = counts.DETECTED + counts.MISSED;
  const baselineTrials = results.filter((result) => result.mutationId === null);
  const baselineFailures = baselineTrials.filter((result) => result.status !== 'PASS').length;
  const applicableTrials = results.filter((result) => result.mutationId !== null && result.mutationOutcome !== 'NOT_APPLICABLE');

  return {
    detectionRate: rate(counts.DETECTED, validTrials),
    survivalRate: rate(counts.MISSED, validTrials),
    falseFailureRate: rate(baselineFailures, baselineTrials.length),
    inconclusiveRate: rate(counts.INCONCLUSIVE, applicableTrials.length),
    counts,
  };
}
