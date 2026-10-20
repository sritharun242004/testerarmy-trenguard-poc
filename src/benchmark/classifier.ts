import type { MutationOutcome, RunResult, RunStatus } from './types.js';

export interface ClassificationInput {
  mutationActivated: boolean;
  applicable: boolean;
  baselineStatus: RunStatus;
  mutatedStatus: RunStatus;
  expectedSignalObserved: boolean;
}

export interface ClassificationResult {
  outcome: MutationOutcome;
  reasonCode: string;
}

export function classifyMutation(input: ClassificationInput): ClassificationResult {
  if (!input.mutationActivated) {
    return { outcome: 'INCONCLUSIVE', reasonCode: 'MUTATION_NOT_APPLIED' };
  }

  if (input.baselineStatus !== 'PASS') {
    return { outcome: 'FALSE_FAILURE', reasonCode: 'BASELINE_INVALID' };
  }

  if (!input.applicable) {
    return { outcome: 'NOT_APPLICABLE', reasonCode: 'SCENARIO_NOT_EXPECTED_TO_DETECT' };
  }

  if (input.mutatedStatus === 'TIMEOUT') {
    return { outcome: 'INCONCLUSIVE', reasonCode: 'TIMEOUT' };
  }

  if (input.mutatedStatus === 'ERROR' || input.mutatedStatus === 'CANCELLED') {
    return { outcome: 'INCONCLUSIVE', reasonCode: 'RUNNER_ERROR' };
  }

  if (!input.expectedSignalObserved) {
    return { outcome: 'INCONCLUSIVE', reasonCode: 'EXPECTED_SIGNAL_NOT_OBSERVED' };
  }

  if (input.mutatedStatus === 'FAIL') {
    return { outcome: 'DETECTED', reasonCode: 'EXPECTED_ASSERTION_FAILED' };
  }

  if (input.mutatedStatus === 'PASS') {
    return { outcome: 'MISSED', reasonCode: 'MUTATION_SURVIVED' };
  }

  return { outcome: 'INCONCLUSIVE', reasonCode: 'NO_REQUIRED_EVIDENCE' };
}

export function withClassification(result: RunResult, classification: ClassificationResult): RunResult {
  return {
    ...result,
    mutationOutcome: classification.outcome,
    reasonCode: classification.reasonCode,
  };
}
