import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ExperimentReport, RunResult } from './types.js';

export async function writeReport(directory: string, report: ExperimentReport): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, 'results.json');
  const markdownPath = path.join(directory, 'summary.md');
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderMarkdown(report), 'utf8');
  return { jsonPath, markdownPath };
}

export async function readReport(filePath: string): Promise<ExperimentReport> {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (!isExperimentReport(parsed)) throw new Error(`Invalid TrenGuard report: ${filePath}`);
  return parsed;
}

export function renderMarkdown(report: ExperimentReport): string {
  const { metrics } = report;
  const resultRows = report.results.map((result) => {
    const mutation = result.mutationId ?? 'HEALTHY';
    return `| ${result.scenarioId} | ${mutation} | ${result.status} | ${result.mutationOutcome ?? 'BASELINE'} | ${result.reasonCode ?? '—'} | ${result.durationMs} |`;
  }).join('\n');

  return `# TrenGuard benchmark summary

## Experiment

- **ID:** ${report.experiment.id}
- **Name:** ${report.experiment.name}
- **Runner:** ${report.experiment.runner}
- **Seed:** \`${report.experiment.seed}\`
- **Repetitions:** ${report.experiment.repetitions}
- **Duration:** ${report.experiment.durationMs} ms

## Outcome metrics

| Metric | Numerator | Denominator | Rate |
| --- | ---: | ---: | ---: |
| Detection rate | ${metrics.detectionRate.numerator} | ${metrics.detectionRate.denominator} | ${formatRate(metrics.detectionRate.rate)} |
| Survival rate | ${metrics.survivalRate.numerator} | ${metrics.survivalRate.denominator} | ${formatRate(metrics.survivalRate.rate)} |
| False-failure rate | ${metrics.falseFailureRate.numerator} | ${metrics.falseFailureRate.denominator} | ${formatRate(metrics.falseFailureRate.rate)} |
| Inconclusive rate | ${metrics.inconclusiveRate.numerator} | ${metrics.inconclusiveRate.denominator} | ${formatRate(metrics.inconclusiveRate.rate)} |

Counts: ${Object.entries(metrics.counts).map(([key, value]) => `**${key}** ${value}`).join(' · ')}

## Weak versus strong checkout

| Scenario | M1 result | Meaning |
| --- | --- | --- |
| S1 weak-example | ${resultLabel(report.results, 'S1', 'M1')} | Confirmation-only UI check |
| S2 strong-example | ${resultLabel(report.results, 'S2', 'M1')} | Order-history and total verification |

## Trial evidence

| Scenario | Mutation | Run status | Classification | Reason | Duration (ms) |
| --- | --- | --- | --- | --- | ---: |
${resultRows}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join('\n')}

## Reproduction

\`\`\`bash
pnpm proofforge run --config proofforge.config.ts
\`\`\`
`;
}

function formatRate(value: number | null): string {
  return value === null ? 'n/a (0 denominator)' : `${(value * 100).toFixed(1)}%`;
}

function resultLabel(results: readonly RunResult[], scenarioId: string, mutationId: string): string {
  const result = results.find((entry) => entry.scenarioId === scenarioId && entry.mutationId === mutationId);
  return result?.mutationOutcome ?? 'not run';
}

function isExperimentReport(value: unknown): value is ExperimentReport {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { schemaVersion?: unknown; results?: unknown; metrics?: unknown; experiment?: unknown };
  if (candidate.schemaVersion !== '1.0' || !Array.isArray(candidate.results) || !candidate.metrics || !candidate.experiment) return false;
  if (!isExperimentMetadata(candidate.experiment) || !isMetrics(candidate.metrics)) return false;
  return candidate.results.every(isRunResult);
}

function isExperimentMetadata(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.seed === 'string'
    && (candidate.runner === 'playwright' || candidate.runner === 'e2e')
    && typeof candidate.startedAt === 'string'
    && typeof candidate.durationMs === 'number'
    && typeof candidate.repetitions === 'number'
    && Array.isArray(candidate.scenarios)
    && Array.isArray(candidate.mutations);
}

function isMetrics(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return isMetric(candidate.detectionRate)
    && isMetric(candidate.survivalRate)
    && isMetric(candidate.falseFailureRate)
    && isMetric(candidate.inconclusiveRate)
    && Boolean(candidate.counts);
}

function isMetric(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.numerator === 'number'
    && typeof candidate.denominator === 'number'
    && (typeof candidate.rate === 'number' || candidate.rate === null);
}

function isRunResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.runId === 'string'
    && typeof candidate.scenarioId === 'string'
    && (candidate.mutationId === null || typeof candidate.mutationId === 'string')
    && typeof candidate.status === 'string'
    && Array.isArray(candidate.assertions)
    && Boolean(candidate.evidence)
    && isEvidence(candidate.evidence)
    && Boolean(candidate.environment);
}

function isEvidence(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.runnerOutput === 'string'
    && typeof candidate.runnerError === 'string'
    && typeof candidate.appHealth === 'string'
    && isOracle(candidate.oracle);
}

function isOracle(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (candidate.expectedSignal === null || typeof candidate.expectedSignal === 'string')
    && typeof candidate.observed === 'boolean'
    && typeof candidate.source === 'string'
    && Boolean(candidate.details);
}
