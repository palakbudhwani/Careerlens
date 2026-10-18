import { generateStructured, isAiEnabled, clipForPrompt } from './aiProvider.js';
import { buildMatchAnalysis, buildInterviewQuestions, buildAnswerEvaluation, runAiTask, RULE_BASED_SOURCE } from './ruleBasedFallback.js';

import './loadEnv.js';

// Prompt input budgets (chars). PDF-extracted text is whitespace-normalized and
// clipped so oversized resumes/JD uploads cannot blow up input-token usage
// against the provider's tokens-per-minute limit. Validation still runs on the
// full raw text in server.js before these limits apply.
const RESUME_CLIP = 14000;
const JD_CLIP = 8000;
const QUESTION_CLIP = 2500;
const ANSWER_CLIP = 6000;

// Task-specific completion-token budgets, sized from each response schema so
// no call requests the full 4096-token allowance. Question budget scales with
// the requested question count. All values are clamped by the provider layer.
//
// match_analysis needs real headroom: the match schema is the largest one
// (summary + gaps + keyword table), and on reasoning/thinking models the
// hidden reasoning tokens share the same budget as the document (Groq gpt-oss
// counts them against max_completion_tokens; Gemini counts them against
// maxOutputTokens). At 2000 the strict Groq output was truncated mid-document
// ("missing required content"). 3000 covers the worst-case document (roughly
// 1300-1700 tokens) plus low-effort reasoning while staying close to the
// previous request size against providers' tokens-per-minute limits.
const TOKEN_LIMITS = {
  match_analysis: 3000,
  answer_evaluation: 800,
  interviewQuestions: (count) => 400 + 320 * count
};

// JSON Schemas in OpenAPI format for Gemini Structured Output
const matchAnalysisSchema = {
  type: "OBJECT",
  properties: {
    matchId: { type: "STRING" },
    atsScore: { type: "INTEGER", description: "Overall ATS compatibility score from 0 to 100." },
    breakdown: {
      type: "OBJECT",
      properties: {
        skillsMatchScore: { type: "INTEGER" },
        experienceScore: { type: "INTEGER" },
        educationScore: { type: "INTEGER" },
        keywordDensityScore: { type: "INTEGER" }
      },
      required: ["skillsMatchScore", "experienceScore", "educationScore", "keywordDensityScore"]
    },
    summary: { type: "STRING", description: "Detailed narrative explaining why the candidate matches and key strengths." },
    matchingSkills: { type: "ARRAY", items: { type: "STRING" } },
    missingSkills: { type: "ARRAY", items: { type: "STRING" } },
    gaps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          description: { type: "STRING" },
          impact: { type: "STRING", description: "High, Medium, or Low" },
          recommendation: { type: "STRING" }
        },
        required: ["category", "description", "impact", "recommendation"]
      }
    },
    atsFeedback: {
      type: "OBJECT",
      properties: {
        formattingNotes: { type: "ARRAY", items: { type: "STRING" } },
        actionVerbsCheck: { type: "STRING" },
        keywordFrequency: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              keyword: { type: "STRING" },
              count: { type: "INTEGER" },
              status: { type: "STRING", description: "Optimal, Present, Missing, or Overused" }
            },
            required: ["keyword", "count", "status"]
          }
        }
      },
      required: ["formattingNotes", "actionVerbsCheck", "keywordFrequency"]
    }
  },
  required: [
    "matchId", "atsScore", "breakdown", "summary", "matchingSkills", 
    "missingSkills", "gaps", "atsFeedback"
  ]
};

const interviewQuestionsSchema = {
  type: "OBJECT",
  properties: {
    resumeBasedQuestions: {
      type: "ARRAY",
      description: "Questions that reference specific projects, coursework, certifications, leadership, or work experience from the resume.",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          type: { type: "STRING", description: "One of: Project-Based, Experience-Based, Coursework-Based, Leadership" },
          question: { type: "STRING", description: "Specific question referencing the resume (max 35 words)." },
          context: { type: "STRING" },
          sampleAnswerOutline: { type: "ARRAY", items: { type: "STRING" }, description: "3-4 bullets, max 12 words each." },
          evalCriteria: { type: "STRING" }
        },
        required: ["id", "type", "question", "context", "sampleAnswerOutline", "evalCriteria"]
      }
    },
    roleBasedQuestions: {
      type: "ARRAY",
      description: "Questions based on the target job role's requirements and gaps against the resume.",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          type: { type: "STRING", description: "One of: Technical, Behavioral, Gap-Addressing" },
          question: { type: "STRING", description: "Job-role based technical, behavioral, or gap question (max 35 words)." },
          context: { type: "STRING" },
          sampleAnswerOutline: { type: "ARRAY", items: { type: "STRING" }, description: "3-4 bullets, max 12 words each." },
          evalCriteria: { type: "STRING" }
        },
        required: ["id", "type", "question", "context", "sampleAnswerOutline", "evalCriteria"]
      }
    }
  },
  required: ["resumeBasedQuestions", "roleBasedQuestions"]
};

