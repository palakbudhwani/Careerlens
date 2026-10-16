// ---------------------------------------------------------------------------
// Deterministic (no-API) fallback for CareerLens core AI features.
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// The provider layer (aiProvider.js) tries Gemini (primary) and then Groq
// (single fallback attempt). When BOTH providers fail with an *eligible*
// availability/timeout/quota/generation error, core features must stay
// usable. This module computes real results from the actual uploaded resume
// text and selected job description using fixed, documented rules — it never
// calls a provider, never fabricates candidate details, and never pretends to
// be an LLM. Every result it produces carries source: 'Rule-based fallback'
// so the UI can label it honestly.
//
// DETERMINISTIC METHOD (documented, reproducible for identical inputs):
//
// 1. Skill vocabulary scan (detectSkills / extractJobRequirements):
//    a fixed vocabulary of known technical/tool/soft skills is matched against
//    text with word-boundary (or prefix) regexes. Job requirements are the
//    vocabulary entries present in the job description, ordered by first
//    appearance; a requirement is High priority when it appears on a
//    requirement-style line (requir/must/need/essential/...) or at least
//    twice, otherwise Medium.
//
// 2. Match analysis (buildMatchAnalysis) weights, mirroring the AI prompt:
//      atsScore    = round(40% skills + 30% experience + 20% keyword + 10% education)
//      skills      = required.length ? round(100 * evidencedRequired / required) : 50 (neutral)
//      experience  = 0 entries -> 0; else round(100 * (0.4 * min(1, entries/2) + 0.6 * domainOverlap))
//                    domainOverlap = required.length ? matched/required : 0.5 (neutral)
//      keyword     = mean of per-requirement frequency bands in the resume
//                    (0 hits -> 0, 1-2 -> 80, 3-8 -> 100, >=9 -> 60 over-stuffed);
//                    50 (neutral) when the job lists no recognizable requirements
//      education   = job mentions a degree/education -> (resume has education ? 100 : 30);
//                    otherwise 75 (neutral: not specified by the job)
//    Neutral branches are always called out in the summary so missing input is
//    identified rather than invented.
//
// 3. Skill gaps (buildSkillGapAnalysis):
//    required = job-description requirements, supplemented by the curated
//    ROLE_SKILLS_MAP for the target role when the JD has none; matching =
//    required skills evidenced in the resume (vocabulary scan + caller-provided
//    parsed skills); missing = required - matching; readiness =
//    round(100 * matching / required). Missing skills always report
//    currentProficiency 'None' because no evidence exists.
//
// 4. Career growth (buildCareerGrowthPlan): driven purely by the missing
//    skills passed in, using the project's curated COURSE_DATABASE and a fixed
//    3-phase milestone template (max 6 courses).
//
// 5. Interview questions (buildInterviewQuestions): questions are chosen from
//    the curated question bank (questionBank.js) using evidence found in the
//    resume and job description (projects, employers, skills, education,
//    certifications, requirements, gaps), scored deterministically (anchor
//    base + prominence + difficulty + diversity — exact formula documented in
//    questionBank.js) with a stable hash tiebreak, and split 3 resume-based +
//    2 role-based by default, matching the AI path. Generic bank entries are
//    used only when no evidence exists — nothing is invented.
//
// 6. Answer evaluation (buildAnswerEvaluation): a fixed four-dimension rubric,
//    25 points each: relevance (question keywords addressed), evidence
//    (metric/example/action markers present), technical coverage (technical
//    terms from the question addressed), completeness (word-count bands).
//    A dimension with no assessable input is marked not-applicable and
//    awarded its full 25 points. Feedback states only observed facts.
//
// 7. Mock evaluation (buildMockEvaluation): derives the 1-10 score from the
//    same rubric: score = 0.4*technicalAccuracy + 0.3*clarity + 0.3*relevance,
//    where technicalAccuracy = (technical + evidence)/50*10, clarity =
//    completeness/25*10, relevance = relevance/25*10.
//
// 8. Scorecard (buildFinalScorecard): overallScore = round(mean(answer scores)
//    * 10) over the actual recorded answers (0 when none), strengths and
//    improvement areas computed from per-round averages and unanswered
//    questions, hiring recommendation by fixed bands (>=80 Strong Hire,
//    >=65 Recommended, >=50 Borderline, else Not Recommended). Terminated
//    sessions always score 0.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

import { selectInterviewQuestions } from './questionBank.js';

/** Source label attached to every deterministic result. */
export const RULE_BASED_SOURCE = 'Rule-based fallback';

/** Human-readable source label for results served by a provider. */
export function aiSourceLabel(provider) {
  return provider === 'groq' ? 'AI-generated (Groq fallback)' : 'AI-generated (Gemini)';
}

