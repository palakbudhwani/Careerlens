process.env.AI_PROVIDER = 'none';
process.env.AI_FALLBACK_PROVIDER = 'none';
process.env.AI_RESULT_CACHE_TTL_MS = '0';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NETWORK_DISABLED_MESSAGE = 'network access is disabled for the offline pilot';
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error(NETWORK_DISABLED_MESSAGE);
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const datasetPath = path.join(rootDir, 'research', 'data', 'pilot', 'pilot_dataset.json');
const resultsDir = path.join(rootDir, 'research', 'results', 'pilot');
const resultsPath = path.join(resultsDir, 'pilot_check_results.json');

const { buildMatchAnalysis, scanSkills, extractJobRequirements, collectEvidence } = await import(
  pathToFileURL(path.join(rootDir, 'backend', 'ruleBasedFallback.js')).href
);
const { parseResume } = await import(pathToFileURL(path.join(rootDir, 'backend', 'llm.js')).href);

function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function skillNames(text) {
  return scanSkills(text).map((entry) => entry.name);
}

function skillCount(text, name) {
  const entry = scanSkills(text).find((item) => item.name === name);
  return entry ? entry.count : 0;
}

function diffSets(before, after) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: [...afterSet].filter((name) => !beforeSet.has(name)).sort(),
    removed: [...beforeSet].filter((name) => !afterSet.has(name)).sort()
  };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const checks = [];
const failures = [];

function record(id, name, items) {
  const failedItems = items.filter((item) => item.ok === false);
  checks.push({
    id,
    name,
    status: failedItems.length === 0 ? 'pass' : 'fail',
    evaluated: items.length,
    failed_items: failedItems
  });
  for (const item of failedItems) failures.push({ check: id, item: item.id, detail: item.detail });
}

const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
const resumes = new Map(dataset.resumes.map((resume) => [resume.resume_id, resume]));
const jobs = new Map(dataset.jobs.map((job) => [job.job_id, job]));

const integrity = [];
{
  const pairKeys = new Set(dataset.pairs.map((pair) => pair.pair_id));
  const expectedPairs = [];
  for (const job of dataset.jobs) {
    for (const resume of dataset.resumes) expectedPairs.push(`${job.job_id}__${resume.resume_id}`);
  }
  integrity.push({
    id: 'pair_crossing_complete',
    ok: expectedPairs.length === dataset.pairs.length && expectedPairs.every((key) => pairKeys.has(key)),
    detail: `expected ${expectedPairs.length} crossed pairs, found ${dataset.pairs.length}`
  });
  integrity.push({
    id: 'unique_pair_ids',
    ok: pairKeys.size === dataset.pairs.length,
    detail: 'pair_id values must be unique'
  });
  const rq3Pairs = dataset.pairs.filter((pair) => pair.rq3_selected);
  integrity.push({
    id: 'rq3_pair_count',
    ok: rq3Pairs.length === 4,
    detail: `rq3_selected pairs: ${rq3Pairs.length}`
  });
  const editTypes = ['E1_relevant_add', 'E2_relevant_remove', 'E3_irrelevant_add', 'E4_irrelevant_prose'];
  for (const pair of rq3Pairs) {
    const pairEdits = dataset.edits.filter((edit) => edit.pair_id === pair.pair_id);
    const types = pairEdits.map((edit) => edit.edit_type).sort();
    integrity.push({
      id: `${pair.pair_id}_four_edits`,
      ok: deepEqual(types, [...editTypes].sort()),
      detail: `edit types found: ${types.join(', ')}`
    });
  }
  const allRefsResolve = dataset.pairs.every((pair) => resumes.has(pair.resume_id) && jobs.has(pair.job_id))
    && dataset.edits.every((edit) => dataset.pairs.some((pair) => pair.pair_id === edit.pair_id));
  integrity.push({
    id: 'refs_resolve',
    ok: allRefsResolve,
    detail: 'every pair/edit reference must resolve'
  });
}
record('c0_dataset_integrity', 'Pilot dataset structure (4x4 crossing, 4 rq3 pairs, 4 edits each, refs resolve)', integrity);

