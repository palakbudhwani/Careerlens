import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('Gemini API initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Gemini API client:', error);
  }
} else {
  console.warn(
    'WARNING: GEMINI_API_KEY is not defined in the environment. Using mockup fallback mode.'
  );
}

// Model configuration
const DEFAULT_MODEL = 'gemini-flash-latest';

// JSON Schemas in OpenAPI format for Gemini Structured Output
const resumeParserSchema = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    email: { type: "STRING" },
    skills: { type: "ARRAY", items: { type: "STRING" } },
    workExperience: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          role: { type: "STRING" },
          company: { type: "STRING" },
          location: { type: "STRING" },
          start: { type: "STRING", description: "Start date (e.g. Month Year or Year)" },
          end: { type: "STRING", description: "End date (e.g. Month Year, 'Present' or null). Put null if not present." },
          highlights: { type: "ARRAY", items: { type: "STRING" }, description: "Key projects, achievements, and tasks completed in this role." }
        },
        required: ["role", "company", "location", "start", "end", "highlights"]
      }
    },
    education: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          degree: { type: "STRING" },
          institution: { type: "STRING" },
          year: { type: "STRING" },
          field: { type: "STRING" }
        },
        required: ["degree", "institution", "year"]
      }
    },
    isAuthentic: {
      type: "BOOLEAN",
      description: "Set to false if the resume text is identified as fake, dummy template placeholder text, a book page, cooking recipe, contains impossible work timelines (e.g. 20 years of experience in React), or has extreme keyword stuffing meant to fool ATS. Otherwise set to true."
    },
    validationErrors: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "List of reasons explaining why the resume failed verification (e.g., 'Overlapping timeline anomaly', 'Generated template placeholder', 'Unrelated text content'). Leave empty if authentic."
    }
  },
  required: ["name", "email", "skills", "workExperience", "education", "isAuthentic", "validationErrors"]
};

const matchAnalysisSchema = {
  type: "OBJECT",
  properties: {
    matchId: { type: "STRING" },
    atsScore: { type: "INTEGER", description: "Overall ATS compatibility, calculated objectively as: Hard skills = 40%, Experience relevance = 30%, Keywords/formatting = 20%, Soft skills = 10%." },
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
      description: "Questions directly tailored to the candidate's resume, referencing specific projects (e.g. 'AI Tutor', 'TransitOps', 'GoRizz'), coursework (e.g. 'Data Structures & Algorithms', 'DBMS'), leadership roles, or work experience bullet points. You MUST pinpoint these specific achievements in the question text.",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          type: { type: "STRING", description: "Must be one of: Project-Based, Experience-Based, Coursework-Based, Leadership" },
          question: { type: "STRING", description: "High-quality, specific question referencing a project, experience, or coursework. E.g., 'In your AI Tutor project, you integrated the Gemini API...'" },
          context: { type: "STRING" },
          sampleAnswerOutline: { type: "ARRAY", items: { type: "STRING" } },
          evalCriteria: { type: "STRING" }
        },
        required: ["id", "type", "question", "context", "sampleAnswerOutline", "evalCriteria"]
      }
    },
    roleBasedQuestions: {
      type: "ARRAY",
      description: "Questions based on the target job role's general requirements and alignment with candidate gaps.",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          type: { type: "STRING", description: "Must be one of: Technical, Behavioral, Gap-Addressing" },
          question: { type: "STRING", description: "General job-role based technical, behavioral, or gap question." },
          context: { type: "STRING" },
          sampleAnswerOutline: { type: "ARRAY", items: { type: "STRING" } },
          evalCriteria: { type: "STRING" }
        },
        required: ["id", "type", "question", "context", "sampleAnswerOutline", "evalCriteria"]
      }
    }
  },
  required: ["resumeBasedQuestions", "roleBasedQuestions"]
};

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
 * Execute LLM call with structured output schema constraint
 */
async function callLLM(prompt, systemInstruction, schema) {
  if (!ai) {
    throw new Error('LLM client not initialized (GEMINI_API_KEY missing)');
  }

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.1 // lower temperature for highly deterministic/structured outputs
    }
  });

  return JSON.parse(response.text);
}

/**
 * Parse raw resume text.
 *
 * Always derives the profile from the uploaded resume itself. A deterministic,
 * rule-based extraction (extractResumeDetails) runs on the raw resume text and
 * is used directly when no LLM is available or it fails — never a hard-coded
 * placeholder profile. When an LLM is available, its (more accurate) core
 * fields override the rule-based ones and the rule-based pass fills the extra
 * fields the LLM schema does not return (phone, location, headline, summary,
 * projects, certifications).
 */