// ---------------------------------------------------------------------------
// Skill vocabulary
// ---------------------------------------------------------------------------
// name: canonical label used in output; aliases: strings matched against text;
// prefix: alias matches words that start with it (e.g. "collaborating");
// exact: alias is matched case-sensitively (avoids lowercase false positives
// such as "rest of the team" for REST).
const SKILL_VOCABULARY = [
  { name: 'JavaScript', aliases: ['javascript'], category: 'technical' },
  { name: 'TypeScript', aliases: ['typescript'], category: 'technical' },
  { name: 'Python', aliases: ['python'], category: 'technical' },
  { name: 'Java', aliases: ['java'], category: 'technical' },
  { name: 'C++', aliases: ['c++'], category: 'technical' },
  { name: 'C#', aliases: ['c#', 'c sharp'], category: 'technical' },
  { name: 'Go', aliases: ['golang'], exact: true, exactAliases: ['Go'], category: 'technical' },
  { name: 'Rust', aliases: ['rust'], category: 'technical' },
  { name: 'PHP', aliases: ['php'], category: 'technical' },
  { name: 'Ruby', aliases: ['ruby'], category: 'technical' },
  { name: 'Kotlin', aliases: ['kotlin'], category: 'technical' },
  { name: 'Swift', aliases: ['swift'], category: 'technical' },
  { name: 'Dart', aliases: ['dart'], category: 'technical' },
  { name: 'SQL', aliases: ['sql'], category: 'technical' },
  { name: 'Bash', aliases: ['bash', 'shell scripting'], category: 'technical' },
  { name: 'HTML', aliases: ['html', 'html5'], category: 'technical' },
  { name: 'CSS', aliases: ['css', 'css3'], category: 'technical' },
  { name: 'React', aliases: ['react'], category: 'technical' },
  { name: 'Angular', aliases: ['angular'], category: 'technical' },
  { name: 'Vue.js', aliases: ['vue.js', 'vuejs'], category: 'technical' },
  { name: 'Next.js', aliases: ['next.js', 'nextjs'], category: 'technical' },
  { name: 'Redux', aliases: ['redux'], category: 'technical' },
  { name: 'Tailwind CSS', aliases: ['tailwind css', 'tailwind'], category: 'technical' },
  { name: 'Sass/SCSS', aliases: ['sass', 'scss'], category: 'technical' },
  { name: 'React Native', aliases: ['react native'], category: 'technical' },
  { name: 'Flutter', aliases: ['flutter'], category: 'technical' },
  { name: 'Node.js', aliases: ['node.js', 'nodejs'], category: 'technical' },
  { name: 'Express', aliases: ['express'], category: 'technical' },
  { name: 'Django', aliases: ['django'], category: 'technical' },
  { name: 'Flask', aliases: ['flask'], category: 'technical' },
  { name: 'FastAPI', aliases: ['fastapi', 'fast api'], category: 'technical' },
  { name: 'Spring Boot', aliases: ['spring boot'], category: 'technical' },
  { name: 'GraphQL', aliases: ['graphql', 'graph ql'], category: 'technical' },
  { name: 'REST APIs', aliases: ['rest apis', 'rest api', 'restful', 'rest'], exact: false, exactAliases: ['REST'], category: 'technical' },
  { name: 'WebSockets', aliases: ['websocket', 'websockets', 'socket.io'], category: 'technical' },
  { name: 'PostgreSQL', aliases: ['postgresql', 'postgres'], category: 'technical' },
  { name: 'MySQL', aliases: ['mysql'], category: 'technical' },
  { name: 'MongoDB', aliases: ['mongodb', 'mongo'], category: 'technical' },
  { name: 'Redis', aliases: ['redis'], category: 'technical' },
  { name: 'SQLite', aliases: ['sqlite'], category: 'technical' },
  { name: 'AWS', aliases: ['aws', 'amazon web services'], category: 'tool' },
  { name: 'Azure', aliases: ['azure'], category: 'tool' },
  { name: 'Google Cloud', aliases: ['google cloud', 'gcp'], category: 'tool' },
  { name: 'Docker', aliases: ['docker'], category: 'tool' },
  { name: 'Kubernetes', aliases: ['kubernetes', 'k8s'], category: 'tool' },
  { name: 'Terraform', aliases: ['terraform'], category: 'tool' },
  { name: 'CI/CD', aliases: ['ci/cd', 'ci cd', 'continuous integration'], category: 'tool' },
  { name: 'Jenkins', aliases: ['jenkins'], category: 'tool' },
  { name: 'GitHub Actions', aliases: ['github actions'], category: 'tool' },
  { name: 'Git', aliases: ['git'], category: 'tool' },
  { name: 'GitHub', aliases: ['github'], category: 'tool' },
  { name: 'GitLab', aliases: ['gitlab'], category: 'tool' },
  { name: 'Linux', aliases: ['linux'], category: 'tool' },
  { name: 'Nginx', aliases: ['nginx'], category: 'tool' },
  { name: 'Jest', aliases: ['jest'], category: 'tool' },
  { name: 'Playwright', aliases: ['playwright'], category: 'tool' },
  { name: 'Cypress', aliases: ['cypress'], category: 'tool' },
  { name: 'Selenium', aliases: ['selenium'], category: 'tool' },
  { name: 'Vitest', aliases: ['vitest'], category: 'tool' },
  { name: 'Storybook', aliases: ['storybook'], category: 'tool' },
  { name: 'Vite', aliases: ['vite'], category: 'tool' },
  { name: 'Webpack', aliases: ['webpack'], category: 'tool' },
  { name: 'Machine Learning', aliases: ['machine learning'], category: 'technical' },
  { name: 'Deep Learning', aliases: ['deep learning'], category: 'technical' },
  { name: 'PyTorch', aliases: ['pytorch'], category: 'technical' },
  { name: 'TensorFlow', aliases: ['tensorflow'], category: 'technical' },
  { name: 'scikit-learn', aliases: ['scikit-learn', 'scikit learn', 'sklearn'], category: 'technical' },
  { name: 'Pandas', aliases: ['pandas'], category: 'technical' },
  { name: 'NumPy', aliases: ['numpy'], category: 'technical' },
  { name: 'NLP', aliases: ['nlp', 'natural language processing'], category: 'technical' },
  { name: 'Computer Vision', aliases: ['computer vision'], category: 'technical' },
  { name: 'LLM APIs', aliases: ['llm', 'large language model', 'llms'], category: 'technical' },
  { name: 'RAG', aliases: ['rag', 'retrieval-augmented generation', 'retrieval augmented'], category: 'technical' },
  { name: 'LangChain', aliases: ['langchain'], category: 'technical' },
  { name: 'Hugging Face', aliases: ['hugging face', 'huggingface'], category: 'technical' },
  { name: 'Prompt Engineering', aliases: ['prompt engineering', 'prompting'], category: 'technical' },
  { name: 'Generative AI', aliases: ['generative ai', 'genai', 'gen ai'], category: 'technical' },
  { name: 'Gemini API', aliases: ['gemini api', 'gemini'], category: 'technical' },
  { name: 'OpenAI API', aliases: ['openai'], category: 'technical' },
  { name: 'MLOps', aliases: ['mlops'], category: 'technical' },
  { name: 'MLflow', aliases: ['mlflow'], category: 'technical' },
  { name: 'Embeddings', aliases: ['embeddings', 'embedding'], category: 'technical' },
  { name: 'Vector Databases', aliases: ['vector database', 'vector databases', 'vector search'], category: 'technical' },
  { name: 'Data Analysis', aliases: ['data analysis', 'data analytics'], category: 'technical' },
  { name: 'Data Visualization', aliases: ['data visualization', 'data visualisation'], category: 'technical' },
  { name: 'Statistics', aliases: ['statistics'], category: 'technical' },
  { name: 'Microservices', aliases: ['microservice', 'microservices'], category: 'technical' },
  { name: 'System Design', aliases: ['system design'], category: 'technical' },
  { name: 'Data Structures & Algorithms', aliases: ['data structures', 'algorithms', 'dsa'], category: 'technical' },
  { name: 'OOP', aliases: ['oop', 'object-oriented', 'object oriented'], category: 'technical' },
  { name: 'DBMS', aliases: ['dbms'], category: 'technical' },
  { name: 'Operating Systems', aliases: ['operating systems'], category: 'technical' },
  { name: 'Computer Networks', aliases: ['computer networks'], category: 'technical' },
  { name: 'OAuth', aliases: ['oauth'], category: 'technical' },
  { name: 'JWT', aliases: ['jwt'], category: 'technical' },
  { name: 'Security', aliases: ['security'], category: 'technical' },
  { name: 'API Integration', aliases: ['api integration', 'apis'], category: 'technical' },
  { name: 'Agile', aliases: ['agile'], category: 'soft' },
  { name: 'Scrum', aliases: ['scrum'], category: 'soft' },
  { name: 'Kanban', aliases: ['kanban'], category: 'soft' },
  { name: 'Communication', aliases: ['communicat'], prefix: true, category: 'soft' },
  { name: 'Leadership', aliases: ['leadership'], category: 'soft' },
  { name: 'Collaboration', aliases: ['collaborat'], prefix: true, category: 'soft' },
  { name: 'Teamwork', aliases: ['teamwork', 'team player'], category: 'soft' },
  { name: 'Problem Solving', aliases: ['problem solving', 'problem-solving'], category: 'soft' },
  { name: 'Mentoring', aliases: ['mentor'], prefix: true, category: 'soft' },
  { name: 'Stakeholder Management', aliases: ['stakeholder'], prefix: true, category: 'soft' },
  { name: 'Accessibility', aliases: ['accessibility', 'accessible'], category: 'technical' },
  { name: 'Responsive Design', aliases: ['responsive design', 'responsive'], category: 'technical' },
  { name: 'State Management', aliases: ['state management'], category: 'technical' },
  { name: 'Design Systems', aliases: ['design system', 'design systems'], category: 'technical' },
  { name: 'Performance Optimization', aliases: ['performance optimization', 'performance optimisation', 'web performance'], category: 'technical' },
  { name: 'Testing', aliases: ['unit testing', 'integration testing', 'automated testing', 'test automation'], category: 'technical' },
];

