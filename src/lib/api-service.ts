// Service adapter layer for CareerLens Backend APIs

const API_BASE_URL = 'http://127.0.0.1:5000/api/v1';

export interface ParsedDetails {
  name: string;
  email: string;
  skills: string[];
  workExperience: Array<{
    role: string;
    company: string;
    location: string;
    start: string;
    end: string | null;
    highlights: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    field?: string;
  }>;
}

export interface ResumeParseResponse {
  resumeText: string;
  parsedDetails: ParsedDetails;
}

export interface MatchGap {
  category: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low' | string;
  recommendation: string;
}

export interface KeywordFrequency {
  keyword: string;
  count: number;
  status: 'Optimal' | 'Present' | 'Missing' | 'Overused' | string;
}

export interface MatchAnalysisResponse {
  matchId: string;
  atsScore: number;
  breakdown: {
    skillsMatchScore: number;
    experienceScore: number;
    educationScore: number;
    keywordDensityScore: number;
  };
  summary: string;
  matchingSkills: string[];
  missingSkills: string[];
  gaps: MatchGap[];
  atsFeedback: {
    formattingNotes: string[];
    actionVerbsCheck: string;
    keywordFrequency: KeywordFrequency[];
  };
  candidateId?: string;
  jobId?: string;
}

export interface InterviewQuestion {
  id: string;
  type: 'Technical' | 'Behavioral' | 'Gap-Addressing' | string;
  question: string;
  context: string;
  sampleAnswerOutline: string[];
  evalCriteria: string;
  answered?: boolean;
}

export interface InterviewQuestionsResponse {
  resumeBasedQuestions: InterviewQuestion[];
  roleBasedQuestions: InterviewQuestion[];
}

export interface AnswerEvaluationResponse {
  score: number;
  feedback: string;
  suggested_improvement: string;
}

/**
 * Handle API response helper
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.message || errorJson.error || errorMsg;
    } catch {
      errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMsg);
  }
  return response.json() as Promise<T>;
}

export const apiService = {
  /**
   * Upload and parse a PDF resume
   * POST /api/v1/resume/parse
   */
  async parseResume(file: File): Promise<ResumeParseResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/resume/parse`, {
      method: 'POST',
      body: formData,
    });

    return handleResponse<ResumeParseResponse>(response);
  },

  /**
   * Analyze ATS match between resume text and job description
   * POST /api/v1/match/analyze
   */
  async analyzeMatch(
    resumeText: string,
    jobDescription: string,
    candidateId?: string,
    jobId?: string
  ): Promise<MatchAnalysisResponse> {
    const response = await fetch(`${API_BASE_URL}/match/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeText,
        jobDescription,
        candidateId,
        jobId,
      }),
    });

    return handleResponse<MatchAnalysisResponse>(response);
  },

  /**
   * Generate tailored interview questions
   * POST /api/v1/interview/questions
   */
  async generateQuestions(
    resumeText: string,
    jobDescription: string,
    difficulty: 'Junior' | 'Mid' | 'Senior' | 'Lead' | string,
    questionCount: number
  ): Promise<InterviewQuestionsResponse> {
    const response = await fetch(`${API_BASE_URL}/interview/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeText,
        jobDescription,
        difficulty,
        questionCount,
      }),
    });

    return handleResponse<InterviewQuestionsResponse>(response);
  },

  /**
   * Evaluate a candidate's answer to an interview question
   * POST /api/v1/interview/evaluate
   */
  async evaluateAnswer(
    question: string,
    answer: string
  ): Promise<AnswerEvaluationResponse> {
    const response = await fetch(`${API_BASE_URL}/interview/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        answer,
      }),
    });

    return handleResponse<AnswerEvaluationResponse>(response);
  },
};