export async function parseResume(resumeText) {
  const systemInstruction = `You are a resume parsing AI. Extract structured details from the resume text into the requested JSON schema. 
Be highly accurate, do not invent details, and structure the work experience highlights as bullet-point lists.

CRITICAL SECURITY AND AUTHENTICITY VALIDATION:
You must critically evaluate the authenticity of the text:
1. If the text is NOT a resume (e.g. it is a cooking recipe, song lyrics, random character dump, textbook page, dummy lorem ipsum template, or empty placeholder text), set "isAuthentic" to false and add "Unrelated text content / placeholder detected" to "validationErrors".
2. If the resume contains impossible timeline anomalies (e.g. listing 10 years of experience in React when React was released in 2013, or working full-time jobs at the same time in completely different cities), set "isAuthentic" to false and add "Impossible timeline anomaly" to "validationErrors".
3. If the resume contains extreme keyword stuffing (e.g. lists of the exact same skill repeated dozens of times to trick ATS search), set "isAuthentic" to false and add "Extreme keyword stuffing detected" to "validationErrors".
4. If the resume uses standard placeholder/dummy names (such as "John Doe", "Jane Doe", "Your Name", "[Your Name]"), or contains bracketed placeholders like "[Company Name]", "[Insert Degree]", or "[Your Email Here]", set "isAuthentic" to false and add "Placeholder template contents detected" to "validationErrors".

If none of these issues are present, set "isAuthentic" to true and keep "validationErrors" empty.`;
  const prompt = `Please parse the following resume text:\n\n${resumeText}`;

  const ruleParsed = extractResumeDetails(resumeText);

  if (!ai) {
    console.log('No LLM client. Using deterministic parsing of the resume text.');
    return ruleParsed;
  }

  try {
    const llmParsed = await callLLM(prompt, systemInstruction, resumeParserSchema);
    return mergeParsedDetails(ruleParsed, llmParsed);
  } catch (error) {
    console.error('LLM parseResume failed, using deterministic parsing of the resume text:', error);
    return ruleParsed;
  }
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

Enforce JSON output matching the required schema. Ensure matchingSkills, missingSkills, gaps, and keywordFrequency are correctly identified based on the job requirements.`;

  const prompt = `
=== RESUME TEXT ===
${resumeText}

=== JOB DESCRIPTION ===
${jobDescription}
`;

  if (!ai) {
    console.log('No LLM client. Returning mock match analysis.');
    return getMockMatchAnalysis(resumeText, jobDescription);
  }

  try {
    return await callLLM(prompt, systemInstruction, matchAnalysisSchema);
  } catch (error) {
    console.error('LLM analyzeMatch failed, returning mock analysis:', error);
    return getMockMatchAnalysis(resumeText, jobDescription);
  }
}

/**
 * Generate interview questions
 */
export async function generateQuestions(resumeText, jobDescription, difficulty = 'Mid', count = 5) {
  const systemInstruction = `You are a Senior Technical Interviewer.
Analyze the provided resume and target job description to generate two distinct sets of tailored interview questions:
1. **resumeBasedQuestions**: Generate exactly 10 questions. You must thoroughly analyze the resume to find specific projects, experiences, coursework, certifications, or leadership accomplishments mentioned by the candidate.
   CRITICAL: Ensure the questions are diverse and cover the entire resume.
   - At least 1 question per project mentioned, asking about design choices or implementation challenges.
   - At least 2 questions targeting coursework or academic theory (e.g. data structures, OS, databases).
   - At least 2 questions targeting work/experience responsibilities, teamwork, or agile sprint practices.
   - At least 1 question targeting certifications, hackathons, or extracurricular achievements.
   - Do NOT repeat the same question phrasing or template pattern. Ensure variety in the style of questions.
2. **roleBasedQuestions**: Generate exactly 5 questions based on the target job role's requirements, covering core technical skills, behavioral scenarios, and alignment with candidate gaps. Do not repeat template patterns.

Ensure the difficulty of the questions is: ${difficulty}.
Provide context, a sampleAnswerOutline, and evalCriteria for every question.
Enforce JSON format matching the schema.`;

  const prompt = `
Generate exactly 10 resume-based questions and exactly 5 role-based questions at the "${difficulty}" difficulty level.

=== RESUME TEXT ===
${resumeText}

=== JOB DESCRIPTION ===
${jobDescription}
`;

  if (!ai) {
    console.log('No LLM client. Returning mock interview questions.');
    return getMockInterviewQuestions(resumeText, jobDescription, difficulty, count);
  }

  try {
    return await callLLM(prompt, systemInstruction, interviewQuestionsSchema);
  } catch (error) {
    console.error('LLM generateQuestions failed, returning mock questions:', error);
    return getMockInterviewQuestions(resumeText, jobDescription, difficulty, count);
  }
}

/**
 * Evaluate answer
 */
export async function evaluateAnswer(question, answer) {
  const systemInstruction = `You are a Tech Interview Evaluator.
Given an interview question and the candidate's answer, provide an objective score from 0 to 100, construct detailed feedback, and suggest concrete ways to improve the response.
Ensure JSON format matches the requested schema.`;

  const prompt = `
=== INTERVIEW QUESTION ===
${question}

=== CANDIDATE ANSWER ===
${answer}
`;

  if (!ai) {
    console.log('No LLM client. Returning mock answer evaluation.');
    return getMockAnswerEvaluation(question, answer);
  }

  try {
    return await callLLM(prompt, systemInstruction, answerEvaluationSchema);
  } catch (error) {
    console.error('LLM evaluateAnswer failed, returning mock evaluation:', error);
    return getMockAnswerEvaluation(question, answer);
  }
}

// --- MOCK FALLBACK DATA GENERATORS ---

// ---------------------------------------------------------------------------
// Deterministic resume parsing
// ---------------------------------------------------------------------------
// Rule-based extraction that reads real details out of the uploaded resume text
// itself. Used when the LLM is unavailable or fails so every resume yields its
// own personalized profile — nothing below is a hard-coded fallback candidate.

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]*)?(?:\(\d{2,4}\)[\s.-]*)?\d{3}[\s.-]*\d{3}[\s.-]*\d{4}(?:\s*(?:x|ext)[.\s]*\d{1,5})?/i;
const LINKEDIN_RE = /(?:linkedin\.com\/in\/|github\.com\/)[\w-]+/i;
const YEAR_RE = /(?:19|20)\d{2}/;
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_TOKEN = `(?:${MONTH}\\.?\\s*\\d{4}|(?:19|20)\\d{2})`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to)\\s*(${MONTH}\\.?\\s*\\d{4}|present|now|current|ongoing|(?:19|20)\\d{2})`, 'i');

const SECTION_KEYWORDS = [
  'summary', 'objective', 'profile', 'about',
  'skills', 'technical skills', 'core competencies', 'competencies', 'technologies', 'tech stack',
  'experience', 'work experience', 'professional experience', 'employment', 'employment history', 'career history',
  'education', 'academics', 'educational background', 'academic background',
  'projects', 'project work', 'academic projects', 'professional projects', 'personal projects',
  'certifications', 'certificates', 'licenses',
  'extracurricular', 'leadership', 'achievements', 'interests', 'languages',
  'additional information', 'additional details', 'references', 'publications', 'awards',
];

function cleanLine(line) {
  return String(line || '').replace(/^[\s•·*\-–—]+|[\s•·*]+$/g, '').trim();
}

function headerKey(line) {
  return cleanLine(line).replace(/[:;]+$/, '').toLowerCase();
}