const VOCAB_BY_NAME = new Map();
for (const entry of SKILL_VOCABULARY) {
  if (!VOCAB_BY_NAME.has(entry.name)) VOCAB_BY_NAME.set(entry.name, entry);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasRegex(alias, entry) {
  const escaped = escapeRegex(alias.toLowerCase());
  const boundary = '(^|[^a-z0-9])';
  const tail = entry.prefix ? '[a-z]*($|[^a-z0-9])' : '($|[^a-z0-9])';
  return new RegExp(`${boundary}${escaped}${tail}`, 'i');
}

function exactAliasRegex(alias) {
  const escaped = escapeRegex(alias);
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`);
}

function countMatches(text, regex) {
  const global = new RegExp(regex.source, `${regex.flags}g`);
  return (text.match(global) || []).length;
}

/**
 * Scan text for vocabulary skills. Returns canonical skill names ordered by
 * first appearance in the text, each with its occurrence count.
 */
export function scanSkills(text) {
  const raw = String(text || '');
  const found = new Map();
  for (const entry of SKILL_VOCABULARY) {
    if (found.has(entry.name)) continue;
    let count = 0;
    let firstIndex = -1;
    for (const alias of entry.aliases || []) {
      const regex = entry.exact && entry.exactAliases?.includes(alias)
        ? exactAliasRegex(alias)
        : aliasRegex(alias, entry);
      const hits = countMatches(raw, regex);
      if (hits > 0) {
        const match = new RegExp(regex.source, 'i').exec(raw);
        if (firstIndex === -1 || (match && match.index < firstIndex)) firstIndex = match ? match.index : firstIndex;
        count += hits;
      }
    }
    for (const alias of entry.exactAliases || []) {
      const regex = exactAliasRegex(alias);
      const hits = countMatches(raw, regex);
      if (hits > 0) {
        const match = regex.exec(raw);
        if (firstIndex === -1 || (match && match.index < firstIndex)) firstIndex = match.index;
        count += hits;
      }
    }
    if (count > 0) found.set(entry.name, { name: entry.name, category: entry.category, count, firstIndex });
  }
  return [...found.values()].sort((a, b) => a.firstIndex - b.firstIndex);
}

/** Convenience: canonical skill names present in the text (appearance order). */
export function detectSkills(text) {
  return scanSkills(text).map((entry) => entry.name);
}

const REQUIREMENT_LINE_RE = /requir|must have|must be|need|essential|strong|proficien|experience with|expertise|looking for|you have/i;
const EDUCATION_RE = /\b(degree|bachelor|master|b\.?tech|m\.?tech|m\.?s\.?c|b\.?s\.?c|mba|ph\.?d|diploma|education|computer science)\b/i;

/**
 * Deterministically extract the job's skill requirements from the job
 * description text. Returns ordered requirements with priority and counts,
 * plus whether the job mentions education and the requested years (null when
 * the job does not state any).
 */
export function extractJobRequirements(jobDescription) {
  const text = String(jobDescription || '');
  const lines = text.split(/\r?\n/);
  const scanned = scanSkills(text);
  const requirements = scanned.map((entry) => {
    const requirementLines = lines.filter((line) => REQUIREMENT_LINE_RE.test(line));
    const onRequirementLine = requirementLines.some((line) => scanSkills(line).some((s) => s.name === entry.name));
    const priority = entry.count >= 2 || onRequirementLine ? 'High' : 'Medium';
    return { name: entry.name, category: entry.category, priority, count: entry.count };
  });
  const yearsMatch = text.match(/(\d+)\s*\+?\s*(?:-|–|to)\s*(\d+)\s*years?|(\d+)\s*\+?\s*years?/i);
  let years = null;
  if (yearsMatch) {
    const min = Number(yearsMatch[1] || yearsMatch[3]);
    if (Number.isFinite(min) && min > 0 && min < 60) years = min;
  }
  return {
    requirements,
    mentionsEducation: EDUCATION_RE.test(text),
    years
  };
}

// ---------------------------------------------------------------------------
// Resume evidence collection (deterministic, section-aware)
// ---------------------------------------------------------------------------

const SECTION_ALIASES = {
  skills: /^skills$|^technical skills$|^core skills$|^key skills$/i,
  experience: /^experience$|^work experience$|^employment( history)?$|^professional experience$/i,
  projects: /^(selected |personal |academic )?projects$/i,
  education: /^education$|^education & training$|^academics$/i,
  certifications: /^(certifications?|licenses?)$/i,
  summary: /^(professional summary|summary|objective|profile|about (me|the candidate))$/i
};

const ACTION_VERBS_RE = /^(developed|build|built|led|manage[d]?|design|implement|creat|work|improve|collaborat|ship|optimiz|migrat|reduc|introduc|mentor|drive|write|test|maintain|support|monitor|coord|assist|participat|deliver|resolv|handl|launch|scale|automate|engineer|perform|review|refactor|architect|configure|integrat|deploy|train|analy|document|own|establish|maintain)/i;

function isSectionHeader(line) {
  if (!line || line.length > 45) return false;
  if (/[.:]$/.test(line)) return false;
  return /^[A-Z0-9][A-Z0-9 &/'()#:.-]*$/.test(line) && line.trim() === line && /[A-Z]/.test(line);
}

function classifySection(line) {
  const key = line.toLowerCase().replace(/[^a-z &/]/g, '').trim();
  for (const [name, re] of Object.entries(SECTION_ALIASES)) {
    if (re.test(key)) return name;
  }
  return null;
}

/**
 * Collect facts from the resume text itself: evidenced skills, projects,
 * employers, education entries, certifications, structure stats. Nothing here
 * is guessed — every item is read from a detected section or an exact
 * vocabulary match.
 */
export function collectEvidence(resumeText) {
  const text = String(resumeText || '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const sections = new Map();
  let current = null;
  for (const line of lines) {
    if (isSectionHeader(line)) {
      const kind = classifySection(line);
      current = kind || null;
      if (kind && !sections.has(kind)) sections.set(kind, []);
      continue;
    }
    if (current) sections.get(current).push(line);
  }

  const projects = [];
  for (const line of sections.get('projects') || []) {
    if (!/[|—–]/.test(line)) continue;
    const pipeParts = line.split('|').map((part) => part.trim()).filter(Boolean);
    let head = pipeParts[0];
    let tech = pipeParts.slice(1).join(', ');
    if (/[—–]/.test(head)) {
      const [title, ...rest] = head.split(/[—–]/);
      head = title.trim();
      const restTech = rest.join(' ').trim();
      tech = [restTech, tech].filter(Boolean).join(', ');
    }
    const name = head.slice(0, 70).trim();
    if (name.length < 3) continue;
    if (projects.some((p) => p.name === name)) continue;
    projects.push({ name, technologies: tech });
  }

  const experience = [];
  for (const line of sections.get('experience') || []) {
    const hasDates = /(?:19|20)\d{2}\s*(?:–|-|–|to)\s*(?:present|now|current|ongoing|(?:19|20)\d{2})/i.test(line);
    if (!hasDates) continue;
    let role = '';
    let company = '';
    const head = line.split('|')[0].trim();
    if (/[—–]/.test(head)) {
      const [r, c] = head.split(/[—–]/);
      role = (r || '').trim();
      company = (c || '').trim();
    }
    experience.push({ role, company });
  }

  const education = (sections.get('education') || []).map((line) => {
    const head = line.split(/[|—–]/)[0].trim();
    return head.length >= 3 ? head : line;
  }).filter(Boolean);

  const certifications = (sections.get('certifications') || []).map((line) => line.split('|')[0].trim()).filter(Boolean);

  const words = text.split(/\s+/).filter(Boolean);
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text);
  const actionVerbLines = lines.filter((line) => ACTION_VERBS_RE.test(line)).length;

  return {
    skills: detectSkills(text),
    projects,
    experience,
    education,
    certifications,
    wordCount: words.length,
    hasEmail: email,
    actionVerbLines: actionVerbLines,
    sectionCount: sections.size
  };
}

function countKeyword(text, skillName) {
  const entry = VOCAB_BY_NAME.get(skillName);
  if (!entry) return 0;
  let total = 0;
  for (const alias of entry.aliases || []) {
    total += countMatches(text, aliasRegex(alias, entry));
  }
  for (const alias of entry.exactAliases || []) {
    total += countMatches(text, exactAliasRegex(alias));
  }
  return total;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function hashId(prefix, ...parts) {
  return `${prefix}-${createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 10)}`;
}

function clipWords(text, maxWords) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

// ---------------------------------------------------------------------------
// 1. Match analysis
// ---------------------------------------------------------------------------

export function buildMatchAnalysis(resumeText, jobDescription) {
  const resume = String(resumeText || '');
  const job = String(jobDescription || '');
  const evidence = collectEvidence(resume);
  const jobInfo = extractJobRequirements(job);

  const required = jobInfo.requirements.slice(0, 12);
  const requiredNames = required.map((r) => r.name);
  const evidenced = new Set(evidence.skills);
  const matching = requiredNames.filter((name) => evidenced.has(name));
  const missing = requiredNames.filter((name) => !evidenced.has(name));

  const skillsMatchScore = requiredNames.length > 0
    ? Math.round((100 * matching.length) / requiredNames.length)
    : 50;
  const domainOverlap = requiredNames.length > 0
    ? matching.length / requiredNames.length
    : 0.5;
  const experienceScore = evidence.experience.length === 0
    ? 0
    : Math.round(100 * (0.4 * Math.min(1, evidence.experience.length / 2) + 0.6 * domainOverlap));
  const educationScore = jobInfo.mentionsEducation
    ? (evidence.education.length > 0 ? 100 : 30)
    : 75;

  const keywordCounts = requiredNames.map((name) => ({ name, count: countKeyword(resume, name) }));
  const bandFor = (count) => (count === 0 ? 0 : count <= 2 ? 80 : count <= 8 ? 100 : 60);
  const keywordDensityScore = requiredNames.length > 0
    ? Math.round(keywordCounts.reduce((sum, k) => sum + bandFor(k.count), 0) / requiredNames.length)
    : 50;

  const atsScore = clamp(
    Math.round(0.4 * skillsMatchScore + 0.3 * experienceScore + 0.2 * keywordDensityScore + 0.1 * educationScore),
    0,
    100
  );

  const missingDetails = missing.map((name) => {
    const req = required.find((r) => r.name === name);
    return { name, priority: req?.priority || 'Medium', category: req?.category || 'technical' };
  });

  const gaps = missingDetails.slice(0, 6).map((item) => ({
    category: item.category === 'tool' ? 'Tooling Gap' : item.category === 'soft' ? 'Soft Skill Gap' : 'Technical Skill Gap',
    description: `"${item.name}" is required by the job description but was not detected in the resume.`,
    impact: item.priority === 'High' ? 'High' : 'Medium',
    recommendation: `Add a project bullet, work achievement, or certification that uses ${item.name}, then list it under Skills.`
  }));

  const notes = [];
  notes.push(`Deterministic scan: ${evidence.wordCount} words, ${evidence.sectionCount} resume sections, ${evidence.experience.length} work experience entries, ${evidence.projects.length} projects, ${evidence.education.length} education entries detected.`);
  notes.push(jobInfo.mentionsEducation
    ? (evidence.education.length > 0
      ? 'The job mentions education requirements and the resume lists a degree.'
      : 'The job mentions education requirements but no degree entry was detected in the resume.')
    : 'The job description does not specify education requirements, so education was scored neutrally (75).');
  notes.push(`Contact email ${evidence.hasEmail ? 'detected' : 'not detected'}; ${evidence.actionVerbLines} lines start with action verbs.`);
  if (requiredNames.length === 0) {
    notes.push('No recognizable skill requirements were found in the job description, so skills/keyword components were scored neutrally.');
  }
  notes.push(`${matching.length} of ${requiredNames.length} detected job requirements are evidenced in the resume.`);

  const summary = clipWords(
    requiredNames.length > 0
      ? `Evidenced ${matching.length} of ${requiredNames.length} detected job requirements: ${matching.join(', ') || 'none'}.` +
        (missing.length ? ` Not evidenced: ${missing.join(', ')}.` : ' No missing detected requirements.') +
        ` Weighted score ${atsScore}% — skills ${skillsMatchScore}% (40%), experience ${experienceScore}% (30%), keyword coverage ${keywordDensityScore}% (20%), education ${educationScore}% (10%).` +
        ` ${jobInfo.mentionsEducation ? (evidence.education.length > 0 ? 'Education entry found.' : 'No education entry detected.') : 'Education not specified by the job (neutral score).'}`
      : `Weighted score ${atsScore}%. No recognizable skill requirements were found in the job description, so skills and keyword components used neutral scores while experience (${experienceScore}%, ${evidence.experience.length} entries detected) and education (${educationScore}%) were assessed from the resume.`,
    120
  );

  const keywordFrequency = keywordCounts.slice(0, 12).map(({ name, count }) => ({
    keyword: name,
    count,
    status: count === 0 ? 'Missing' : count <= 2 ? 'Present' : count <= 8 ? 'Optimal' : 'Overused'
  }));

  const actionVerbsCheck = evidence.actionVerbLines >= 8
    ? `Strong: ${evidence.actionVerbLines} lines start with action verbs.`
    : evidence.actionVerbLines >= 4
      ? `Moderate: ${evidence.actionVerbLines} lines start with action verbs.`
      : `Few: only ${evidence.actionVerbLines} lines start with action verbs.`;

  return {
    matchId: hashId('match-rule', resume, job),
    atsScore,
    breakdown: { skillsMatchScore, experienceScore, educationScore, keywordDensityScore },
    summary,
    matchingSkills: matching.slice(0, 12),
    missingSkills: missing.slice(0, 12),
    gaps,
    atsFeedback: {
      formattingNotes: notes,
      actionVerbsCheck,
      keywordFrequency
    }
  };
}

// ---------------------------------------------------------------------------
// 2. Skill gap analysis
// ---------------------------------------------------------------------------

const ROLE_SKILLS_MAP = {
  'frontend engineer': ['TypeScript', 'React', 'Next.js', 'Tailwind CSS', 'State Management', 'Performance Optimization', 'Testing', 'Accessibility'],
  'senior frontend engineer': ['TypeScript', 'React', 'Next.js', 'Design Systems', 'Performance Optimization', 'Testing', 'GraphQL', 'Accessibility'],
  'backend engineer': ['Node.js', 'Python', 'PostgreSQL', 'Docker', 'Kubernetes', 'System Design', 'REST APIs', 'Microservices'],
  'full-stack engineer': ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'System Design', 'REST APIs'],
  'data scientist': ['Python', 'SQL', 'Machine Learning', 'Pandas', 'Statistics', 'Data Visualization', 'MLOps', 'Deep Learning'],
  'ai product engineer': ['Python', 'TypeScript', 'React', 'LLM APIs', 'Vector Databases', 'LangChain', 'Node.js', 'FastAPI'],
  'ai / ml engineer': ['Python', 'PyTorch', 'Machine Learning', 'MLOps', 'Docker', 'Vector Databases', 'System Design', 'NLP'],
  'devops engineer': ['Docker', 'Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Linux', 'System Design', 'Security'],
  'mobile developer': ['Flutter', 'React Native', 'Dart', 'Kotlin', 'Swift', 'State Management', 'REST APIs', 'Testing']
};

function resolveRoleSkills(targetRole) {
  const roleKey = String(targetRole || '').toLowerCase().trim();
  if (ROLE_SKILLS_MAP[roleKey]) return ROLE_SKILLS_MAP[roleKey];
  const found = Object.keys(ROLE_SKILLS_MAP).find((key) => roleKey.includes(key) || key.includes(roleKey));
  if (found) return ROLE_SKILLS_MAP[found];
  return ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'System Design', 'Testing'];
}

export function buildSkillGapAnalysis({ resumeText = '', parsedSkills = [], targetRole = 'Software Engineer', jobDescription = '' } = {}) {
  const evidence = collectEvidence(resumeText);
  const jobInfo = extractJobRequirements(jobDescription);

  const evidenced = new Set([
    ...evidence.skills.map((s) => s.toLowerCase()),
    ...(Array.isArray(parsedSkills) ? parsedSkills : []).map((s) => String(typeof s === 'string' ? s : s?.name || '').toLowerCase()).filter(Boolean)
  ]);

  const requiredNames = [];
  const pushUnique = (name) => {
    if (name && !requiredNames.some((existing) => existing.toLowerCase() === String(name).toLowerCase())) {
      requiredNames.push(name);
    }
  };
  jobInfo.requirements.forEach((r) => pushUnique(r.name));
  if (requiredNames.length === 0) resolveRoleSkills(targetRole).forEach(pushUnique);
  const required = requiredNames.slice(0, 10);

  const matchingSkills = required.filter((name) => evidenced.has(name.toLowerCase()));
  const missingSkills = required
    .filter((name) => !evidenced.has(name.toLowerCase()))
    .map((name) => {
      const jobReq = jobInfo.requirements.find((r) => r.name === name);
      const category = jobReq?.category || (VOCAB_BY_NAME.get(name)?.category ?? 'technical');
      const priority = jobReq?.priority || 'Medium';
      return {
        name,
        category,
        priority,
        currentProficiency: 'None',
        requiredProficiency: category === 'tool' ? 'Intermediate' : 'Advanced',
        description: category === 'soft'
          ? `The ${targetRole} role calls for ${name}; the resume shows no evidence of it yet.`
          : `Required for ${targetRole} and not detected in the resume — focus on hands-on practice and a portfolio example.`
      };
    });

  const readinessScore = required.length > 0
    ? Math.round((100 * matchingSkills.length) / required.length)
    : 0;

  const summary = required.length > 0
    ? `Readiness ${readinessScore}% — ${matchingSkills.length} of ${required.length} requirements for ${targetRole} are evidenced in the resume` +
      (missingSkills.length ? `; gaps: ${missingSkills.map((m) => m.name).join(', ')}.` : '; no detected gaps.')
    : `No requirements could be identified for ${targetRole} from the job description or curated role profile, so readiness was not scored.`;

  return {
    targetRole,
    readinessScore,
    summary,
    matchingSkills,
    requiredSkills: required,
    missingSkills
  };
}

// ---------------------------------------------------------------------------
// 3. Career growth plan (curated course database)
// ---------------------------------------------------------------------------

const COURSE_DATABASE = {
  'typescript': [
    { title: 'Understanding TypeScript', provider: 'Udemy', url: 'https://www.udemy.com/course/understanding-typescript/', type: 'Paid / Certificate', duration: '15 hours', level: 'Beginner to Advanced', description: 'Master TypeScript, compiler configuration, design patterns, and integration with React/Node.' },
    { title: 'TypeScript Course for Beginners', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=gieEQFIfgYc', type: 'Free', duration: '5 hours', level: 'Beginner', description: 'Types, interfaces, generics, classes, and project setups.' }
  ],
  'react': [
    { title: 'The Ultimate React Course: React, Redux & More', provider: 'Udemy', url: 'https://www.udemy.com/course/the-ultimate-react-course/', type: 'Paid / Certificate', duration: '65 hours', level: 'All Levels', description: 'Modern React with hooks, state management, Query, and architecture.' },
    { title: 'React Course - Beginner Tutorial', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=bMknfKXIFA8', type: 'Free', duration: '12 hours', level: 'Beginner', description: 'Components, JSX, props, state, hooks, and hands-on applications.' }
  ],
  'node.js': [
    { title: 'Node.js, Express & MongoDB - Full Stack Development', provider: 'Udemy', url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/', type: 'Paid / Certificate', duration: '42 hours', level: 'Intermediate', description: 'Node runtime, Express REST APIs, security, and deployment.' },
    { title: 'Node.js Full Course for Beginners', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=Oe421EPjeBE', type: 'Free', duration: '8 hours', level: 'Beginner', description: 'Event loops, asynchronous I/O, Express routing, and fundamentals.' }
  ],
  'docker': [
    { title: 'Docker & Kubernetes: The Practical Guide', provider: 'Udemy', url: 'https://www.udemy.com/course/docker-kubernetes-the-practical-guide/', type: 'Paid / Certificate', duration: '23 hours', level: 'All Levels', description: 'Containers, images, volumes, and orchestration.' },
    { title: 'Docker Tutorial for Beginners', provider: 'YouTube (Programming with Mosh)', url: 'https://www.youtube.com/watch?v=pTFZFxd4hOI', type: 'Free', duration: '2 hours', level: 'Beginner', description: 'Dockerfiles, images, ports, volumes, and Docker Compose.' }
  ],
  'kubernetes': [
    { title: 'Certified Kubernetes Application Developer (CKAD)', provider: 'Udemy', url: 'https://www.udemy.com/course/certified-kubernetes-application-developer/', type: 'Paid / Certificate', duration: '10 hours', level: 'Intermediate to Advanced', description: 'Pods, deployments, services, volumes, and ingress.' },
    { title: 'Kubernetes Course for Beginners', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=X48VuDVv0do', type: 'Free', duration: '4 hours', level: 'Beginner', description: 'Pods, deployments, services, and cluster management.' }
  ],
  'python': [
    { title: '100 Days of Code: The Complete Python Pro Bootcamp', provider: 'Udemy', url: 'https://www.udemy.com/course/100-days-of-code/', type: 'Paid / Certificate', duration: '60 hours', level: 'Beginner to Intermediate', description: 'Core Python, automation, data analysis, and projects.' },
    { title: 'Python for Beginners - Full Course', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw', type: 'Free', duration: '4 hours', level: 'Beginner', description: 'Syntax, variables, data structures, loops, functions, and OOP.' }
  ],
  'sql': [
    { title: 'The Complete SQL Bootcamp', provider: 'Udemy', url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/', type: 'Paid / Certificate', duration: '9 hours', level: 'Beginner to Advanced', description: 'PostgreSQL, queries, joins, GROUP BY, and schemas.' },
    { title: 'SQL Tutorial - Full Database Course', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY', type: 'Free', duration: '4 hours', level: 'Beginner', description: 'Fundamentals, relationships, joins, and database design.' }
  ],
  'aws': [
    { title: 'AWS Certified Solutions Architect Associate', provider: 'Udemy', url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/', type: 'Paid / Certificate', duration: '27 hours', level: 'Intermediate', description: 'EC2, S3, RDS, Lambda, VPC, and architecture patterns.' },
    { title: 'AWS Basics for Beginners', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=ulprqHHWlng', type: 'Free', duration: '4 hours', level: 'Beginner', description: 'Cloud concepts, IAM security, and serverless basics.' }
  ],
  'system design': [
    { title: 'Grokking the System Design Interview', provider: 'DesignGurus', url: 'https://www.designgurus.io/course/grokking-the-system-design-interview', type: 'Paid', duration: '20 hours', level: 'Intermediate to Advanced', description: 'Scalable architecture, caching, sharding, and queues.' },
    { title: 'System Design Course for Beginners', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=m8Icp_Cid5o', type: 'Free', duration: '5 hours', level: 'Beginner to Intermediate', description: 'Design principles, CDN caching, SQL vs NoSQL, scalability.' }
  ],
  'machine learning': [
    { title: 'Machine Learning Specialization by Andrew Ng', provider: 'Coursera', url: 'https://www.coursera.org/specializations/machine-learning-introduction', type: 'Certificate Option', duration: '60 hours', level: 'Beginner to Intermediate', description: 'Supervised learning, neural networks, and model evaluation.' },
    { title: 'Practical Deep Learning for Coders', provider: 'fast.ai', url: 'https://course.fast.ai/', type: 'Free', duration: '30 hours', level: 'Intermediate', description: 'Hands-on deep learning with PyTorch and real datasets.' }
  ]
};

const MAX_COURSES = 6;

export function buildCareerGrowthPlan({ missingSkills = [], targetRole = 'Software Engineer' } = {}) {
  const skills = (Array.isArray(missingSkills) ? missingSkills : [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
    .filter(Boolean)
    .slice(0, MAX_COURSES);

  const courses = [];
  skills.forEach((skill, index) => {
    if (courses.length >= MAX_COURSES) return;
    const clean = skill.toLowerCase().trim();
    const dbKey = Object.keys(COURSE_DATABASE).find((key) => clean.includes(key) || key.includes(clean));
    if (dbKey) {
      for (const course of COURSE_DATABASE[dbKey]) {
        if (courses.length >= MAX_COURSES) break;
        courses.push({ id: `course-${index + 1}-${courses.length + 1}`, skillName: skill, ...course });
      }
    } else {
      courses.push({
        id: `course-${index + 1}-1`,
        skillName: skill,
        title: `${skill} — structured learning path`,
        provider: 'Curated search',
        url: `https://www.google.com/search?q=${encodeURIComponent(`${skill} course online freecodecamp udemy coursera`)}`,
        type: 'Paid / Certificate',
        duration: '10–15 hours',
        level: 'Beginner to Intermediate',
        description: `Curated starting point for ${skill} with tutorials, official docs, and practice exercises.`
      });
    }
  });

  const focusOne = skills.slice(0, 2).join(', ') || 'primary skill gaps';
  const focusTwo = skills.slice(2, 4).join(', ') || 'secondary gaps';
  const milestones = [
    {
      phase: 'Phase 1 (Month 1-2)',
      focus: `Core foundations — ${focusOne}`,
      action: 'Complete the foundational course modules and practise daily with small exercises.',
      targetOutcome: 'Ship one hands-on feature or mini-project that uses the new skill.'
    },
    {
      phase: 'Phase 2 (Month 3-4)',
      focus: `Applied integration — ${focusTwo}`,
      action: 'Build a portfolio project that integrates the new skills with your existing stack.',
      targetOutcome: 'Publish the repository with documentation and a live demo.'
    },
    {
      phase: 'Phase 3 (Month 5-6)',
      focus: 'Interview preparation and resume refinement',
      action: 'Update resume bullets and your interview stories to cover the newly learned skills.',
      targetOutcome: 'Clear target-role interviews with evidence for every listed skill.'
    }
  ];

  return {
    targetRole,
    summary: skills.length > 0
      ? `Structured ${skills.length}-skill upskilling plan for ${targetRole}: focused phases across 3–6 months with curated resources for each gap.`
      : `No skill gaps were supplied, so the plan follows the standard ${targetRole} learning path with general resources.`,
    courses,
    milestones
  };
}

