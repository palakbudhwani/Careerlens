// run_analysis_tests.mjs — code-level tests for analysis_core.mjs against the
// SYNTHETIC fixture research/test-fixtures/analysis_fixture_v1.json.
//
// Scope: offline only. Runs pure Node tests (no application tests, no network,
// no providers, no secrets). Expected values are hand-derived in the fixture from
// protocol §7 formulas and protocol-published §5.3 sign-test values.
// Exit code 0 = all passed; 1 = at least one failure.
// Writes research/results/analysis/analysis_test_results.json (clearly labeled
// as code-level test output, never a research result).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  classifyScore,
  classifyRuleScore,
  splitRuns,
  mean,
  median,
  sampleSD,
  quantile7,
  pearson,
  spearman,
  fisherZReference,
  exactSignTest,
  holmAdjust,
  clopperPearson,
  rq1Agreement,
  rq2Repeatability,
  rq3EditDeltas,
  editSummary,
  rq1Bootstrap,
  rq2Bootstrap,
  LABELS,
  PROTOCOL_SEED,
} from './analysis_core.mjs';

const here = new URL('.', import.meta.url);
const fixturePath = fileURLToPath(new URL('../test-fixtures/analysis_fixture_v1.json', here));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const results = [];
let failures = 0;

function check(group, name, cond, detail = '') {
  const ok = Boolean(cond);
  results.push({ group, name, status: ok ? 'pass' : 'fail', detail: ok ? '' : detail });
  if (!ok) failures += 1;
  return ok;
}

function close(group, name, actual, expected, tol) {
  const ok = typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
  return check(group, name, ok, `expected ${expected} ±${tol}, got ${actual}`);
}

// ---------------------------------------------------------------- G1 fixture hygiene
{
  const g = 'G1_fixture_hygiene';
  check(g, 'fixture carries SYNTHETIC label', /SYNTHETIC/.test(fixture.label ?? ''), fixture.label);
  check(g, 'fixture states NOT research results', /NOT research results/.test(fixture.label ?? ''), fixture.label);
  check(g, 'fixture seed matches protocol', fixture.seed === PROTOCOL_SEED, `seed=${fixture.seed}`);
}

// ---------------------------------------------------------------- G2 RQ1 primary
{
  const g = 'G2_rq1_primary_metrics';
  const exp = fixture.agreement_panel.expected;
  const out = rq1Agreement(fixture.agreement_panel.rows);
  check(g, 'status ok', out.status === 'ok', JSON.stringify(out.reason ?? ''));
  close(g, 'n = 6', out.n, exp.n, 0);
  close(g, 'MAE', out.mae, exp.mae, 1e-6);
  close(g, 'MedAD', out.medad, exp.medad, 1e-9);
  close(g, 'bias', out.bias, exp.bias, 1e-6);
  close(g, 'SD_d', out.sd_d, exp.sd_d, 1e-5);
  close(g, 'LoA lower', out.loa_lower, exp.loa_lower, 1e-4);
  close(g, 'LoA upper', out.loa_upper, exp.loa_upper, 1e-4);
  close(g, 'P(|d|<=5) %', out.pct_within_5, exp.pct_within_5, 1e-5);
  close(g, 'P(|d|<=10) %', out.pct_within_10, exp.pct_within_10, 1e-9);
  close(g, 'Pearson r', out.pearson_r, exp.pearson_r, 1e-5);
  close(g, 'Spearman rho (exact 1.0)', out.spearman_rho, exp.spearman_rho, 1e-12);
  close(g, 'Fisher-z half-width', out.fisher_z?.half_width, exp.fisher_z_half_width, 1e-6);
  check(g, 'Fisher label = frozen wording', out.fisher_z?.label === LABELS.fisher, out.fisher_z?.label);
  check(g, 'no exclusions on clean panel', out.excluded.length === 0, JSON.stringify(out.excluded));
}

