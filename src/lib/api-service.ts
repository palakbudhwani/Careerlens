// Service adapter layer for CareerLens Backend APIs
import {
  API_BASE_URL,
  API_HEALTH_URL,
  API_ORIGIN_LABEL,
  BACKEND_WAIT_BUDGET_MS,
  BACKEND_WAIT_INTERVAL_MS,
  IS_TEST_RUN,
} from './api-config'

/**
 * The backend could not be reached at all: it is not running, is still
 * starting, or the network refused the connection. This is NOT an application
 * error and NOT an AI-provider outage.
 */
export class BackendConnectionError extends Error {
  readonly kind = 'backend-connection'

  constructor(message: string) {
    super(message)
    this.name = 'BackendConnectionError'
  }
}

/**
 * The backend answered with an HTTP error status. `code` is set when the
 * backend attached one (AI provider failures use `AI_*` codes).
 */
export class ApiHttpError extends Error {
  readonly kind = 'http'
  readonly status: number
  readonly code?: string

  constructor(message: string, options: { status: number; code?: string }) {
    super(message)
    this.name = 'ApiHttpError'
    this.status = options.status
    this.code = options.code
  }

  /** True when Gemini/Groq (or its configuration) caused the failure. */
  get isAiProviderError(): boolean {
    return typeof this.code === 'string' && this.code.startsWith('AI_')
  }
}

/** Message shown whenever the backend itself cannot be reached. */
export function describeConnectionFailure(): string {
  return `Could not reach the CareerLens backend at ${API_ORIGIN_LABEL}. Start it with \`npm run dev\` and try again.`
}

/**
 * Upper bound for one API request. The backend's AI chain spends at most
 * PRIMARY_TIMEOUT_MS (20s) on the primary provider, then the fallback attempt
 * (60s), so a full chain is bounded at ~81s including the short fallback
 * backoff; this sits well above it: a slow-but-valid answer is never cut off,
 * while a stalled connection can no longer hang the UI forever.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 130_000

/** Health probes only prove the server is up — they must answer fast. */
export const HEALTH_TIMEOUT_MS = 3_000

/**
 * The request was aborted by our own deadline, not by the user and not by a
 * network failure. Callers must never see this turn into a backend-retry.
 */
export class RequestTimeoutError extends Error {
  readonly kind = 'timeout'
  readonly timeoutMs: number

