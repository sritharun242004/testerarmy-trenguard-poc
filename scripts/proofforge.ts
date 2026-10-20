import path from 'node:path';

import { runBenchmark } from '../src/benchmark/runner.js';
import { readReport, renderMarkdown, writeReport } from '../src/benchmark/report.js';
import { writeDashboard } from '../src/benchmark/dashboard.js';
import { MUTATION_REGISTRY, MUTATION_IDS, findMutation, type MutationId } from '../src/mutations.js';
import type { ProofForgeConfig } from '../src/benchmark/config.js';
import { inspectTesterArmyE2E } from '../src/optional-e2e.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';

try {
  if (command === 'run') {
    await runCommand();
  } else if (command === 'report') {
    await reportCommand();
  } else if (command === 'dashboard') {
    await dashboardCommand();
  } else if (command === 'list-mutations') {
    listMutations();
  } else if (command === 'validate-config') {
    await validateConfigCommand();
  } else if (command === 'e2e-status') {
    const preflight = await inspectTesterArmyE2E();
    console.log(`TesterArmy e2e adapter: ${preflight.available ? 'available' : 'unavailable'}`);
    console.log(`Node: ${preflight.nodeVersion} (required ${preflight.requiredNode})`);
    console.log(`e2e: ${preflight.e2eVersion ?? 'not installed'}`);
    console.log(`@e2e-dev/web: ${preflight.webEngineVersion ?? 'not installed'}`);
    if (preflight.reason) console.log(`Reason: ${preflight.reason}`);
    process.exitCode = 0;
  } else {
    printHelp();
    process.exitCode = command === 'help' ? 0 : 2;
  }
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}

async function runCommand(): Promise<void> {
  const config = await loadConfig(getOption('--config') ?? 'proofforge.config.ts');
  validateConfig(config);
  const outputDir = path.resolve(getOption('--output') ?? config.artifactDir);
  const scenarioIds = getRepeatedOption('--scenario');
  const mutationValues = getRepeatedOption('--mutation');
  const mutationIds = mutationValues.length > 0 ? mutationValues.map(asMutationId) : config.mutations;
  const repetitions = Number(getOption('--repetitions') ?? config.repetitions);
  const seed = getOption('--seed') ?? config.seed;

  const result = await runBenchmark({
    config,
    scenarioIds: scenarioIds.length > 0 ? scenarioIds : config.scenarios,
    mutationIds,
    repetitions,
    outputDir,
    seed,
  });
  await writeDashboard(path.join(outputDir, 'dashboard.html'), result.report);
  console.log(`TrenGuard run complete: ${result.paths.jsonPath}`);
  console.log(`Summary: ${result.paths.markdownPath}`);
  console.log(`Dashboard: ${path.join(outputDir, 'dashboard.html')}`);
  console.log(`Detected ${result.report.metrics.detectionRate.numerator}/${result.report.metrics.detectionRate.denominator} valid mutation trials.`);
  if (!process.exitCode && config.failOnInconclusive && result.report.metrics.inconclusiveRate.numerator > 0) process.exitCode = 3;
}

async function reportCommand(): Promise<void> {
  const input = path.resolve(getOption('--input') ?? 'artifacts/latest/results.json');
  const report = await readReport(input);
  const directory = path.dirname(input);
  await writeReport(directory, report);
  console.log(`Summary: ${path.join(directory, 'summary.md')}`);
}

async function dashboardCommand(): Promise<void> {
  const input = path.resolve(getOption('--input') ?? 'artifacts/latest/results.json');
  const output = path.resolve(getOption('--output') ?? path.join(path.dirname(input), 'dashboard.html'));
  const report = await readReport(input);
  await writeDashboard(output, report);
  console.log(`Dashboard: ${output}`);
}

function listMutations(): void {
  for (const mutation of MUTATION_REGISTRY) {
    console.log(`${mutation.id}\t${mutation.title}\t${mutation.category}\t${mutation.expectedAffectedScenarios.join(',')}`);
  }
}

async function validateConfigCommand(): Promise<void> {
  const config = await loadConfig(getOption('--config') ?? 'proofforge.config.ts');
  validateConfig(config);
  console.log(`Configuration valid: ${config.id}`);
}

async function loadConfig(file: string): Promise<ProofForgeConfig> {
  const module = await import(path.resolve(file));
  return module.default as ProofForgeConfig;
}

function validateConfig(config: ProofForgeConfig): void {
  if (!config.id || !config.name || !config.seed) throw new Error('Config requires id, name, and seed.');
  if (!Array.isArray(config.scenarios) || config.scenarios.length === 0) throw new Error('Config requires at least one scenario.');
  const knownScenarios = new Set(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  if (config.scenarios.some((scenario) => !knownScenarios.has(scenario))) throw new Error('Config contains an unknown scenario.');
  if (!Array.isArray(config.mutations) || config.mutations.some((id) => !MUTATION_IDS.includes(id))) throw new Error('Config contains an unknown mutation.');
  if (!Number.isInteger(config.repetitions) || config.repetitions < 1) throw new Error('Config repetitions must be a positive integer.');
  if (config.runner !== 'playwright' && config.runner !== 'e2e') throw new Error('Config runner must be playwright or e2e.');
  try {
    const url = new URL(config.baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('Config baseUrl must be an absolute HTTP(S) URL.');
  }
  if (!config.artifactDir || path.isAbsolute(config.artifactDir) || config.artifactDir.startsWith('..')) throw new Error('Config artifactDir must stay inside the project.');
}

function asMutationId(value: string): MutationId {
  if (!findMutation(value)) throw new Error(`Unknown mutation: ${value}`);
  return value as MutationId;
}

function getOption(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function getRepeatedOption(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === name && value) values.push(value);
  }
  return values;
}

function printHelp(): void {
  console.log(`Usage:
  pnpm proofforge run [--config proofforge.config.ts] [--scenario S2] [--mutation M1] [--repetitions 1] [--output artifacts/latest]
  pnpm proofforge report --input artifacts/latest/results.json
  pnpm proofforge dashboard --input artifacts/latest/results.json
  pnpm proofforge list-mutations
  pnpm proofforge validate-config
  pnpm proofforge e2e-status`);
}
