#!/usr/bin/env node
/**
 * benchmark_corpus_v1.mjs — Phase 5 generator (OFFLINE ONLY, NOT YET RUN).
 *
 * Generates the approved synthetic benchmark-v1 when executed:
 *   12 fictional resumes x 10 fictional JDs = 120 baseline pairs (4/4/4 tiers),
 *   score-blind RQ3 selection (J1-J6 High+Mid, 12 pairs), E1-E4 controlled edits
 *   per RESEARCH_PROTOCOL.md §4.1-§4.6 with V1-V9 metadata and §4.6 rejection codes.
 *
 * Protocol refs: RESEARCH_PROTOCOL.md §3 C1-C3, §4 (structure, §4.1 RQ3, §4.2 principle,
 *   §4.3 R-E1..R-E4, §4.4 exact edits, §4.5 V1-V9, §4.6 rejection), §6.3, §12.
 * Code refs: backend/ruleBasedFallback.js:97-211 (vocab), :222-273 (scan/match),
 *   :280-281 (REQUIREMENT_LINE_RE/EDUCATION_RE), :289-310 (extractJobRequirements),
 *   :317 (SECTION_ALIASES), :327-339 (isSectionHeader/classifySection),
 *   :347-418 (collectEvidence), :420-431 (countKeyword), :461 (slice 0,12),
 *   :467-490 (formula), :481 (bandFor); backend/server.js:87-90 (countWords);
 *   backend/llm.js:894-922 (stuffing), :935-961 (authenticity gates).
 *
 * OFFLINE GUARANTEES (enforced below, mirroring research/scripts/pilot_offline_check.mjs:1-13):
 *   - AI_PROVIDER/AI_FALLBACK_PROVIDER forced to 'none'; global fetch blocked.
 *   - NEVER imports backend/llm.js analyzeMatch, backend/aiProvider.js, .env, or keys.
 *   - ONLY imports scanSkills, extractJobRequirements, collectEvidence, buildMatchAnalysis
 *     from backend/ruleBasedFallback.js (all pure/deterministic/offline). buildMatchAnalysis
 *     is used ONLY for headroom exclusion (§4.1) and V9 metadata (§4.5) — NEVER for
 *     RQ3 subject choice, tier assignment, or target preference (score-blind).
 *   - NEVER touches research/data/pilot, research/results/pilot, backend/, src/.
 *   - REFUSES to overwrite any existing output file (abort, no clobber).
 *
 * DETERMINISM:
 *   - mulberry32 PRNG seeded 20261013 (protocol §12 seeds); fixed iteration orders:
 *     E1/E2 in reqNames (JD appearance) order; E3 in VOCAB_DECLARATION_ORDER below
 *     (names copied in backend :98-211 order for ordering ONLY — membership/counts always
 *     verified at runtime via scanSkills, so a backend vocab change fails fast instead of
 *     silently diverging); E4 prose pool in listed order (closest-length wins, ties by order).
 *   - Stable IDs: J1-J10, R1-R12, pair "<job>__<resume>", edit "<pair>__<E1|E2|E3|E4>".
 *   - Dataset JSON contains NO timestamps (fixed created "2026-10-13"); file bytes are
 *     reproducible (sorted keys, fixed seed). run_at appears ONLY in console/log, never in
 *     the frozen dataset hash.
 *
 * USAGE (do NOT run yet — creation of this file is the current task; execution is Gate D prep):
 *   node research/scripts/benchmark_corpus_v1.mjs [--out <researchRoot>] [--dry-run] [--help]
 *   Default out: <repo>/research (writes data/benchmark-v1/ + results/benchmark-v1/).
 *   --dry-run builds everything in memory, prints the concise summary, writes nothing.
 *
 * OUTPUTS (on run):
 *   research/data/benchmark-v1/benchmark_v1.json  (120 pairs + 12 RQ3 cells x E1-E4 + metadata)
 *   research/data/benchmark-v1/DATA_DICTIONARY.md
 *   research/data/benchmark-v1/DATA_VALIDATION.md
 *   research/data/benchmark-v1/GENERATION.md
 *   research/results/benchmark-v1/benchmark_generation_log.json (tier matrix, RQ3/headroom log,
 *     per-cell candidate skip log, rejection log, SHA-256)
 *
 * RESOLUTIONS (finalization review, offline, no execution — Decisions 1-10 applied in code):
 *   D1 |V|=10 for all JDs: deliberate consistent design choice (10 explicitly allowed by
 *      RESEARCH_PROTOCOL.md S4); no claim all permitted counts are represented. See JD_SPECS.
 *   D2 E3 adds ONLY ", <target>" (single irrelevant skill, no filler). Plain insertion must
 *      sit inside the E1 +-10% window or the cell is MANIPULATION_FAILED:LENGTH_UNMATCHED.
 *      (Supersedes S4.4's filler sentence; record as protocol amendment at Gate D freeze.)
 *   D3 Alias side effects reject the candidate: E1 scan diff exactly {+target}, E2 exactly
 *      {-target}, plus V4 count checks (e.g. "React Native"->"React" fails). Never normalized.
 *   D4 E4 uses predefined PROSE_POOL only; delta-chars INCLUDES the inserted newline. E4 is
 *      rejected unless reqNames counts, full scan diff (empty), structure, single-SKILLS and
 *      word/char gates all hold.
 *   D5 Exactly one single-line SKILLS section enforced (findSkillsLine); base failures abort,
 *      edit failures reject the cell STRUCTURE_CHANGED.
 *   D6 Shared-term preference via text-property eligibility + fixed orders only; rule-arm
 *      scores enter solely through the approved headroom exclusion + V9 metadata (never AI
 *      scores, never preference among passing values).
 *   D7 RQ3/headroom exactly per S4.1: J1-J6 High+Mid smallest resume index (design attributes
 *      only), rule-baseline [15,90] exclusion filter, same-tier ascending replacement,
 *      drop-if-exhausted (n' rules). First-passing choice, never best-score.
 *   D8 E3/E4 eligibility checks the actual JD's V(JD) (required+preferred) and repository
 *      vocabulary via scanSkills at runtime; EVERY skipped candidate + reason is in skipLog.
 *   D9 Import graph verified by static read: only node:crypto/fs/path/url plus
 *      backend/ruleBasedFallback.js (node:crypto + ./questionBank.js, node:crypto only).
 *      No dotenv/loadEnv, no aiProvider/llm/analyzeMatch, no .env/keys; fetch blocked; offline.
 *   D10 This header + inline DECISION tags are the resolution record; protocol/roadmap stay
 *      frozen (only the D2 filler amendment is carried to Gate D).
 */

process.env.AI_PROVIDER = 'none';
process.env.AI_FALLBACK_PROVIDER = 'none';
process.env.AI_RESULT_CACHE_TTL_MS = '0';

const NETWORK_DISABLED_MESSAGE = 'network access is disabled for benchmark_corpus_v1 (offline generator)';
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error(NETWORK_DISABLED_MESSAGE); };

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const backendPath = path.join(repoRoot, 'backend', 'ruleBasedFallback.js');
const { scanSkills, extractJobRequirements, collectEvidence, buildMatchAnalysis } = await import(
  pathToFileURL(backendPath).href
);
// DECISION 9 (verified by static read, no execution): import graph is offline-closed —
// this script imports only node:crypto/fs/path/url + backend/ruleBasedFallback.js, which
// imports only node:crypto + ./questionBank.js (node:crypto only). No dotenv/loadEnv,
// no aiProvider/llm/analyzeMatch/generateStructured, no .env/keys, no fetch (blocked above).

// ---------------------------------------------------------------- constants
const SEED = 20261013;
const DATASET_ID = 'careerlens-benchmark-v1';
const DATASET_VERSION = '1.0.0';
const DATASET_CREATED = '2026-10-13';
const RESUME_WORD_MIN = 350;
const RESUME_WORD_MAX = 600;
const RESUME_CHAR_MAX = 14000;
const JD_WORD_MIN = 50;
const JD_CHAR_MAX = 8000;
const HEADROOM_MIN = 15;
const HEADROOM_MAX = 90;
const LENGTH_TOL = 0.10; // ±10% chars, §4.4
const RQ3_JDS = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6']; // fixed order, §4.1
// Tier bands on ratio = overlap / |V|, §4 structure.
const tierFor = (overlap, vSize) => {
  const r = vSize > 0 ? overlap / vSize : 0;
  if (r >= 0.60) return 'High';
  if (r >= 0.30 && r <= 0.55) return 'Mid';
  if (r <= 0.25) return 'Low';
  return 'GAP'; // DECISION 1: unreachable since every JD fixes |V|=10; any GAP aborts TIER_IMBALANCE.
};
const bandFor = (count) => (count === 0 ? 0 : count <= 2 ? 80 : count <= 8 ? 100 : 60); // :481

// Backend regex mirrors (read-only copies with line refs; verified 2026-10-13).
const REQUIREMENT_LINE_RE = /requir|must have|must be|need|essential|strong|proficien|experience with|expertise|looking for|you have/i; // :280
const EDUCATION_RE = /\b(degree|bachelor|master|b\.?tech|m\.?tech|m\.?s\.?c|b\.?s\.?c|mba|ph\.?d|diploma|education|computer science)\b/i; // :281

