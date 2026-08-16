// Simple in-memory session store for Mock Interviews and Proctoring state
const sessions = new Map();

export function createSession(sessionId, candidateId, jobDescription, resumeText, targetRole, questions) {
  const session = {
    sessionId,
    candidateId,
    jobDescription,
    resumeText,
    targetRole,
    status: 'IN_PROGRESS',
    proctorConfig: {
      maxAllowedViolations: 3,
      requireWebcam: true,
      requireMic: true,
      requireFullscreen: true
    },
    violations: [],
    violationCount: 0,
    roundQuestions: questions, // structure: { 1: MCQQuestion[], 2: FreeTextQuestion[], 3: FreeTextQuestion[] }
    answers: {} // questionId -> { userAnswerText, score, feedback, evaluatedCriteria }
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function addViolation(sessionId, violationType, timestamp) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.violations.push({ violationType, timestamp });
  session.violationCount = session.violations.length;

  let action = 'WARNING_ISSUED';
  let violationLabel = 'violating rules';
  if (violationType === 'TAB_SWITCH') violationLabel = 'switching browser tabs/windows';
  if (violationType === 'GAZE_AWAY') violationLabel = 'looking away from the screen';
  if (violationType === 'PHONE_DETECTED') violationLabel = 'using a mobile device / object detection warning';

  let warningMessage = `Warning: Prohibited activity detected (${violationLabel}). Session will auto-terminate after ${session.proctorConfig.maxAllowedViolations - session.violationCount} more warnings.`;

  if (session.violationCount >= session.proctorConfig.maxAllowedViolations) {
    session.status = 'TERMINATED';
    action = 'TERMINATE_SESSION';
    warningMessage = 'Session terminated due to multiple proctoring violations.';
  }

  return {
    currentViolations: session.violationCount,
    maxViolations: session.proctorConfig.maxAllowedViolations,
    action,
    warningMessage
  };
}

export function recordAnswer(sessionId, questionId, userAnswerText, evaluation) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.answers[questionId] = {
    userAnswerText,
    score: evaluation.score,
    feedback: evaluation.instantFeedback,
    evaluatedCriteria: evaluation.evaluatedCriteria
  };

  return session.answers[questionId];
}

export function completeSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (session.status !== 'TERMINATED') {
    session.status = 'COMPLETED';
  }
  return session;
}