// Contract for AI-generated interview questions. fillDefaults guarantees the
// shape, but not the content: a provider can legally return empty lists,
// blank strings, a hollow outline, or the wrong question counts. The previous
// all-or-nothing check discarded a fully successful provider response for any
// single deviation (e.g. one extra role question, or a 2-bullet outline),
// which needlessly sent users to the curated bank. Instead, keep the items
// that honor the content contract, trim each set to the requested count, and
// fall back to the curated bank only when a set would end up empty -- never
// fabricating or relabeling questions as AI-generated.
function sanitizeInterviewQuestions(result, resumeCount, roleCount) {
  const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
  const itemOk = (item) =>
    Boolean(item) &&
    typeof item === 'object' &&
    nonEmpty(item.type) &&
    nonEmpty(item.question) &&
    nonEmpty(item.context) &&
    nonEmpty(item.evalCriteria) &&
    Array.isArray(item.sampleAnswerOutline) &&
    item.sampleAnswerOutline.filter(nonEmpty).length >= 3;
  const sanitizeSet = (list, expected) =>
    Array.isArray(list) ? list.filter(itemOk).slice(0, expected) : [];
  const resumeBasedQuestions = sanitizeSet(result?.resumeBasedQuestions, resumeCount);
  const roleBasedQuestions = sanitizeSet(result?.roleBasedQuestions, roleCount);
  if (resumeBasedQuestions.length === 0 || roleBasedQuestions.length === 0) return null;
  return { resumeBasedQuestions, roleBasedQuestions };
}

const answerEvaluationSchema = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", description: "Score from 0 to 100 based on the quality of the answer relative to the question and criteria." },
    feedback: { type: "STRING", description: "Detailed narrative evaluation feedback." },
    suggested_improvement: { type: "STRING", description: "Tips/suggestions to improve the response." }
  },
  required: ["score", "feedback", "suggested_improvement"]
};

/**
 * Execute structured-output LLM call through the configured AI provider
 * (Gemini by default, Groq as the single fallback). `options.onSource` is
 * forwarded so the caller learns which provider served the result.
 */
async function callLLM(prompt, systemInstruction, schema, options = {}) {
  return generateStructured({
    prompt,
    systemInstruction,
    schema,
    schemaName: options.schemaName || 'response',
    temperature: options.temperature ?? 0.1,
    fillDefaults: options.fillDefaults ?? true,
    maxCompletionTokens: options.maxCompletionTokens,
    onSource: options.onSource
  });
}

/**
 * Parse raw resume text.
 *
 * Resume parsing is deliberately independent of the AI provider: the
 * deterministic, rule-based extraction (extractResumeDetails) always runs on
 * the raw PDF-extracted text, whether or not Groq/Gemini is configured. An
 * upload therefore never spends provider tokens, never fails with a provider
 * rate limit (HTTP 429), and never invents details that are absent from the
 * PDF -- every field is read from the text itself. The response keeps the same
 * schema as before (name, email, skills, workExperience, education plus the
 * optional contact/detail fields, isAuthentic, validationErrors), missing
 * fields stay missing, and the authenticity rules are enforced
 * deterministically (see collectValidationErrors). AI providers remain in use
 * for match analysis, skill gaps, career growth, interview questions,
 * evaluation, and scorecards.
 */
export async function parseResume(resumeText) {
  return extractResumeDetails(resumeText);
}

/**
 * Analyze resume matches against job description
 */
export async function analyzeMatch(resumeText, jobDescription) {
  const systemInstruction = `You are a Senior Technical Recruiter and ATS system.
Analyze the provided resume against the target job description.
Assess compatibility and calculate scores objectively based on these weights:
- Hard skills = 40%
- Experience relevance = 30%
- Keywords/formatting = 20%
- Soft skills = 10%

Identify matchingSkills, missingSkills, gaps, and keywordFrequency from the job requirements. Summarize the match in at most 120 words and list at most 12 keywords and 6 gaps.`;

  const prompt = `=== RESUME TEXT ===
${clipForPrompt(resumeText, RESUME_CLIP)}

=== JOB DESCRIPTION ===
${clipForPrompt(jobDescription, JD_CLIP)}`;

  if (!isAiEnabled()) {
    console.log('AI provider disabled. Computing match analysis with the deterministic rule-based engine.');
  }

  return runAiTask({
    task: 'match_analysis',
    enabled: isAiEnabled(),
    aiCall: (onSource) =>
      callLLM(prompt, systemInstruction, matchAnalysisSchema, {
        schemaName: 'match_analysis',
        temperature: 0.1,
        maxCompletionTokens: TOKEN_LIMITS.match_analysis,
        onSource
      }),
    buildLocal: () => buildMatchAnalysis(resumeText, jobDescription)
  });
}

/**
 * Generate interview questions.
 * `count` is the total number of questions requested (frontend sends 5):
 * split between resume-based and role-based sets. The budget of completion
 * tokens scales with the count so small requests stay small.
 */