// ---------------------------------------------------------------- G3 RQ1 validation
{
  const g = 'G3_rq1_validation_missingness';
  const exp = fixture.rq1_validation.expected;
  const out = rq1Agreement(fixture.rq1_validation.rows);
  check(g, 'status ok', out.status === 'ok', out.reason ?? '');
  close(g, 'primary n = 2 (complete-case)', out.n, exp.primary_n, 0);
  close(g, 'primary MAE', out.mae, exp.primary_mae, 1e-9);
  close(g, 'primary bias', out.bias, exp.primary_bias, 1e-9);
  const reasons = {};
  for (const ex of out.excluded) reasons[ex.pair_id] = ex.reason;
  for (const [pair, want] of Object.entries(exp.excluded_reasons)) {
    check(g, `excluded ${pair} = ${want}`, reasons[pair] === want, JSON.stringify(reasons));
  }
  check(g, 'excluded count = 4', out.excluded.length === 4, JSON.stringify(out.excluded));
  check(g, 'suspected default fills counted (v2: 1)', out.suspected_default_fills_excluded === 1, String(out.suspected_default_fills_excluded));
  check(g, 'invalid runs counted (v1: 150)', out.invalid_runs_excluded === 1, String(out.invalid_runs_excluded));
  const sens = rq1Agreement(fixture.rq1_validation.rows, { includeSuspected: true });
  close(g, 'sensitivity includeSuspected n', sens.n, exp.include_suspected_sensitivity.n, 0);
  close(g, 'sensitivity includeSuspected MAE', sens.mae, exp.include_suspected_sensitivity.mae, 1e-9);
  close(g, 'sensitivity includeSuspected bias', sens.bias, exp.include_suspected_sensitivity.bias, 1e-9);
  const empty = rq1Agreement([]);
  check(g, 'empty input -> insufficient', empty.status === 'insufficient', empty.status);
}

// ---------------------------------------------------------------- G4 RQ2 repeatability
{
  const g = 'G4_rq2_repeatability';
  const exp = fixture.repeatability.expected;
  const out = rq2Repeatability(fixture.repeatability.items);
  check(g, 'status ok', out.status === 'ok', out.reason ?? '');
  close(g, 'valid items = 3', out.n, exp.valid_items, 0);
  const byId = Object.fromEntries(out.items.map((it) => [it.item_id, it]));
  for (const id of ['fx-ra', 'fx-rb', 'fx-rc']) {
    close(g, `${id} k`, byId[id]?.k, exp[id].k, 0);
    close(g, `${id} mean`, byId[id]?.mean, exp[id].mean, 1e-9);
    close(g, `${id} sd`, byId[id]?.sd, exp[id].sd, 1e-6);
    close(g, `${id} range`, byId[id]?.range, exp[id].range, 0);
    check(g, `${id} identical flag`, byId[id]?.identical === exp[id].identical, JSON.stringify(byId[id]));
  }
  close(g, 'pooled s_w = sqrt(2)', out.pooled_sw, exp.pooled_sw, 1e-9);
  close(g, 'pooled df = 5', out.pooled_df, exp.pooled_df, 0);
  close(g, 'median range = 2', out.median_range, exp.median_range, 1e-9);
  close(g, '% identical = 33.333333', out.pct_identical, exp.pct_identical, 1e-5);
  const reasons = Object.fromEntries(out.excluded.map((e) => [e.item_id, e.reason]));
  for (const [id, want] of Object.entries(exp.excluded)) {
    check(g, `excluded ${id} = ${want}`, reasons[id] === want, JSON.stringify(reasons));
  }
}

// ---------------------------------------------------------------- G5 RQ3 deltas
{
  const g = 'G5_rq3_deltas_and_missing_cells';
  const exp = fixture.edits.expected;
  const out = rq3EditDeltas(fixture.edits.cells);
  check(g, 'ok cells = 4', out.ok_count === exp.ok_cells, String(out.ok_count));
  check(g, 'missing cells = 3', out.missing_count === 3, String(out.missing_count));
  for (const cell of out.cells) {
    const want = exp[cell.pair_id];
    if (!want) continue;
    check(g, `${cell.pair_id} status = ${want.status}`, cell.status === want.status, JSON.stringify(cell));
    if (want.status === 'ok') close(g, `${cell.pair_id} delta`, cell.delta, want.delta, 1e-9);
    if (want.status === 'missing_cell') {
      check(g, `${cell.pair_id} reason = ${want.reason}`, cell.reason === want.reason, JSON.stringify(cell));
      check(g, `${cell.pair_id} delta is null`, cell.delta === null, String(cell.delta));
    }
  }
  const okDeltas = out.cells.filter((c) => c.status === 'ok').map((c) => c.delta);
  const sum = editSummary(okDeltas);
  const s = exp.summary_over_ok_deltas;
  close(g, 'summary median', sum.median, s.median, 1e-9);
  close(g, 'summary q1', sum.q1, s.q1, 1e-9);
  close(g, 'summary q3', sum.q3, s.q3, 1e-9);
  close(g, 'summary iqr', sum.iqr, s.iqr, 1e-9);
  close(g, 'summary positives', sum.positives, s.positives, 0);
  close(g, 'summary negatives', sum.negatives, s.negatives, 0);
  close(g, 'summary zeros', sum.zeros, s.zeros, 0);
  close(g, "summary sign p", sum.sign_test.p, s.sign_test_p, 1e-12);
  close(g, "summary sign n'", sum.sign_test.n_prime, s.sign_test_n_prime, 0);
  close(g, 'summary % within ±5', sum.pct_within_5, s.pct_within_5, 1e-9);
  check(g, 'summary CP interval present', sum.clopper_pearson_within_5?.lower != null && sum.clopper_pearson_within_5?.upper != null, JSON.stringify(sum.clopper_pearson_within_5));
}