const wordCounts = [];
for (const resume of dataset.resumes) {
  wordCounts.push({ id: resume.resume_id, ok: countWords(resume.text) >= 50, detail: `resume words=${countWords(resume.text)}` });
}
for (const job of dataset.jobs) {
  wordCounts.push({ id: job.job_id, ok: countWords(job.text) >= 50, detail: `jd words=${countWords(job.text)}` });
}
for (const edit of dataset.edits) {
  wordCounts.push({ id: edit.edit_id, ok: countWords(edit.variant_resume_text) >= 50, detail: `variant words=${countWords(edit.variant_resume_text)}` });
}
record('c1a_word_count_gate', '>=50 words per field (server.js countWords gate, mirrored)', wordCounts);

const authenticity = [];
const parsedCache = new Map();
for (const resume of dataset.resumes) {
  const parsed = await parseResume(resume.text);
  parsedCache.set(resume.resume_id, parsed);
  authenticity.push({
    id: resume.resume_id,
    ok: parsed.isAuthentic === true && parsed.validationErrors.length === 0,
    detail: `isAuthentic=${parsed.isAuthentic} errors=${JSON.stringify(parsed.validationErrors)}`
  });
}
for (const edit of dataset.edits) {
  const parsed = await parseResume(edit.variant_resume_text);
  parsedCache.set(edit.edit_id, parsed);
  authenticity.push({
    id: edit.edit_id,
    ok: parsed.isAuthentic === true && parsed.validationErrors.length === 0,
    detail: `isAuthentic=${parsed.isAuthentic} errors=${JSON.stringify(parsed.validationErrors)}`
  });
}
record('c1b_authenticity_gate', 'parseResume authenticity gates pass for all resumes and edit variants', authenticity);

const baselineResults = new Map();
const baselineItems = [];
const weightedFormula = (breakdown) =>
  clamp(
    Math.round(
      0.4 * breakdown.skillsMatchScore
      + 0.3 * breakdown.experienceScore
      + 0.2 * breakdown.keywordDensityScore
      + 0.1 * breakdown.educationScore
    ),
    0,
    100
  );

for (const pair of dataset.pairs) {
  const resume = resumes.get(pair.resume_id);
  const job = jobs.get(pair.job_id);
  const analysis = buildMatchAnalysis(resume.text, job.text);
  baselineResults.set(pair.pair_id, analysis);
  const breakdown = analysis.breakdown || {};
  const problems = [];
  if (!Number.isInteger(analysis.atsScore) || analysis.atsScore < 0 || analysis.atsScore > 100) problems.push(`atsScore invalid: ${analysis.atsScore}`);
  for (const [key, value] of Object.entries(breakdown)) {
    if (!Number.isInteger(value) || value < 0 || value > 100) problems.push(`${key} invalid: ${value}`);
  }
  if (weightedFormula(breakdown) !== analysis.atsScore) {
    problems.push(`weighted recompute ${weightedFormula(breakdown)} !== atsScore ${analysis.atsScore}`);
  }
  if (!String(analysis.matchId || '').startsWith('match-rule-')) problems.push(`matchId prefix wrong: ${analysis.matchId}`);
  const summaryWords = String(analysis.summary || '').split(/\s+/).filter(Boolean).length;
  if (summaryWords === 0 || summaryWords > 120) problems.push(`summary words=${summaryWords}`);
  if (!Array.isArray(analysis.matchingSkills) || !Array.isArray(analysis.missingSkills)) problems.push('missing skills arrays');
  if (!Array.isArray(analysis.gaps) || analysis.gaps.length > 6) problems.push(`gaps len=${(analysis.gaps || []).length}`);
  const jobInfo = extractJobRequirements(job.text);
  const requiredNames = jobInfo.requirements.slice(0, 12).map((requirement) => requirement.name);
  const known = new Set(requiredNames);
  const overlapping = [...analysis.matchingSkills, ...analysis.missingSkills].filter((name) => known.has(name));
  if (overlapping.length !== requiredNames.length) {
    problems.push(`matching+missing over known requirements ${overlapping.length} !== required ${requiredNames.length}`);
  }
  baselineItems.push({
    id: pair.pair_id,
    ok: problems.length === 0,
    detail: problems.join('; ') || `atsScore=${analysis.atsScore} required=${requiredNames.length}`
  });
}
record('c2_baseline_processing', 'buildMatchAnalysis processes all 16 baseline pairs; scores, breakdown, formula and schema valid', baselineItems);