export async function generateQuestions(resumeText, jobDescription, difficulty = 'Mid', count = 5) {
  const parsedCount = Number.parseInt(count, 10);
  const total = Math.min(10, Math.max(2, Number.isFinite(parsedCount) ? parsedCount : 5));
  const resumeCount = Math.ceil(total / 2);
  const roleCount = total - resumeCount;

  const systemInstruction = `You are a Senior Technical Interviewer.
Generate exactly ${resumeCount} resume-based questions and exactly ${roleCount} role-based questions at the "${difficulty}" difficulty level.
resumeBasedQuestions must reference specific projects, experience, coursework, certifications, or leadership from the resume; cover different parts of the resume and do not repeat phrasing or template patterns.
roleBasedQuestions must cover the target job role's core technical skills, behavioral scenarios, and gaps between the resume and the job requirements; do not repeat template patterns.
Every question needs: id, type, question (max 35 words), context (max 25 words), sampleAnswerOutline (3-4 bullets, max 12 words each), and evalCriteria (max 25 words).`;

  const prompt = `=== RESUME TEXT ===
${clipForPrompt(resumeText, RESUME_CLIP)}

=== JOB DESCRIPTION ===
${clipForPrompt(jobDescription, JD_CLIP)}`;

  if (!isAiEnabled()) {
    console.log('AI provider disabled. Generating interview questions with the deterministic rule-based engine.');
  }

  const result = await runAiTask({
    task: 'interview_questions',
    enabled: isAiEnabled(),
    aiCall: (onSource) =>
      callLLM(prompt, systemInstruction, interviewQuestionsSchema, {
        schemaName: 'interview_questions',
        temperature: 0.1,
        maxCompletionTokens: TOKEN_LIMITS.interviewQuestions(total),
        onSource
      }),
    buildLocal: () => buildInterviewQuestions({ resumeText, jobDescription, difficulty, total })
  });

  const sanitized = sanitizeInterviewQuestions(result, resumeCount, roleCount);
  if (!sanitized) {
    console.warn(
      `[llm] interview_questions AI output had no usable questions in at least one set (resume=${result?.resumeBasedQuestions?.length ?? 'n/a'}/${resumeCount}, role=${result?.roleBasedQuestions?.length ?? 'n/a'}/${roleCount}); answering from the curated question bank.`
    );
    return {
      ...buildInterviewQuestions({ resumeText, jobDescription, difficulty, total }),
      source: RULE_BASED_SOURCE
    };
  }

  if (
    sanitized.resumeBasedQuestions.length !== resumeCount ||
    sanitized.roleBasedQuestions.length !== roleCount
  ) {
    console.log(
      `[llm] interview_questions kept ${sanitized.resumeBasedQuestions.length}/${resumeCount} resume-based and ${sanitized.roleBasedQuestions.length}/${roleCount} role-based AI questions after contract filtering`
    );
  }

  return { ...result, ...sanitized };
}

/**
 * Evaluate answer
 */
export async function evaluateAnswer(question, answer) {
  const systemInstruction = `You are a Tech Interview Evaluator.
Given an interview question and the candidate's answer, provide an objective score from 0 to 100, concise but specific feedback (max 150 words), and concrete suggestions to improve the response (max 80 words).`;

  const prompt = `=== INTERVIEW QUESTION ===
${clipForPrompt(question, QUESTION_CLIP)}

=== CANDIDATE ANSWER ===
${clipForPrompt(answer, ANSWER_CLIP)}`;

  if (!isAiEnabled()) {
    console.log('AI provider disabled. Evaluating the answer with the deterministic rubric.');
  }

  return runAiTask({
    task: 'answer_evaluation',
    enabled: isAiEnabled(),
    aiCall: (onSource) =>
      callLLM(prompt, systemInstruction, answerEvaluationSchema, {
        schemaName: 'answer_evaluation',
        temperature: 0.1,
        maxCompletionTokens: TOKEN_LIMITS.answer_evaluation,
        onSource
      }),
    buildLocal: () => buildAnswerEvaluation({ question, answer })
  });
}