// ---------------------------------------------------------------------------
// 4. Interview questions (curated bank selected over real evidence)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'that', 'this', 'what', 'how', 'when', 'where', 'why', 'who',
  'are', 'was', 'were', 'have', 'has', 'had', 'can', 'could', 'would', 'should', 'about', 'from', 'into',
  'their', 'they', 'them', 'his', 'her', 'she', 'him', 'its', 'our', 'out', 'get', 'got', 'did', 'does',
  'not', 'but', 'any', 'all', 'one', 'two', 'than', 'then', 'there', 'here', 'been', 'being', 'will', 'may',
  'much', 'many', 'very', 'most', 'some', 'such', 'only', 'own', 'same', 'too', 'just', 'also', 'over',
  'under', 'between', 'during', 'before', 'after', 'while', 'because', 'while', 'whether', 'each', 'other'
]);

function questionWords(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
  )];
}

export function buildInterviewQuestions({ resumeText = '', jobDescription = '', difficulty = 'Mid', total = 5 } = {}) {
  const parsedTotal = Number.parseInt(total, 10);
  const count = Math.min(10, Math.max(2, Number.isFinite(parsedTotal) ? parsedTotal : 5));
  const resumeCount = Math.ceil(count / 2);
  const roleCount = count - resumeCount;

  const evidence = collectEvidence(resumeText);
  const jobInfo = extractJobRequirements(jobDescription);
  const skillMeta = new Map(scanSkills(resumeText).map((entry) => [entry.name, entry]));

  const questions = selectInterviewQuestions({
    resumeText,
    jobDescription,
    evidence,
    skillMeta,
    jobInfo,
    difficulty,
    resumeCount,
    roleCount
  });

  const stamp = (list, prefix) => list.map((question, index) => ({
    ...question,
    id: `${prefix}-${index + 1}`,
    context: clipWords(question.context, 25),
    evalCriteria: clipWords(`${difficulty} level. ${question.evalCriteria}`, 25),
    question: clipWords(question.question, 35),
    sampleAnswerOutline: question.sampleAnswerOutline.map((bullet) => clipWords(bullet, 12))
  }));

  return {
    resumeBasedQuestions: stamp(questions.resumeBasedQuestions, 'q-res'),
    roleBasedQuestions: stamp(questions.roleBasedQuestions, 'q-role')
  };
}