// ---------------------------------------------------------------- G6 exact sign tests
{
  const g = 'G6_exact_sign_test';
  for (const fx of fixture.sign_tests) {
    const out = exactSignTest(fx.deltas);
    const wantStatus = fx.expected_status ?? 'ok';
    check(g, `${fx.name}: status`, out.status === wantStatus, JSON.stringify(out));
    close(g, `${fx.name}: n'`, out.n_prime, fx.expected_n_prime, 0);
    if (fx.expected_k != null) close(g, `${fx.name}: k`, out.k, fx.expected_k, 0);
    if (fx.expected_p == null) check(g, `${fx.name}: p null`, out.p === null, String(out.p));
    else close(g, `${fx.name}: p`, out.p, fx.expected_p, 1e-12);
  }
}

// ---------------------------------------------------------------- G7 Holm step-down
{
  const g = 'G7_holm_step_down';
  for (const fx of fixture.holm) {
    const out = holmAdjust(fx.p_values, fx.alpha);
    close(g, `${fx.name}: first-step threshold`, out.first_step_threshold, fx.expected_first_step_threshold, 1e-12);
    fx.expected_adjusted.forEach((want, i) => close(g, `${fx.name}: adjusted[${i}]`, out.adjusted[i], want, 1e-12));
    fx.expected_rejected.forEach((want, i) => check(g, `${fx.name}: rejected[${i}]`, out.rejected[i] === want, JSON.stringify(out.rejected)));
  }
}

// ---------------------------------------------------------------- G8 Clopper–Pearson
{
  const g = 'G8_clopper_pearson';
  for (const fx of fixture.clopper_pearson) {
    const out = clopperPearson(fx.k, fx.n);
    if (fx.expected_lower != null) close(g, `${fx.name}: lower`, out.lower, fx.expected_lower, 1e-7);
    if (fx.expected_upper != null) close(g, `${fx.name}: upper`, out.upper, fx.expected_upper, 1e-7);
    if (fx.expect_contains_phat != null) {
      check(
        g,
        `${fx.name}: interval contains phat`,
        out.lower <= fx.expect_contains_phat && fx.expect_contains_phat <= out.upper,
        JSON.stringify(out),
      );
    }
    check(g, `${fx.name}: ordering 0 <= lower <= upper <= 1`, out.lower >= 0 && out.lower <= out.upper && out.upper <= 1, JSON.stringify(out));
  }
}

// ---------------------------------------------------------------- G9 correlation guards
{
  const g = 'G9_correlation_guards';
  const ties = fixture.correlations.spearman_ties;
  const rho = spearman(ties.x, ties.y);
  close(g, 'Spearman with tie = hand value', rho, ties.expected_rho, 1e-6);
  check(g, 'constant input -> pearson null', pearson([5, 5, 5], [1, 2, 3]) === null, String(pearson([5, 5, 5], [1, 2, 3])));
  check(g, 'n<4 -> fisher null', fisherZReference(0.9, 3) === null, String(fisherZReference(0.9, 3)));
  check(g, 'classifyScore: 0 suspected', classifyScore(0) === 'suspected_default_fill', classifyScore(0));
  check(g, 'classifyScore: 101 invalid', classifyScore(101) === 'invalid', classifyScore(101));
  check(g, 'classifyScore: 70.5 invalid', classifyScore(70.5) === 'invalid', classifyScore(70.5));
  check(g, 'classifyScore: 50 valid', classifyScore(50) === 'valid', classifyScore(50));
  check(g, 'classifyRuleScore: 0 valid (clamp value)', classifyRuleScore(0) === 'valid', classifyRuleScore(0));
  const split = splitRuns([70, 0, 150, 'x', 71]);
  check(g, 'splitRuns valid=2 suspected=1 invalid=2', split.valid.length === 2 && split.suspected.length === 1 && split.invalidCount === 2, JSON.stringify(split));
  close(g, 'mean hand check', mean([71, 65, 82, 55, 89, 42]), 404 / 6, 1e-12);
  close(g, 'median even count', median([1, 2, 3, 4]), 2.5, 1e-12);
  close(g, 'sampleSD hand check', sampleSD([70, 72, 71]), 1, 1e-12);
  close(g, 'quantile7 type-7 hand check', quantile7([1, 2, 3, 4], 0.25), 1.75, 1e-12);
}