// ---------------------------------------------------------------------------
// Deterministic resume parsing
// ---------------------------------------------------------------------------
// Rule-based extraction that reads real details out of the uploaded resume text
// itself. Used when the LLM is unavailable or fails so every resume yields its
// own personalized profile -- nothing below is a hard-coded fallback candidate.

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]*)?(?:\(\d{2,4}\)[\s.-]*)?\d{3}[\s.-]*\d{3}[\s.-]*\d{4}(?:\s*(?:x|ext)[.\s]*\d{1,5})?/i;
const LINKEDIN_RE = /(?:linkedin\.com\/in\/|github\.com\/)[\w-]+/i;
const YEAR_RE = /(?:19|20)\d{2}/;
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
// Numeric month form ("06/2020") seen in many corporate resumes.
const MONTH_NUM = '(?:(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2})';
const DATE_TOKEN = `(?:${MONTH}\\.?\\s*\\d{4}|${MONTH_NUM}|(?:19|20)\\d{2})`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|\u2013|\u2014|to)\\s*(${MONTH}\\.?\\s*\\d{4}|${MONTH_NUM}|present|now|current|ongoing|(?:19|20)\\d{2})`, 'i');

// PHONE_RE covers the common grouped formats. findPhone adds a candidate scan
// for international/oddly grouped numbers ("+91 90000 12345", "020 7946 0958")
// while rejecting digit runs that are only four-digit years.
function findPhone(text) {
  const source = String(text || '');
  const direct = source.match(PHONE_RE);
  if (direct) return direct[0];
  const candidates = source.match(/\+?[\d(][\d\s.()-]{5,26}\d/g) || [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) continue;
    const groups = trimmed.split(/[\s.()+-]+/).filter(Boolean);
    if (groups.length > 0 && groups.every((g) => /^(?:19|20)\d{2}$/.test(g))) continue;
    if (digits.length === 8 && /^(?:19|20)\d{2}(?:19|20)\d{2}$/.test(digits)) continue;
    const hasSeparator = /[\s()-]/.test(trimmed.replace(/^\+?\d+/, ''));
    if (!hasSeparator && digits.length < 10) continue;
    return trimmed;
  }
  return undefined;
}

const LIGATURES = {
  '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl',
  '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st',
};

// Normalizes extracted PDF text before deterministic parsing: removes
// invisible characters, expands ligatures, unifies dashes/bullets, and maps
// full-width punctuation so regexes only ever see ASCII plus \u2022.
function normalizeForParsing(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00AD/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\uFB00-\uFB06]/g, (c) => LIGATURES[c] || c)
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\uFF1A]/g, ':')
    .replace(/[\uFF0C\u3001]/g, ',')
    .replace(/[\uFF08]/g, '(')
    .replace(/[\uFF09]/g, ')')
    .replace(/[\u00B7\u2022\u25E6\u25AA\u2023\u25CF\u25A0\u25AB\u25CB\u2043\u2219]/g, '\u2022');
}

const SECTION_KEYWORDS = [
  'summary', 'objective', 'profile', 'about', 'personal statement',
  'skills', 'technical skills', 'core competencies', 'competencies', 'technologies', 'tech stack',
  'experience', 'work experience', 'work history', 'professional experience', 'employment', 'employment history', 'career history',
  'education', 'academics', 'educational background', 'academic background',
  'projects', 'project work', 'academic projects', 'professional projects', 'personal projects',
  'certifications', 'certificates', 'licenses',
  'extracurricular', 'leadership', 'achievements', 'interests', 'languages',
  'additional information', 'additional details', 'references', 'publications', 'awards',
];

function cleanLine(line) {
  return String(line || '').replace(/^[\s\u2022\u00b7*\-\u2013\u2014]+|[\s\u2022\u00b7*]+$/g, '').trim();
}

function headerKey(line) {
  return cleanLine(line).replace(/[:;]+$/, '').toLowerCase();
}

function isSectionHeader(line) {
  const key = headerKey(line);
  if (!key || key.length > 32) return false;
  const words = key.split(/\s+/);
  if (words.length > 4) return false;
  return SECTION_KEYWORDS.some((kw) =>
    key === kw ||
    // "skills:", "skills / certifications", "experience - 2020", …
    (key.startsWith(kw) && !/[a-z0-9]/.test(key[kw.length] || '')) ||
    // "Professional Experience", "My Skills" — keyword as the final word.
    (words[words.length - 1] === kw && !/^\d/.test(key))
  );
}

function isShoutedHeader(line) {
  return /[A-Za-z]/.test(line) && /^[A-Z][A-Z\s&+.-]{2,}$/.test(line.trim());
}

function splitIntoBlocks(lines) {
  const blocks = [];
  let current = null;
  let lastLineWasBlank = true;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      lastLineWasBlank = true;
      continue;
    }
    const isHeader = isSectionHeader(line) && (lastLineWasBlank || isShoutedHeader(line) || /[:;]$/.test(line));
    if (isHeader) {
      current = { key: headerKey(line), lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
    lastLineWasBlank = false;
  }
  return blocks;
}

function isLocationText(text) {
  const t = text.trim();
  if (t.length < 4 || t.length > 45) return false;
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  const words = t.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 3) return false;
  if (parts.some((p) => !/^[A-Za-z][A-Za-z.'-]*$/.test(p))) return false;
  return true;
}

function extractTopLines(lines) {
  const top = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (isSectionHeader(line)) break;
    top.push(cleanLine(line));
    if (top.length >= 8) break;
  }
  return top;
}

function detectName(topLines) {
  for (const line of topLines) {
    if (!line || line.length > 60) continue;
    if (/\d/.test(line)) continue;
    if (/@/.test(line) || findPhone(line)) continue;
    if (isLocationText(line)) continue;
    if (isSectionHeader(line)) continue;
    const lower = line.toLowerCase().replace(/^['"]+|['"]+$/g, '');
    if (['resume', 'cv', 'curriculum vitae', 'curriculum', 'r\u00e9sum\u00e9'].includes(lower)) continue;
    if (!/[A-Z]/.test(line)) continue;
    // Header lines like "NAME - Software Engineer": the name is the part
    // before the spaced dash (the title is picked up by detectHeadline).
    let candidate = line;
    const dashIdx = line.indexOf(' - ');
    if (dashIdx > 0) {
      const left = line.slice(0, dashIdx).trim();
      if (left.split(/\s+/).length >= 2) candidate = left;
    }
    if (!candidate) continue;
    const words = candidate.split(/\s+/);
    if (words.length < 1 || words.length > 6) continue;
    return candidate;
  }
  return '';
}

function detectHeadline(topLines, name) {
  let start = 0;
  if (name) {
    const idx = topLines.indexOf(name);
    if (idx >= 0) start = idx + 1;
    // detectName may have split "NAME - Title" down to NAME; the full line
    // still sits at the top, so skip past it rather than echoing it back.
    else if (topLines[0]?.startsWith(name)) start = 1;
  }
  for (let i = start; i < topLines.length; i++) {
    const line = topLines[i];
    if (!line) continue;
    if (isSectionHeader(line)) break;
    if (line.length > 80) continue;
    if (isLocationText(line)) continue;
    if (/@/.test(line) || findPhone(line)) continue;
    if (/^(email|phone|mobile|tel|address|location|city|country|postcode|pincode|zip|linkedin|github|portfolio|website|contact|www|http)[\s:]|\.(com|in|dev|org|net)\b/i.test(line)) continue;
    if (/^(skills|education|experience|projects|summary|objective|profile|about)[\s:]|^[0-9]+$/i.test(line.toLowerCase())) continue;
    if (line === name) continue;
    return line;
  }
  return '';
}

function detectLocation(topLines) {
  for (const line of topLines) {
    if (!EMAIL_RE.test(line) && !findPhone(line)) continue;
    const tokens = line.split(/[|\u2022\u00b7/]+/).map((s) => s.trim()).filter(Boolean);
    for (const token of tokens) {
      const t = token.replace(/^[\s:;]+|[\s,;]+$/g, '');
      if (isLocationText(t)) return t;
    }
  }
  for (const line of topLines) {
    if (line.length > 45) continue;
    const t = line.replace(/^[\s:;]+|[\s,;]+$/g, '');
    if (isLocationText(t)) return t;
  }
  const remote = topLines.find((l) => /^(remote|hybrid|on-?site|onsite)$/i.test(l.trim()));
  return remote ? remote.trim() : '';
}

const SKILL_TOKEN_RE = /^[A-Za-z][A-Za-z0-9+#./& ()'-]{1,45}$/;

const ACTION_VERB_RE = /^(developed|build?|built|led|manage|design|implement|creat|work|improve|collaborat|ship|optimiz|migrat|reduc|introduc|mentor|drive|write|test|maintain|support|monitor|coord|assist|participat|deliver|resolv|handl|launch|scale|automate|engineer|perform|review|refactor|present|learn|tutor|contribut|prototyp|architect|configure|integrat|deploy|train|model|analy|document|own|lead)/i;

function isPlausibleSkillToken(token) {
  if (token.length < 2 || token.length > 46 || !SKILL_TOKEN_RE.test(token)) return false;
  if (ACTION_VERB_RE.test(token.trim())) return false;
  return true;
}

// Joins list lines that the PDF wrapped mid-item: a line that does not end
// with a separator and is followed by a lowercase-starting line is one item
// split across two lines ("... Gemini API, prompt" + "engineering, ...").
function mergeWrappedLines(lines) {
  const merged = [];
  for (const line of lines) {
    const prev = merged[merged.length - 1];
    if (prev && !/[,;&/|\u2022:)\]-]$/.test(prev) && /^[a-z]/.test(line)) {
      merged[merged.length - 1] = `${prev} ${line}`;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

function extractSkills(lines, blocks, opts = {}) {
  const collected = [];
  const skillsBlock = blocks.find((b) => /^skills?|technical skills|core|competenc|technolog|tech stack/i.test(b.key));
  if (skillsBlock) collected.push(...mergeWrappedLines(skillsBlock.lines));
  for (const line of lines) {
    if (/^skills?\s*[:\uFF1A]/i.test(line.trim())) {
      collected.push(line.replace(/^skills?\s*[:\uFF1A]/i, '').trim());
    } else if (/^[\u2022\u00b7*\-\u2013\u2014]\s*[A-Za-z]/.test(line.trim())) {
      const token = cleanLine(line).replace(/^[\u2022\u00b7*\-\u2013\u2014]\s*/, '').trim();
      if (isPlausibleSkillToken(token) && token.split(/\s+/).length <= 4) collected.push(token);
    }
  }
  if (collected.length === 0 && Array.isArray(opts.top)) {
    const excludes = (opts.exclude || []).map((s) => s.toLowerCase());
    for (const line of opts.top) {
      const token = cleanLine(line).replace(/^[\u2022\u00b7*\-\u2013\u2014]\s*/, '').trim();
      if (!token) continue;
      if (EMAIL_RE.test(token) || findPhone(token)) continue;
      if (isLocationText(token)) continue;
      if (excludes.includes(token.toLowerCase())) continue;
      if (token.split(/\s+/).length > 4) continue;
      if (!isPlausibleSkillToken(token)) continue;
      collected.push(token);
    }
  }
  if (collected.length === 0) return [];
  const skills = [];
  for (const raw of collected) {
    const line = cleanLine(raw);
    if (!line) continue;
    const parts = line.split(/[,;\u2022\u00b7/|]+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const token = part.replace(/^[\d.]+\)?\s*/i, '').trim();
      if (isPlausibleSkillToken(token)) skills.push(token);
    }
  }
  const seen = new Set();
  const unique = [];
  for (const skill of skills) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(skill);
    }
  }
  return unique.slice(0, 80);
}

function parseEntryHeader(header) {
  const result = { role: '', company: '', location: '' };
  let rest = header.replace(/^[|\u2022\u00b7/:,\s-]+|[|\u2022\u00b7/:\s,-]+$/g, '').trim();
  const segments = rest.split('|').map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (!result.location && isLocationText(seg)) {
      result.location = seg;
      continue;
    }
    if (!result.role) {
      // Split "Role at Company" / "Role - Company" inside the first segment
      // so a later short segment ("Mumbai") is recognized as location.
      const at = seg.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
      const dash = at ? null : seg.match(/^(.*?)\s*-\s+(.+)$/);
      if (at) {
        result.role = at[1].trim();
        result.company = at[2].trim();
      } else if (dash && dash[1].trim() && dash[2].trim()) {
        result.role = dash[1].trim();
        result.company = dash[2].trim();
      } else {
        result.role = seg;
      }
      continue;
    }
    if (!result.company) {
      result.company = seg;
      continue;
    }
    if (!result.location && seg.length <= 30 && seg.split(/\s+/).length <= 3 && /^[A-Za-z][A-Za-z .'-]*$/.test(seg)) {
      result.location = seg;
      continue;
    }
  }
  if (result.role && !result.company) {
    const at = result.role.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (at) {
      result.role = at[1].trim();
      result.company = at[2].trim();
    } else {
      const dash = result.role.match(/^(.*?)\s*(?:\u2014|\u2013|-)\s*(.+)$/);
      if (dash) {
        result.role = dash[1].trim();
        result.company = dash[2].trim();
      }
    }
  }
  result.role = result.role.replace(/[({]+$/g, '').trim();
  return result;
}

function looksLikeMeta(line) {
  if (/@/.test(line) || findPhone(line)) return true;
  if (isLocationText(line)) return true;
  if (isSectionHeader(line)) return true;
  return false;
}

function extractExperience(blocks) {
  const expBlock = blocks.find((b) => /experience|employment|career|work history/.test(b.key));
  if (!expBlock) return [];
  const entries = [];
  let current = null;
  let pendingTitle = '';

  const commitNoDateEntry = (role) => {
    entries.push({ role, company: '', location: '', start: '', end: null, highlights: [] });
  };

  for (const raw of expBlock.lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    const isBullet = /^[\u2022\u00b7*\-\u2013\u2014]|^\d+[.)]\s/.test(raw);
    const stripped = line.replace(/^[\u2022\u00b7*\-\u2013\u2014]\s*/, '');

    if (DATE_RANGE_RE.test(line)) {
      const m = line.match(DATE_RANGE_RE);
      const header = line.replace(DATE_RANGE_RE, '').replace(/[|\u2022\u00b7/]\s*$/, '').trim();
      const meta = parseEntryHeader(header);
      current = {
        role: meta.role || pendingTitle,
        company: meta.company || '',
        location: meta.location || '',
        start: m[1].trim(),
        end: /^(present|now|current|ongoing)$/i.test(m[2]) ? 'Present' : m[2].trim(),
        highlights: [],
      };
      pendingTitle = '';
      entries.push(current);
      continue;
    }

    if (isBullet) {
      if (!current) commitNoDateEntry(pendingTitle || 'Professional');
      if (current) {
        const point = stripped;
        if (point && point.length <= 200) current.highlights.push(point);
      }
      continue;
    }

    if (looksLikeMeta(line)) continue;

    // Many resumes list responsibilities as plain lines with no bullet
    // marker. After a dated entry, a sentence-like line (long, lowercase
    // continuation, or ending in a period) is a description — not a new
    // title — so it must not spawn a bogus entry.
    if (current && current.start && !pendingTitle) {
      const looksLikeDescription = line.length >= 40 || /^[a-z]/.test(line) || /[.!?]$/.test(line);
      if (looksLikeDescription) {
        if (stripped.length <= 200) current.highlights.push(stripped);
        continue;
      }
    }

    // A header-ish (non-bullet) line: a role title or a company line.
    if (pendingTitle) {
      const orgHint = /(inc|labs|corp|co\.?|technolog|systems|solutions|studios|university|college|institute|academy|llc|pvt|private|ltd|limited|technologies?|services?)$/i.test(line);
      if (orgHint && !current) {
        entries.push({ role: pendingTitle, company: line, location: '', start: '', end: null, highlights: [] });
        pendingTitle = '';
        continue;
      }
      if (!current) commitNoDateEntry(pendingTitle);
      else if (current.highlights.length === 0 && !current.start) {
        commitNoDateEntry(pendingTitle);
      }
      pendingTitle = line;
      continue;
    }
    pendingTitle = line;
  }

  if (pendingTitle) {
    if (!current) commitNoDateEntry(pendingTitle);
    else if (!current.start && current.highlights.length === 0) {
      current.role = pendingTitle;
    } else {
      commitNoDateEntry(pendingTitle);
    }
  }

  entries.forEach((entry) => {
    if (!entry.location) {
      const loc = [entry.role, ...entry.highlights].join(' ');
      const found = loc.split(/[|\u2022\u00b7/]+/).map((s) => s.trim()).find((s) => isLocationText(s));
      if (found) entry.location = found;
    }
    entry.highlights = entry.highlights.slice(0, 10);
    if (!entry.role) entry.role = 'Professional';
  });

  return entries.filter((e) => e.role.length > 0);
}

const DEGREE_RE = /\b(bachelor(?:'s)?|master(?:'s)?|doctor(?:al)?|b\.?s\.?c\.?|m\.?s\.?c\.?|b\.?e\.?|b\.?tech\.?|m\.?tech\.?|b\.?s\.?|m\.?s\.?|m\.?b\.?a\.?|ph\.?d\.?|b\.?c\.?a\.?|m\.?c\.?a\.?|b\.?com\.?|m\.?com\.?|diploma|associate|high school|secondary school|higher secondary|intermediate|b\.?a\.?|m\.?a\.?)\b/i;

function extractEducation(blocks) {
  const eduBlock = blocks.find((b) => /educat|academic/.test(b.key));
  if (!eduBlock) return [];
  const entries = [];
  let current = null;
  for (const raw of eduBlock.lines) {
    const line = cleanLine(raw).replace(/^[\u2022\u00b7*\-\u2013\u2014]\s*/, '');
    if (!line) continue;
    if (DEGREE_RE.test(line)) {
      current = { degree: '', institution: '', year: '', field: '' };
      entries.push(current);
    }
    if (!current) continue;
    let rest = line;
    // Graduation year: the LAST year on the line ("2018 – 2022" -> 2022).
    if (!current.year) {
      const years = rest.match(/(?:19|20)\d{2}/g);
      if (years) current.year = years[years.length - 1];
    }
    // Drop "(2015)"-style year parens before the field scan so a bare year is
    // never mistaken for the field of study.
    rest = rest.replace(/\s*\(\s*\d{4}\s*\)\s*/, ' ');
    const fieldMatch = rest.match(/\(([^)]{2,80})\)/);
    if (fieldMatch && !current.field) current.field = fieldMatch[1];
    if (!current.degree && DEGREE_RE.test(rest)) {
      const instMatch = rest.match(/^(.*?)\s*(?:[,|]|\s+at\s+|\s+from\s+|-|\u2014|\u2013)\s+(.*)$/i);
      if (instMatch && instMatch[1].trim() && instMatch[2].trim()) {
        current.degree = instMatch[1].trim();
        if (!current.institution) current.institution = instMatch[2].trim();
      } else {
        current.degree = rest.trim();
      }
    } else if (!current.institution) {
      const head = rest.split('|')[0];
      const stripped = head.replace(/(?:19|20)\d{2}/g, ' ').replace(/[,\s]+$/g, '').trim();
      const looksUseful = stripped
        && !/^[\s.,;/|-]+$/.test(stripped)
        && !/gpa\b/i.test(stripped)
        && !isLocationText(stripped);
      if (looksUseful) current.institution = stripped;
    }
    if (current.institution) {
      // "University of Mumbai | 2018 - 2022 | CGPA 8.4/10" -> "University of Mumbai"
      current.institution = current.institution.split('|')[0]
        .replace(/\s*\b(?:19|20)\d{2}\b[\s\S]*$/, '')
        .replace(/[\s,;/|-]+$/g, '').trim();
    }
    if (current.degree) {
      current.degree = current.degree.split('|')[0]
        .replace(/\s*\b(?:19|20)\d{2}\b[\s\S]*$/, '')
        .replace(/[\s,;|-]+$/g, '').trim();
    }
  }
  return entries.filter((e) => e.degree || e.institution).slice(0, 6);
}

function extractProjects(blocks) {
  const projBlock = blocks.find((b) => /projects?|project work/i.test(b.key));
  if (!projBlock) return [];
  const projects = [];
  let current = null;
  for (const raw of projBlock.lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    const isBullet = /^[\u2022\u00b7*\-\u2013\u2014]/.test(raw);
    const text = line.replace(/^[\u2022\u00b7*\-\u2013\u2014]\s*/, '').trim();
    if (isBullet) {
      if (current) current.description = current.description ? `${current.description} ${text}` : text;
      continue;
    }
    if (current) projects.push(current);
    current = { name: text, description: '', technologies: [] };
  }
  if (current) projects.push(current);
  for (const p of projects) {
    const techMatch = `${p.name} ${p.description}`.match(/[Tt]echnologies?\s*[:\uFF1A]\s*([^\n.]{1,120})/);
    if (techMatch) {
      p.technologies = techMatch[1].split(/[,;\u2022\u00b7/]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
    }
  }
  return projects.slice(0, 10).filter((p) => p.name && p.name.length > 1);
}

function extractCertifications(blocks) {
  const certBlock = blocks.find((b) => /^certif|licenses?/i.test(b.key));
  if (!certBlock) return [];
  const certs = [];
  for (const raw of certBlock.lines) {
    const line = cleanLine(raw).replace(/^[\u2022\u00b7*\-\u2013\u2014]\s*/, '');
    if (!line || line.length > 120) continue;
    const yearMatch = line.match(YEAR_RE);
    const cert = { name: line, issuer: undefined, year: undefined };
    if (yearMatch) {
      cert.year = yearMatch[0];
      cert.name = line.replace(yearMatch[0], '').replace(/[,\s-]+$/g, '').trim();
    }
    certs.push(cert);
  }
  return certs.slice(0, 10).filter((c) => c.name && c.name.length > 1);
}

function extractSummary(blocks) {
  const sumBlock = blocks.find((b) => /^(summary|objective|profile|about|personal statement)\b|(summary|objective|profile|about)$/i.test(b.key));
  if (sumBlock) {
    const text = sumBlock.lines.map(cleanLine).filter(Boolean).join(' ');
    if (text) return text.slice(0, 600);
  }
  return '';
}

// --- Deterministic authenticity validation -------------------------------
// The same rules the resume-parse system prompt used to enforce (placeholder
// templates, unrelated/lorem-ipsum content, extreme keyword stuffing, and
// impossible timelines), implemented in plain JavaScript so isAuthentic and
// validationErrors keep their meaning without any AI provider request.

const PLACEHOLDER_NAME_RE = /\b(?:john doe|jane doe|your name)\b/i;
const BRACKET_PLACEHOLDER_RE = /\[\s*(?:insert\b|your\b|company name\b|(?:name|email|phone|address|company|degree|title)\s*\])/i;
const LOREM_IPSUM_RE = /\blorem ipsum\b|\bdolor sit amet\b/i;
const RESUME_SECTION_RE = /\b(?:skills?|technical skills|experience|work experience|employment|education|summary|objective|projects?|certifications?)\b/i;
const YEAR_IN_TEXT_RE = /(?:19|20)\d{2}/;
const KEYWORD_STUFFING_THRESHOLD = 40;
const STUFFING_STOP_WORDS = new Set(
  ('the and for with that this from are was were have has had will would can could you your our their its not but all any ' +
    'who what when where how why which while into over under than then they been being more most some such only also just about ' +
    'across after before between during through within without per via using use used may might shall should must does did ' +
    'make made need needs want well much many each both few other another here there out get give take come new one two first ' +
    'last own same way even still yet quite rather too enough almost always never often sometimes once again further until ' +
    'above below down off said says like work works worked team teams project projects').split(' ')
);

function looksLikeResume(text) {
  if (EMAIL_RE.test(text) || findPhone(text) || LINKEDIN_RE.test(text)) return true;
  if (DEGREE_RE.test(text)) return true;
  // Section headings plus at least one year are a strong resume signal.
  if (RESUME_SECTION_RE.test(text) && YEAR_IN_TEXT_RE.test(text)) return true;
  return false;
}

function hasExtremeKeywordStuffing(text) {
  const words = String(text).toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || [];
  const counts = new Map();
  for (const word of words) {
    if (STUFFING_STOP_WORDS.has(word)) continue;
    const next = (counts.get(word) || 0) + 1;
    if (next >= KEYWORD_STUFFING_THRESHOLD) return true;
    counts.set(word, next);
  }
  return false;
}

function hasImpossibleTimeline(workExperience) {
  for (const entry of workExperience) {
    const start = String(entry.start || '').match(YEAR_IN_TEXT_RE);
    const endRaw = String(entry.end || '');
    if (!endRaw || /^(?:present|now|current|ongoing)$/i.test(endRaw)) continue;
    const end = endRaw.match(YEAR_IN_TEXT_RE);
    if (start && end && Number(end[0]) < Number(start[0])) return true;
  }
  return false;
}

function collectValidationErrors(text, details) {
  const errors = [];
  const add = (message) => {
    if (!errors.includes(message)) errors.push(message);
  };

  if (!text || typeof text !== 'string' || text.trim().length < 150) {
    add('Document text content is empty or too short to be a valid resume.');
    return errors;
  }
  if (LOREM_IPSUM_RE.test(text) || !looksLikeResume(text)) {
    add('Unrelated text content / placeholder detected');
  }
  if (PLACEHOLDER_NAME_RE.test(text) || PLACEHOLDER_NAME_RE.test(details.name || '')) {
    add('Placeholder template contents detected');
  }
  if (BRACKET_PLACEHOLDER_RE.test(text)) {
    add('Placeholder template contents detected');
  }
  if (hasExtremeKeywordStuffing(text)) {
    add('Extreme keyword stuffing detected');
  }
  if (hasImpossibleTimeline(details.workExperience || [])) {
    add('Impossible timeline anomaly');
  }
  return errors;
}

function extractResumeDetails(text) {
  const empty = {
    name: '',
    email: '',
    skills: [],
    workExperience: [],
    education: [],
    phone: undefined,
    location: undefined,
    summary: undefined,
    headline: undefined,
    linkedin: undefined,
    portfolio: undefined,
    projects: [],
    certifications: [],
    isAuthentic: true,
    validationErrors: [],
  };
  if (typeof text !== 'string' || !text || text.trim().length < 150) {
    return {
      ...empty,
      isAuthentic: false,
      validationErrors: ['Document text content is empty or too short to be a valid resume.']
    };
  }
  text = normalizeForParsing(text);
  if (text.trim().length < 150) {
    return {
      ...empty,
      isAuthentic: false,
      validationErrors: ['Document text content is empty or too short to be a valid resume.']
    };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const wholeText = nonEmpty.join(' ');
  const top = extractTopLines(lines);
  const blocks = splitIntoBlocks(lines);

  const name = detectName(top);
  const location = detectLocation(top);
  const headline = detectHeadline(top, name);
  const details = {
    ...empty,
    name,
    email: (wholeText.match(EMAIL_RE) || [])[0] || '',
    skills: extractSkills(nonEmpty, blocks, {
      top,
      exclude: [name, headline, location].filter(Boolean),
    }),
    workExperience: extractExperience(blocks),
    education: extractEducation(blocks),
  };

  const phone = findPhone(wholeText);
  if (phone) details.phone = phone;
  const linkedin = wholeText.match(LINKEDIN_RE);
  if (linkedin) details.linkedin = linkedin[0];
  if (location) details.location = location;
  if (headline) details.headline = headline;
  const summary = extractSummary(blocks);
  if (summary) details.summary = summary;
  const projects = extractProjects(blocks);
  if (projects.length) details.projects = projects;
  const certifications = extractCertifications(blocks);
  if (certifications.length) details.certifications = certifications;

  const validationErrors = collectValidationErrors(text, details);
  details.isAuthentic = validationErrors.length === 0;
  details.validationErrors = validationErrors;

  return details;
}