// ---------------------------------------------------------------------------
// 5. Answer evaluation rubric (fixed 4 x 25 dimensions)
// ---------------------------------------------------------------------------

export const EVALUATION_RUBRIC = {
  dimensions: ['relevance', 'evidence', 'technical coverage', 'completeness'],
  maxPoints: 25
};

const EVIDENCE_MARKER_RES = [
  /\d/, // any concrete number
  /%|percent/i,
  /for example|e\.g\.|such as/i,
  /\bI\b|\bwe\b/i,
  /shipped|built|reduced|improved|increased|delivered|designed|led|launched|optimized|automated/i
];

const IMPROVEMENT_BY_DIMENSION = {
  relevance: 'Open with a direct answer to the question, then tie each point back to what was asked.',
  evidence: 'Add one concrete example with a measurable result (scale, time, or percentage).',
  technical: 'Name the specific technologies or concepts involved and explain how you applied them.',
  completeness: 'Expand with context, your actions, and the result (STAR structure).'
};

/**
 * Deterministic four-dimension rubric (25 points each, 100 total).
 * Returns per-dimension detail so feedback can state observed facts only.
 */
export function scoreAnswer(question, answer) {
  const q = String(question || '');
  const a = String(answer || '');
  const lowerAnswer = a.toLowerCase();
  const words = a.split(/\s+/).filter(Boolean);

  const keywords = questionWords(q);
  const relevanceHits = keywords.filter((word) => lowerAnswer.includes(word));
  const relevance = keywords.length > 0 ? (25 * relevanceHits.length) / keywords.length : 25;

  const markersPresent = EVIDENCE_MARKER_RES.filter((re) => re.test(a)).length;
  const evidence = (25 * markersPresent) / EVIDENCE_MARKER_RES.length;

  const questionTechnical = detectSkills(q);
  const coveredTechnical = questionTechnical.filter((skill) => countKeyword(a, skill) > 0);
  const technical = questionTechnical.length > 0
    ? (25 * coveredTechnical.length) / questionTechnical.length
    : 25;

  const wordCount = words.length;
  const completeness = wordCount < 15 ? 4 : wordCount < 40 ? 11 : wordCount < 120 ? 19 : 25;

  const score = clamp(Math.round(relevance + evidence + technical + completeness), 0, 100);

  const dimensions = { relevance, evidence, technical, completeness };
  const lowest = ['relevance', 'evidence', 'technical', 'completeness']
    .map((key) => ({ key, value: dimensions[key] }))
    .sort((x, y) => x.value - y.value)[0].key;

  const verdict = score >= 85 ? 'Strong answer.'
    : score >= 70 ? 'Solid, with identifiable gaps.'
      : score >= 50 ? 'Partially addresses the question.'
        : 'Underdeveloped response.';

  const feedback = `Scored ${score}/100 on a fixed four-part rubric (relevance, evidence, technical coverage, completeness; 25 points each). ` +
    `Relevance: ${relevanceHits.length}/${keywords.length} question keywords addressed. ` +
    `Evidence: ${markersPresent}/${EVIDENCE_MARKER_RES.length} markers present${/\d/.test(a) ? ' (includes a number)' : ' (no quantified result found)'}. ` +
    `Technical coverage: ${questionTechnical.length > 0 ? `${coveredTechnical.length}/${questionTechnical.length} technical terms from the question addressed` : 'no technical terms in the question (not applicable, full marks)'}. ` +
    `Completeness: ${wordCount} words. ${verdict}`;

  return {
    score,
    feedback,
    suggested_improvement: IMPROVEMENT_BY_DIMENSION[lowest],
    dimensions: { relevance, evidence, technical, completeness },
    wordCount
  };
}