// ---------------------------------------------------------------- G10 bootstrap structure
{
  const g = 'G10_bootstrap';
  const rows = fixture.agreement_panel.rows;
  const opts = { iters: 500, seed: PROTOCOL_SEED };
  const a = rq1Bootstrap(rows, opts);
  const b = rq1Bootstrap(rows, opts);
  check(g, 'status ok', a.status === 'ok', a.status ?? a.reason);
  check(g, 'label contains "indicative"', /indicative/.test(a.bootstrap.label ?? ''), a.bootstrap.label);
  check(g, 'label equals frozen wording', a.bootstrap.label === LABELS.cluster, a.bootstrap.label);
  check(g, 'few-cluster warning present', typeof a.bootstrap.warning === 'string' && a.bootstrap.warning.length > 0, String(a.bootstrap.warning));
  close(g, 'resume clusters = 3', a.bootstrap.clusters.resumes, fixture.bootstrap.expected.resume_clusters, 0);
  close(g, 'job clusters = 4', a.bootstrap.clusters.jobs, fixture.bootstrap.expected.job_clusters, 0);
  close(g, 'seed recorded', a.bootstrap.seed, fixture.bootstrap.expected.seed, 0);
  close(g, 'iters honored', a.bootstrap.iters, 500, 0);
  const deterministic = JSON.stringify(a) === JSON.stringify(b);
  check(g, 'deterministic under same seed', deterministic, 'outputs differ');
  for (const [name, ci] of Object.entries(a.bootstrap.cis)) {
    check(g, `CI ordering for ${name}`, ci.lower == null || ci.upper == null || ci.lower <= ci.upper, JSON.stringify(ci));
    check(g, `CI has finite point for ${name}`, typeof ci.point === 'number' && Number.isFinite(ci.point), JSON.stringify(ci));
    check(g, `CI used <= iters for ${name}`, ci.used <= 500, String(ci.used));
    check(g, `CI point estimate matches base metric for ${name}`, typeof a.base[name] === 'number' && Math.abs(ci.point - a.base[name]) < 1e-9, JSON.stringify(ci));
  }
  const rq2 = rq2Bootstrap(fixture.repeatability.items, { iters: 500, seed: PROTOCOL_SEED });
  check(g, 'rq2 bootstrap status ok', rq2.status === 'ok', rq2.status ?? rq2.reason);
  check(g, 'rq2 pooled_sw point = base', Math.abs(rq2.bootstrap.cis.pooled_sw.point - rq2.base.pooled_sw) < 1e-12, JSON.stringify(rq2.bootstrap.cis.pooled_sw));
  const rq2b = rq2Bootstrap(fixture.repeatability.items, { iters: 500, seed: PROTOCOL_SEED });
  check(g, 'rq2 bootstrap deterministic', JSON.stringify(rq2) === JSON.stringify(rq2b), 'outputs differ');
}

// ---------------------------------------------------------------- report
const total = results.length;
const passed = total - failures;
const summary = {
  label: 'CODE-LEVEL ANALYSIS TEST RUN — not research results, no model/provider involved.',
  script: 'research/scripts/run_analysis_tests.mjs',
  core: 'research/scripts/analysis_core.mjs',
  fixture: 'research/test-fixtures/analysis_fixture_v1.json (SYNTHETIC)',
  run_at: new Date().toISOString(),
  node: process.version,
  seed: PROTOCOL_SEED,
  groups: [...new Set(results.map((r) => r.group))],
  checks_total: total,
  checks_passed: passed,
  checks_failed: failures,
  failures: results.filter((r) => r.status === 'fail'),
  results,
};

const outDir = fileURLToPath(new URL('../results/analysis/', here));
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL('../results/analysis/analysis_test_results.json', here), JSON.stringify(summary, null, 2));

for (const g of summary.groups) {
  const gr = results.filter((r) => r.group === g);
  const gf = gr.filter((r) => r.status === 'fail').length;
  console.log(`${gf === 0 ? 'PASS' : 'FAIL'}  ${g}  (${gr.length - gf}/${gr.length})`);
}
for (const f of summary.failures) console.log(`  FAIL [${f.group}] ${f.name} :: ${f.detail}`);
console.log(`\n${passed}/${total} checks passed${failures ? `, ${failures} FAILED` : ''}`);
console.log(`Wrote research/results/analysis/analysis_test_results.json`);

process.exit(failures === 0 ? 0 : 1);