const determinismItems = [];
for (const pair of dataset.pairs) {
  const resume = resumes.get(pair.resume_id);
  const job = jobs.get(pair.job_id);
  const rerun = buildMatchAnalysis(resume.text, job.text);
  const first = baselineResults.get(pair.pair_id);
  determinismItems.push({
    id: pair.pair_id,
    ok: deepEqual(rerun, first),
    detail: deepEqual(rerun, first) ? 'second run identical' : 'second run DIFFERS'
  });
}
for (const edit of dataset.edits) {
  const pair = dataset.pairs.find((item) => item.pair_id === edit.pair_id);
  const job = jobs.get(pair.job_id);
  const first = buildMatchAnalysis(resumes.get(pair.resume_id).text, job.text);
  const variant = buildMatchAnalysis(edit.variant_resume_text, job.text);
  const rerunVariant = buildMatchAnalysis(edit.variant_resume_text, job.text);
  determinismItems.push({
    id: edit.edit_id,
    ok: deepEqual(variant, rerunVariant) && deepEqual(first, buildMatchAnalysis(resumes.get(pair.resume_id).text, job.text)),
    detail: 'baseline and variant both reproduce identically on second run'
  });
}
record('c3_determinism', 'rule arm is deterministic: identical output on repeated runs (16 pairs + 16 variants)', determinismItems);

const editRows = [];
const scanItems = [];
const keywordItems = [];
const directionItems = [];
const structureItems = [];

