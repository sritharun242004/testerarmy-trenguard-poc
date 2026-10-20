import type { MutationId } from '../mutations.js';

export interface ProofForgeConfig {
  id: string;
  name: string;
  seed: string;
  baseUrl: string;
  scenarios: string[];
  mutations: MutationId[];
  repetitions: number;
  runner: 'playwright' | 'e2e';
  artifactDir: string;
  failOnInconclusive: boolean;
}