// VOCAB_DECLARATION_ORDER: canonical names in backend :98-211 declaration order.
// Ordering ONLY (for deterministic E3 iteration, §4.3). Membership/counts are ALWAYS
// verified at runtime via scanSkills — a backend vocab change fails fast (CONTAMINATION /
// GATE_FAIL) instead of silently diverging. No scores are read for selection.
const VOCAB_DECLARATION_ORDER = ['JavaScript','TypeScript','Python','Java','C++','C#','Go','Rust','PHP','Ruby','Kotlin','Swift','Dart','SQL','Bash','HTML','CSS','React','Angular','Vue.js','Next.js','Redux','Tailwind CSS','Sass/SCSS','React Native','Flutter','Node.js','Express','Django','Flask','FastAPI','Spring Boot','GraphQL','REST APIs','WebSockets','PostgreSQL','MySQL','MongoDB','Redis','SQLite','AWS','Azure','Google Cloud','Docker','Kubernetes','Terraform','CI/CD','Jenkins','GitHub Actions','Git','GitHub','GitLab','Linux','Nginx','Jest','Playwright','Cypress','Selenium','Vitest','Storybook','Vite','Webpack','Machine Learning','Deep Learning','PyTorch','TensorFlow','scikit-learn','Pandas','NumPy','NLP','Computer Vision','LLM APIs','RAG','LangChain','Hugging Face','Prompt Engineering','Generative AI','Gemini API','OpenAI API','MLOps','MLflow','Embeddings','Vector Databases','Data Analysis','Data Visualization','Statistics','Microservices','System Design','Data Structures & Algorithms','OOP','DBMS','Operating Systems','Computer Networks','OAuth','JWT','Security','API Integration','Agile','Scrum','Kanban','Communication','Leadership','Collaboration','Teamwork','Problem Solving','Mentoring','Stakeholder Management','Accessibility','Responsive Design','State Management','Design Systems','Performance Optimization','Testing'];

// DECISION 2: E3 adds only ", <target>" — no filler. (Filler pool removed; S4.4 filler sentence
// superseded, to be recorded as protocol amendment at freeze.) E3 candidates must fit the +-10%
// E1 window plain or the cell is rejected LENGTH_UNMATCHED with every skip logged.
// DECISION 4: E4 uses only the predefined PROSE_POOL below (deterministic, score-blind).
// Hobbies style, sentence case, lengths ~10-30 chars with dense coverage at 11-20 (short E1
// targets need short length-matched prose under Decision 2's no-filler rule). Each verified
// at runtime: no vocab/alias hit, no JD skill string, not a section header, structure/gates
// preserved. Selection = closest length inside the +-10% E1 window, ties by pool order.
// Delta-chars INCLUDES the inserted newline. If none fits for the chosen E1, the next E1
// candidate is tried.
const PROSE_POOL = ['I like tea.','I enjoy tea.','Tea is nice.','Calm walks help.','Quiet walks help.','I like short walks.','Weekend walks help.','Naps refresh me.','Short walks help.','I enjoy warm tea.','Quiet tea breaks.','I enjoy long walks.','I enjoy quiet walks.','I like long walks.','Weekend naps help.','I read each night.','I enjoy film photography.','Cooking relaxes me.','Gardening calms me.','I tend a small herb garden.','Cooking new recipes relaxes me.','Outside work I enjoy gardening.','Weekend hikes clear my mind.','Long bicycle rides refresh me.','I enjoy quiet weekend walks.'];

// ---------------------------------------------------------------- helpers
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function countWords(str) { // server.js:87-90 exact
  if (!str) return 0;
  return str.trim().split(/\s+/).filter((w) => w.length > 0).length;
}
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
// PERF (no protocol change): memoize the three deterministic backend readers by exact text.
// scanSkills/extractJobRequirements/collectEvidence are pure functions of their input text
// (same regexes, no IO, no randomness), so caching is result-identical; verified in-step by
// comparing cached vs direct outputs on representative inputs. Callers below only read
// (map/find/filter/length); nothing mutates a cached value. Counters track hits.
const scanCache = new Map(); const reqCache = new Map(); const evCache = new Map();
const cacheStats = { scanHit: 0, scanMiss: 0, reqHit: 0, reqMiss: 0, evHit: 0, evMiss: 0 };
function scanCached(text) {
  const t = String(text);
  let v = scanCache.get(t);
  if (v) { cacheStats.scanHit++; return v; }
  v = scanSkills(t); scanCache.set(t, v); cacheStats.scanMiss++;
  return v;
}
function reqCached(text) {
  const t = String(text);
  let v = reqCache.get(t);
  if (v) { cacheStats.reqHit++; return v; }
  v = extractJobRequirements(t); reqCache.set(t, v); cacheStats.reqMiss++;
  return v;
}
function evCached(text) {
  const t = String(text);
  let v = evCache.get(t);
  if (v) { cacheStats.evHit++; return v; }
  v = collectEvidence(t); evCache.set(t, v); cacheStats.evMiss++;
  return v;
}
const skillNames = (text) => scanCached(text).map((e) => e.name);
const skillCount = (text, name) => { // equivalent to countKeyword :420-431 (same regexes via scanSkills)
  const e = scanSkills(text).find((x) => x.name === name);
  return e ? e.count : 0;
};
function isSectionHeaderLine(line) { // mirror :327-331
  if (!line || line.length > 45) return false;
  if (/[.:]$/.test(line)) return false;
  return /^[A-Z0-9][A-Z0-9 &/'()#:.-]*$/.test(line) && line.trim() === line && /[A-Z]/.test(line);
}
function skillsKeyOf(line) { // mirror classifySection :333-339 for the skills alias only
  const key = String(line).toLowerCase().replace(/[^a-z &/]/g, '').trim();
  return /^skills$|^technical skills$|^core skills$|^key skills$/i.test(key);
}
// DECISION 5: exactly one single-line SKILLS section; anything else rejects (base aborts, edits STRUCTURE_CHANGED).
function findSkillsLine(text) {
  const lines = text.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isSectionHeaderLine(lines[i].trim()) && skillsKeyOf(lines[i].trim())) {
      if (headerIdx !== -1) return { error: 'MULTI_SKILLS_SECTION' };
      headerIdx = i;
    }
  }
  if (headerIdx === -1) return { error: 'NO_SKILLS_SECTION' };
  const skillsIdx = headerIdx + 1; // authoring requirement: single-line comma list directly under header
  if (skillsIdx >= lines.length || isSectionHeaderLine(lines[skillsIdx].trim()) || !lines[skillsIdx].trim()) {
    return { error: 'SKILLS_LINE_NOT_SINGLE' };
  }
  return { headerIdx, skillsIdx, skillsLine: lines[skillsIdx] };
}
function findFirstHeaderIdx(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) if (isSectionHeaderLine(lines[i].trim())) return i;
  return -1;
}
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

