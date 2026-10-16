import { generateStructured, isAiEnabled, clipForPrompt } from './aiProvider.js';
import { buildMockQuestions, buildMockEvaluation, buildFinalScorecard, runAiTask } from './ruleBasedFallback.js';

import './loadEnv.js';

// Prompt input budgets (chars) â€” keeps oversized resume/JD uploads from
// inflating input-token usage.
const RESUME_CLIP = 8000;
const JD_CLIP = 6000;
const ANSWER_CLIP = 1500;
const FEEDBACK_CLIP = 300;

// Completion-token budgets sized from each response schema (clamped by the
// provider layer to at most 4096).
const TOKEN_LIMITS = {
  mock_questions: 1800,
  mock_evaluation: 600,
  mock_scorecard: 900
};

// OpenAPI JSON schemas for structured mock interview output
const mockInterviewSchema = {
  type: "OBJECT",
  properties: {
    round1: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          questionId: { type: "STRING" },
          type: { type: "STRING" }, // "MCQ"
          questionText: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          category: { type: "STRING" },
          correctAnswerIndex: { type: "INTEGER", description: "0-based index of correct option" }
        },
        required: ["questionId", "type", "questionText", "options", "category", "correctAnswerIndex"]
      }
    },
    round2: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          questionId: { type: "STRING" },
          type: { type: "STRING" }, // "FREE_TEXT"
          questionText: { type: "STRING" },
          category: { type: "STRING" }
        },
        required: ["questionId", "type", "questionText", "category"]
      }
    },
    round3: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          questionId: { type: "STRING" },
          type: { type: "STRING" }, // "FREE_TEXT"
          questionText: { type: "STRING" },
          category: { type: "STRING" }
        },
        required: ["questionId", "type", "questionText", "category"]
      }
    }
  },
  required: ["round1", "round2", "round3"]
};

const mockEvaluationSchema = {
  type: "OBJECT",
  properties: {
    score: { type: "NUMBER", description: "Score from 1.0 to 10.0" },
    instantFeedback: { type: "STRING" },
    evaluatedCriteria: {
      type: "OBJECT",
      properties: {
        technicalAccuracy: { type: "NUMBER", description: "Score from 1.0 to 10.0" },
        clarity: { type: "NUMBER", description: "Score from 1.0 to 10.0" },
        relevanceToRole: { type: "NUMBER", description: "Score from 1.0 to 10.0" }
      },
      required: ["technicalAccuracy", "clarity", "relevanceToRole"]
    }
  },
  required: ["score", "instantFeedback", "evaluatedCriteria"]
};

const mockScorecardSchema = {
  type: "OBJECT",
  properties: {
    overallScore: { type: "INTEGER", description: "Score from 0 to 100" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    improvementAreas: { type: "ARRAY", items: { type: "STRING" } },
    hiringRecommendation: { type: "STRING", description: "e.g. Strong Hire, Recommended, Borderline, Not Recommended" }
  },
  required: ["overallScore", "strengths", "improvementAreas", "hiringRecommendation"]
};

async function callLLM(prompt, systemInstruction, schema, schemaName, maxCompletionTokens, onSource) {
  return generateStructured({ prompt, systemInstruction, schema, schemaName, temperature: 0.2, maxCompletionTokens, onSource });
}

/**
 * Generate 3-round interview questions
 */
export async function generateMockQuestions(resumeText, jobDescription, targetRole) {
  if (!isAiEnabled()) {
    console.log('AI provider disabled. Generating mock interview questions with the deterministic engine.');
  }

  const systemInstruction = `You are an expert technical interviewer and logic puzzle designer.
Generate a comprehensive, 3-round interview question set based on the candidate's resume, target role, and job description:
1. **Round 1 (Aptitude)**: Generate exactly 5 logic/aptitude Multiple Choice Questions (type: "MCQ") with 4 options each and a correct index (0-based).
2. **Round 2 (Technical)**: Generate exactly 3 technical free-form questions (type: "FREE_TEXT") assessing specific technical details or coding structures.
3. **Round 3 (HR & Behavioral)**: Generate exactly 3 behavioral questions (type: "FREE_TEXT") checking cultural alignment, soft skills, or goals.
Keep every question under 40 words and every MCQ option under 12 words.`;

  const prompt = `Target Role: ${targetRole}
Job Description: ${clipForPrompt(jobDescription, JD_CLIP)}
Candidate Resume: ${clipForPrompt(resumeText, RESUME_CLIP)}`;

  return runAiTask({
    task: 'mock_questions',
    enabled: isAiEnabled(),
    aiCall: (onSource) => callLLM(prompt, systemInstruction, mockInterviewSchema, 'mock_questions', TOKEN_LIMITS.mock_questions, onSource),
    buildLocal: () => buildMockQuestions({ resumeText, jobDescription, targetRole })
  });
}

/**
 * Evaluate technical/HR free-text mock answer
 */
export async function evaluateMockAnswer(question, answer, roundId) {
  if (!isAiEnabled()) {
    console.log('AI provider disabled. Evaluating the mock answer with the deterministic rubric.');
  }

  const systemInstruction = `You are a Senior Technical and HR Evaluator.
Evaluate the candidate's response to the interview question in the context of their active round.
Grade the answer out of 10.0 and give specific feedback (max 80 words).`;

  const prompt = `Question: ${clipForPrompt(question, 2000)}
Candidate Answer: ${clipForPrompt(answer, ANSWER_CLIP)}
Round ID: ${roundId} (Round 2 = Technical, Round 3 = HR & Behavioral)`;

  return runAiTask({
    task: 'mock_evaluation',
    enabled: isAiEnabled(),
    aiCall: (onSource) => callLLM(prompt, systemInstruction, mockEvaluationSchema, 'mock_evaluation', TOKEN_LIMITS.mock_evaluation, onSource),
    buildLocal: () => buildMockEvaluation({ question, answer, roundId })
  });
}

/**
 * Compile final scorecard
 */
export async function generateFinalScorecard(session) {
  if (!isAiEnabled()) {
    console.log('AI provider disabled. Compiling the scorecard from the recorded answers.');
  }

  const systemInstruction = `You are the Head of Engineering.
Review the completed mock interview session logs (questions, answers, scores, and proctor violations) and compile a final scorecard summary: at most 4 strengths, 4 improvement areas, and a one-sentence hiring recommendation.`;

  // Compact, clipped answer summary: pretty-printing and long free-text answers
  // previously inflated this prompt's token count for no analytical benefit.
  const answersSummary = Object.entries(session.answers || {}).map(([questionId, entry]) => ({
    questionId,
    score: entry?.score,
    answer: clipForPrompt(entry?.userAnswerText, ANSWER_CLIP),
    feedback: clipForPrompt(entry?.feedback, FEEDBACK_CLIP)
  }));

  const prompt = `Target Role: ${session.targetRole}
Violations Logged: ${session.violationCount}
Interview Answers & Scores: ${JSON.stringify(answersSummary)}`;

  return runAiTask({
    task: 'mock_scorecard',
    enabled: isAiEnabled(),
    aiCall: (onSource) => callLLM(prompt, systemInstruction, mockScorecardSchema, 'mock_scorecard', TOKEN_LIMITS.mock_scorecard, onSource),
    buildLocal: () => buildFinalScorecard(session)
  });
}
