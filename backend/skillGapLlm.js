import { generateStructured, isAiEnabled, clipForPrompt } from './aiProvider.js';
import { buildSkillGapAnalysis, buildCareerGrowthPlan, runAiTask } from './ruleBasedFallback.js';

import './loadEnv.js';

// Prompt input budget for the resume context (chars); validation of feature
// behaviour runs on the caller's full text.
const RESUME_CLIP = 8000;
// Job description budget: the JD was previously interpolated unclipped, so an
// oversized description silently inflated every skill-gap request's input
// tokens (and its latency) for context the summary does not need in full.
const JD_CLIP = 5000;

// Completion-token budgets sized from each response schema (clamped by the
// provider layer to at most 4096).
const TOKEN_LIMITS = {
  skill_gap_analysis: 1400,
  career_growth_plan: 2000
};

// JSON Schemas for Gemini Structured Output
const skillGapAnalysisSchema = {
  type: "OBJECT",
  properties: {
    targetRole: { type: "STRING" },
    readinessScore: { type: "INTEGER", description: "Readiness score from 0 to 100 based on matching skills vs required skills." },
    summary: { type: "STRING", description: "Executive summary of the candidate's fit for this role and key gap areas." },
    matchingSkills: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    requiredSkills: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    missingSkills: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          category: { type: "STRING", description: "technical, tool, or soft" },
          priority: { type: "STRING", description: "High, Medium, or Low" },
          currentProficiency: { type: "STRING", description: "None, Beginner, or Intermediate" },
          requiredProficiency: { type: "STRING", description: "Intermediate, Advanced, or Expert" },
          description: { type: "STRING", description: "Why this skill is needed for the role and what to focus on." }
        },
        required: ["name", "category", "priority", "currentProficiency", "requiredProficiency", "description"]
      }
    }
  },
  required: ["targetRole", "readinessScore", "summary", "matchingSkills", "requiredSkills", "missingSkills"]
};

const careerGrowthPlanSchema = {
  type: "OBJECT",
  properties: {
    targetRole: { type: "STRING" },
    summary: { type: "STRING" },
    courses: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          skillName: { type: "STRING" },
          title: { type: "STRING" },
          provider: { type: "STRING", description: "Udemy, Coursera, freeCodeCamp, YouTube, edX, Pluralsight, etc." },
          url: { type: "STRING", description: "Direct valid URL to course or video tutorial" },
          type: { type: "STRING", description: "Free, Paid / Certificate, or Certificate Option" },
          duration: { type: "STRING", description: "Estimated hours or weeks" },
          level: { type: "STRING", description: "Beginner, Intermediate, or Advanced" },
          description: { type: "STRING", description: "Course overview and key takeaways" }
        },
        required: ["id", "skillName", "title", "provider", "url", "type", "duration", "level", "description"]
      }
    },
    milestones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          phase: { type: "STRING", description: "e.g. Month 1-2, Month 3-4, Month 5-6" },
          focus: { type: "STRING" },
          action: { type: "STRING" },
          targetOutcome: { type: "STRING" }
        },
        required: ["phase", "focus", "action", "targetOutcome"]
      }
    }
  },
  required: ["targetRole", "summary", "courses", "milestones"]
};

/**
 * Call the configured AI provider with a structured-output schema
 */
async function callLLM(prompt, systemInstruction, schema, schemaName, maxCompletionTokens, onSource) {
  return generateStructured({ prompt, systemInstruction, schema, schemaName, temperature: 0.2, maxCompletionTokens, onSource });
}

/**
 * Main Function 1: Skill Gap Analysis
 */
export async function analyzeSkillGaps(resumeText, parsedSkills = [], targetRole = 'Software Engineer', jobDescription = '') {
  const prompt = `Target Role: ${targetRole}
Job Description Context: ${clipForPrompt(jobDescription, JD_CLIP) || 'Standard requirements for ' + targetRole}
Candidate Parsed Skills: ${JSON.stringify(parsedSkills)}

Candidate Resume (relevant experience excerpt):
${clipForPrompt(resumeText, RESUME_CLIP) || 'No resume text available.'}

Evaluate this candidate's skills against the target role. Identify matching skills, required role skills, missing skills (with category, priority: High/Medium/Low, current proficiency, required proficiency, and a one-sentence explanation each), calculate a realistic readiness score (0-100), and write a concise executive summary (max 100 words). List at most 10 matching and 10 required skills.`;

  const systemInstruction = `You are an expert Career Development Coach and Technical Recruiter.
Be accurate and realistic. Categorize missing skills clearly and assign priority based on critical role requirements.`;

  if (!isAiEnabled()) {
    console.log('[skillGapLlm] AI provider disabled. Using deterministic skill gap analysis.');
  }

  return runAiTask({
    task: 'skill_gap_analysis',
    enabled: isAiEnabled(),
    aiCall: (onSource) => callLLM(prompt, systemInstruction, skillGapAnalysisSchema, 'skill_gap_analysis', TOKEN_LIMITS.skill_gap_analysis, onSource),
    buildLocal: () => buildSkillGapAnalysis({ resumeText, parsedSkills, targetRole, jobDescription })
  });
}

/**
 * Main Function 2: Career Growth Plan & Course Recommendations
 */
export async function generateCareerGrowthPlan(missingSkills = [], targetRole = 'Software Engineer', resumeText = '') {
  const missingSkillNames = Array.isArray(missingSkills) 
    ? missingSkills.map(s => typeof s === 'string' ? s : s.name)
    : [];

  const prompt = `Target Role: ${targetRole}
Missing Skills to Upskill: ${JSON.stringify(missingSkillNames)}
Candidate Resume Context: ${clipForPrompt(resumeText, 1000) || 'Standard tech candidate'}

Generate a tailored Career Growth Plan for the target role: "${targetRole}".
Recommend at most 6 courses in total (1-2 per top-priority missing skill) with real, clickable links to major platforms (Coursera, Udemy, freeCodeCamp, YouTube, edX, Pluralsight). Keep each course description under 30 words.
Provide exactly 3 milestones (Phase 1, Phase 2, Phase 3) forming a 3-6 month upskilling roadmap.`;

  const systemInstruction = `You are a Senior Learning & Development Director.
Suggest real, practical courses with accurate URLs on major learning platforms.
Ensure course URLs are valid web links formatted cleanly.`;

  if (!isAiEnabled()) {
    console.log('[skillGapLlm] AI provider disabled. Using deterministic career growth course generator.');
  }

  const result = await runAiTask({
    task: 'career_growth_plan',
    enabled: isAiEnabled(),
    aiCall: (onSource) => callLLM(prompt, systemInstruction, careerGrowthPlanSchema, 'career_growth_plan', TOKEN_LIMITS.career_growth_plan, onSource),
    buildLocal: () => buildCareerGrowthPlan({ missingSkills: missingSkillNames, targetRole })
  });
  result.courses = (result.courses || []).map((c, i) => ({
    ...c,
    id: c.id || `course-${i + 1}`,
    url: validateOrFallbackUrl(c.skillName, c.url)
  }));
  return result;
}

function validateOrFallbackUrl(skillName = '', url = '') {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  return `https://www.google.com/search?q=${encodeURIComponent((skillName || 'tech') + ' course online')}`;
}
