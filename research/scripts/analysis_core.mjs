// analysis_core.mjs — pure, offline analysis functions for CareerLens RQ1–RQ3.
//
// Scope: RESEARCH_PROTOCOL.md §7 metrics implemented as standard named procedures
// (MAE, MedAD, bias + SD_d, limits of agreement, % within ±5/±10, Pearson r,
// Spearman ρ with average-rank ties, Fisher-z reference interval, pooled within-pair
// SD, exact two-sided binomial sign test, Holm step-down, Clopper–Pearson exact
// interval, two-way cluster bootstrap with seed 20261013). RQ1/RQ2/RQ3 validation
// follows §8.4 (complete-case, ≥2 valid runs, MISSING_CELL, no imputation).
//
// Rules: zero network, zero application imports, zero secrets. Function-pure
// except the seeded PRNG (deterministic). Literature citations for these
// procedures are pending Phase 8 verification (§9) — none is invented here.
//
// Labels (frozen wording, protocol §5.1/§7.1):
//   - Fisher-z / pair-level intervals: "reference (independence assumption — does not hold)"
//   - cluster bootstrap CIs: "indicative (few-cluster bootstrap) — not calibrated 95% coverage"

export const PROTOCOL_SEED = 20261013;

export const LABELS = {
  fisher: 'reference (independence assumption — does not hold)',
  cluster: 'indicative (few-cluster bootstrap) — not calibrated 95% coverage',
};

// ---------------------------------------------------------------- primitives

export function classifyScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return 'invalid';
  if (value < 0 || value > 100) return 'invalid';
  if (value === 0) return 'suspected_default_fill'; // C9 / §8.1 AI_SCHEMA_DEFAULT_FILL
  return 'valid'; // 1–100
}

export function classifyRuleScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return 'invalid';
  if (value < 0 || value > 100) return 'invalid';
  return 'valid'; // rule arm 0–100 is a legitimate computed value
}

export function splitRuns(runs, { includeSuspected = false } = {}) {
  const list = Array.isArray(runs) ? runs : [];
  const valid = [];
  const suspected = [];
  let invalidCount = 0;
  for (const r of list) {
    const c = classifyScore(r);
    if (c === 'valid') valid.push(r);
    else if (c === 'suspected_default_fill') suspected.push(r);
    else invalidCount += 1;
  }
  const primary = includeSuspected ? valid.concat(suspected) : valid;
  return { valid, suspected, invalidCount, primary };
}

export function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

export function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const a = [...values].sort((x, y) => x - y);
  const m = a.length;
  const h = Math.floor((m - 1) / 2);
  return m % 2 === 1 ? a[h] : (a[h] + a[h + 1]) / 2;
}

export function sampleSD(values) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const mu = mean(values);
  let ss = 0;
  for (const v of values) ss += (v - mu) * (v - mu);
  return Math.sqrt(ss / (values.length - 1));
}

// Type-7 linear-interpolation quantile (R default), on a sorted copy.
export function quantile7(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const a = [...values].sort((x, y) => x - y);
  const n = a.length;
  if (n === 1) return a[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const frac = h - lo;
  if (frac === 0) return a[lo];
  const hi = Math.min(lo + 1, n - 1);
  return a[lo] + frac * (a[hi] - a[lo]);
}

// Average ranks (ties get the mean of the tied positions).
export function rankArray(values) {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length).fill(null);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j += 1;
    const avg = (i + j) / 2 + 1; // 1-based average of positions i..j
    for (let k = i; k <= j; k += 1) ranks[idx[k].i] = avg;
    i = j + 1;
  }
  return ranks;
}

export function pearson(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 3) return null;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null; // constant input → undefined
  return sxy / Math.sqrt(sxx * syy);
}

export function spearman(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 3) return null;
  return pearson(rankArray(x), rankArray(y));
}

export function fisherZReference(r, n) {
  if (typeof r !== 'number' || !Number.isFinite(r) || Math.abs(r) >= 1) return null;
  if (!Number.isFinite(n) || n < 4) return null; // 1.96/sqrt(n-3) needs n > 3
  const halfWidth = 1.96 / Math.sqrt(n - 3);
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const lo = Math.tanh(z - halfWidth);
  const hi = Math.tanh(z + halfWidth);
  return { half_width: halfWidth, ci_lower: lo, ci_upper: hi, label: LABELS.fisher };
}

// --------------------------------------------------- tests / multiplicity / CI

function binomCoeff(n, k) {
  let c = 1;
  for (let i = 0; i < k; i += 1) c = (c * (n - i)) / (i + 1);
  return c;
}