for (const edit of dataset.edits) {
  const pair = dataset.pairs.find((item) => item.pair_id === edit.pair_id);
  const job = jobs.get(pair.job_id);
  const baseResumeText = resumes.get(pair.resume_id).text;
  const baseAnalysis = baselineResults.get(pair.pair_id);
  const variantAnalysis = buildMatchAnalysis(edit.variant_resume_text, job.text);

  const scanDiff = diffSets(skillNames(baseResumeText), skillNames(edit.variant_resume_text));
  const expectedScan = edit.manipulation_expectations.scan_skills_diff;
  let scanOk = false;
  if (expectedScan === 'none') {
    scanOk = scanDiff.added.length === 0 && scanDiff.removed.length === 0;
  } else if (expectedScan.startsWith('+')) {
    scanOk = deepEqual(scanDiff.added, [expectedScan.slice(1)]) && scanDiff.removed.length === 0;
  } else if (expectedScan.startsWith('-')) {
    scanOk = deepEqual(scanDiff.removed, [expectedScan.slice(1)]) && scanDiff.added.length === 0;
  }
  scanItems.push({
    id: edit.edit_id,
    ok: scanOk,
    detail: `expected ${expectedScan}, got +[${scanDiff.added.join(',')}] -[${scanDiff.removed.join(',')}]`
  });

  let keywordBefore = null;
  let keywordAfter = null;
  let keywordOk = true;
  let keywordDetail = 'no target skill (E4)';
  if (edit.target_skill) {
    keywordBefore = skillCount(baseResumeText, edit.target_skill);
    keywordAfter = skillCount(edit.variant_resume_text, edit.target_skill);
    keywordOk = keywordBefore === edit.manipulation_expectations.count_keyword_before
      && keywordAfter === edit.manipulation_expectations.count_keyword_after;
    keywordDetail = `${edit.target_skill} count ${keywordBefore} -> ${keywordAfter} (expected ${edit.manipulation_expectations.count_keyword_before} -> ${edit.manipulation_expectations.count_keyword_after})`;
  }
  keywordItems.push({ id: edit.edit_id, ok: keywordOk, detail: keywordDetail });

  const deltaAts = variantAnalysis.atsScore - baseAnalysis.atsScore;
  const deltaComponents = {
    skillsMatchScore: variantAnalysis.breakdown.skillsMatchScore - baseAnalysis.breakdown.skillsMatchScore,
    experienceScore: variantAnalysis.breakdown.experienceScore - baseAnalysis.breakdown.experienceScore,
    keywordDensityScore: variantAnalysis.breakdown.keywordDensityScore - baseAnalysis.breakdown.keywordDensityScore,
    educationScore: variantAnalysis.breakdown.educationScore - baseAnalysis.breakdown.educationScore
  };
  let directionOk = false;
  if (edit.expected_rule_direction === 'increase') directionOk = deltaAts > 0;
  else if (edit.expected_rule_direction === 'decrease') directionOk = deltaAts < 0;
  else directionOk = deltaAts === 0 && Object.values(deltaComponents).every((value) => value === 0);
  directionItems.push({
    id: edit.edit_id,
    ok: directionOk,
    detail: `expected ${edit.expected_rule_direction}, delta=${deltaAts} components=${JSON.stringify(deltaComponents)}`
  });

  const baseEvidence = collectEvidence(baseResumeText);
  const variantEvidence = collectEvidence(edit.variant_resume_text);
  const structureOk =
    baseEvidence.experience.length === variantEvidence.experience.length
    && baseEvidence.education.length === variantEvidence.education.length
    && baseEvidence.projects.length === variantEvidence.projects.length
    && baseEvidence.sectionCount === variantEvidence.sectionCount;
  structureItems.push({
    id: edit.edit_id,
    ok: structureOk,
    detail: `experience ${baseEvidence.experience.length}->${variantEvidence.experience.length}, education ${baseEvidence.education.length}->${variantEvidence.education.length}, projects ${baseEvidence.projects.length}->${variantEvidence.projects.length}, sections ${baseEvidence.sectionCount}->${variantEvidence.sectionCount}`
  });

  editRows.push({
    edit_id: edit.edit_id,
    pair_id: edit.pair_id,
    edit_type: edit.edit_type,
    target_skill: edit.target_skill,
    expected_rule_direction: edit.expected_rule_direction,
    baseline_ats: baseAnalysis.atsScore,
    variant_ats: variantAnalysis.atsScore,
    delta_ats: deltaAts,
    delta_components: deltaComponents,
    direction_check: directionOk,
    scan_diff: { expected: expectedScan, added: scanDiff.added, removed: scanDiff.removed, ok: scanOk },
    keyword_counts: { before: keywordBefore, after: keywordAfter, ok: keywordOk },
    structure_counts: {
      experience: [baseEvidence.experience.length, variantEvidence.experience.length],
      education: [baseEvidence.education.length, variantEvidence.education.length],
      projects: [baseEvidence.projects.length, variantEvidence.projects.length],
      sections: [baseEvidence.sectionCount, variantEvidence.sectionCount]
    },
    structure_ok: structureOk
  });
}
record('c4a_manipulation_scan_diff', 'scanSkills diff matches every predeclared manipulation expectation', scanItems);
record('c4b_manipulation_keyword_counts', 'vocabulary keyword counts match predeclared before/after expectations', keywordItems);
record('c5_edit_direction', 'rule-arm score direction matches expected_rule_direction (zero requires all components unchanged)', directionItems);
record('c7_structure_invariance', 'single-edit variants leave experience/education/projects/section counts unchanged', structureItems);