export function buildAnswerEvaluation({ question = '', answer = '' } = {}) {
  const scored = scoreAnswer(question, answer);
  return { score: scored.score, feedback: scored.feedback, suggested_improvement: scored.suggested_improvement };
}

// ---------------------------------------------------------------------------
// 6. Mock interview questions / evaluation / scorecard
// ---------------------------------------------------------------------------

const APTITUDE_MCQS = [
  {
    questionText: 'If a cloud application requires 99.99% uptime, what is the maximum allowed downtime per year?',
    options: ['~52 minutes', '~8.7 hours', '~5.2 hours', '~3.6 days'],
    category: 'System Availability Logic',
    correctAnswerIndex: 0
  },
  {
    questionText: 'Which HTTP status code represents "Unprocessable Entity" due to semantic errors in a request?',
    options: ['400 Bad Request', '401 Unauthorized', '422 Unprocessable Entity', '500 Internal Server Error'],
    category: 'Web Protocol Logic',
    correctAnswerIndex: 2
  },
  {
    questionText: 'In git, which command temporarily stores uncommitted changes without committing them?',
    options: ['git stash', 'git revert', 'git push', 'git reset --hard'],
    category: 'Version Control Logic',
    correctAnswerIndex: 0
  },
  {
    questionText: 'Which sorting algorithm offers the best worst-case time complexity guarantee?',
    options: ['Quick Sort', 'Bubble Sort', 'Merge Sort', 'Insertion Sort'],
    category: 'Algorithmic Logic',
    correctAnswerIndex: 2
  },
  {
    questionText: 'A table has 1 million rows with 99% reads and 1% writes. Should you add an index to the lookup column?',
    options: ['Yes, if the lookup is frequent', 'No, indexes block reads', 'Only if the table is empty', 'Indexes never affect writes'],
    category: 'Database Logic',
    correctAnswerIndex: 0
  },
  {
    questionText: 'What is the safest way to store API credentials in a Node.js server?',
    options: ['Hardcode in source files', 'Load from environment variables', 'Commit to a config file', 'Log them for debugging'],
    category: 'Security Logic',
    correctAnswerIndex: 1
  }
];

