// RQ1 agreement analysis v1 (focused §4.7, n=31 existing baselines). OFFLINE ONLY.
// Reads: CALL_LEDGER.csv, raw JSONL, frozen benchmark_v1.json. Uses the frozen
// research/scripts/analysis_core.mjs metric library (191/191 tests) + offline
// backend/ruleBasedFallback.js buildMatchAnalysis (pure; llm.js never imported).
// Writes (new files only; deterministic — no timestamps, fixed key order):
//   research/results/analysis/rq1_observations_v1.json (frozen snapshot + manifest)
//   research/results/analysis/rq1_results_v1.json (metrics)
//   research/results/analysis/rq1_results_v1.md (results table)
//   research/results/analysis/rq1_scatter_v1.svg (F1: AI vs rule + identity)
//   research/results/analysis/rq1_blandaltman_v1.svg (F2: difference vs mean)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const outDir = path.join(rootDir, 'research', 'results', 'analysis');
const { buildMatchAnalysis } = await import(pathToFileURL(path.join(rootDir, 'backend', 'ruleBasedFallback.js')).href);
const core = await import('./analysis_core.mjs');
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const benchRaw = readFileSync(path.join(rootDir, 'research', 'data', 'benchmark-v1', 'benchmark_v1.json'), 'utf8');
const D = JSON.parse(benchRaw);
const ledgerRaw = readFileSync(path.join(rootDir, 'research', 'logs', 'CALL_LEDGER.csv'), 'utf8');
const rawLines = readFileSync(path.join(rootDir, 'research', 'results', 'raw', 'groq_tierb_chains.jsonl'), 'utf8').split('\n').filter((l) => l.trim());
const resumes = new Map(D.resumes.map((r) => [r.resume_id, r.text]));
const jobs = new Map(D.jobs.map((j) => [j.job_id, j.text]));
// --- audit: ledger rows
const ledger = [];
for (const line of ledgerRaw.split('\n').slice(1)) {
  const c = line.trim().split(',');
  if (c.length < 16 || !c[1]) continue;
  ledger.push({ seq: Number(c[0]), ts: c[1], case_id: c[2], run_idx: Number(c[3]), purpose: c[4], attempt_idx: Number(c[5]), code: c[6], served: c[9], latency: Number(c[10]), outcome: c[11], counted: Number(c[12]) || 0, pt: c[13] === '' ? null : Number(c[13]), ct: c[14] === '' ? null : Number(c[14]), tt: c[15] === '' ? null : Number(c[15]) });
}
// --- audit: raw JSONL lines (valid_for_analysis + groq + int 1..100 + baseline run 0, no edit)
const raw = rawLines.map((l, i) => ({ line: i + 1, ...JSON.parse(l) }));
const isIntScore = (v) => Number.isInteger(v) && v >= 1 && v <= 100;
const aiObs = raw.filter((r) => r.valid_for_analysis === true && /groq/i.test(r.served_provider || '') && isIntScore(r.atsScore) && (r.purpose === 'RQ1' || r.purpose === 'RQ3' || r.purpose === 'retry') && !r.edit && r.run_idx === 0);
// first-valid per (case,run); later valid dups flagged (adopted rule)
const seenFam = new Set();
const accepted = [];
const duplicates = [];
for (const r of aiObs) {
  const fam = `${r.case_id}|${r.run_idx}`;
  if (seenFam.has(fam)) { duplicates.push({ case_id: r.case_id, run_idx: r.run_idx, line: r.line, atsScore: r.atsScore }); continue; }
  seenFam.add(fam);
  accepted.push(r);
}
// cross-check ledger AI_OK baseline rows <-> accepted JSONL (by case/run/attempt/purpose-served)
const fails = ledger.filter((r) => r.outcome !== 'AI_OK' && !r.outcome.startsWith('HARNESS_DEFECT'));
const invalidOutputs = raw.filter((r) => r.atsScore === 0);
const modelLabels = [...new Set(accepted.map((r) => r.model))];
const servedLabels = [...new Set(accepted.map((r) => r.served_provider))];
const mismatches = [];
for (const a of accepted) {
  const m = ledger.find((r) => r.case_id === a.case_id && r.run_idx === a.run_idx && r.attempt_idx === a.attempt_idx && r.outcome === 'AI_OK');
  if (!m) mismatches.push(`no ledger AI_OK for ${a.case_id} run ${a.run_idx} att ${a.attempt_idx} (line ${a.line})`);
}
// --- rule scores (offline recompute on frozen texts) + snapshot rows (sorted, fixed keys)
const pairs = new Map(D.pairs.map((p) => [p.pair_id, p]));
const snapRows = accepted.map((a) => {
  const p = pairs.get(a.case_id);
  const rule = buildMatchAnalysis(resumes.get(p.resume_id), jobs.get(p.job_id)).atsScore;
  return { pair_id: a.case_id, resume_id: p.resume_id, job_id: p.job_id, designed_tier: p.designed_tier, rule_score: rule, ai_score: a.atsScore, ai_runs: [a.atsScore], ledger_seq: (ledger.find((r) => r.case_id === a.case_id && r.run_idx === a.run_idx && r.attempt_idx === a.attempt_idx && r.outcome === 'AI_OK') || {}).seq ?? null, raw_line: a.line, served_provider: a.served_provider, model: a.model, latency_ms: a.latency_ms, tokens: a.http_attempts && a.http_attempts[0] ? a.http_attempts[0].usage : { prompt_tokens: null, completion_tokens: null, total_tokens: null } };
}).sort((x, y) => (x.pair_id < y.pair_id ? -1 : 1));
const snapshot = {
  dataset_id: 'careerlens-rq1-observations-v1',
  protocol_ref: 'RESEARCH_PROTOCOL.md §4.7 (focused RQ1, n=31 existing baselines; first-valid-success dedupe)',
  n_accepted: snapRows.length,
  manifest: {
    benchmark_sha256: sha(benchRaw),
    ledger_rows: ledger.length,
    raw_lines: raw.length,
    generator_seed: 20261013,
    analysis_library: 'research/scripts/analysis_core.mjs (frozen; PROTOCOL_SEED 20261013)',
    rule_engine: 'backend/ruleBasedFallback.js buildMatchAnalysis (offline recompute)',
    ground_truth_note: 'No independently validated ground-truth ATS scores exist; agreement with a rule-based score is NOT accuracy.',
  },
  audit: {
    failed_attempt_rows: fails.map((r) => ({ seq: r.seq, case: r.case_id, outcome: r.outcome, code: r.code })),
    defect_zero_http_rows: ledger.filter((r) => r.outcome.startsWith('HARNESS_DEFECT')).map((r) => r.seq),
    duplicate_valid_observations: duplicates,
    invalid_outputs_ats_zero: invalidOutputs.length,
    ledger_jsonl_mismatches: mismatches,
    served_labels: servedLabels,
    model_labels: modelLabels,
  },
  rows: snapRows,
};
// --- metrics via frozen library
const coreRows = snapRows.map((r) => ({ pair_id: r.pair_id, resume_id: r.resume_id, job_id: r.job_id, rule_score: r.rule_score, ai_runs: r.ai_runs }));
const agreement = core.rq1Agreement(coreRows);
const boot = core.rq1Bootstrap(coreRows, { iters: 10000, seed: core.PROTOCOL_SEED });
const results = {
  dataset_id: snapshot.dataset_id,
  n: agreement.n,
  status: agreement.status,
  mae: agreement.mae,
  medad: agreement.medad,
  bias: agreement.bias,
  sd_d: agreement.sd_d,
  loa_lower: agreement.loa_lower,
  loa_upper: agreement.loa_upper,
  pct_within_5: agreement.pct_within_5,
  pct_within_10: agreement.pct_within_10,
  pearson_r: agreement.pearson_r,
  spearman_rho: agreement.spearman_rho,
  fisher_z_reference: agreement.fisher_z,
  cluster_bootstrap_indicative: boot.status === 'ok' ? boot.bootstrap : boot,
  excluded: agreement.excluded,
  ground_truth_note: snapshot.manifest.ground_truth_note,
};
const f2 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? 'n/a' : String(Math.round(v * 100) / 100));
const md = `# RQ1 score-agreement results v1 (focused §4.7, n=${results.n})\n\nAgreement is NOT accuracy: no ground-truth ATS scores exist; these measure AI-vs-rule score correspondence on this fixed panel only.\n\n| Metric | Value |\n|---|---|\n| n (pairs) | ${results.n} |\n| MAE (points) | ${f2(results.mae)} |\n| Median absolute difference (points) | ${f2(results.medad)} |\n| Mean bias AI−rule (points) | ${f2(results.bias)} |\n| SD of differences (points) | ${f2(results.sd_d)} |\n| Limits of agreement (points) | ${f2(results.loa_lower)} to ${f2(results.loa_upper)} |\n| Within ±5 points (%) | ${f2(results.pct_within_5)} |\n| Within ±10 points (%) | ${f2(results.pct_within_10)} |\n| Pearson r | ${f2(results.pearson_r)} |\n| Spearman rho | ${f2(results.spearman_rho)} |\n| Fisher-z reference 95% half-width | ${results.fisher_z_reference ? f2(results.fisher_z_reference.half_width) : 'n/a'} (${results.fisher_z_reference ? results.fisher_z_reference.label : 'n/a — independence does not hold'})) |\n\nCluster-bootstrap CIs are indicative ranges (few-cluster, uncalibrated); see results JSON.\n`;
// --- SVG plots (deterministic, hand-built; n stated on every panel)
function svgScatter(rs) {
  const W = 560, H = 420, P = 56;
  const pts = rs.map((r) => `${(P + (r.rule_score / 100) * (W - 2 * P)).toFixed(1)},${(H - P - (r.ai_score / 100) * (H - 2 * P)).toFixed(1)}`).map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="#1f6feb"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/><text x="${W / 2}" y="24" text-anchor="middle" font-size="14">RQ1 AI vs rule scores (n=${rs.length})</text><line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${P}" stroke="#888" stroke-dasharray="5,4"/><text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-size="12">rule atsScore (0-100)</text><text x="14" y="${H / 2}" text-anchor="middle" font-size="12" transform="rotate(-90 14,${H / 2})">AI atsScore (0-100)</text>${pts}</svg>\n`;
}
function svgBA(rs, bias, lo, hi) {
  const W = 560, H = 420, P = 56;
  const X = (m) => P + (m / 100) * (W - 2 * P);
  const Y = (d) => H / 2 - (d / 100) * (H - 2 * P);
  const pts = rs.map((r) => { const m = (r.ai_score + r.rule_score) / 2, d = r.ai_score - r.rule_score; return `<circle cx="${X(m).toFixed(1)}" cy="${Y(d).toFixed(1)}" r="4" fill="#1f6feb"/>`; }).join('');
  const hl = (v, c, dash) => `<line x1="${P}" y1="${Y(v).toFixed(1)}" x2="${W - P}" y2="${Y(v).toFixed(1)}" stroke="${c}" ${dash ? 'stroke-dasharray="5,4"' : ''}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/><text x="${W / 2}" y="24" text-anchor="middle" font-size="14">RQ1 Bland-Altman differences (n=${rs.length})</text>${hl(bias, '#222', false)}${hl(lo, '#888', true)}${hl(hi, '#888', true)}<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-size="12">pair mean (points)</text><text x="14" y="${H / 2}" text-anchor="middle" font-size="12" transform="rotate(-90 14,${H / 2})">AI minus rule (points)</text>${pts}</svg>\n`;
}
writeFileSync(path.join(outDir, 'rq1_observations_v1.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(path.join(outDir, 'rq1_results_v1.json'), `${JSON.stringify(results, null, 2)}\n`);
writeFileSync(path.join(outDir, 'rq1_results_v1.md'), `${md}\n`);
writeFileSync(path.join(outDir, 'rq1_scatter_v1.svg'), svgScatter(snapRows));
writeFileSync(path.join(outDir, 'rq1_blandaltman_v1.svg'), svgBA(snapRows, results.bias, results.loa_lower, results.loa_upper));
console.log(`RQ1 n=${results.n} MAE=${f2(results.mae)} MedAD=${f2(results.medad)} bias=${f2(results.bias)} P5=${f2(results.pct_within_5)} P10=${f2(results.pct_within_10)} r=${f2(results.pearson_r)} rho=${f2(results.spearman_rho)} excluded=${agreement.excluded.length} mismatches=${mismatches.length} dups=${duplicates.length}`);
console.log(`wrote ${path.relative(rootDir, outDir)}/rq1_{observations,results}_v1.{json,md} + rq1_{scatter,blandaltman}_v1.svg`);