function isSectionHeader(line) {
  const key = headerKey(line);
  if (!key || key.length > 32) return false;
  return SECTION_KEYWORDS.some((kw) => key === kw || key.startsWith(`${kw} `) || key.startsWith(`${kw}:`));
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
    if (/@/.test(line) || PHONE_RE.test(line)) continue;
    if (isLocationText(line)) continue;
    if (isSectionHeader(line)) continue;
    const lower = line.toLowerCase().replace(/^['"]+|['"]+$/g, '');
    if (['resume', 'cv', 'curriculum vitae', 'curriculum', 'résumé'].includes(lower)) continue;
    if (!/[A-Z]/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 1 || words.length > 6) continue;
    return line;
  }
  return '';
}

function detectHeadline(topLines, name) {
  const start = name ? topLines.indexOf(name) + 1 : 0;
  for (let i = start; i < topLines.length; i++) {
    const line = topLines[i];
    if (!line) continue;
    if (isSectionHeader(line)) break;
    if (line.length > 80) continue;
    if (isLocationText(line)) continue;
    if (/@/.test(line) || PHONE_RE.test(line)) continue;
    if (/^(email|phone|mobile|tel|address|linkedin|github|portfolio|website|contact|www|http)[\s:]|\.(com|in|dev|org|net)\b/i.test(line)) continue;
    if (/^(skills|education|experience|projects|summary|objective|profile|about)[\s:]|^[0-9]+$/i.test(line.toLowerCase())) continue;
    if (line === name) continue;
    return line;
  }
  return '';
}

function detectLocation(topLines) {
  for (const line of topLines) {
    if (!EMAIL_RE.test(line) && !PHONE_RE.test(line)) continue;
    const tokens = line.split(/[|•·/]+/).map((s) => s.trim()).filter(Boolean);
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

function extractSkills(lines, blocks, opts = {}) {
  const collected = [];
  const skillsBlock = blocks.find((b) => /^skills?|technical skills|core|competenc|technolog|tech stack/i.test(b.key));
  if (skillsBlock) collected.push(...skillsBlock.lines);
  for (const line of lines) {
    if (/^skills?\s*[:：]/i.test(line.trim())) {
      collected.push(line.replace(/^skills?\s*[:：]/i, '').trim());
    } else if (/^[•·*\-–—]\s*[A-Za-z]/.test(line.trim())) {
      const token = cleanLine(line).replace(/^[•·*\-–—]\s*/, '').trim();
      if (isPlausibleSkillToken(token) && token.split(/\s+/).length <= 4) collected.push(token);
    }
  }
  if (collected.length === 0 && Array.isArray(opts.top)) {
    const excludes = (opts.exclude || []).map((s) => s.toLowerCase());
    for (const line of opts.top) {
      const token = cleanLine(line).replace(/^[•·*\-–—]\s*/, '').trim();
      if (!token) continue;
      if (EMAIL_RE.test(token) || PHONE_RE.test(token)) continue;
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
    const parts = line.split(/[,;•·/|]+/).map((s) => s.trim()).filter(Boolean);
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
  let rest = header.replace(/^[|•·/:,\s-]+|[|•·/:\s,-]+$/g, '').trim();
  const segments = rest.split('|').map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (!result.location && isLocationText(seg)) {
      result.location = seg;
      continue;
    }
    if (!result.role) {
      result.role = seg;
      continue;
    }
    if (!result.company) {
      result.company = seg;
      continue;
    }
  }
  if (result.role && !result.company) {
    const at = result.role.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (at) {
      result.role = at[1].trim();
      result.company = at[2].trim();
    } else {
      const dash = result.role.match(/^(.*?)\s*(?:—|–|-)\s*(.+)$/);
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
  if (/@/.test(line) || PHONE_RE.test(line)) return true;
  if (isLocationText(line)) return true;
  if (isSectionHeader(line)) return true;
  return false;
}

function extractExperience(blocks) {
  const expBlock = blocks.find((b) => /experience|employment|career/.test(b.key));
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
    const isBullet = /^[•·*\-–—]|^\d+[.)]\s/.test(raw);
    const stripped = line.replace(/^[•·*\-–—]\s*/, '');

    if (DATE_RANGE_RE.test(line)) {
      const m = line.match(DATE_RANGE_RE);
      const header = line.replace(DATE_RANGE_RE, '').replace(/[|•·/]\s*$/, '').trim();
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
      const found = loc.split(/[|•·/]+/).map((s) => s.trim()).find((s) => isLocationText(s));
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
    const line = cleanLine(raw).replace(/^[•·*\-–—]\s*/, '');
    if (!line) continue;
    if (DEGREE_RE.test(line)) {
      current = { degree: '', institution: '', year: '', field: '' };
      entries.push(current);
    }
    if (!current) continue;
    let rest = line;
    const yearMatch = rest.match(YEAR_RE);
    if (yearMatch && !current.year) current.year = yearMatch[0];
    const fieldMatch = rest.match(/\(([^)]{2,80})\)/);
    if (fieldMatch && !current.field) current.field = fieldMatch[1];
    rest = rest.replace(/\s*\(\s*\d{4}\s*\)\s*/, ' ');
    if (!current.degree && DEGREE_RE.test(rest)) {
      const instMatch = rest.match(/^(.*?)\s*(?:[,|]|\s+at\s+|\s+from\s+|—|–)\s+(.*)$/i);
      if (instMatch) {
        current.degree = instMatch[1].trim();
        if (!current.institution) current.institution = instMatch[2].trim();
      } else {
        current.degree = rest.trim();
      }
    } else if (!current.institution) {
      const stripped = rest.replace(YEAR_RE, '').replace(/[,\s]+$/g, '').trim();
      if (stripped && !isLocationText(stripped)) current.institution = stripped;
    }
    if (current.institution) {
      current.institution = current.institution.replace(YEAR_RE, '').replace(/[,\s]+$/g, '').trim();
    }
  }
  return entries.filter((e) => e.degree || e.institution).slice(0, 6);
}

function extractProjects(blocks) {
  const projBlock = blocks.find((b) => /^projects?|project work/i.test(b.key));
  if (!projBlock) return [];
  const projects = [];
  let current = null;
  for (const raw of projBlock.lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    const isBullet = /^[•·*\-–—]/.test(raw);
    const text = line.replace(/^[•·*\-–—]\s*/, '').trim();
    if (isBullet) {
      if (current) current.description = current.description ? `${current.description} ${text}` : text;
      continue;
    }
    if (current) projects.push(current);
    current = { name: text, description: '', technologies: [] };
  }
  if (current) projects.push(current);
  for (const p of projects) {
    const techMatch = `${p.name} ${p.description}`.match(/[Tt]echnologies?\s*[:：]\s*([^\n.]{1,120})/);
    if (techMatch) {
      p.technologies = techMatch[1].split(/[,;•·/]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
    }
  }
  return projects.slice(0, 10).filter((p) => p.name && p.name.length > 1);
}

function extractCertifications(blocks) {
  const certBlock = blocks.find((b) => /^certif|licenses?/i.test(b.key));
  if (!certBlock) return [];
  const certs = [];
  for (const raw of certBlock.lines) {
    const line = cleanLine(raw).replace(/^[•·*\-–—]\s*/, '');
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
  const sumBlock = blocks.find((b) => /^summary|^objective|^profile|^about/i.test(b.key));
  if (sumBlock) {
    const text = sumBlock.lines.map(cleanLine).filter(Boolean).join(' ');
    if (text) return text.slice(0, 600);
  }
  return '';
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
  if (!text || typeof text !== 'string' || text.trim().length < 150) {
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

  const phone = wholeText.match(PHONE_RE);
  if (phone) details.phone = phone[0];
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

  return details;
}

function mergeParsedDetails(ruleParsed, llmParsed) {
  const merged = { ...ruleParsed };
  if (llmParsed && typeof llmParsed === 'object') {
    const take = (llmVal, ruleVal) => (typeof llmVal === 'string' && llmVal.trim() ? llmVal.trim() : ruleVal);
    const takeArray = (llmVal, ruleVal) => (Array.isArray(llmVal) && llmVal.length ? llmVal : ruleVal);
    merged.name = take(llmParsed.name, ruleParsed.name);
    merged.email = take(llmParsed.email, ruleParsed.email);
    merged.skills = takeArray(llmParsed.skills, ruleParsed.skills);
    merged.workExperience = takeArray(llmParsed.workExperience, ruleParsed.workExperience);
    merged.education = takeArray(llmParsed.education, ruleParsed.education);
    merged.isAuthentic = llmParsed.isAuthentic !== undefined ? llmParsed.isAuthentic : ruleParsed.isAuthentic;
    merged.validationErrors = Array.isArray(llmParsed.validationErrors) ? llmParsed.validationErrors : ruleParsed.validationErrors;
  }
  return merged;
}

function getMockMatchAnalysis(resumeText, jobDescription) {
  const isReact = jobDescription.toLowerCase().includes('react');
  const isDocker = jobDescription.toLowerCase().includes('docker');
  const isGraphQL = jobDescription.toLowerCase().includes('graphql');

  const matching = ["React", "TypeScript", "Tailwind CSS", "JavaScript", "Git"];
  const missing = [];
  if (isDocker) missing.push("Docker");
  if (isGraphQL) missing.push("GraphQL");
  if (missing.length === 0) {
    missing.push("Kubernetes", "CI/CD Setup");
  }

  const atsScore = isGraphQL || isDocker ? 78 : 88;

  return {
    matchId: "match-" + Math.floor(Math.random() * 100000),
    atsScore,
    breakdown: {
      skillsMatchScore: atsScore + 2,
      experienceScore: atsScore - 5,
      educationScore: 90,
      keywordDensityScore: atsScore - 10
    },
    summary: "The candidate shows strong foundation in Frontend development with solid React and TypeScript skills. However, they lack hands-on experience in backend API query tools like GraphQL and container environments which are preferred/required for the role.",
    matchingSkills: matching,
    missingSkills: missing,
    gaps: [
      {
        category: "Technical Skill",
        description: `Missing hands-on experience with ${missing.join(' and ')}.`,
        impact: "Medium",
        recommendation: `Read documentation on ${missing[0]} or work on a side project integrating it.`
      }
    ],
    atsFeedback: {
      formattingNotes: ["Resume formatting is clean and parsable.", "Ensure lists use bullet points."],
      actionVerbsCheck: "Good usage of action verbs like 'Developed', 'Optimized', and 'Collaborated'.",
      keywordFrequency: [
        { keyword: "React", count: 4, status: "Optimal" },
        { keyword: "TypeScript", count: 3, status: "Optimal" },
        { keyword: "GraphQL", count: 0, status: "Missing" }
      ]
    }
  };
}

function getSkillSpecificQuestion(skill, qId) {
  const skillLower = skill.toLowerCase();
  if (skillLower.includes('react')) {
    return {
      id: `q-res-dyn-${qId}`,
      type: "Technical",
      question: `Your resume lists experience with React. In your experience, how do you handle state management across deeply nested components, and when do you opt for custom hooks vs context or state libraries?`,
      context: `Assesses React state management depth.`,
      sampleAnswerOutline: ["Acknowledge prop drilling.", "Explain Context API and custom hooks.", "Discuss Zustand or Redux for global states."],
      evalCriteria: "Looks for practical React state modeling capability."
    };
  }
  if (skillLower.includes('javascript') || skillLower.includes('typescript')) {
    return {
      id: `q-res-dyn-${qId}`,
      type: "Technical",
      question: `Since you work with ${skill}, can you explain how you handle asynchronous control flows, error boundaries, and memory management in modern JavaScript runtimes?`,
      context: `Tests advanced asynchronous JS runtime knowledge.`,
      sampleAnswerOutline: ["Discuss Promises, async/await, and try-catch.", "Explain event loop microtasks.", "Mention memory leak preventions (clearing timers/listeners)."],
      evalCriteria: "Looks for deep understanding of the JS runtime engine."
    };
  }
  if (skillLower.includes('python')) {
    return {
      id: `q-res-dyn-${qId}`,
      type: "Technical",
      question: `Your profile highlights Python skills. How do you approach structuring large-scale Python applications, and what patterns do you use for dependency isolation and performance scaling?`,
      context: `Tests backend Python architecture capabilities.`,
      sampleAnswerOutline: ["Mention virtualenvs, pip, or poetry.", "Discuss asyncio or multiprocessing for scaling.", "Describe testing frameworks like pytest."],
      evalCriteria: "Looks for large-scale Python package and runtime experience."
    };
  }
  if (skillLower.includes('docker') || skillLower.includes('kubernetes')) {
    return {
      id: `q-res-dyn-${qId}`,
      type: "Technical",
      question: `You've worked with containerization using ${skill}. What are your best practices for optimizing Dockerfile build times, layer caching, and minimizing container image sizes for production?`,
      context: `Assesses containerization scaling and deployment.`,
      sampleAnswerOutline: ["Use multi-stage builds.", "Order commands to maximize layer caching.", "Choose alpine or distroless base images."],
      evalCriteria: "Evaluates production-ready Devops/Docker knowledge."
    };
  }
  if (skillLower.includes('aws') || skillLower.includes('cloud')) {
    return {
      id: `q-res-dyn-${qId}`,
      type: "Technical",
      question: `With your cloud experience in ${skill}, how do you approach setting up high-availability architectures and securing access to data buckets or EC2 instances using IAM rules?`,
      context: `Checks cloud infrastructure security awareness.`,
      sampleAnswerOutline: ["State the principle of least privilege in IAM policies.", "Use VPCs, security groups, and private subnets.", "Configure auto-scaling groups and load balancers."],
      evalCriteria: "Checks cloud architecture and security principles."
    };
  }
  // Generic skill templates
  if (qId % 2 === 0) {
    return {
      id: `q-res-dyn-${qId}`,
      type: "Technical",
      question: `Your resume lists proficiency in "${skill}". Can you explain a scenario where you integrated this technology to solve a complex engineering challenge?`,
      context: `Assesses integration capabilities of "${skill}".`,
      sampleAnswerOutline: [`Explain the purpose of using "${skill}" in your project.`, `Describe a technical obstacle that arose during integration.`, `Detail how you resolved the bug or configuration blocker.`],
      evalCriteria: "Looks for practical troubleshooting and tool application."
    };
  } else {
    return {
      id: `q-res-dyn-${qId}`,
      type: "Technical",
      question: `How do you stay up-to-date with best practices in "${skill}", and what is a new feature or design pattern in this technology that you are excited about?`,
      context: `Checks candidate's growth mindset and technological curiosity.`,
      sampleAnswerOutline: [`Mention blogs, official documentations, or GitHub repositories.`, `Explain a new version feature (e.g. React server components, Python type hints).`, `Discuss how this feature improves developer efficiency or runtime speed.`],
      evalCriteria: "Evaluates intellectual curiosity and eagerness to learn."
    };
  }
}

function getMockInterviewQuestions(resumeText, jobDescription, difficulty, count) {
  const text = resumeText || '';
  const textLower = text.toLowerCase();
  
  // Check if it's Palak's resume first for the premium mockup questions
  const isPalak = textLower.includes('palak') || 
                  textLower.includes('budhwani') || 
                  textLower.includes('gorizz') ||
                  textLower.includes('transitops') ||
                  textLower.includes('ai tutor');

  let resumeBasedQuestions = [];
  
  if (isPalak) {
    resumeBasedQuestions = [
      {
        id: "q-res-001",
        type: "Project-Based",
        question: "In your AI Tutor project, you integrated the Gemini API for contextual AI responses. Can you walk me through a specific challenge you faced while integrating a generative AI API like Gemini, and how you approached debugging or resolving it?",
        context: "Assesses hands-on API integration skills and debugging methodology on personal projects.",
        sampleAnswerOutline: [
          "Explain the goal of the AI Tutor integration.",
          "Describe a challenge (e.g., handling rate limits, cleaning markdown tags, or context window management).",
          "Describe the solution (e.g., retry logic with backoff, regex pre-processors, or message history pruning).",
          "Quantify the outcome."
        ],
        evalCriteria: "Looks for practical problem solving, familiarity with generative AI concepts, and resilience."
      },
      {
        id: "q-res-002",
        type: "Project-Based",
        question: "For your Cloud-Based File Sharing & Backup System, you utilized AWS EC2, S3, and IAM. Describe the architecture you designed for this system and explain how IAM was crucial for ensuring secure file access and sharing among users.",
        context: "Assesses cloud architecture planning and security best practices.",
        sampleAnswerOutline: [
          "Explain the client-server-storage flow.",
          "Describe the usage of AWS SDK and IAM roles/policies for authorization.",
          "Discuss safety of files in S3 buckets.",
          "Explain audit logs or cross-sharing mechanisms."
        ],
        evalCriteria: "Evaluates security awareness, understanding of AWS primitives, and structural database/storage mapping."
      },
      {
        id: "q-res-003",
        type: "Technical",
        question: "You've worked with both React.js (TransitOps) and Flutter (GoRizz, Hope Finder). In what scenarios would you choose Flutter over React.js for a new mobile application project, and what are the key technical considerations behind that decision?",
        context: "Assesses framework selection capability and platform trade-offs.",
        sampleAnswerOutline: [
          "Compare rendering architectures (Skia/Impeller vs Native components bridge).",
          "Discuss developer velocity and code sharing between iOS/Android.",
          "Evaluate UI customization and component consistency.",
          "Address performance, bundle sizes, and native device feature access."
        ],
        evalCriteria: "Checks architectural decision-making, framework familiarity, and understanding of hybrid mobile app ecosystem."
      },
      {
        id: "q-res-004",
        type: "Coursework-Based",
        question: "You've listed Data Structures & Algorithms and DBMS in your coursework. Can you explain a scenario where your understanding of efficient data structures or database design was critical in optimizing the performance of one of your applications?",
        context: "Checks computer science fundamentals applied in practice.",
        sampleAnswerOutline: [
          "Specify the slow feature (e.g. sorting files, nested SQL lookups).",
          "Detail the optimization (e.g. changing an O(N^2) loop to O(N) using HashMaps, indexing columns, or database normalization).",
          "Compare benchmarks before and after optimization."
        ],
        evalCriteria: "Looks for theoretical knowledge, algorithm analysis, and database normalization/indexing proficiency."
      },
      {
        id: "q-res-005",
        type: "Leadership",
        question: "In the TransitOps hackathon project, you collaborated with a team. Describe your role in the team, how tasks were divided, and how you managed integration conflicts under high-pressure time constraints.",
        context: "Assesses teamwork, collaboration under pressure, and Git integration skills.",
        sampleAnswerOutline: [
          "Explain the TransitOps project goal and hackathon setting.",
          "Detail your specific contributions and task delegation.",
          "Provide a clear example of resolving a merge conflict or technical difference of opinion.",
          "Highlight how you successfully delivered the project on time."
        ],
        evalCriteria: "Evaluates leadership capability, teamwork ethics, communication clarity, and version control discipline."
      },
      {
        id: "q-res-006",
        type: "Project-Based",
        question: "In your GoRizz project, you built a mobile platform using Flutter. What patterns did you use for structure and state management, and how did you verify the app remains responsive during network latency?",
        context: "Explores mobile design paradigms and asynchronous loading performance.",
        sampleAnswerOutline: [
          "State state management choices (e.g. Provider, Bloc, Riverpod).",
          "Explain asynchronous operations (async/await, FutureBuilder).",
          "Discuss offline caching or mock repositories for latency testing."
        ],
        evalCriteria: "Assesses familiarity with clean architecture in Flutter and handling unstable network threads."
      },
      {
        id: "q-res-007",
        type: "Project-Based",
        question: "Your resume details Hope Finder. What was the core problem solved by Hope Finder, and how did you structure its database schemas in Supabase for quick, relational user queries?",
        context: "Assesses PostgreSQL/Supabase database schema structure capability.",
        sampleAnswerOutline: [
          "Explain the purpose and users of Hope Finder.",
          "Discuss Supabase backend configuration, tables, and foreign keys.",
          "Describe any row-level security (RLS) policies set up for security."
        ],
        evalCriteria: "Looks for schema design competence, relational database security rules, and clean query construction."
      },
      {
        id: "q-res-008",
        type: "Experience-Based",
        question: "You participated in the Odoo Hackathon. Tell me about the product you built during the hackathon and the most critical debugging decision you had to make under tight time limits.",
        context: "Evaluates prototyping ability and debugging under extreme hackathon pressure.",
        sampleAnswerOutline: [
          "Summarize the product concept built at Odoo Hackathon.",
          "Describe the critical issue that arose in the final hours.",
          "Explain how you isolated the bug and decided on a quick workaround rather than a full refactor."
        ],
        evalCriteria: "Checks problem solving efficiency, adaptability, and high-pressure development decision capabilities."
      },
      {
        id: "q-res-009",
        type: "Coursework-Based",
        question: "You have listed Operating Systems and Computer Networks in your courses. How do concepts like thread pooling, TCP handshakes, or CORS headers directly apply when you are developing Node.js backend endpoints?",
        context: "Bridges core operating systems and networks concepts to practical server-side JavaScript.",
        sampleAnswerOutline: [
          "Explain Node.js event loop single-threaded model and thread pool (libuv) delegation.",
          "Describe how TCP streams transmit JSON payload and how CORS restricts browser fetch.",
          "Illustrate with an example of configuring CORS middleware in Express."
        ],
        evalCriteria: "Tests basic comprehension of networking boundaries and OS-level execution in Node."
      },
      {
        id: "q-res-010",
        type: "Coursework-Based",
        question: "You have coursework listed in DBMS. Can you discuss the difference between SQL indexes (B-Trees) and standard table scans, and how you choose when to index columns in your tables?",
        context: "Assesses index optimization knowledge in relational databases.",
        sampleAnswerOutline: [
          "Define B-Tree indexing logic and search complexity O(log N).",
          "Explain the overhead of write operations (INSERT/UPDATE) on indexes.",
          "Detail a role of thumb for indexing columns (primary keys, foreign keys, fields inside WHERE clauses)."
        ],
        evalCriteria: "Looks for DB performance optimization capabilities and index management mechanics."
      }
    ];
  } else {
    // Dynamic Heuristics for other resumes (Generating 10 questions covering different sections)
    const projects = [];
    const KNOWN_SKILLS = [
      'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Java', 'C++', 
      'Next.js', 'Express', 'MongoDB', 'PostgreSQL', 'Docker', 'Kubernetes', 
      'AWS', 'Tailwind CSS', 'GraphQL', 'REST API', 'Git', 'CI/CD', 'Redux', 'HTML', 'CSS',
      'Flutter', 'Dart', 'SQL', 'DBMS', 'Django', 'Flask', 'Go', 'PHP'
    ];
    const courses = [
      'Data Structures', 'Algorithms', 'Database Management', 'DBMS', 
      'Operating Systems', 'Computer Networks', 'Machine Learning', 'Artificial Intelligence',
      'Software Engineering', 'System Design'
    ];

    const lines = text.split(/[\r\n]+/);
    lines.forEach(line => {
      const match = line.match(/(?:[-•*]*\s*)([A-Z][a-zA-Z0-9\s\-]{3,25})(?:\s+Project|\s+App|\s+System|\s+Portal|\s+Tracker|\s+Tool)\b/i);
      if (match && match[1]) {
        const pName = match[1].trim();
        if (!projects.includes(pName) && pName.length > 3) {
          projects.push(pName);
        }
      }
    });

    const detectedSkills = KNOWN_SKILLS.filter(skill => {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(text);
    });

    const coursework = courses.filter(course => {
      const regex = new RegExp(course, 'i');
      return regex.test(text);
    });

    const companies = [];
    lines.forEach(line => {
      const match = line.match(/(?:at|for|with)\s+([A-Z][a-zA-Z0-9\s.,]{2,20})\s+(?:as|Co|Corp|LLC|Inc|Ltd|Company)\b/i);
      if (match && match[1]) {
        const cName = match[1].trim();
        if (!companies.includes(cName)) companies.push(cName);
      }
    });

    let qCount = 0;

    // SECTION 1: PROJECTS (1 question per project, up to 3)
    projects.forEach((p, idx) => {
      if (qCount >= 10 || idx >= 3) return;
      const s = detectedSkills[idx % detectedSkills.length] || 'modern technologies';
      
      if (idx === 0) {
        resumeBasedQuestions.push({
          id: `q-res-dyn-${++qCount}`,
          type: "Project-Based",
          question: `In your "${p}" project, you integrated ${s}. Can you walk me through the architecture and the main technical challenges you faced during its implementation?`,
          context: `Directly targets project details found in your resume for "${p}".`,
          sampleAnswerOutline: [
            `Describe the core objective of the "${p}" project.`,
            `Explain how ${s} was integrated into the architecture.`,
            `Discuss a specific challenge faced (e.g. latency, deployment, database schemas) and how you resolved it.`,
            `State the final results or performance metrics.`
          ],
          evalCriteria: "Looks for practical engineering experience, clarity in system design, and ownership of development."
        });
      } else if (idx === 1) {
        resumeBasedQuestions.push({
          id: `q-res-dyn-${++qCount}`,
          type: "Project-Based",
          question: `For your project "${p}", what were your key architectural decisions, and why did you choose to build it using ${s} over other alternatives?`,
          context: `Explores design choices for your "${p}" project.`,
          sampleAnswerOutline: [
            `Describe the problem statement of "${p}".`,
            `Explain the technology stack options you considered.`,
            `Justify the selection of "${s}" and how it solved your goals.`,
            `Highlight the trade-offs of this choice.`
          ],
          evalCriteria: "Evaluates architectural trade-off analysis, technical depth, and decision-making logic."
        });
      } else {
        resumeBasedQuestions.push({
          id: `q-res-dyn-${++qCount}`,
          type: "Project-Based",
          question: `Regarding "${p}", how did you optimize performance (such as reducing loading time or query bottlenecks), and how did you verify the scaling limits of this application?`,
          context: `Checks performance tuning and scaling capabilities on project "${p}".`,
          sampleAnswerOutline: [
            `Detail the performance profiling methods used.`,
            `Mention the bottleneck identified in "${p}".`,
            `Explain the optimization strategy (caching, indexes, compression) and results.`
          ],
          evalCriteria: "Checks performance optimization practices and monitoring knowledge."
        });
      }
    });

    // SECTION 2: WORK EXPERIENCE (up to 2 questions)
    companies.forEach((c, idx) => {
      if (qCount >= 10 || idx >= 2) return;
      if (idx === 0) {
        resumeBasedQuestions.push({
          id: `q-res-dyn-${++qCount}`,
          type: "Experience-Based",
          question: `I see you have work experience at "${c}". Can you describe your day-to-day responsibilities there and how you collaborated with your team to deliver features?`,
          context: `Targets professional experience at "${c}".`,
          sampleAnswerOutline: [
            `State your role and key tasks at "${c}".`,
            `Explain the team size, sprint rituals (Scrum, Kanban), and product cycle.`,
            `Provide an example of a feature you shipped and how you verified its quality.`
          ],
          evalCriteria: "Assesses teamwork, collaboration frameworks, professional growth, and feature ownership."
        });
      } else {
        resumeBasedQuestions.push({
          id: `q-res-dyn-${++qCount}`,
          type: "Experience-Based",
          question: `During your tenure at "${c}", can you describe a time when you had to manage conflicting technical requirements or tight deadlines, and how you communicated with stakeholders?`,
          context: `Checks engineering execution and stakeholder communication at "${c}".`,
          sampleAnswerOutline: [
            `Describe the deadline or conflicting feature requirements.`,
            `Outline the prioritization trade-offs (scope reduction, MVP).`,
            `Detail how you communicated this with your team lead or manager.`
          ],
          evalCriteria: "Checks behavioral skills, pressure management, and negotiation."
        });
      }
    });

    // SECTION 3: EDUCATION / COURSEWORK (up to 2 questions)
    coursework.forEach((c, idx) => {
      if (qCount >= 10 || idx >= 2) return;
      if (idx === 0) {
        resumeBasedQuestions.push({
          id: `q-res-dyn-${++qCount}`,
          type: "Coursework-Based",
          question: `You have listed "${c}" in your academic focus or coursework. How have you applied these theoretical concepts in a practical programming project?`,
          context: `Tests alignment between academic study of "${c}" and practical application.`,
          sampleAnswerOutline: [
            `Define the core concepts of "${c}" (e.g. databases, complexity analysis, routing).`,
            `Identify a personal project where these concepts were implemented.`,
            `Describe how applying these concepts made the software faster, more secure, or more maintainable.`
          ],
          evalCriteria: "Assesses ability to bridge academic theory and real-world software implementation."
        });
      } else {
        resumeBasedQuestions.push({
          id: `q-res-dyn-${++qCount}`,
          type: "Coursework-Based",
          question: `In your course on "${c}", what was the most complex assignment or project you completed, and what core algorithms or design patterns did you implement?`,
          context: `Assesses coursework academic project details.`,
          sampleAnswerOutline: [
            `Summarize the project or laboratory work for "${c}".`,
            `Detail the core algorithms (e.g. graph traversal, query parsing, thread pooling).`,
            `Share the debugging challenges faced.`
          ],
          evalCriteria: "Evaluates understanding of fundamental computer science concepts."
        });
      }
    });

    // SECTION 4: SKILLS & CERTIFICATIONS (distinct templates via helper, up to 3 questions)
    const skillsToAsk = detectedSkills.slice(0, 4);
    skillsToAsk.forEach((s) => {
      if (qCount >= 10) return;
      // Make sure we don't ask about skills we already covered in projects
      const projectTechsUsed = resumeBasedQuestions.map(q => q.question);
      const isAlreadyAsked = projectTechsUsed.some(qText => qText.includes(`"${s}"`) || qText.includes(` ${s} `));
      if (!isAlreadyAsked) {
        resumeBasedQuestions.push(getSkillSpecificQuestion(s, ++qCount));
      }
    });

    // Fill up to 10 with general fallback templates
    const generalFallbacks = [
      {
        question: "Based on the experience listed in your resume, can you walk me through the architecture and technical challenges of your most complex software project?",
        type: "Project-Based",
        context: "Assesses architectural understanding and depth of project ownership.",
        sampleAnswerOutline: ["Outline the system architecture.", "Describe a major bottleneck (performance, scaling, state management).", "Explain the solution and trade-offs.", "State the outcomes and metrics."],
        evalCriteria: "Looks for deep technical understanding of design decisions and execution."
      },
      {
        question: "In your software engineering roles, how do you approach learning new frameworks or backend systems when joining a team?",
        type: "Experience-Based",
        context: "Checks adaptability and onboarding efficiency.",
        sampleAnswerOutline: ["Detail your study strategy (docs, sample apps, codebase walkthroughs).", "Explain how you ask senior devs questions without interrupting their flow.", "Share an example of a technology you mastered quickly."],
        evalCriteria: "Looks for self-driven learning ability, proactiveness, and team integration."
      },
      {
        question: "Describe your approach to code reviews. What do you look for when reviewing a pull request, and how do you deliver constructive feedback?",
        type: "Experience-Based",
        context: "Checks quality assurance standard and engineering culture fit.",
        sampleOutline: ["List factors: safety, optimization, standards, readability.", "Explain how to structure remarks (e.g. asking questions rather than commanding).", "Discuss how to highlight positive aspects of the code."],
        evalCriteria: "Evaluates interpersonal communication, engineering discipline, and code quality benchmarks."
      },
      {
        question: "When designing API endpoints, what RESTful standards or routing conventions do you follow to ensure your endpoints are scalable and easy to consume?",
        type: "Technical",
        context: "Checks API architectural standards.",
        sampleAnswerOutline: ["Mention plural nouns, HTTP verbs (GET, POST, etc.), and standard status codes.", "Discuss nesting models, validation schemas, and versioning (/api/v1).", "Explain CORS configurations and payload limits."],
        evalCriteria: "Assesses familiarity with HTTP paradigms, routing safety, and API integrations."
      }
    ];

    while (resumeBasedQuestions.length < 10 && generalFallbacks.length > 0) {
      const fb = generalFallbacks.shift();
      resumeBasedQuestions.push({
        id: `q-res-dyn-fb-${++qCount}`,
        ...fb
      });
    }
  }

  const roleBasedQuestions = [
    {
      id: "q-role-001",
      type: "Technical",
      question: "How do you manage complex application state in a React application with TypeScript? Can you discuss the pros and cons of using Context API vs custom state libraries?",
      context: "Assesses state architecture understanding in frontend environments.",
      sampleAnswerOutline: [
        "Discuss context API re-render overhead.",
        "Explain custom hooks or state container libraries (Redux, Zustand).",
        "Highlight TypeScript typing strategies for states and actions."
      ],
      evalCriteria: "Checks proficiency with modern React features, rendering cycles, and type-safe state containers."
    },
    {
      id: "q-role-002",
      type: "Gap-Addressing",
      question: "I notice your resume highlights frontend work, but this role lists GraphQL and Docker. How would you go about getting up to speed with these tools in your first few weeks?",
      context: "Assesses adaptability to missing backend skill requirements.",
      sampleAnswerOutline: [
        "Acknowledge the skills gap.",
        "Propose a structured self-study plan (reading schema docs, containerizing a local project).",
        "Highlight a past project where you successfully learned new technologies quickly."
      ],
      evalCriteria: "Looks for eagerness to learn, adaptability, self-direction, and structured onboarding ideas."
    },
    {
      id: "q-role-003",
      type: "Technical",
      question: "Explain the concept of Cross-Origin Resource Sharing (CORS) in modern web apps. How does it protect api servers, and how do you configure it in an Express application?",
      context: "Evaluates fundamental web security architecture and Express middleware configuration.",
      sampleAnswerOutline: [
        "Define CORS as a browser-side security standard limiting cross-origin fetches.",
        "Describe pre-flight requests (OPTIONS check).",
        "Show how to initialize 'cors()' middleware in Express with whitelist origin options."
      ],
      evalCriteria: "Looks for security awareness, API communication boundaries, and practical Express middleware knowledge."
    },
    {
      id: "q-role-004",
      type: "Technical",
      question: "Describe your approach to writing unit and integration tests. What testing frameworks (like Jest, Vitest, React Testing Library) do you prefer and why?",
      context: "Tests engineering quality standard, testing strategies, and test tooling experience.",
      sampleAnswerOutline: [
        "Differentiate unit testing (functions in isolation) from integration testing (components working together).",
        "Explain mock endpoints/servers vs actual assertions.",
        "Justify choice of tool (e.g. Vitest for speed in Vite projects, RTL for user action simulation)."
      ],
      evalCriteria: "Evaluates commitment to code quality, testing strategies, and framework-level execution."
    },
    {
      id: "q-role-005",
      type: "Behavioral",
      question: "Describe a situation where you had a disagreement with a designer or product manager regarding how a feature should be implemented. How did you resolve it?",
      context: "Evaluates communication, negotiation skills, and cross-functional collaboration.",
      sampleAnswerOutline: [
        "Describe the context of disagreement.",
        "Discuss how you actively listened to their user experience concerns.",
        "Explain how you proposed a compromise or backed it up with data/performance metrics.",
        "State the final positive outcome."
      ],
      evalCriteria: "Checks for empathy, professional communication, and constructive problem-solving skills."
    }
  ];

  return { resumeBasedQuestions, roleBasedQuestions };
}

function getMockAnswerEvaluation(question, answer) {
  const length = answer.trim().length;
  let score = 50;
  let feedback = "";
  let suggested_improvement = "";

  if (length < 20) {
    score = 45;
    feedback = "The answer is too brief. Try to structure your response using the STAR method (Situation, Task, Action, Result) and include specific technology details.";
    suggested_improvement = "Provide a concrete scenario or technical example to illustrate your point rather than a single sentence.";
  } else if (length < 100) {
    score = 70;
    feedback = "Good response! You addressed the question directly and showed basic knowledge. However, the explanation lacks depth regarding engineering trade-offs or personal experiences.";
    suggested_improvement = "Mention a specific instance where you encountered this problem and state the outcome or lessons learned.";
  } else {
    score = 90;
    feedback = "Excellent, thorough response. You structured the answer perfectly, discussed architectural choices and trade-offs, and grounded it in practical experience.";
    suggested_improvement = "Quantify your results where possible (e.g. 'reduced bundle size by 30%' or 'saved 4 hours of build time').";
  }

  return {
    score,
    feedback,
    suggested_improvement
  };
}
