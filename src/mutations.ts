export const MUTATION_IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'] as const;
export const M1_ID = 'M1' as const;
export type MutationId = (typeof MUTATION_IDS)[number];

export type MutationCategory =
  | 'state-persistence'
  | 'business-logic'
  | 'authorization'
  | 'data-correctness'
  | 'identity-selection';

export interface MutationActivation {
  id: MutationId | null;
  marker: 'HEALTHY_BASELINE' | `${MutationId}_ACTIVE`;
  persistOrder: boolean;
  incorrectTotal: boolean;
  allowUnauthorized: boolean;
  omittedProductId: string | null;
  persistProfile: boolean;
  wrongRecordAction: boolean;
}

export interface MutationDefinition {
  id: MutationId;
  title: string;
  description: string;
  category: MutationCategory;
  riskLevel: 'high' | 'medium';
  deterministic: true;
  enabled: true;
  expectedAffectedScenarios: readonly string[];
  expectedFailureSignal: string;
  apply: () => MutationActivation;
}

function healthyActivation(): MutationActivation {
  return {
    id: null,
    marker: 'HEALTHY_BASELINE',
    persistOrder: true,
    incorrectTotal: false,
    allowUnauthorized: false,
    omittedProductId: null,
    persistProfile: true,
    wrongRecordAction: false,
  };
}

const MUTATIONS: readonly MutationDefinition[] = [
  {
    id: 'M1',
    title: 'Confirmation without persistence',
    description: 'Return checkout success without writing the order to the store.',
    category: 'state-persistence',
    riskLevel: 'high',
    deterministic: true,
    enabled: true,
    expectedAffectedScenarios: ['S1', 'S2'],
    expectedFailureSignal: 'ORDER_MISSING_AFTER_RELOAD',
    apply: () => ({ ...healthyActivation(), id: 'M1', marker: 'M1_ACTIVE', persistOrder: false }),
  },
  {
    id: 'M2',
    title: 'Incorrect total calculation',
    description: 'Return a total that excludes the second unit from the order calculation.',
    category: 'business-logic',
    riskLevel: 'high',
    deterministic: true,
    enabled: true,
    expectedAffectedScenarios: ['S2'],
    expectedFailureSignal: 'TOTAL_MISMATCH',
    apply: () => ({ ...healthyActivation(), id: 'M2', marker: 'M2_ACTIVE', incorrectTotal: true }),
  },
  {
    id: 'M3',
    title: 'Unauthorized admin access',
    description: 'Allow the normal fixture user to access the protected admin summary.',
    category: 'authorization',
    riskLevel: 'high',
    deterministic: true,
    enabled: true,
    expectedAffectedScenarios: ['S4'],
    expectedFailureSignal: 'UNAUTHORIZED_ACTION_ALLOWED',
    apply: () => ({ ...healthyActivation(), id: 'M3', marker: 'M3_ACTIVE', allowUnauthorized: true }),
  },
  {
    id: 'M4',
    title: 'Search omission',
    description: 'Omit the known Verification Pen result from a matching search.',
    category: 'data-correctness',
    riskLevel: 'medium',
    deterministic: true,
    enabled: true,
    expectedAffectedScenarios: ['S5'],
    expectedFailureSignal: 'EXPECTED_RESULT_MISSING',
    apply: () => ({ ...healthyActivation(), id: 'M4', marker: 'M4_ACTIVE', omittedProductId: 'verification-pen' }),
  },
  {
    id: 'M5',
    title: 'Profile save appears successful but does not save',
    description: 'Return profile-save success while dropping the update before persistence.',
    category: 'state-persistence',
    riskLevel: 'high',
    deterministic: true,
    enabled: true,
    expectedAffectedScenarios: ['S3'],
    expectedFailureSignal: 'PROFILE_VALUE_MISSING_AFTER_RELOAD',
    apply: () => ({ ...healthyActivation(), id: 'M5', marker: 'M5_ACTIVE', persistProfile: false }),
  },
  {
    id: 'M6',
    title: 'Wrong-record action',
    description: 'Apply a selected-record update to its neighboring record instead.',
    category: 'identity-selection',
    riskLevel: 'high',
    deterministic: true,
    enabled: true,
    expectedAffectedScenarios: ['S6'],
    expectedFailureSignal: 'WRONG_RECORD_CHANGED',
    apply: () => ({ ...healthyActivation(), id: 'M6', marker: 'M6_ACTIVE', wrongRecordAction: true }),
  },
];

export const MUTATION_REGISTRY: readonly MutationDefinition[] = MUTATIONS;

export function findMutation(id: string): MutationDefinition | undefined {
  return MUTATION_REGISTRY.find((mutation) => mutation.id === id);
}

export function resolveMutation(rawId: string | undefined): MutationActivation {
  const id = rawId?.trim();
  if (!id) {
    return healthyActivation();
  }

  const mutation = findMutation(id);
  if (!mutation || !mutation.deterministic || !mutation.enabled) {
    throw new Error(`Unknown or non-deterministic mutation "${id}". Known mutations: ${MUTATION_IDS.join(', ')}`);
  }

  return mutation.apply();
}