// P(X >= k) for X ~ Bin(n, 0.5), exact on powers of two.
function binomTailAtLeast(n, k) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let s = 0;
  for (let i = k; i <= n; i += 1) s += binomCoeff(n, i);
  return s / 2 ** n;
}

// Exact two-sided binomial sign test (protocol §5.3): p = min(1, 2·P(X ≥ k)),
// k = majority sign count among non-zero deltas; ties (zero deltas) excluded.
export function exactSignTest(deltas) {
  if (!Array.isArray(deltas)) throw new TypeError('deltas must be an array');
  let positives = 0;
  let negatives = 0;
  let zeros = 0;
  for (const d of deltas) {
    if (typeof d !== 'number' || !Number.isFinite(d)) throw new TypeError('delta must be a finite number');
    if (d > 0) positives += 1;
    else if (d < 0) negatives += 1;
    else zeros += 1;
  }
  const nPrime = positives + negatives;
  if (nPrime === 0) {
    return { status: 'no_nonzero', n_prime: 0, positives, negatives, zeros, k: null, p: null };
  }
  const k = Math.max(positives, negatives);
  const p = Math.min(1, 2 * binomTailAtLeast(nPrime, k));
  return { status: 'ok', n_prime: nPrime, positives, negatives, zeros, k, p };
}

// Holm step-down (protocol §7.3): adjusted p_i = max over ranks of
// (m - rank + 1)·p_(rank), capped at 1; reject until first failure at α/(m−rank+1).
export function holmAdjust(pValues, alpha = 0.05) {
  if (!Array.isArray(pValues) || pValues.length === 0) throw new TypeError('pValues must be a non-empty array');
  const m = pValues.length;
  const order = pValues.map((p, i) => i).sort((a, b) => pValues[a] - pValues[b]);
  const adjusted = new Array(m).fill(null);
  const rejected = new Array(m).fill(false);
  let running = 0;
  let stopped = false;
  for (let r = 0; r < m; r += 1) {
    const i = order[r];
    const factor = m - r;
    const raw = Math.min(1, pValues[i] * factor);
    running = Math.max(running, raw);
    adjusted[i] = running;
    if (!stopped && pValues[i] <= alpha / factor) rejected[i] = true;
    else stopped = true;
  }
  return { m, alpha, first_step_threshold: alpha / m, adjusted, rejected, order };
}

function binomCdf(k, n, p) {
  let s = 0;
  for (let i = 0; i <= k; i += 1) s += binomCoeff(n, i) * p ** i * (1 - p) ** (n - i);
  return s;
}

function binomSurvival(k, n, p) {
  let s = 0;
  for (let i = k; i <= n; i += 1) s += binomCoeff(n, i) * p ** i * (1 - p) ** (n - i);
  return s;
}

// Clopper–Pearson exact interval by bisection on the binomial tails (§7.3).
// lower solves P(X >= k | p) = α/2 (survival increasing in p);
// upper solves P(X <= k | p) = α/2 (CDF decreasing in p for k < n).
export function clopperPearson(k, n, alpha = 0.05) {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || k < 0 || k > n) {
    throw new RangeError('require n >= 1 and 0 <= k <= n (integers)');
  }
  const target = alpha / 2;
  let lower = 0;
  if (k > 0) {
    let lo = 0;
    let hi = 1;
    for (let it = 0; it < 200; it += 1) {
      const mid = (lo + hi) / 2;
      if (binomSurvival(k, n, mid) < target) lo = mid;
      else hi = mid;
    }
    lower = (lo + hi) / 2;
  }
  let upper = 1;
  if (k < n) {
    let lo = 0;
    let hi = 1;
    for (let it = 0; it < 200; it += 1) {
      const mid = (lo + hi) / 2;
      if (binomCdf(k, n, mid) > target) lo = mid;
      else hi = mid;
    }
    upper = (lo + hi) / 2;
  }
  return { lower, upper };
}

// ---------------------------------------------------------------- RQ1 (§7.1)