const headroomItems = [];
const headroom = [];
for (const pair of dataset.pairs.filter((item) => item.rq3_selected)) {
  const analysis = baselineResults.get(pair.pair_id);
  const inRange = analysis.atsScore >= 15 && analysis.atsScore <= 90;
  headroom.push({ pair_id: pair.pair_id, atsScore: analysis.atsScore, in_range: inRange });
  headroomItems.push({
    id: pair.pair_id,
    ok: inRange,
    detail: `atsScore=${analysis.atsScore} (protocol headroom band [15, 90])`
  });
}
record('c6_baseline_headroom', 'rq3 edit-subject baselines sit inside the [15, 90] headroom band', headroomItems);

const jdItems = [];
const jdSnapshots = new Map();
for (const job of dataset.jobs) {
  const info = extractJobRequirements(job.text);
  const info2 = extractJobRequirements(job.text);
  jdSnapshots.set(job.job_id, info);
  const deterministic = deepEqual(info, info2);
  const educationFlagOk = info.mentionsEducation === job.mentions_education_by_design;
  jdItems.push({
    id: job.job_id,
    ok: deterministic && educationFlagOk,
    detail: `deterministic=${deterministic} mentionsEducation=${info.mentionsEducation} designed=${job.mentions_education_by_design} requirements=${info.requirements.length} years=${info.years}`
  });
}
record('c8_jd_stability', 'extractJobRequirements is deterministic and education flags match the dataset design', jdItems);

const lengthItems = [];
const lengthMatching = [];
for (const pair of dataset.pairs.filter((item) => item.rq3_selected)) {
  const baseText = resumes.get(pair.resume_id).text;
  const e1 = dataset.edits.find((edit) => edit.pair_id === pair.pair_id && edit.edit_type === 'E1_relevant_add');
  const e4 = dataset.edits.find((edit) => edit.pair_id === pair.pair_id && edit.edit_type === 'E4_irrelevant_prose');
  const addedE1 = e1.variant_resume_text.length - baseText.length;
  const addedE4 = e4.variant_resume_text.length - baseText.length;
  const ratio = addedE1 > 0 ? addedE4 / addedE1 : NaN;
  const ok = Number.isFinite(ratio) && Math.abs(ratio - 1) <= 0.1;
  lengthMatching.push({ pair_id: pair.pair_id, added_chars_e1: addedE1, added_chars_e4: addedE4, ratio_e4_over_e1: Number(ratio.toFixed(3)), within_10pct: ok });
  lengthItems.push({
    id: `${pair.pair_id}_E4_length_match`,
    ok,
    detail: `E1 +${addedE1} chars vs E4 +${addedE4} chars, ratio=${ratio.toFixed(3)} (band 0.90-1.10)`
  });
}
record('c9_e4_length_matching', 'E4 neutral prose is length-matched to E1 within +/-10% per pair', lengthItems);

const pairRows = dataset.pairs.map((pair) => {
  const analysis = baselineResults.get(pair.pair_id);
  const required = extractJobRequirements(jobs.get(pair.job_id).text).requirements.slice(0, 12);
  const requiredCount = required.length;
  const matchingCount = analysis.matchingSkills.length + analysis.missingSkills.length;
  return {
    pair_id: pair.pair_id,
    designed_tier: pair.designed_tier,
    rq3_selected: pair.rq3_selected,
    atsScore: analysis.atsScore,
    breakdown: analysis.breakdown,
    required_count: requiredCount,
    matched_count: requiredCount - analysis.missingSkills.length,
    overlap_fraction: requiredCount > 0 ? Number(((requiredCount - analysis.missingSkills.length) / requiredCount).toFixed(3)) : null,
    matching_skills: analysis.matchingSkills,
    missing_skills: analysis.missingSkills
  };
});