  constructor(pathLabel: string, timeoutMs: number) {
    super(
      `The ${pathLabel} request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
    )
    this.name = 'RequestTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

function isConnectionError(error: unknown): boolean {
  if (error instanceof BackendConnectionError) return true
  if (error instanceof TypeError) return true
  const message = error instanceof Error ? error.message : ''
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|ERR_CONNECTION|ECONNREFUSED|ECONNRESET|socket hang up/i.test(
    message,
  )
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Probe the backend health endpoint. Any HTTP answer — even an error status —
 * proves the server is up; only a thrown fetch error means "not reachable".
 * The probe carries its own short deadline so a stalled socket can never hang
 * `waitForBackend()` (and therefore the UI's loading state).
 */
export async function checkBackendHealth(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    await fetch(API_HEALTH_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Poll the health endpoint until the backend answers or the budget runs out. */
async function waitForBackend(): Promise<boolean> {
  const deadline = Date.now() + BACKEND_WAIT_BUDGET_MS
  for (;;) {
    if (await checkBackendHealth()) return true
    if (Date.now() >= deadline) return false
    await sleep(BACKEND_WAIT_INTERVAL_MS)
  }
}

/**
 * Run a request; when the backend is unreachable, wait for it to come up and
 * retry exactly once. Application (HTTP) errors are never retried.
 */
async function run<T>(execute: () => Promise<T>): Promise<T> {
  try {
    return await execute()
  } catch (error) {
    if (IS_TEST_RUN || !isConnectionError(error)) throw error
    if (!(await waitForBackend())) throw new BackendConnectionError(describeConnectionFailure())
    return execute()
  }
}

/** Fire one API request and decode its JSON response or HTTP error. */
async function callApi<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return run(async () => {
    const method = (init?.method || 'GET').toUpperCase()
    const started = performance.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      // The deadline stays armed through body parsing too, so a response that
      // stalls mid-download also terminates.
      const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal })
      const result = await handleResponse<T>(response)
      // Duration and status only — never the request body or parsed answer, so
      // the log line is always safe to print.
      console.log(
        `[api] ${method} ${path} status=${response.status} in ${Math.round(performance.now() - started)}ms`,
      )
      return result
    } catch (error) {
      if (controller.signal.aborted) {
        throw new RequestTimeoutError(path, timeoutMs)
      }
      console.warn(
        `[api] ${method} ${path} error after ${Math.round(performance.now() - started)}ms: ${
          error instanceof Error ? error.name : 'unknown'
        }`,
      )
      throw error
    } finally {
      clearTimeout(timer)
    }
  })
}


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
  isAuthentic?: boolean;
  validationErrors?: string[];
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
  isAuthentic?: boolean;
  validationErrors?: string[];
  source?: string;
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
  source?: string;
}

export interface AnswerEvaluationResponse {
  score: number;
  feedback: string;
  suggested_improvement: string;
  source?: string;
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
  source?: string;
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
  source?: string;
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
  source?: string;
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
  source?: string;
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
  source?: string;
}

/**
 * Handle API response helper
 *
 * Throws `ApiHttpError` for HTTP failures so callers can tell an application
 * error (or an AI-provider outage, `AI_*` codes) apart from a dead backend.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMsg = 'An unexpected error occurred';
    let code: string | undefined;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.message || errorJson.error || errorMsg;
      code = typeof errorJson.code === 'string' ? errorJson.code : undefined;
    } catch {
      errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    }
    throw new ApiHttpError(errorMsg, { status: response.status, code });
  }
  return response.json() as Promise<T>;
}

export const apiService = {
  /**
   * Upload and parse a PDF resume
   * POST /api/v1/resume/parse
   *
   * Keeps its own timeout/abort semantics; the backend-availability retry wraps
   * the whole attempt so a server that is still booting is waited for once.
   */
  async parseResume(
    file: File,
    options: { timeoutMs?: number; signal?: AbortSignal } = {}
  ): Promise<ResumeParseResponse> {
    return run(() => parseResumeAttempt(file, options));
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
    return callApi<MatchAnalysisResponse>('/match/analyze', {
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
    return callApi<InterviewQuestionsResponse>('/interview/questions', {
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
  },

  /**
   * Evaluate a candidate's answer to an interview question
   * POST /api/v1/interview/evaluate
   */
  async evaluateAnswer(
    question: string,
    answer: string
  ): Promise<AnswerEvaluationResponse> {
    return callApi<AnswerEvaluationResponse>('/interview/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        answer,
      }),
    });
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
    return callApi<MockInterviewStartResponse>('/mock-interview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId, jobDescription, resumeText, targetRole })
    });
  },

  /**
   * Fetch questions for an active round
   * GET /api/v1/mock-interview/questions
   */
  async getMockQuestions(sessionId: string, roundId: number): Promise<MockInterviewQuestionsResponse> {
    return callApi<MockInterviewQuestionsResponse>(
      `/mock-interview/questions?sessionId=${sessionId}&roundId=${roundId}`
    );
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
    return callApi<MockInterviewAnswerResponse>('/mock-interview/submit-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, roundId, questionId, userAnswerText })
    });
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
    return callApi<MockProctorEventResponse>('/mock-interview/proctor-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, violationType, timestamp })
    });
  },

  /**
   * Generate final mock interview scorecard
   * POST /api/v1/mock-interview/complete
   */
  async completeMockInterview(sessionId: string): Promise<MockInterviewCompleteResponse> {
    return callApi<MockInterviewCompleteResponse>('/mock-interview/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
  },

  /**
   * Transcribe WebM audio blob
   * POST /api/v1/mock-interview/transcribe-audio
   */
  async transcribeMockAudio(audioBlob: Blob): Promise<{ success: boolean; transcript: string }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    return callApi<{ success: boolean; transcript: string }>('/mock-interview/transcribe-audio', {
      method: 'POST',
      body: formData
    });
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
    return callApi<SkillGapAnalysisResponse>('/skill-gaps/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, parsedSkills, targetRole, jobDescription }),
    });
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
    return callApi<CareerGrowthPlanResponse>('/career-growth/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingSkills, targetRole, resumeText }),
    });
  }
};

async function parseResumeAttempt(
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

    const started = performance.now();
    const response = await fetch(`${API_BASE_URL}/resume/parse`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    const parsed = await handleResponse<ResumeParseResponse>(response);
    console.log(
      `[api] POST /resume/parse status=${response.status} in ${Math.round(performance.now() - started)}ms`,
    );
    return parsed;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The resume analysis took too long to complete. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