// rows: { pair_id, resume_id?, job_id?, ai_runs: number[], rule_score: number }
// §8.4 complete-case: keep pairs with a valid rule score and >= 1 valid AI run;
// AI run 0 = suspected default fill (excluded from primary, optional sensitivity).
export function rq1Agreement(rows, { includeSuspected = false } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: 'insufficient', reason: 'no_rows', n: 0, excluded: [] };
  }
  const included = [];
  const excluded = [];
  for (const row of rows) {
    const pairId = row.pair_id ?? '(missing_pair_id)';
    const ruleClass = classifyRuleScore(row.rule_score);
    if (ruleClass === 'invalid') {
      excluded.push({ pair_id: pairId, reason: 'invalid_rule_score' });
      continue;
    }
    const runs = splitRuns(row.ai_runs, { includeSuspected });
    if (runs.primary.length === 0) {
      excluded.push({ pair_id: pairId, reason: 'no_valid_ai_runs' });
      continue;
    }
    included.push({ ...row, ai_mean: mean(runs.primary), suspected_count: runs.suspected.length, invalid_runs: runs.invalidCount });
  }
  const n = included.length;
  if (n < 2) {
    return { status: 'insufficient', reason: 'fewer_than_2_complete_pairs', n, excluded };
  }
  const diffs = included.map((r) => r.ai_mean - r.rule_score);
  const absDiffs = diffs.map(Math.abs);
  const aiMeans = included.map((r) => r.ai_mean);
  const ruleScores = included.map((r) => r.rule_score);
  const dbar = mean(diffs);
  const sdD = sampleSD(diffs);
  const r = pearson(aiMeans, ruleScores);
  const rho = spearman(aiMeans, ruleScores);
  const fisher = fisherZReference(r, n);
  return {
    status: 'ok',
    n,
    excluded,
    included_pair_ids: included.map((x) => x.pair_id),
    mae: mean(absDiffs),
    medad: median(absDiffs),
    bias: dbar,
    sd_d: sdD,
    loa_lower: dbar - 1.96 * sdD,
    loa_upper: dbar + 1.96 * sdD,
    pct_within_5: (100 * absDiffs.filter((d) => d <= 5).length) / n,
    pct_within_10: (100 * absDiffs.filter((d) => d <= 10).length) / n,
    pearson_r: r,
    spearman_rho: rho,
    fisher_z: fisher,
    suspected_default_fills_excluded: included.reduce((s, x) => s + x.suspected_count, 0),
    invalid_runs_excluded: included.reduce((s, x) => s + x.invalid_runs, 0),
    diffs,
  };
}

// ---------------------------------------------------------------- RQ2 (§7.2)

// items: { item_id, resume_id?, job_id?, runs: number[] }
// §8.4: items need >= 2 valid runs; pooled s_w over valid items; no imputation.
export function rq2Repeatability(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { status: 'insufficient', reason: 'no_items', n: 0, excluded: [] };
  }
  const valid = [];
  const excluded = [];
  for (const item of items) {
    const id = item.item_id ?? '(missing_item_id)';
    const runs = splitRuns(item.runs, {});
    if (runs.primary.length < 2) {
      excluded.push({ item_id: id, reason: 'fewer_than_2_valid_runs', valid_runs: runs.primary.length });
      continue;
    }
    const vals = runs.primary;
    valid.push({
      item_id: id,
      k: vals.length,
      mean: mean(vals),
      sd: sampleSD(vals),
      range: Math.max(...vals) - Math.min(...vals),
      identical: new Set(vals).size === 1,
      values: vals,
    });
  }
  if (valid.length < 1) {
    return { status: 'insufficient', reason: 'no_item_with_2_valid_runs', n: 0, excluded };
  }
  let ss = 0;
  let df = 0;
  for (const it of valid) {
    const mu = it.mean;
    for (const v of it.values) ss += (v - mu) * (v - mu);
    df += it.k - 1;
  }
  if (df < 1) {
    return { status: 'insufficient', reason: 'zero_pooled_df', n: valid.length, excluded };
  }
  const ranges = valid.map((it) => it.range);
  const identicalCount = valid.filter((it) => it.identical).length;
  return {
    status: 'ok',
    n: valid.length,
    excluded,
    items: valid.map(({ values, ...rest }) => rest),
    pooled_sw: Math.sqrt(ss / df),
    pooled_df: df,
    median_range: median(ranges),
    pct_identical: (100 * identicalCount) / valid.length,
    total_valid_runs: valid.reduce((s, it) => s + it.k, 0),
  };
}

// ---------------------------------------------------------------- RQ3 (§7.3)

