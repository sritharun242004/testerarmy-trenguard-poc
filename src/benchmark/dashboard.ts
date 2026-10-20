import { writeFile } from 'node:fs/promises';

import type { ExperimentReport } from './types.js';

export async function writeDashboard(filePath: string, report: ExperimentReport): Promise<void> {
  const rows = report.results.map((result) => `<tr><td>${escapeHtml(result.scenarioId)}</td><td>${escapeHtml(result.mutationId ?? 'HEALTHY')}</td><td>${escapeHtml(result.status)}</td><td>${escapeHtml(result.mutationOutcome ?? 'BASELINE')}</td><td>${escapeHtml(result.reasonCode ?? '—')}</td></tr>`).join('');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TrenGuard benchmark dashboard</title>
<style>body{font-family:system-ui,sans-serif;background:#fffdf5;color:#1e293b;margin:0;padding:32px}main{max-width:1100px;margin:auto}h1{font-size:42px;letter-spacing:-.04em}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric,section{background:#fff;border:2px solid #1e293b;border-radius:16px;padding:18px;box-shadow:4px 4px 0 #e2e8f0}.metric strong{display:block;font-size:28px}.metric span{color:#64748b;font-size:12px}table{border-collapse:collapse;width:100%;background:#fff;border:2px solid #1e293b;border-radius:16px;overflow:hidden}th,td{text-align:left;padding:11px;border-bottom:1px solid #e2e8f0;font-size:13px}th{background:#f8f5ff}.ok{color:#047857}@media(max-width:760px){body{padding:18px}.metrics{grid-template-columns:1fr 1fr}h1{font-size:34px}}</style></head>
<body><main><p>TrenGuard / observed run</p><h1>Test strength, made visible.</h1><p>${escapeHtml(report.experiment.name)} · seed ${escapeHtml(report.experiment.seed)}</p>
<div class="metrics"><div class="metric"><strong>${formatRate(report.metrics.detectionRate.rate)}</strong><span>Detection rate</span></div><div class="metric"><strong>${formatRate(report.metrics.survivalRate.rate)}</strong><span>Survival rate</span></div><div class="metric"><strong>${formatRate(report.metrics.falseFailureRate.rate)}</strong><span>False-failure rate</span></div><div class="metric"><strong>${formatRate(report.metrics.inconclusiveRate.rate)}</strong><span>Inconclusive rate</span></div></div>
<section style="margin-top:24px"><h2>Trial matrix</h2><table><thead><tr><th>Scenario</th><th>Mutation</th><th>Run</th><th>Outcome</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table></section></main></body></html>`;
  await writeFile(filePath, html, 'utf8');
}

function formatRate(rate: number | null): string {
  return rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
