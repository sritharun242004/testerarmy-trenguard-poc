import type { ProofForgeConfig } from './src/benchmark/config.js';

const config: ProofForgeConfig = {
  id: 'checkout-verification',
  name: 'TrenGuard checkout and state verification benchmark',
  seed: 'proofforge-phase-4',
  baseUrl: 'http://127.0.0.1:4175',
  scenarios: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  mutations: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
  repetitions: 1,
  runner: 'playwright',
  artifactDir: 'artifacts/latest',
  failOnInconclusive: false,
};

export default config;