// cells: { pair_id, edit_type?, baseline_runs: number[], edited_runs: number[] }
// §8.4: edited cell needs >= 2 valid runs; baseline needs >= 1 valid run;
// otherwise status 'missing_cell' with a reason. No imputation.
export function rq3EditDeltas(cells) {
  if (!Array.isArray(cells)) throw new TypeError('cells must be an array');
  const out = [];
  for (const cell of cells) {
    const pairId = cell.pair_id ?? '(missing_pair_id)';
    const base = splitRuns(cell.baseline_runs, {});
    const edit = splitRuns(cell.edited_runs, {});
    if (base.primary.length < 1) {
      out.push({ pair_id: pairId, edit_type: cell.edit_type ?? null, status: 'missing_cell', reason: 'no_valid_baseline_runs', delta: null });
      continue;
    }
    if (edit.primary.length < 2) {
      out.push({ pair_id: pairId, edit_type: cell.edit_type ?? null, status: 'missing_cell', reason: 'fewer_than_2_valid_edited_runs', delta: null });
      continue;
    }
    const delta = mean(edit.primary) - mean(base.primary);
    out.push({
      pair_id: pairId,
      edit_type: cell.edit_type ?? null,
      status: 'ok',
      reason: null,
      baseline_mean: mean(base.primary),
      edited_mean: mean(edit.primary),
      delta,
      baseline_k: base.primary.length,
      edited_k: edit.primary.length,
    });
  }
  return {
    status: out.some((c) => c.status === 'ok') ? 'ok' : 'insufficient',
    cells: out,
    ok_count: out.filter((c) => c.status === 'ok').length,
    missing_count: out.filter((c) => c.status === 'missing_cell').length,
  };
}

// Per edit type / arm family: median, IQR, signs, exact sign test (non-zero only),
// % within ±5 with Clopper–Pearson CI (§7.3). `deltas` = numeric array (ok cells).
export function editSummary(deltas) {
  if (!Array.isArray(deltas) || deltas.length === 0) {
    return { status: 'insufficient', reason: 'no_deltas' };
  }
  const finite = deltas.filter((d) => typeof d === 'number' && Number.isFinite(d));
  if (finite.length === 0) return { status: 'insufficient', reason: 'no_finite_deltas' };
  const q1 = quantile7(finite, 0.25);
  const q3 = quantile7(finite, 0.75);
  const within5 = finite.filter((d) => Math.abs(d) <= 5).length;
  const n = finite.length;
  const cp = within5 === 0 && n === 0 ? null : clopperPearson(within5, n);
  return {
    status: 'ok',
    n,
    median: median(finite),
    q1,
    q3,
    iqr: q3 - q1,
    positives: finite.filter((d) => d > 0).length,
    negatives: finite.filter((d) => d < 0).length,
    zeros: finite.filter((d) => d === 0).length,
    pct_within_5: (100 * within5) / n,
    clopper_pearson_within_5: cp,
    sign_test: exactSignTest(finite),
  };
}

// ---------------------------------------------------------------- bootstrap (§7.1/§7.2)

function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentileCI(samples, alpha) {
  const sorted = samples.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length < 2) return { lower: null, upper: null, used: sorted.length };
  return {
    lower: quantile7(sorted, alpha / 2),
    upper: quantile7(sorted, 1 - alpha / 2),
    used: sorted.length,
  };
}

// Two-way cluster bootstrap: resample resume clusters and job clusters with
// replacement, weight each row by the product of its cluster multiplicities,
// and rebuild the crossing (protocol §7.1). Deterministic under `seed`.
export function twoWayClusterBootstrap(rows, statFns, opts = {}) {
  const {
    iters = 10000,
    seed = PROTOCOL_SEED,
    resumeKey = 'resume_id',
    jobKey = 'job_id',
    alpha = 0.05,
    maxAttempts = 500,
  } = opts;
  if (!Array.isArray(rows) || rows.length === 0) return { status: 'insufficient', reason: 'no_rows' };
  if (!statFns || Object.keys(statFns).length === 0) return { status: 'insufficient', reason: 'no_stats' };
  const resumes = [...new Set(rows.map((r) => r[resumeKey]))];
  const jobs = [...new Set(rows.map((r) => r[jobKey]))];
  if (resumes.length === 0 || jobs.length === 0 || resumes.some((v) => v == null) || jobs.some((v) => v == null)) {
    return { status: 'insufficient', reason: 'missing_cluster_keys' };
  }
  const rand = mulberry32(seed);
  const pickCounts = (pool) => {
    const counts = new Map();
    for (let i = 0; i < pool.length; i += 1) {
      const v = pool[Math.floor(rand() * pool.length)];
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return counts;
  };
  const original = {};
  for (const [name, fn] of Object.entries(statFns)) {
    let v = null;
    try {
      v = fn(rows);
    } catch {
      v = null;
    }
    original[name] = Number.isFinite(v) ? v : null;
  }
  const samples = {};
  for (const name of Object.keys(statFns)) samples[name] = [];
  let redraws = 0;
  let failedReplicates = 0;
  for (let it = 0; it < iters; it += 1) {
    let expanded = null;
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts += 1;
      const rc = pickCounts(resumes);
      const jc = pickCounts(jobs);
      const out = [];
      for (const row of rows) {
        const w = (rc.get(row[resumeKey]) || 0) * (jc.get(row[jobKey]) || 0);
        for (let x = 0; x < w; x += 1) out.push(row);
      }
      if (out.length > 0) {
        expanded = out;
        redraws += attempts - 1;
        break;
      }
    }
    if (!expanded) {
      failedReplicates += 1;
      redraws += maxAttempts;
      continue;
    }
    for (const [name, fn] of Object.entries(statFns)) {
      let v = null;
      try {
        v = fn(expanded);
      } catch {
        v = null;
      }
      if (Number.isFinite(v)) samples[name].push(v);
    }
  }
  const cis = {};
  for (const name of Object.keys(statFns)) {
    const ci = percentileCI(samples[name], alpha);
    cis[name] = { point: original[name], lower: ci.lower, upper: ci.upper, used: ci.used };
  }
  const clusterCounts = { resumes: resumes.length, jobs: jobs.length };
  const fewClusters = resumes.length < 10 || jobs.length < 10;
  return {
    status: 'ok',
    label: LABELS.cluster,
    seed,
    iters,
    alpha,
    clusters: clusterCounts,
    warning: fewClusters
      ? `few clusters (resumes=${resumes.length}, jobs=${jobs.length}): indicative only, likely under-covering (protocol §5.1)`
      : null,
    cis,
    redraws,
    failed_replicates: failedReplicates,
  };
}