export function buildMockQuestions({ resumeText = '', jobDescription = '', targetRole = '' } = {}) {
  const evidence = collectEvidence(resumeText);
  const jobInfo = extractJobRequirements(jobDescription);

  const round1 = APTITUDE_MCQS.slice(0, 5).map((mcq, index) => ({
    questionId: `apt-${index + 1}`,
    type: 'MCQ',
    ...mcq
  }));

  const technicalTemplates = [];
  evidence.projects.forEach((project) => {
    technicalTemplates.push({
      questionId: `tech-${technicalTemplates.length + 1}`,
      type: 'FREE_TEXT',
      questionText: `In your "${project.name}" project, what was the primary technical bottleneck you faced, and how did you resolve it?`,
      category: 'Project Architecture'
    });
  });
  evidence.skills.slice(0, 6).forEach((skill) => {
    technicalTemplates.push({
      questionId: `tech-${technicalTemplates.length + 1}`,
      type: 'FREE_TEXT',
      questionText: `Your resume lists "${skill}". How would you use it to build a reliable feature for the ${targetRole || 'target'} role?`,
      category: `Technical: ${skill}`
    });
  });
  jobInfo.requirements.slice(0, 4).forEach((requirement) => {
    technicalTemplates.push({
      questionId: `tech-${technicalTemplates.length + 1}`,
      type: 'FREE_TEXT',
      questionText: `The job description requires "${requirement.name}". Explain how you would apply it in production and what you would monitor.`,
      category: `Job Requirement: ${requirement.name}`
    });
  });
  technicalTemplates.push({
    questionId: `tech-${technicalTemplates.length + 1}`,
    type: 'FREE_TEXT',
    questionText: 'Describe how you structure automated tests for a feature: what you test first, and how you mock external services.',
    category: 'Testing & Quality'
  });
  const round2 = technicalTemplates.slice(0, 3);

  const round3 = [
    {
      questionId: 'hr-1',
      type: 'FREE_TEXT',
      questionText: 'Tell me about a time you had to adapt to a new technology or requirement under a tight deadline. How did you handle it?',
      category: 'Adaptability'
    },
    {
      questionId: 'hr-2',
      type: 'FREE_TEXT',
      questionText: 'Describe a disagreement with a teammate or stakeholder about a technical decision. How did you resolve it?',
      category: 'Conflict Resolution'
    },
    {
      questionId: 'hr-3',
      type: 'FREE_TEXT',
      questionText: `What attracts you to the ${targetRole || 'target'} role, and where do you want to grow over the next two years?`,
      category: 'Motivation & Growth'
    }
  ];

  return { round1, round2, round3 };
}

