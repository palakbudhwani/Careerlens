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
  phone?: string;
  location?: string;
  summary?: string;
  headline?: string;
  linkedin?: string;
  portfolio?: string;
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: string;
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

export interface MockInterviewStartResponse {
  sessionId: string;
  status: string;
  rounds: Array<{
    roundId: number;
    name: string;
    durationMinutes: number;
    totalQuestions: number;
  }>;
  proctorConfig: {
    maxAllowedViolations: number;
    requireWebcam: boolean;
    requireMic: boolean;
    requireFullscreen: boolean;
  };
}

export interface MockInterviewQuestion {
  questionId: string;
  type: 'MCQ' | 'FREE_TEXT';
  questionText: string;
  options?: string[];
  category: string;
}

export interface MockInterviewQuestionsResponse {
  roundId: number;
  roundName: string;
  questions: MockInterviewQuestion[];
}

export interface MockInterviewAnswerResponse {
  questionId: string;
  score: number;
  instantFeedback: string;
  evaluatedCriteria: {
    technicalAccuracy: number;
    clarity: number;
    relevanceToRole: number;
  };
}

export interface MockProctorEventResponse {
  currentViolations: number;
  maxViolations: number;
  action: 'WARNING_ISSUED' | 'TERMINATE_SESSION';
  warningMessage: string;
}

export interface MockInterviewCompleteResponse {
  sessionId: string;
  overallScore: number;
  proctorStatus: 'PASSED' | 'TERMINATED_DUE_TO_CHEATING';
  totalViolationsLogged: number;
  roundBreakdown: {
    aptitudeScore: number;
    technicalScore: number;
    hrScore: number;
  };
  strengths: string[];
  improvementAreas: string[];
  hiringRecommendation: string;
}

export interface SkillGapItem {
  name: string;
  category: 'technical' | 'tool' | 'soft' | string;
  priority: 'High' | 'Medium' | 'Low' | string;
  currentProficiency: string;
  requiredProficiency: string;
  description: string;
}

export interface SkillGapAnalysisResponse {
  targetRole: string;
  readinessScore: number;
  summary: string;
  matchingSkills: string[];
  requiredSkills: string[];
  missingSkills: SkillGapItem[];
}

export interface CourseRecommendation {
  id: string;
  skillName: string;
  title: string;
  provider: string;
  url: string;
  type: string;
  duration: string;
  level: string;
  description: string;
}

export interface CareerMilestone {
  phase: string;
  focus: string;
  action: string;
  targetOutcome: string;
}

export interface CareerGrowthPlanResponse {
  targetRole: string;
  summary: string;
  courses: CourseRecommendation[];
  milestones: CareerMilestone[];
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
  async parseResume(
    file: File,
    options: { timeoutMs?: number; signal?: AbortSignal } = {}
  ): Promise<ResumeParseResponse> {
    const { timeoutMs = 120_000, signal } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onAbort);
    }
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/resume/parse`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      return await handleResponse<ResumeParseResponse>(response);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('The resume analysis took too long to complete. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
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

  /**
   * Initialize a mock interview session
   * POST /api/v1/mock-interview/start
   */
  async startMockInterview(
    candidateId: string,
    jobDescription: string,
    resumeText: string,
    targetRole: string
  ): Promise<MockInterviewStartResponse> {
    const response = await fetch(`${API_BASE_URL}/mock-interview/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId, jobDescription, resumeText, targetRole })
    });
    return handleResponse<MockInterviewStartResponse>(response);
  },

  /**
   * Fetch questions for an active round
   * GET /api/v1/mock-interview/questions
   */
  async getMockQuestions(sessionId: string, roundId: number): Promise<MockInterviewQuestionsResponse> {
    const response = await fetch(`${API_BASE_URL}/mock-interview/questions?sessionId=${sessionId}&roundId=${roundId}`);
    return handleResponse<MockInterviewQuestionsResponse>(response);
  },

  /**
   * Submit free text or MCQ answer
   * POST /api/v1/mock-interview/submit-answer
   */
  async submitMockAnswer(
    sessionId: string,
    roundId: number,
    questionId: string,
    userAnswerText: string
  ): Promise<MockInterviewAnswerResponse> {
    const response = await fetch(`${API_BASE_URL}/mock-interview/submit-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, roundId, questionId, userAnswerText })
    });
    return handleResponse<MockInterviewAnswerResponse>(response);
  },

  /**
   * Log proctoring violation event
   * POST /api/v1/mock-interview/proctor-event
   */
  async logProctorEvent(
    sessionId: string,
    violationType: 'TAB_SWITCH' | 'WINDOW_UNFOCUS' | 'FULLSCREEN_EXITED' | 'NO_FACE_DETECTED' | 'GAZE_AWAY' | 'PHONE_DETECTED',
    timestamp: string
  ): Promise<MockProctorEventResponse> {
    const response = await fetch(`${API_BASE_URL}/mock-interview/proctor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, violationType, timestamp })
    });
    return handleResponse<MockProctorEventResponse>(response);
  },

  /**
   * Generate final mock interview scorecard
   * POST /api/v1/mock-interview/complete
   */
  async completeMockInterview(sessionId: string): Promise<MockInterviewCompleteResponse> {
    const response = await fetch(`${API_BASE_URL}/mock-interview/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    return handleResponse<MockInterviewCompleteResponse>(response);
  },

  /**
   * Transcribe WebM audio blob
   * POST /api/v1/mock-interview/transcribe-audio
   */
  async transcribeMockAudio(audioBlob: Blob): Promise<{ success: boolean; transcript: string }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    const response = await fetch(`${API_BASE_URL}/mock-interview/transcribe-audio`, {
      method: 'POST',
      body: formData
    });
    return handleResponse<{ success: boolean; transcript: string }>(response);
  },

  /**
   * Analyze skill gaps between candidate resume/skills and target role
   * POST /api/v1/skill-gaps/analyze
   */
  async analyzeSkillGaps(
    resumeText: string,
    parsedSkills: string[],
    targetRole: string,
    jobDescription?: string
  ): Promise<SkillGapAnalysisResponse> {
    const response = await fetch(`${API_BASE_URL}/skill-gaps/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, parsedSkills, targetRole, jobDescription }),
    });
    return handleResponse<SkillGapAnalysisResponse>(response);
  },

  /**
   * Generate career growth upskilling plan with course links
   * POST /api/v1/career-growth/plan
   */
  async getCareerGrowthPlan(
    missingSkills: Array<string | SkillGapItem>,
    targetRole: string,
    resumeText?: string
  ): Promise<CareerGrowthPlanResponse> {
    const response = await fetch(`${API_BASE_URL}/career-growth/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingSkills, targetRole, resumeText }),
    });
    return handleResponse<CareerGrowthPlanResponse>(response);
  }
};