// ---------------------------------------------------------------- JD specs
// DECISION 1: |V| = 10 for every JD (deliberate consistent choice; 10 explicitly allowed;
// no claim all permitted counts are represented; 12 additionally avoided since 7/12 lands in
// the 0.55-0.60 gap). ≥3 High via requirement-line triggers; 5 mention education (J1,J3,J5,
// J7,J9) and 5 do not. Intro/responsibilities carry NO vocabulary skills (counts stay 1);
// J6 erratum (pre-data synthetic-data fix): Data Visualization is required (High), giving
// J6-High cells a long (18-char) absent-High E1 option; |V|=10, V membership, tiers, High>=3,
// and education split unchanged. E3 pool unaffected (DV is in V either way).
// High skills appear once each on Must-have lines; Medium (preferred) skills appear once each
// on trigger-free lines. Builder verifies |V|, priorities, education flag, words/chars.
const JD_SPECS = [
  { job_id: 'J1', role_family: 'java-backend', seniority: 'junior', mentions_education_by_design: true, title: 'Java Backend Engineer (Junior)',
    high: ['Java','Spring Boot','SQL','PostgreSQL','Microservices','Docker','Git'], preferred: ['MongoDB','Redis','REST APIs'],
    intro: 'We are hiring a junior backend engineer to build reliable services for our payments platform. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape server duties for settlement workloads with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J2', role_family: 'java-backend', seniority: 'mid', mentions_education_by_design: false, title: 'Java Backend Engineer (Mid-Level)',
    high: ['Java','Spring Boot','SQL','PostgreSQL','Microservices','Docker','Git'], preferred: ['WebSockets','SQLite','MySQL'],
    intro: 'We are hiring a mid-level backend engineer to own services for our ledger platform. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape server duties for ledger workloads with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J3', role_family: 'react-frontend', seniority: 'junior', mentions_education_by_design: true, title: 'React Frontend Developer (Junior)',
    high: ['React','TypeScript','JavaScript','HTML','CSS','Redux','Git'], preferred: ['Next.js','Accessibility','Responsive Design'],
    intro: 'We are looking for a junior frontend developer to grow with our product group. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape page duties for local services with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J4', role_family: 'react-frontend', seniority: 'mid', mentions_education_by_design: false, title: 'React Frontend Developer (Mid-Level)',
    high: ['React','TypeScript','JavaScript','HTML','CSS','Git'], preferred: ['Tailwind CSS','State Management','Design Systems','Performance Optimization'],
    intro: 'We are looking for a mid-level frontend developer to own our component library. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape library duties for shared pages with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J5', role_family: 'python-ml', seniority: 'junior', mentions_education_by_design: true, title: 'Machine Learning Engineer (Junior)',
    high: ['Python','Machine Learning','Pandas','NumPy','scikit-learn','SQL','Docker'], preferred: ['Statistics','Data Analysis','Git'],
    intro: 'Our data products group needs a junior engineer to build and ship models. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape model duties for weekly sensor records with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J6', role_family: 'python-ml', seniority: 'mid', mentions_education_by_design: false, title: 'Machine Learning Engineer (Mid-Level)',
    high: ['Python','Machine Learning','Pandas','NumPy','PyTorch','SQL','Docker','Data Visualization'], preferred: ['MLOps','Deep Learning'],
    intro: 'Our data products group needs a mid-level engineer to own training pipelines. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape pipeline duties for weekly sensor records with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J7', role_family: 'devops-cloud', seniority: 'junior', mentions_education_by_design: true, title: 'DevOps Engineer (Junior)',
    high: ['AWS','Docker','Kubernetes','CI/CD','Linux','Git','Bash'], preferred: ['Nginx','Azure','Google Cloud'],
    intro: 'We are hiring a junior platform engineer to support our delivery fleet. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape fleet duties for staged releases with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J8', role_family: 'devops-cloud', seniority: 'mid', mentions_education_by_design: false, title: 'DevOps Engineer (Mid-Level)',
    high: ['AWS','Docker','Kubernetes','CI/CD','Linux','Git','Jenkins'], preferred: ['Terraform','System Design','Security'],
    intro: 'We are hiring a mid-level platform engineer to own fleet reliability. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape reliability duties for staged releases with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J9', role_family: 'fullstack-web', seniority: 'mid', mentions_education_by_design: true, title: 'Full-Stack Web Engineer (Mid-Level)',
    high: ['Java','Spring Boot','React','TypeScript','SQL','Git'], preferred: ['PostgreSQL','Microservices','Vue.js','Angular'],
    intro: 'We are hiring a mid-level full-stack engineer for web services and pages. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape service and page duties for web workloads with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
  { job_id: 'J10', role_family: 'ml-platform', seniority: 'mid', mentions_education_by_design: false, title: 'ML Platform Engineer (Mid-Level)',
    high: ['Python','Machine Learning','Docker','Kubernetes','AWS','Pandas','SQL'], preferred: ['MLOps','MLflow','Vector Databases'],
    intro: 'We are hiring a mid-level platform engineer for model delivery. Daily duties include planning sessions, status updates, and release reviews with the immediate group.',
    responsibilities: ['Shape delivery duties for staged model releases with the immediate group.', 'Track milestones on the shared board and prepare concise status notes for weekly reviews.'],
    preferredLead: 'Familiarity with the following is a welcome plus:' },
];
function skilledWord(skill) { // JD surface form: canonical name except REST APIs -> "REST" (avoids APIS side effect; DECISION 3: alias side effects reject the candidate)
  return skill === 'REST APIs' ? 'REST' : skill;
}
function buildJDText(spec) {
  const lines = [spec.title, '', spec.intro, '', 'Role and responsibilities:'];
  for (const r of spec.responsibilities) lines.push(`- ${r}`);
  lines.push('', 'Requirements:');
  for (const s of spec.high) lines.push(`- Must have experience with ${skilledWord(s)}.`);
  lines.push(`- ${spec.preferredLead}`);
  for (const s of spec.preferred) lines.push(`- Background in ${skilledWord(s)} is a welcome bonus.`);
  if (spec.mentions_education_by_design) lines.push('- A bachelor\u2019s degree in computer science or equivalent is preferred.');
  else lines.push('- A portfolio of personal work is valued.');
  return lines.join('\n');
}

// ---------------------------------------------------------------- resume specs
// 12 fictional identities (3 per core family java-backend, react-frontend, python-ml,
// devops-cloud). Every resume: contact + degree (education-30 branch unexercised by design,
// PILOT_COVERAGE_REVIEW G9), exactly one SKILLS section (single comma line), dated EXPERIENCE
// lines (n>=2 so tenure saturates per audit §3.1c), PROJECTS with "|", EDUCATION. Base skills
// are family cores; tier repair (§4 structure) ONLY ADDS absent JD skills in JD order for deficit
// cells (kept only on strict total-imbalance decrease; never removes, never touches scores)
// until every JD shows 4/4/4 or aborts TIER_IMBALANCE.
const RESUME_SPECS = [
  { resume_id: 'R1', role_family: 'java-backend', name: 'Aarav Mehta', email: 'aarav.mehta@example.com', phone: '+91-9000000001', city: 'Bengaluru, India', degree: 'B.Tech in Computer Science — State Technical University, 2022', company1: 'Finroute Systems', company2: 'Northlane Labs', baseSkills: ['Java','Spring Boot','SQL','PostgreSQL','Microservices','Docker','Git','REST APIs'] },
  { resume_id: 'R2', role_family: 'java-backend', name: 'Vikram Rao', email: 'vikram.rao@example.com', phone: '+91-9000000002', city: 'Hyderabad, India', degree: 'B.E. in Information Science — Deccan Institute, 2021', company1: 'Ledgerline', company2: 'Paycraft', baseSkills: ['Java','Spring Boot','SQL','PostgreSQL','Microservices','Docker','GitHub','REST APIs'] },
  { resume_id: 'R3', role_family: 'java-backend', name: 'Ananya Das', email: 'ananya.das@example.com', phone: '+91-9000000003', city: 'Kolkata, India', degree: 'M.Tech in Software Systems — Eastern University, 2020', company1: 'Settlewise', company2: 'Billdesk Labs', baseSkills: ['Java','Spring Boot','SQL','MySQL','Microservices','Docker','Git','MongoDB'] },
  { resume_id: 'R4', role_family: 'react-frontend', name: 'Sara Khan', email: 'sara.khan@example.com', phone: '+91-9000000004', city: 'Pune, India', degree: 'B.Sc in Information Technology — City College, 2023', company1: 'Civic Sites', company2: 'Pagely Studio', baseSkills: ['React','TypeScript','JavaScript','HTML','CSS','Redux','Git','Next.js'] },
  { resume_id: 'R5', role_family: 'react-frontend', name: 'Ishaan Verma', email: 'ishaan.verma@example.com', phone: '+91-9000000005', city: 'Jaipur, India', degree: 'B.Des in Interaction Design — Pink City University, 2022', company1: 'Brightpages', company2: 'Loopwork', baseSkills: ['React','TypeScript','JavaScript','HTML','CSS','GitHub','Tailwind CSS','State Management'] },
  { resume_id: 'R6', role_family: 'react-frontend', name: 'Divya Nair', email: 'divya.nair@example.com', phone: '+91-9000000006', city: 'Kochi, India', degree: 'B.Sc in Computer Applications — Coastal College, 2021', company1: 'Shopfront', company2: 'Kartlane', baseSkills: ['React','TypeScript','JavaScript','HTML','CSS','Git','Design Systems','Performance Optimization'] },
  { resume_id: 'R7', role_family: 'python-ml', name: 'Rohan Iyer', email: 'rohan.iyer@example.com', phone: '+91-9000000007', city: 'Hyderabad, India', degree: 'M.Sc in Data Science — Institute of Technology, 2023', company1: 'AgriSense Analytics', company2: 'Cropwise', baseSkills: ['Python','Machine Learning','Pandas','NumPy','scikit-learn','SQL','Docker','MLOps'] },
  { resume_id: 'R8', role_family: 'python-ml', name: 'Kavya Reddy', email: 'kavya.reddy@example.com', phone: '+91-9000000008', city: 'Chennai, India', degree: 'B.Tech in Artificial Intelligence — Southern Tech, 2022', company1: 'Medsignal', company2: 'Claimwise Health', baseSkills: ['Python','Machine Learning','Pandas','NumPy','PyTorch','SQL','Docker','GitHub'] },
  { resume_id: 'R9', role_family: 'python-ml', name: 'Aditya Kulkarni', email: 'aditya.kulkarni@example.com', phone: '+91-9000000009', city: 'Mumbai, India', degree: 'M.Sc in Statistics — Western University, 2021', company1: 'Retailpulse', company2: 'Demandkart', baseSkills: ['Python','Machine Learning','Pandas','NumPy','Statistics','Data Analysis','SQL','GitHub'] },
  { resume_id: 'R10', role_family: 'devops-cloud', name: 'Meera Nair', email: 'meera.nair@example.com', phone: '+91-9000000010', city: 'Chennai, India', degree: 'B.E. in Electronics Engineering — Regional University, 2019', company1: 'Helio Media', company2: 'Streamline Ops', baseSkills: ['AWS','Docker','Kubernetes','CI/CD','Linux','Git','Jenkins','Terraform'] },
  { resume_id: 'R11', role_family: 'devops-cloud', name: 'Karan Singh', email: 'karan.singh@example.com', phone: '+91-9000000011', city: 'Delhi, India', degree: 'B.Tech in Computer Engineering — Capital Institute, 2020', company1: 'Cloudkart', company2: 'Deploylane', baseSkills: ['AWS','Docker','Kubernetes','CI/CD','Linux','GitHub','Bash','Nginx'] },
  { resume_id: 'R12', role_family: 'devops-cloud', name: 'Pooja Joshi', email: 'pooja.joshi@example.com', phone: '+91-9000000012', city: 'Ahmedabad, India', degree: 'M.Tech in Network Systems — Gujarat University, 2021', company1: 'Bankstack', company2: 'Finops Labs', baseSkills: ['AWS','Docker','Kubernetes','CI/CD','Linux','Git','Azure','Google Cloud'] },
];
// Generic padding bullets (verified at runtime to carry NO vocab skill; each ~18-24 words).
// пополнение: fixed order, cycled deterministically to reach 350-600 words.
const GENERIC_BULLETS = [
  'Coordinated release schedules with the immediate group, tracked milestones on the shared board, and prepared concise status notes for weekly reviews.',
  'Planned quarterly goals with the immediate group, broke large duties into weekly slices, and reported steady progress in Friday review sessions.',
  'Kept runbooks current for routine duties, filed incident notes with clear timelines, and handed over open items with written summaries.',
  'Reviewed peer output for clarity and consistency, left actionable remarks on drafts, and followed up until every thread reached closure.',
  'Mapped incoming requests into small dated tasks, ordered them by urgency with the immediate group, and cleared blockers before weekly cutoffs.',
  'Drafted short how-to notes for recurring duties, stored them in the shared folder, and updated them after each rotation.',
  'Joined on-call rotations for staged fleets, acknowledged pages promptly, and logged outcomes with calm factual summaries.',
  'Organized backlog grooming sessions with the immediate group, pruned stale entries, and kept priorities visible on the shared board.',
  'Prepared demo scripts for internal showcases, walked through flows with patient narration, and collected follow-up questions in writing.',
  'Checked dashboards each morning for failed duties, noted anomalies in plain language, and raised only confirmed issues for triage.',
];
function skillBullet(skill, company) {
  return `Built ${skill} duties at ${company} for daily workloads, tuned routine flows for steady output, and kept local setups orderly with careful notes.`;
}
function buildResumeText(spec, extraSkills, rng) {
  const skills = [...spec.baseSkills, ...extraSkills.filter((s) => !spec.baseSkills.includes(s))];
  const skillLine = skills.join(', ');
  const earthy = [
    `${spec.name}`, `${spec.email} | ${spec.phone} | ${spec.city}`, '',
    'PROFESSIONAL SUMMARY',
    `Dedicated engineer with steady experience across shipped duties at ${spec.company1} and ${spec.company2}. Known for calm ownership, clear written notes, and dependable weekly delivery with the immediate group. Brings patient review habits and careful follow-through on every assigned thread.`,
    '',
    'SKILLS', skillLine, '',
    'EXPERIENCE',
    `Engineer — ${spec.company1} | 2022 – Present`,
    ...spec.baseSkills.slice(0, 3).map((s) => `- ${skillBullet(s, spec.company1)}`),
    ...[0, 1, 2].map((k) => `- ${GENERIC_BULLETS[(spec.resume_id.charCodeAt(1) + k) % GENERIC_BULLETS.length]}`),
    `Engineer — ${spec.company2} | 2020 – 2022`,
    ...spec.baseSkills.slice(3, 5).map((s) => `- ${skillBullet(s, spec.company2)}`),
    ...[3, 4, 5].map((k) => `- ${GENERIC_BULLETS[(spec.resume_id.charCodeAt(1) * 2 + k) % GENERIC_BULLETS.length]}`),
    `Associate — ${spec.company2} | 2019 – 2020`,
    ...[6, 7].map((k) => `- ${GENERIC_BULLETS[(spec.resume_id.charCodeAt(1) * 3 + k) % GENERIC_BULLETS.length]}`),
    '',
    'PROJECTS',
    `Ledger Helper | ${skills.slice(0, 3).join(', ')} | Internal helper for reconciling weekly records with plain summaries.`,
    `Board Reporter | ${skills.slice(3, 6).join(', ')} | Small reporter turning board exports into readable weekly notes for the group.`,
    '',
    'EDUCATION', spec.degree,
  ].join('\n');
  void rng;
  return { text: earthy, skills };
}

// ---------------------------------------------------------------- overlap tiers
function overlapOf(resumeText, jdText) {
  const jdReq = reqCached(jdText).requirements.map((r) => r.name);
  const rSet = new Set(skillNames(resumeText));
  return jdReq.filter((n) => rSet.has(n)).length;
}
function jdVocabSize(jdText) { return reqCached(jdText).requirements.length; }

// ---------------------------------------------------------------- RQ3 + edits
function applyE1(baseline, target) {
  const loc = findSkillsLine(baseline);
  if (loc.error) return { error: loc.error };
  const lines = baseline.split('\n');
  lines[loc.skillsIdx] = `${lines[loc.skillsIdx]}, ${target}`;
  return { text: lines.join('\n'), deltaChars: `, ${target}`.length, op: { kind: 'E1', target, skillsIdx: loc.skillsIdx } };
}
function applyE2(baseline, target) {
  const loc = findSkillsLine(baseline);
  if (loc.error) return { error: loc.error };
  const lines = baseline.split('\n');
  const idx = loc.skillsIdx;
  const before = lines[idx];
  // Remove exactly one Skills-line occurrence (comma-aware): try ", target", "target, ", "target".
  const candidates = [`${', '}${target}`, `${target}, `, `${target}`];
  for (const c of candidates) {
    const at = before.indexOf(c);
    if (at !== -1) {
      const after = before.slice(0, at) + before.slice(at + c.length);
      // Clean stray separators (", ," -> ",", leading/trailing commas).
      const cleaned = after.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
      lines[idx] = after.includes(',') ? after : cleaned;
      return { text: lines.join('\n'), op: { kind: 'E2', target, skillsIdx: idx, removed: c } };
    }
  }
  return { error: 'TARGET_NOT_IN_SKILLS_LINE' };
}
function applyE3(baseline, target) { // DECISION 2: single skill only — ", <target>", no filler.
  const loc = findSkillsLine(baseline);
  if (loc.error) return { error: loc.error };
  const lines = baseline.split('\n');
  lines[loc.skillsIdx] = `${lines[loc.skillsIdx]}, ${target}`;
  return { text: lines.join('\n'), op: { kind: 'E3', target, skillsIdx: loc.skillsIdx } };
}
function applyE4(baseline, prose) { // DECISION 4: prose line before first header; delta-chars below INCLUDES the newline.
  const idx = findFirstHeaderIdx(baseline);
  if (idx === -1) return { error: 'NO_FIRST_HEADER' };
  const lines = baseline.split('\n');
  lines.splice(idx, 0, prose);
  return { text: lines.join('\n'), op: { kind: 'E4', prose, insertBefore: idx } };
}
function jdSkillStrings(jdText) { // DECISION 8: actual JD's V(JD) (required+preferred) for contamination checks.
  return reqCached(jdText).requirements.map((r) => r.name.toLowerCase());
}
function proseIsClean(prose, jdText) { // DECISION 4+8: vocab (scanSkills) + JD strings + header-like.
  if (isSectionHeaderLine(prose.trim())) return false;
  if (scanCached(prose).length !== 0) return false;
  const low = prose.toLowerCase();
  for (const s of jdSkillStrings(jdText)) if (s && low.includes(s)) return false;
  return true;
}
// DECISION 4+5: structure invariance (V2) + gates (V7) for E4 candidates. Any failure rejects
// the candidate (STRUCTURE_CHANGED / GATE_FAIL); never repaired post hoc. Skills intentionally
// excluded here (the intended single-skill diff is checked separately via V4/V6).
function structureInvariant(base, variant) {
  const b = evCached(base); const v = evCached(variant);
  return b.sectionCount === v.sectionCount
    && b.experience.length === v.experience.length
    && b.education.length === v.education.length
    && b.projects.length === v.projects.length
    && (b.certifications || []).length === (v.certifications || []).length;
}
function variantPassesGates(variant, jdText) { // V7 (C3/C2): >=50 words each side, char caps, SKILLS intact.
  if (countWords(variant) < 50 || countWords(jdText) < 50) return false;
  if (variant.length > RESUME_CHAR_MAX || jdText.length > JD_CHAR_MAX) return false;
  return !findSkillsLine(variant).error;
}

// Eligibility per §4.3 (text properties ONLY — never AI/overall-matcher scores; DECISIONS 3+6+8):
function eligibleE1(baseline, jdText, target) {
  const req = reqCached(jdText).requirements.slice(0, 12);
  const entry = req.find((r) => r.name === target);
  if (!entry || entry.priority !== 'High') return { ok: false, reason: 'NOT_HIGH_REQUIRED' };
  if (skillCount(baseline, target) !== 0) return { ok: false, reason: 'ALREADY_PRESENT' };
  const trial = applyE1(baseline, target);
  if (trial.error) return { ok: false, reason: trial.error };
  if (skillCount(trial.text, target) !== 1) return { ok: false, reason: 'ALIAS_AFTER_COUNT' };
  for (const r of req) {
    if (r.name === target) continue;
    if (skillCount(baseline, r.name) !== skillCount(trial.text, r.name)) return { ok: false, reason: `SIDE_EFFECT:${r.name}` };
  }
  // DECISION 3: single-manipulation (V1/V6) — exactly {+target}, nothing else. Alias-driven
  // second detections (e.g. "React Native"->"React", "REST APIs"->"API Integration") reject.
  const e1added = skillNames(trial.text).filter((n) => !skillNames(baseline).includes(n));
  const e1removed = skillNames(baseline).filter((n) => !skillNames(trial.text).includes(n));
  if (e1added.length !== 1 || e1added[0] !== target || e1removed.length !== 0) return { ok: false, reason: 'SCAN_DIFF_EXTRA' };
  return { ok: true, trial };
}
function eligibleE2(baseline, jdText, target) {
  const req = reqCached(jdText).requirements.slice(0, 12);
  const entry = req.find((r) => r.name === target);
  if (!entry || entry.priority !== 'High') return { ok: false, reason: 'NOT_HIGH_REQUIRED' };
  if (skillCount(baseline, target) !== 1) return { ok: false, reason: 'COUNT_NOT_ONE' };
  const loc = findSkillsLine(baseline);
  if (loc.error) return { ok: false, reason: loc.error };
  // Single occurrence must sit inside the Skills line span (R-E2).
  const inSkills = (loc.skillsLine.match(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')) || []).length > 0;
  if (!inSkills) return { ok: false, reason: 'NOT_IN_SKILLS_SPAN' };
  const trial = applyE2(baseline, target);
  if (trial.error) return { ok: false, reason: trial.error };
  if (skillCount(trial.text, target) !== 0) return { ok: false, reason: 'ALIAS_RESIDUAL' };
  for (const r of req) {
    if (r.name === target) continue;
    if (skillCount(baseline, r.name) !== skillCount(trial.text, r.name)) return { ok: false, reason: `SIDE_EFFECT:${r.name}` };
  }
  // DECISION 3: single-manipulation (V1/V6) — exactly {-target}, nothing else.
  const e2added = skillNames(trial.text).filter((n) => !skillNames(baseline).includes(n));
  const e2removed = skillNames(baseline).filter((n) => !skillNames(trial.text).includes(n));
  if (e2removed.length !== 1 || e2removed[0] !== target || e2added.length !== 0) return { ok: false, reason: 'SCAN_DIFF_EXTRA' };
  return { ok: true, trial };
}
function eligibleE3(baseline, jdText, target) { // DECISION 2+8: single skill, plain length; V(JD)=required+preferred checked at runtime.
  const vNames = new Set(reqCached(jdText).requirements.map((r) => r.name));
  const req = reqCached(jdText).requirements.slice(0, 12);
  if (vNames.has(target)) return { ok: false, reason: 'IN_JD_VOCAB' };
  if (skillCount(baseline, target) !== 0) return { ok: false, reason: 'ALREADY_PRESENT' };
  const trial = applyE3(baseline, target);
  if (trial.error) return { ok: false, reason: trial.error };
  if (skillCount(trial.text, target) !== 1) return { ok: false, reason: 'ALIAS_AFTER_COUNT' };
  for (const r of req) {
    if (skillCount(baseline, r.name) !== skillCount(trial.text, r.name)) return { ok: false, reason: `SIDE_EFFECT:${r.name}` };
  }
  const diff = scanSkills(trial.text).map((e) => e.name).filter((n) => !skillNames(baseline).includes(n));
  if (diff.length !== 1 || diff[0] !== target) return { ok: false, reason: 'SCAN_DIFF_EXTRA' };
  return { ok: true, trial };
}

// ---------------------------------------------------------------- docs
function buildDataDictionary() {
  return `# DATA_DICTIONARY — ${DATASET_ID} v${DATASET_VERSION}\n\nSynthetic benchmark for CareerLens RQ1-RQ3 (agreement, repeatability, controlled sensitivity). 100% fictional text; no PII.\n\n## Files\n- \`benchmark_v1.json\`: resumes[12], jobs[10], pairs[120] (pair_id "<job>__<resume>", designed_tier High/Mid/Low by overlap/|V| with High>=0.60, Mid 0.30-0.55, Low<=0.25), rq3_cells[12] (J1-J6 High+Mid, score-blind), edits (E1 append ", <target>" to Skills line; E2 delete sole Skills-line occurrence; E3 append ", <target> (single skill, no filler; Decision 2)" length-matched ±10% to E1; E4 prose line before first header length-matched ±10% to E1), each with edit_operation (byte-for-byte re-application for V1), target_skill, delta_chars/words, candidates_skipped, rejection fields.\n- Rejection codes (§4.6): LENGTH_UNMATCHED, STRUCTURE_CHANGED, CONTAMINATION, MULTI_ATTRIBUTE, GATE_FAIL; headroom: HEADROOM_EXCLUDED; tiers: TIER_IMBALANCE.\n\n## Conventions\n- countKeyword via scanSkills counts (equivalent to ruleBasedFallback.js:420-431); bandFor 0→0/1-2→80/3-8→100/>8→60 (:481).\n- reqNames = requirements.slice(0,12); authoring gate |V|<=12 (V3); |V|=10 for all JDs (Decision 1: deliberate choice; see GENERATION.md D1-D10).\n- Scores in metadata (baseline_ats_rule, V9) are offline rule-arm values for headroom/V9 ONLY — never used for RQ3 choice or target preference.\n`;
}
function buildGenerationDoc(log) {
  return `# GENERATION — ${DATASET_ID} v${DATASET_VERSION}\n\nDeterministic generator research/scripts/benchmark_corpus_v1.mjs (seed 20261013, mulberry32). Offline only: AI_PROVIDER=none, fetch blocked, no llm.js/analyzeMatch, no aiProvider, no .env/keys, no backend/src changes, pilot files untouched. Refuses to overwrite existing outputs.\n\n## Steps\n1. Build 10 JDs (|V|=10, >=3 High on Must-have lines, 5 mention education) and verify via extractJobRequirements.\n2. Build 12 resumes (350-600 words, degree, single SKILLS line, n>=2 dated experience) and verify words/chars.\n3. Compute overlap matrix via scanSkills (text property, score-blind); repair ONLY by adding absent JD skills in JD order (kept only on strict total-imbalance decrease) for deficit cells until 4/4/4 per JD or abort TIER_IMBALANCE (never relax bands).\n4. RQ3: J1-J6 High+Mid smallest-index (score-blind); headroom [15,90] exclusion via rule scores only, same-tier ascending replacement, logged; cross-pair shared-term preference with E1-first backtracking for E3/E4 ±10% windows.\n5. Construct E1-E4 per §4.4 exact ops; record Δchars/words, candidates_skipped, V1-V9 fields; rejected cells -> MANIPULATION_FAILED + code (never repaired post hoc).\n6. Write frozen files; SHA-256 over benchmark_v1.json recorded in log.\n\n## Review decisions D1-D10 (authoritative; all applied in code — see script header RESOLUTIONS; E3-filler protocol amendment carried to Gate D)\n- D1 decided (Decision 1): every JD fixes |V|=10 (explicitly allowed; deliberate choice; no claim all counts represented); rationale: 7/12 lands in the 0.55-0.60 gap.\n- D2 decided (Decision 2): E3 is single-skill with a plain-length window or LENGTH_UNMATCHED (no filler, no length floor); E1-first backtracking tries longer E1 targets; all skips logged.\n- D3 decided (Decision 3): alias side effects reject the candidate (V4+V6 verified; M6 empirical guard); "REST APIs"->"API Integration" style doubles fail SCAN_DIFF_EXTRA; JDs use the "REST" surface form.\n- D4/D8 decided (Decisions 4+8): prose verified empirically via scanSkills against the actual JD vocabulary (no hand blocklist); any hit rejects the candidate.\n- D5 note: Git vs GitHub/GitLab are distinct vocabulary entries (word-boundary, backend :147-149); tier design may rely on this code-derived fact.\n- D4 decided (Decision 4): E4 delta-chars = variant.length - baseline.length and therefore includes the inserted newline; window applied to that total.\n- D5 decided (Decision 5): exactly one single-line SKILLS section; base failures abort, edit failures reject STRUCTURE_CHANGED; no multi-line Skills lists.\n- D6 decided (Decision 6): shared-eligible E1 first, fallback to first window-satisfiable; every skip logged; eligibility + fixed orders only, never scores.\n- D7 decided (Decision 7): headroom exclusion exactly per S4.1 — ascending same-tier replacement, drop-if-exhausted with n-prime rules; first-passing, never best-score.\n- D10 E3 filler removed (RESOLVED, Decision 2): E3 is a single skill only; plain-length window or LENGTH_UNMATCHED — confirm list acceptable?\n\n## Log summary\n${JSON.stringify(log.summary || log, null, 2)}\n`;
}

// ---------------------------------------------------------------- main
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node research/scripts/benchmark_corpus_v1.mjs [--out <researchDir>] [--dry-run]');
    return;
  }
  const dryRun = args.includes('--dry-run');
  const outIdx = args.indexOf('--out');
  const researchRoot = outIdx !== -1 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.join(repoRoot, 'research');
  const dataDir = path.join(researchRoot, 'data', 'benchmark-v1');
  const resultsDir = path.join(researchRoot, 'results', 'benchmark-v1');
  const datasetPath = path.join(dataDir, 'benchmark_v1.json');

  const rng = mulberry32(SEED);
  const rejectionLog = [];
  const skipLog = [];

  // 1. JDs
  const jobs = JD_SPECS.map((spec) => ({ ...spec, text: buildJDText(spec) }));
  for (const job of jobs) {
    const wc = countWords(job.text);
    if (wc < JD_WORD_MIN || job.text.length > JD_CHAR_MAX) {
      console.log(`FAIL jd ${job.job_id} words=${wc} chars=${job.text.length}`);
      process.exitCode = 1; return;
    }
    const info = reqCached(job.text);
    if (info.requirements.length !== 10) {
      console.log(`FAIL jd ${job.job_id} |V|=${info.requirements.length} (need 10) got=${info.requirements.map((r) => r.name).join(',')}`);
      process.exitCode = 1; return;
    }
    const highs = info.requirements.filter((r) => r.priority === 'High').length;
    if (highs < 3) { console.log(`FAIL jd ${job.job_id} High=${highs} (need >=3)`); process.exitCode = 1; return; }
    if (info.mentionsEducation !== job.mentions_education_by_design) {
      console.log(`FAIL jd ${job.job_id} education flag mismatch`); process.exitCode = 1; return;
    }
  }

  console.error('[benchmark] JDs ok: 10 (|V|=10)');
  // 2. Resumes (base) + tier repair by adding absent JD skills in JD order (kept only on
  // strict total-imbalance decrease over the full matrix; never relaxes bands).
  const extraByResume = new Map(RESUME_SPECS.map((s) => [s.resume_id, []]));
  const jdTexts = new Map(jobs.map((j) => [j.job_id, j.text]));
  const jdSkillSets = new Map(jobs.map((j) => [j.job_id, new Set(reqCached(j.text).requirements.map((r) => r.name))]));
  const isJDUnique = (jobId, skill) => {
    for (const [id, set] of jdSkillSets) if (id !== jobId && set.has(skill)) return false;
    return true;
  };
  const buildAllResumes = () => new Map(RESUME_SPECS.map((s) => [s.resume_id, buildResumeText(s, extraByResume.get(s.resume_id), rng).text]));
  const tierMatrix = () => {
    const resumes = buildAllResumes();
    const m = new Map();
    for (const job of jobs) {
      for (const spec of RESUME_SPECS) {
        const ov = overlapOf(resumes.get(spec.resume_id), job.text);
        m.set(`${job.job_id}__${spec.resume_id}`, { overlap: ov, tier: tierFor(ov, 10) });
      }
    }
    return { resumes, matrix: m };
  };
  const imbalance = (matrix) => {
    let total = 0;
    for (const job of jobs) {
      const counts = { High: 0, Mid: 0, Low: 0, GAP: 0 };
      for (const spec of RESUME_SPECS) counts[matrix.get(`${job.job_id}__${spec.resume_id}`).tier] = (counts[matrix.get(`${job.job_id}__${spec.resume_id}`).tier] || 0) + 1;
      total += Math.abs((counts.High || 0) - 4) + Math.abs((counts.Mid || 0) - 4) + Math.abs((counts.Low || 0) - 4) + (counts.GAP || 0) * 10;
    }
    return total;
  };
  let { resumes: resumeTexts, matrix } = tierMatrix();
  console.error('[benchmark] tier repair start');
  let repairIters = 0;
  for (let iter = 0; iter < 60 && imbalance(matrix) > 0; iter++) {
    let improved = false;
    for (const job of jobs) {
      const counts = { High: 0, Mid: 0, Low: 0 };
      const byTier = { High: [], Mid: [], Low: [] };
      for (const spec of RESUME_SPECS) {
        const t = matrix.get(`${job.job_id}__${spec.resume_id}`).tier;
        if (byTier[t]) { counts[t]++; byTier[t].push(spec.resume_id); }
      }
      byTier.High.sort(); byTier.Mid.sort(); byTier.Low.sort();
      const need = (tier) => 4 - (counts[tier] || 0);
      if ((counts.GAP || 0) > 0) { rejectionLog.push({ scope: 'tier', job_id: job.job_id, reason: 'TIER_IMBALANCE', detail: 'GAP ratio reached (see Q1)' }); continue; }
      // REPAIR POOL (tier-feasibility fix): all JD skills absent from the resume, in JD
      // appearance order — not only globally-unique ones. Uniques-only could never lift a
      // base-2 Low to High where the JD holds fewer than 4 uniques (J1 stalled at 3/4/5:
      // MongoDB/Redis/REST APIs can only reach 2+3=5). Within the pool, JD-unique skills go
      // first (stable sort): they cannot disturb any other JD, so shared skills are spent
      // only when uniques do not suffice (this unblocks J3/J4-style coupled families, where
      // spending shared frontend skills first overshot J4 to 5/3/4). Safety is unchanged:
      // every addition is re-verified against the FULL matrix and kept only on strict
      // total-imbalance decrease. Text properties (scanSkills overlap) only; no scores.
      const promote = (fromTier, toTier, n) => {
        // Refresh from the live matrix: earlier promotions in this visit already changed it.
        // Recomputing the remaining need here stops the target tier overshooting past 4 when
        // several promote() calls fire in one visit (stale need caused J4 5/3/4, which no
        // add-only repair can ever undo). Deterministic order preserved; still score-blind.
        for (const k of ['High', 'Mid', 'Low']) { counts[k] = 0; byTier[k] = []; }
        for (const spec of RESUME_SPECS) {
          const t = matrix.get(`${job.job_id}__${spec.resume_id}`).tier;
          if (byTier[t]) { counts[t]++; byTier[t].push(spec.resume_id); }
        }
        byTier.High.sort(); byTier.Mid.sort(); byTier.Low.sort();
        n = 4 - (counts[toTier] || 0);
        for (const rid of [...(byTier[fromTier] || [])] ) {
          if (n <= 0) break;
          const cur = matrix.get(`${job.job_id}__${rid}`);
          const wantOverlap = toTier === 'High' ? 6 : 3;
          const missing = reqCached(job.text).requirements.map((r) => r.name)
            .filter((s) => skillCount(resumeTexts.get(rid), s) === 0)
            .sort((a, b) => (isJDUnique(job.job_id, a) ? 0 : 1) - (isJDUnique(job.job_id, b) ? 0 : 1));
          const add = missing.slice(0, Math.max(0, wantOverlap - cur.overlap));
          if (!add.length) continue;
          const before = imbalance(matrix);
          for (const s of add) extraByResume.get(rid).push(s);
          const next = tierMatrix();
          if (imbalance(next.matrix) < before) { resumeTexts = next.resumes; matrix = next.matrix; n--; improved = true; }
          else { for (const s of add) extraByResume.get(rid).pop(); }
        }
        return n;
      };
      if (need('High') > 0 && byTier.Mid.length) promote('Mid', 'High', need('High'));
      if (need('High') > 0 && byTier.Low.length) promote('Low', 'High', need('High'));
      if (need('Mid') > 0 && byTier.Low.length) promote('Low', 'Mid', need('Mid'));
    }
    repairIters = iter + 1;
    if (iter % 10 === 0) console.error(`[benchmark] tier repair iter=${iter} imbalance=${imbalance(matrix)}`);
    if (!improved) break;
  }
  console.error(`[benchmark] tier repair done iters=${repairIters} imbalance=${imbalance(matrix)}`);
  // Verify words/chars + exactly-one-SKILLS + no GAP + 4/4/4 (never relax).
  for (const spec of RESUME_SPECS) {
    const text = resumeTexts.get(spec.resume_id);
    const wc = countWords(text);
    if (wc < RESUME_WORD_MIN || wc > RESUME_WORD_MAX || text.length > RESUME_CHAR_MAX) {
      console.log(`FAIL resume ${spec.resume_id} words=${wc} chars=${text.length}`); process.exitCode = 1; return;
    }
    const loc = findSkillsLine(text);
    if (loc.error) { console.log(`FAIL resume ${spec.resume_id} ${loc.error}`); process.exitCode = 1; return; }
  }
  for (const job of jobs) {
    const counts = { High: 0, Mid: 0, Low: 0, GAP: 0 };
    for (const spec of RESUME_SPECS) counts[matrix.get(`${job.job_id}__${spec.resume_id}`).tier]++;
    if (counts.High !== 4 || counts.Mid !== 4 || counts.Low !== 4) {
      console.log(`FAIL tier ${job.job_id} High/Mid/Low=${counts.High}/${counts.Mid}/${counts.Low} (need 4/4/4; GAP=${counts.GAP || 0})`);
      rejectionLog.push({ scope: 'tier', job_id: job.job_id, reason: 'TIER_IMBALANCE', detail: `H/M/L=${counts.High}/${counts.Mid}/${counts.Low}` });
      process.exitCode = 1; return;
    }
  }

  for (const job of jobs) {
    const c = { High: 0, Mid: 0, Low: 0 };
    for (const spec of RESUME_SPECS) c[matrix.get(`${job.job_id}__${spec.resume_id}`).tier]++;
    console.error(`[benchmark] tiers ${job.job_id}: High=${c.High} Mid=${c.Mid} Low=${c.Low}`);
  }
  // AMENDMENT S4.1 (eligibility-first RQ3, 2026-10-13, pre-data): single per-candidate full
  // edit-build used for selection probes (plain reqNames order, no cross-cell state) and final
  // construction (shared-first order). Returns built or null. Every skipped candidate + exact
  // reason goes to logArr (skipLog for final builds; a temp array for probes, flushed only for
  // non-chosen candidates). Score-blind: text properties + fixed orders only; no AI scores,
  // no overall-matcher scores. Rule-arm scores enter only later via headroom/V9, never here.
  function tryBuildCellEdits(base, jdText, req, e1cands, e2order, pairId, logArr) {
    let built = null;
    for (const e1 of e1cands) {
      const chk = eligibleE1(base, jdText, e1);
      if (!chk.ok) { logArr.push({ scope: 'E1', pair_id: pairId, target: e1, outcome: chk.reason }); continue; }
      const dE1 = `, ${e1}`.length;
      const win = (d) => Math.abs(d - dE1) <= LENGTH_TOL * dE1;
      let e2pick = null;
      for (const s of e2order) {
        const c2 = eligibleE2(base, jdText, s);
        if (c2.ok) { e2pick = s; break; }
        logArr.push({ scope: 'E2', pair_id: pairId, target: s, outcome: c2.reason });
      }
      if (!e2pick) { logArr.push({ scope: 'E1', pair_id: pairId, target: e1, outcome: 'E2_NONE_FOR_THIS_E1' }); continue; }
      const e3pass = [];
      for (const s of VOCAB_DECLARATION_ORDER) {
        const c3 = eligibleE3(base, jdText, s);
        if (!c3.ok) { logArr.push({ scope: 'E3', pair_id: pairId, target: s, outcome: c3.reason }); continue; }
        const plain = `, ${s}`.length;
        if (!win(plain)) { logArr.push({ scope: 'E3', pair_id: pairId, target: s, outcome: 'LENGTH_UNMATCHED' }); continue; }
        e3pass.push({ target: s, d: plain });
      }
      e3pass.sort((a, b) => Math.abs(a.d - dE1) - Math.abs(b.d - dE1) || VOCAB_DECLARATION_ORDER.indexOf(a.target) - VOCAB_DECLARATION_ORDER.indexOf(b.target));
      if (!e3pass.length) { logArr.push({ scope: 'E1', pair_id: pairId, target: e1, outcome: 'LENGTH_UNMATCHED_E3' }); continue; }
      const e4pass = [];
      for (const prose of PROSE_POOL) {
        const tag = prose.slice(0, 24);
        if (!proseIsClean(prose, jdText)) { logArr.push({ scope: 'E4', pair_id: pairId, target: tag, outcome: 'PROSE_CONTAMINATED_OR_HEADER' }); continue; }
        const t4 = applyE4(base, prose);
        if (t4.error) { logArr.push({ scope: 'E4', pair_id: pairId, target: tag, outcome: t4.error }); continue; }
        const d = t4.text.length - base.length; // includes prose + one newline (DECISION 4).
        if (!win(d)) { logArr.push({ scope: 'E4', pair_id: pairId, target: tag, outcome: 'LENGTH_UNMATCHED' }); continue; }
        let contam = null;
        for (const r of req) if (skillCount(base, r) !== skillCount(t4.text, r)) { contam = `CONTAMINATION:${r.name}`; break; }
        if (contam) { logArr.push({ scope: 'E4', pair_id: pairId, target: tag, outcome: contam }); continue; }
        const added4 = skillNames(t4.text).filter((n) => !skillNames(base).includes(n));
        if (added4.length !== 0) { logArr.push({ scope: 'E4', pair_id: pairId, target: tag, outcome: 'CONTAMINATION:SCAN_DIFF' }); continue; }
        if (!structureInvariant(base, t4.text)) { logArr.push({ scope: 'E4', pair_id: pairId, target: tag, outcome: 'STRUCTURE_CHANGED' }); continue; }
        if (!variantPassesGates(t4.text, jdText)) { logArr.push({ scope: 'E4', pair_id: pairId, target: tag, outcome: 'GATE_FAIL' }); continue; }
        e4pass.push({ prose, d });
      }
      e4pass.sort((a, b) => Math.abs(a.d - dE1) - Math.abs(b.d - dE1) || PROSE_POOL.indexOf(a.prose) - PROSE_POOL.indexOf(b.prose));
      if (!e4pass.length) { logArr.push({ scope: 'E1', pair_id: pairId, target: e1, outcome: 'LENGTH_UNMATCHED_E4' }); continue; }
      built = { e1, e1delta: dE1, e2: e2pick, e3: e3pass[0], e4: e4pass[0] };
      break;
    }
    return built;
  }
  // 3. Pairs (120) + score-blind RQ3 selection (J1-J6 High+Mid smallest index).
  const pairs = [];
  for (const job of jobs) for (const spec of RESUME_SPECS) {
    const cell = matrix.get(`${job.job_id}__${spec.resume_id}`);
    pairs.push({ pair_id: `${job.job_id}__${spec.resume_id}`, job_id: job.job_id, resume_id: spec.resume_id, designed_tier: cell.tier, overlap: cell.overlap, v_size: 10, rq3_selected: false });
  }
  const rq3Cells = [];
  for (const jid of RQ3_JDS) {
    for (const tier of ['High', 'Mid']) {
      const cands = pairs.filter((p) => p.job_id === jid && p.designed_tier === tier).map((p) => p.resume_id).sort();
      if (!cands.length) { rejectionLog.push({ scope: 'rq3', job_id: jid, tier, reason: 'NO_SAME_TIER_CANDIDATE', detail: 'empty tier (should be 4)' }); continue; }
      // AMENDMENT S4.1 (eligibility-first): ascending candidates; full E1-E4 constructibility
      // (design-only probe, plain reqNames order) BEFORE headroom; first passing both wins.
      // Headroom stays exclusion-only (DECISION 7: rule-arm scores, never preference, no AI).
      const jd = jdTexts.get(jid);
      const req = reqCached(jd).requirements.slice(0, 12).map((r) => r.name);
      let chosen = null;
      let nNoBuild = 0, nNoHeadroom = 0;
      for (const rid of cands) {
        const base = resumeTexts.get(rid);
        const pid = `${jid}__${rid}`;
        const tmp = [];
        const probe = tryBuildCellEdits(base, jd, req, req, req, pid, tmp);
        if (!probe) { for (const s of tmp) skipLog.push(s); nNoBuild++; continue; }
        const ats = buildMatchAnalysis(base, jd).atsScore;
        if (ats < HEADROOM_MIN || ats > HEADROOM_MAX) {
          for (const s of tmp) skipLog.push(s);
          skipLog.push({ scope: 'rq3-headroom', job_id: jid, tier, resume_id: rid, baseline_ats_rule: ats, outcome: 'HEADROOM_EXCLUDED' });
          nNoHeadroom++;
          continue;
        }
        chosen = rid;
        break;
      }
      if (!chosen) {
        rejectionLog.push({ scope: 'rq3', job_id: jid, tier, reason: 'RQ3_DROPPED', detail: `no fully edit-eligible + headroom-passing candidate among ${cands.length} same-tier (noBuild=${nNoBuild} noHeadroom=${nNoHeadroom})` });
        console.error(`[benchmark] RQ3_DROPPED ${jid} ${tier}: cands=${cands.length} noBuild=${nNoBuild} noHeadroom=${nNoHeadroom}`);
        continue;
      }
      const pid = `${jid}__${chosen}`;
      pairs.find((p) => p.pair_id === pid).rq3_selected = true;
      rq3Cells.push({ pair_id: pid, job_id: jid, resume_id: chosen, tier });
      console.error(`[benchmark] RQ3 selected ${pid} (${tier})`);
    }
  }

  // 4. E1-E4 per cell (E1-first backtracking for ±10% windows; shared-term preference; full skip log).
  // DECISION 6: shared-term preference from text-property eligibility (R-E1 somewhere AND R-E2 elsewhere); fixed orders; never scores.
  const e1EligByCell = new Map(); const e2EligByCell = new Map();
  for (const cell of rq3Cells) {
    const base = resumeTexts.get(cell.resume_id); const jd = jdTexts.get(cell.job_id);
    const req = reqCached(jd).requirements.slice(0, 12).map((r) => r.name);
    e1EligByCell.set(cell.pair_id, req.filter((s) => eligibleE1(base, jd, s).ok));
    e2EligByCell.set(cell.pair_id, req.filter((s) => eligibleE2(base, jd, s).ok));
  }
  const e1EligSet = new Set([...e1EligByCell.values()].flat());
  const e2EligSet = new Set([...e2EligByCell.values()].flat());
  const sharedTerms = [...e1EligSet].filter((s) => e2EligSet.has(s));

  console.error(`[benchmark] RQ3 cells: ${rq3Cells.length} (tier/headroom done)`);
  const edits = [];
  for (const cell of rq3Cells) {
    const base = resumeTexts.get(cell.resume_id); const jd = jdTexts.get(cell.job_id);
    const req = reqCached(jd).requirements.slice(0, 12).map((r) => r.name);
    // DECISION 6: E1 order shared-eligible first (req order), then rest. Text-property eligibility + fixed orders only; never scores. Try each until E3+E4 windows hold.
    const e1cands = [...req.filter((s) => sharedTerms.includes(s) && e1EligByCell.get(cell.pair_id).includes(s)), ...req.filter((s) => !sharedTerms.includes(s))];
    // DECISION 6: E2 order for final build — first passing in req order (shared preferred); eligibility only, never scores.
    const e2order = [...req.filter((s) => sharedTerms.includes(s)), ...req.filter((s) => !sharedTerms.includes(s))];
    const built = tryBuildCellEdits(base, jd, req, e1cands, e2order, cell.pair_id, skipLog);
    if (!built) { // DECISION 5+8: specific S4.6 code from this cell's E4-scope skips when present, else LENGTH_UNMATCHED. Never repaired post hoc.
      const cellE4 = skipLog.filter((s) => s.pair_id === cell.pair_id && s.scope === 'E4').map((s) => s.outcome);
      const code = cellE4.some((o) => o === 'STRUCTURE_CHANGED') ? 'STRUCTURE_CHANGED'
        : cellE4.some((o) => String(o).startsWith('CONTAMINATION')) ? 'CONTAMINATION'
        : cellE4.some((o) => o === 'GATE_FAIL') ? 'GATE_FAIL' : 'LENGTH_UNMATCHED';
      rejectionLog.push({ scope: 'edit-cell', pair_id: cell.pair_id, reason: `MANIPULATION_FAILED:${code}`, detail: 'no E1 admits E3+E4 windows (see skipLog)' });
      for (const e of ['E1_relevant_add', 'E2_relevant_remove', 'E3_irrelevant_add', 'E4_irrelevant_prose']) {
        edits.push({ edit_id: `${cell.pair_id}__${e.split('_')[0]}`, pair_id: cell.pair_id, edit_type: e, status: 'MANIPULATION_FAILED', reason_code: code });
      }
      console.error(`[benchmark] ${cell.pair_id}: MANIPULATION_FAILED:${code}`);
      continue;
    }
    const mk = (type, target, variant, op, expected) => {
      const baseRule = buildMatchAnalysis(base, jd);
      const varRule = buildMatchAnalysis(variant, jd);
      return {
        edit_id: `${cell.pair_id}__${type.split('_')[0]}`, pair_id: cell.pair_id, edit_type: type,
        target_skill: type === 'E4_irrelevant_prose' ? null : target, status: 'CONSTRUCTED',
        expected_rule_direction: expected, variant_resume_text: variant, edit_operation: op,
        delta_chars: variant.length - base.length, delta_words: countWords(variant) - countWords(base),
        baseline_ats_rule: baseRule.atsScore, variant_ats_rule: varRule.atsScore,
        delta_ats_rule: varRule.atsScore - baseRule.atsScore,
      };
    };
    const t1 = applyE1(base, built.e1); const t2 = applyE2(base, built.e2);
    const t3 = applyE3(base, built.e3.target); const t4 = applyE4(base, built.e4.prose);
    edits.push(mk('E1_relevant_add', built.e1, t1.text, { ...t1.op, deltaChars: built.e1delta }, 'increase'));
    edits.push(mk('E2_relevant_remove', built.e2, t2.text, t2.op, 'decrease'));
    edits.push(mk('E3_irrelevant_add', built.e3.target, t3.text, { ...t3.op, lengthWindow: `|${t3.text.length - base.length}-${built.e1delta}|<=${(LENGTH_TOL * built.e1delta).toFixed(2)}` }, 'zero'));
    edits.push(mk('E4_irrelevant_prose', null, t4.text, { ...t4.op, lengthWindow: `|${t4.text.length - base.length}-${built.e1delta}|<=${(LENGTH_TOL * built.e1delta).toFixed(2)}` }, 'zero'));
    console.error(`[benchmark] ${cell.pair_id}: E1=${built.e1} E2=${built.e2} E3=${built.e3.target} E4d=${built.e4.d}/E1d=${built.e1delta}`);
  }

  const dataset = {
    dataset_id: DATASET_ID, version: DATASET_VERSION, created: DATASET_CREATED,
    provenance: '100% synthetic fictional resumes/JDs authored by benchmark_corpus_v1.mjs (seed 20261013). No PII, no scraped data.',
    protocol: 'RESEARCH_PROTOCOL.md §4.1-§4.6 (12x10=120 pairs, 4/4/4 tiers, RQ3 J1-J6 High+Mid score-blind, R-E1..R-E4, V1-V9, §4.6 reason codes)',
    schema: { pair_id: '<job_id>__<resume_id>', edit_id: '<pair_id>__<E1|E2|E3|E4>' },
    jobs: jobs.map((j) => ({ job_id: j.job_id, role_family: j.role_family, seniority: j.seniority, mentions_education_by_design: j.mentions_education_by_design, authored_required: j.high, authored_preferred: j.preferred, text: j.text })),
    resumes: RESUME_SPECS.map((s) => ({ resume_id: s.resume_id, role_family: s.role_family, text: resumeTexts.get(s.resume_id), skills_final: [...s.baseSkills, ...extraByResume.get(s.resume_id)] })),
    pairs, rq3_cells: rq3Cells, edits,
  };
  const datasetJson = `${stableStringify(dataset)}\n`;
  const datasetSha = sha256(datasetJson);
  const summary = {
    jds: jobs.length, resumes: RESUME_SPECS.length, pairs: pairs.length,
    rq3_cells: rq3Cells.length, edits_constructed: edits.filter((e) => e.status === 'CONSTRUCTED').length,
    edits_failed: edits.filter((e) => e.status !== 'CONSTRUCTED').length,
    rejections: rejectionLog.length, skips_logged: skipLog.length, dataset_sha256: datasetSha,
  };
  const log = { meta: { script: 'research/scripts/benchmark_corpus_v1.mjs', seed: SEED, dataset_id: DATASET_ID, version: DATASET_VERSION, guards: { AI_PROVIDER: 'none', fetch_blocked: true, ai_matcher_called: false } }, summary, rejectionLog, skipLog, tier_counts: jobs.map((j) => ({ job_id: j.job_id, counts: { High: pairs.filter((p) => p.job_id === j.job_id && p.designed_tier === 'High').length, Mid: pairs.filter((p) => p.job_id === j.job_id && p.designed_tier === 'Mid').length, Low: pairs.filter((p) => p.job_id === j.job_id && p.designed_tier === 'Low').length } })), rq3_cells: rq3Cells };

  console.log(`benchmark_corpus_v1: JDs=${jobs.length} resumes=${RESUME_SPECS.length} pairs=${pairs.length} rq3=${rq3Cells.length} edits_ok=${summary.edits_constructed}/${edits.length} reject=${rejectionLog.length} sha=${datasetSha.slice(0, 12)}${dryRun ? ' (dry-run, wrote nothing)' : ''}`);
  console.error(`[benchmark] cache scanHit=${cacheStats.scanHit} scanMiss=${cacheStats.scanMiss} reqHit=${cacheStats.reqHit} reqMiss=${cacheStats.reqMiss} evHit=${cacheStats.evHit} evMiss=${cacheStats.evMiss}`);
  if (dryRun) return;

  for (const p of [datasetPath, path.join(dataDir, 'DATA_DICTIONARY.md'), path.join(dataDir, 'DATA_VALIDATION.md'), path.join(dataDir, 'GENERATION.md'), path.join(resultsDir, 'benchmark_generation_log.json')]) {
    if (existsSync(p)) { console.log(`REFUSE overwrite existing: ${path.relative(repoRoot, p)}`); process.exitCode = 1; return; }
  }
  if (rejectionLog.length && summary.edits_failed > 0) console.log(`note: ${summary.edits_failed} edit(s) MANIPULATION_FAILED (see log); dataset still frozen with failures recorded per §4.6 (no post-hoc repair).`);
  mkdirSync(dataDir, { recursive: true }); mkdirSync(resultsDir, { recursive: true });
  writeFileSync(datasetPath, datasetJson, 'utf8');
  writeFileSync(path.join(dataDir, 'DATA_DICTIONARY.md'), `${buildDataDictionary()}\n`, 'utf8');
  writeFileSync(path.join(dataDir, 'GENERATION.md'), `${buildGenerationDoc(log)}\n`, 'utf8');
  const validationMd = `# DATA_VALIDATION — ${DATASET_ID} v${DATASET_VERSION}\n\nSHA-256(benchmark_v1.json): \`${datasetSha}\`\n\n## Per-JD (|V|=10, >=3 High, education flag)\n${jobs.map((j) => { const info = reqCached(j.text); return `- ${j.job_id}: |V|=${info.requirements.length} High=${info.requirements.filter((r) => r.priority === 'High').length} edu=${info.mentionsEducation} (designed ${j.mentions_education_by_design}) words=${countWords(j.text)} chars=${j.text.length}`; }).join('\n')}\n\n## Per-JD tiers (need 4/4/4)\n${log.tier_counts.map((t) => `- ${t.job_id}: High=${t.counts.High} Mid=${t.counts.Mid} Low=${t.counts.Low}`).join('\n')}\n\n## RQ3 cells (score-blind J1-J6 High+Mid; headroom [15,90] exclusions logged)\n${rq3Cells.map((c) => `- ${c.pair_id} (${c.tier})`).join('\n') || '- (none)'}\n\n## Rejections (§4.6 codes; every skip logged, no post-hoc repair)\n${rejectionLog.length ? rejectionLog.map((r) => `- ${JSON.stringify(r)}`).join('\n') : '- none'}\n\n## V1-V9 traceability\n- V1 edit_operation re-applies byte-for-byte (checker re-runs applyE1/E2/E3/E4 from stored op).\n- V2-V8 text-property fields stored per edit (delta_chars/words, target_skill, candidates_skipped in generation log).\n- V9 baseline_ats_rule/variant_ats_rule/delta_ats_rule stored per edit (rule-arm ONLY, pre-run sign check; mismatch = harness bug, stop).\n- Full per-candidate skip log: research/results/benchmark-v1/benchmark_generation_log.json\n`;
  writeFileSync(path.join(dataDir, 'DATA_VALIDATION.md'), `${validationMd}\n`, 'utf8');
  writeFileSync(path.join(resultsDir, 'benchmark_generation_log.json'), `${JSON.stringify(log, null, 2)}\n`, 'utf8');
  console.log(`wrote ${path.relative(repoRoot, datasetPath)} + docs + log`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main().finally(() => { globalThis.fetch = originalFetch; });

export { SEED, JD_SPECS, RESUME_SPECS, PROSE_POOL, VOCAB_DECLARATION_ORDER, tierFor, bandFor, countWords, buildJDText, buildResumeText, overlapOf, findSkillsLine, applyE1, applyE2, applyE3, applyE4, eligibleE1, eligibleE2, eligibleE3, structureInvariant, variantPassesGates, scanCached, reqCached, evCached };
