// Independent RQ1 verifier v1: recomputes every headline metric with DIFFERENT
// implementations (Kahan mean, Welford SD, descending-sort median, single-pass
// Pearson, counting-rank Spearman, atanh Fisher) and re-derives the accepted set
// straight from the ledger (own CSV parse + first-valid rule). OFFLINE ONLY.
// Pass bar: |diff| <= 1e-9 absolute (1e-9 relative for |v|>1) on every metric.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const outDir = path.join(rootDir, 'research', 'results', 'analysis');
const snap = JSON.parse(readFileSync(path.join(outDir, 'rq1_observations_v1.json'), 'utf8'));
const res = JSON.parse(readFileSync(path.join(outDir, 'rq1_results_v1.json'), 'utf8'));
let fail = 0;
const close = (name, a, b) => {
  const ok = (a === null && b === null) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
  console.log(`${ok ? 'AGREE' : 'MISMATCH'} ${name}: recomputed=${a} recorded=${b}`);
  if (!ok) fail++;
};
// independent re-derivation from ledger (own parse, first-valid per baseline family)
const rows = [];
for (const line of readFileSync(path.join(rootDir, 'research', 'logs', 'CALL_LEDGER.csv'), 'utf8').split('\n').slice(1)) {
  const c = line.trim().split(',');
  if (c.length < 16 || !c[1]) continue;
  rows.push({ purpose: c[4], case_id: c[2], run_idx: Number(c[3]), attempt: Number(c[5]), outcome: c[11] });
}
const firstValid = new Map();
for (const r of rows) {
  if (r.purpose === 'preflight' || r.case_id.includes('__E')) continue;
  if (r.outcome !== 'AI_OK' || r.run_idx !== 0) continue;
  const k = `${r.case_id}|${r.run_idx}`;
  if (!firstValid.has(k)) firstValid.set(k, r);
}
close('accepted-pair-count', firstValid.size, snap.n_accepted);
const snapSet = new Set(snap.rows.map((r) => `${r.pair_id}|0`));
const missing = [...firstValid.keys()].filter((k) => !snapSet.has(k));
const extra = [...snapSet].filter((k) => !firstValid.has(k));
if (missing.length || extra.length) { console.log(`MISMATCH accepted-set missing=[${missing}] extra=[${extra}]`); fail++; }
else console.log('AGREE accepted-set identical');
// Kahan mean, Welford sample SD, descending median, single-pass Pearson, counting Spearman, atanh Fisher
const A = snap.rows.map((r) => r.ai_score);
const B = snap.rows.map((r) => r.rule_score);
const D = A.map((a, i) => a - B[i]);
const AD = D.map(Math.abs);
function kahanMean(v) { let s = 0, c = 0; for (const x of v) { const y = x - c, t = s + y; c = (t - s) - y; s = t; } return s / v.length; }
function welfordSD(v) { let m = 0, s2 = 0; v.forEach((x, i) => { const d = x - m; m += d / (i + 1); s2 += d * (x - m); }); return Math.sqrt(s2 / (v.length - 1)); }
function medianDesc(v) { const a = [...v].sort((x, y) => y - x); const m = a.length; return m % 2 === 1 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2; }
function pearson1P(x, y) { const n = x.length; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; sxy += x[i] * y[i]; } const cov = sxy - (sx * sy) / n; return cov / Math.sqrt((sxx - (sx * sx) / n) * (syy - (sy * sy) / n)); }
function countingRanks(v) { return v.map((x) => 1 + v.filter((y) => y < x).length + (v.filter((y) => y === x).length - 1) / 2); }
function spearmanC(x, y) { return pearson1P(countingRanks(x), countingRanks(y)); }
const n = A.length;
close('mae', kahanMean(AD), res.mae);
close('medad', medianDesc(AD), res.medad);
close('bias', kahanMean(D), res.bias);
close('sd_d', welfordSD(D), res.sd_d);
close('loa_lower', kahanMean(D) - 1.96 * welfordSD(D), res.loa_lower);
close('loa_upper', kahanMean(D) + 1.96 * welfordSD(D), res.loa_upper);
close('pct_within_5', (100 * AD.filter((d) => d <= 5).length) / n, res.pct_within_5);
close('pct_within_10', (100 * AD.filter((d) => d <= 10).length) / n, res.pct_within_10);
close('pearson_r', pearson1P(A, B), res.pearson_r);
close('spearman_rho', spearmanC(A, B), res.spearman_rho);
{
  const r = pearson1P(A, B);
  const hw = 1.96 / Math.sqrt(n - 3);
  const z = Math.atanh(r);
  close('fisher_halfwidth', hw, res.fisher_z_reference.half_width);
  close('fisher_lo', Math.tanh(z - hw), res.fisher_z_reference.ci_lower);
  close('fisher_hi', Math.tanh(z + hw), res.fisher_z_reference.ci_upper);
}
console.log(fail === 0 ? 'RQ1_VERIFY_PASS' : `RQ1_VERIFY_FAILED(${fail})`);
process.exit(fail === 0 ? 0 : 1);