// Convenience wrapper: RQ1 metrics with cluster-bootstrap CIs (§7.1 set).
export function rq1Bootstrap(rows, opts = {}) {
  const base = rq1Agreement(rows);
  if (base.status !== 'ok') return { status: 'insufficient', reason: 'rq1_not_ok', base };
  const statFns = {
    mae: (rs) => rq1Agreement(rs).mae,
    medad: (rs) => rq1Agreement(rs).medad,
    bias: (rs) => rq1Agreement(rs).bias,
    pct_within_5: (rs) => rq1Agreement(rs).pct_within_5,
    pct_within_10: (rs) => rq1Agreement(rs).pct_within_10,
    spearman_rho: (rs) => rq1Agreement(rs).spearman_rho,
  };
  return { status: 'ok', base, bootstrap: twoWayClusterBootstrap(rows, statFns, opts) };
}

// One-dimensional bootstrap over items (RQ2 pooled s_w CI, §7.2 "pairs resampled").
export function itemBootstrap(items, statFns, opts = {}) {
  const { iters = 10000, seed = PROTOCOL_SEED, alpha = 0.05 } = opts;
  if (!Array.isArray(items) || items.length === 0) return { status: 'insufficient', reason: 'no_items' };
  if (!statFns || Object.keys(statFns).length === 0) return { status: 'insufficient', reason: 'no_stats' };
  const rand = mulberry32(seed);
  const original = {};
  for (const [name, fn] of Object.entries(statFns)) {
    let v = null;
    try {
      v = fn(items);
    } catch {
      v = null;
    }
    original[name] = Number.isFinite(v) ? v : null;
  }
  const samples = {};
  for (const name of Object.keys(statFns)) samples[name] = [];
  for (let it = 0; it < iters; it += 1) {
    const out = [];
    for (let i = 0; i < items.length; i += 1) out.push(items[Math.floor(rand() * items.length)]);
    for (const [name, fn] of Object.entries(statFns)) {
      let v = null;
      try {
        v = fn(out);
      } catch {
        v = null;
      }
      if (Number.isFinite(v)) samples[name].push(v);
    }
  }
  const cis = {};
  for (const name of Object.keys(statFns)) {
    const ci = percentileCI(samples[name], alpha);
    cis[name] = { point: original[name], lower: ci.lower, upper: ci.upper, used: ci.used };
  }
  return { status: 'ok', label: LABELS.cluster, seed, iters, alpha, n_clusters: items.length, cis };
}

// Convenience wrapper: pooled s_w with item-bootstrap CI (§7.2).
// Stats run on the RAW items so validation (≥2 valid runs) is re-applied per replicate.
export function rq2Bootstrap(items, opts = {}) {
  const base = rq2Repeatability(items);
  if (base.status !== 'ok') return { status: 'insufficient', reason: 'rq2_not_ok', base };
  const statFns = { pooled_sw: (its) => rq2Repeatability(its).pooled_sw };
  return { status: 'ok', base, bootstrap: itemBootstrap(items, statFns, opts) };
}