export function buildMockEvaluation({ question = '', answer = '' } = {}) {
  const scored = scoreAnswer(question, answer);
  const technicalAccuracy = clamp(round1(((scored.dimensions.technical + scored.dimensions.evidence) / 50) * 10), 1, 10);
  const clarity = clamp(round1((scored.dimensions.completeness / 25) * 10), 1, 10);
  const relevanceToRole = clamp(round1((scored.dimensions.relevance / 25) * 10), 1, 10);
  const score = clamp(round1(0.4 * technicalAccuracy + 0.3 * clarity + 0.3 * relevanceToRole), 1, 10);

  const weakest = scored.dimensions.completeness < 12
    ? 'expand with context, actions, and results'
    : scored.dimensions.evidence < 15
      ? 'add a concrete example with a measurable outcome'
      : scored.dimensions.relevance < 15
        ? 'tie each point back to the question'
        : 'name the specific technical concepts you applied';

  const instantFeedback = `${score.toFixed(1)}/10 — ${scored.wordCount} words. ` +
    `Technical coverage and evidence: ${((scored.dimensions.technical + scored.dimensions.evidence) / 50 * 10).toFixed(1)}/10; ` +
    `clarity (completeness proxy): ${clarity.toFixed(1)}/10; relevance to the question: ${relevanceToRole.toFixed(1)}/10. ` +
    `Next step: ${weakest}.`;

  return {
    score,
    instantFeedback,
    evaluatedCriteria: { technicalAccuracy, clarity, relevanceToRole }
  };
}

function roundLabel(roundQuestions, answers) {
  let sum = 0;
  let count = 0;
  for (const question of roundQuestions || []) {
    const answer = answers?.[question.questionId];
    if (answer && Number.isFinite(answer.score)) {
      sum += answer.score;
      count += 1;
    }
  }
  return { average: count > 0 ? sum / count : null, count };
}

export function buildFinalScorecard(session = {}) {
  if (session.status === 'TERMINATED') {
    return {
      overallScore: 0,
      strengths: [],
      improvementAreas: ['Session ended early because proctoring violations were recorded.'],
      hiringRecommendation: 'Not Recommended (Terminated for proctor violations)'
    };
  }

  const answers = session.answers || {};
  const rounds = [
    { label: 'Aptitude', ...roundLabel(session.roundQuestions?.round1, answers) },
    { label: 'Technical', ...roundLabel(session.roundQuestions?.round2, answers) },
    { label: 'HR & Behavioral', ...roundLabel(session.roundQuestions?.round3, answers) }
  ];

  const scores = Object.values(answers)
    .map((entry) => entry?.score)
    .filter((value) => Number.isFinite(value));
  const overallScore = scores.length > 0
    ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10)
    : 0;

  const totalQuestions = ['round1', 'round2', 'round3']
    .flatMap((key) => session.roundQuestions?.[key] || [])
    .length;
  const unanswered = totalQuestions - Object.keys(answers).length;

  const strengths = [];
  const improvementAreas = [];
  for (const round of rounds) {
    if (round.average === null) continue;
    if (round.average >= 8) strengths.push(`${round.label} round: ${round1(round.average)}/10 average across ${round.count} answer(s).`);
    else if (round.average < 6) improvementAreas.push(`${round.label} round: ${round1(round.average)}/10 average — review these topics before reattempting.`);
  }
  if (strengths.length === 0 && rounds.some((round) => round.average !== null)) {
    const best = rounds.filter((round) => round.average !== null).sort((a, b) => b.average - a.average)[0];
    strengths.push(`Highest score in the ${best.label} round (${round1(best.average)}/10 average).`);
  }
  if (unanswered > 0) improvementAreas.push(`No answer recorded for ${unanswered} of ${totalQuestions} questions.`);
  if (scores.length === 0) improvementAreas.push('No answers were recorded, so no performance evidence is available.');
  if (strengths.length === 0 && improvementAreas.length === 0) {
    strengths.push('All recorded answers were submitted.');
  }

  const hiringRecommendation = overallScore >= 80 ? 'Strong Hire'
    : overallScore >= 65 ? 'Recommended'
      : overallScore >= 50 ? 'Borderline'
        : 'Not Recommended';

  return {
    overallScore,
    strengths: strengths.slice(0, 4),
    improvementAreas: improvementAreas.slice(0, 4),
    hiringRecommendation
  };
}

// ---------------------------------------------------------------------------
// Shared task runner: AI when configured, deterministic when unavailable
// ---------------------------------------------------------------------------

/**
 * Run an AI-backed task with a deterministic rule-based fallback.
 *
 * - AI disabled (AI_PROVIDER=none): always the deterministic engine.
 * - AI enabled: the provider layer result wins; only when BOTH providers
 *   failed with eligible availability/generation errors (the provider layer
 *   flags the error with `localFallbackEligible`) is the deterministic engine
 *   used. Validation, credential, and configuration errors still propagate.
 *
 * Every returned object is labelled with its `source`.
 */
export async function runAiTask({ task, enabled, aiCall, buildLocal }) {
  if (!enabled) {
    console.log(`[aiProvider] task=${task} AI disabled; using deterministic rule-based fallback`);
    return { ...buildLocal(), source: RULE_BASED_SOURCE };
  }
  let served = null;
  try {
    const result = await aiCall((provider) => {
      served = provider;
    });
    return { ...result, source: aiSourceLabel(served) };
  } catch (error) {
    if (error && error.localFallbackEligible) {
      console.warn(
        `[aiProvider] task=${task} both providers failed (${error.primaryCode || 'n/a'}/${error.fallbackCode || 'n/a'}); using deterministic rule-based fallback`
      );
      return { ...buildLocal(), source: RULE_BASED_SOURCE };
    }
    throw error;
  }
}