const tierOrdering = { informational: true, rows: [] };
for (const tier of ['High', 'Mid', 'Low']) {
  const rows = pairRows.filter((row) => row.designed_tier === tier);
  tierOrdering.rows.push({
    designed_tier: tier,
    n: rows.length,
    overlap_fractions: rows.map((row) => row.overlap_fraction),
    ats_scores: rows.map((row) => row.atsScore)
  });
}
const highOverlaps = pairRows.filter((row) => row.designed_tier === 'High').map((row) => row.overlap_fraction);
const lowOverlaps = pairRows.filter((row) => row.designed_tier === 'Low').map((row) => row.overlap_fraction);
tierOrdering.min_high_overlap = Math.min(...highOverlaps);
tierOrdering.max_low_overlap = Math.max(...lowOverlaps);
tierOrdering.separation_ok = tierOrdering.min_high_overlap > tierOrdering.max_low_overlap;
tierOrdering.note = 'Descriptive only: designed tiers are authoring intent, not verified labels; separation is reported, never asserted as ground truth.';

const summary = {
  all_pass: checks.every((check) => check.status === 'pass'),
  checks_total: checks.length,
  checks_passed: checks.filter((check) => check.status === 'pass').length,
  checks_failed: checks.filter((check) => check.status === 'fail').length,
  failures,
  pairs_evaluated: pairRows.length,
  edits_evaluated: editRows.length,
  rq3_headroom: headroom,
  baseline_ats_scores: pairRows.map((row) => ({ pair_id: row.pair_id, atsScore: row.atsScore }))
};

const output = {
  meta: {
    script: 'research/scripts/pilot_offline_check.mjs',
    run_at: new Date().toISOString(),
    node: process.version,
    dataset_id: dataset.dataset_id,
    dataset_version: dataset.version,
    dataset_path: 'research/data/pilot/pilot_dataset.json',
    label: 'OFFLINE PILOT — feasibility checks ONLY. Not the research benchmark, not final research data.',
    guards: {
      AI_PROVIDER: process.env.AI_PROVIDER,
      AI_FALLBACK_PROVIDER: process.env.AI_FALLBACK_PROVIDER,
      fetch_blocked: true,
      ai_matcher_called: false,
      network_used: false
    },
    code_paths_used: [
      'backend/ruleBasedFallback.js: buildMatchAnalysis, scanSkills, extractJobRequirements, collectEvidence',
      'backend/llm.js: parseResume (deterministic extractResumeDetails, no provider call)'
    ],
    code_paths_not_used: ['backend/llm.js: analyzeMatch (AI arm) — NOT called']
  },
  checks,
  pairs: pairRows,
  edits: editRows,
  designed_tier_ordering: tierOrdering,
  e4_length_matching: lengthMatching,
  summary
};

mkdirSync(resultsDir, { recursive: true });
writeFileSync(resultsPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

globalThis.fetch = originalFetch;

console.log('CareerLens offline pilot check (rule arm only, AI matcher never called)');
console.log(`dataset: ${dataset.dataset_id}@${dataset.version} | node ${process.version}`);
console.log('');
for (const check of checks) {
  console.log(`[${check.status === 'pass' ? 'PASS' : 'FAIL'}] ${check.id} (${check.evaluated} items)`);
  if (check.status === 'fail') {
    for (const item of check.failed_items) console.log(`        - ${item.id}: ${item.detail}`);
  }
}
console.log('');
console.log(`baseline atsScore per pair:`);
for (const row of pairRows) {
  console.log(`  ${row.pair_id.padEnd(16)} tier=${row.designed_tier.padEnd(4)} ats=${String(row.atsScore).padStart(3)} matched=${row.matched_count}/${row.required_count}`);
}
console.log('');
console.log('edit deltas:');
for (const row of editRows) {
  console.log(`  ${row.edit_id.padEnd(26)} ${row.expected_rule_direction.padEnd(8)} delta=${row.delta_ats >= 0 ? '+' : ''}${row.delta_ats} ${row.direction_check ? 'OK' : 'MISMATCH'}`);
}
console.log('');
console.log(`summary: ${summary.checks_passed}/${summary.checks_total} checks passed, all_pass=${summary.all_pass}`);
console.log(`results written to ${path.relative(rootDir, resultsPath)}`);

if (summary.failures.length > 0) process.exitCode = 1;
