import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import pdf from 'pdf-parse';
import { parseResume, analyzeMatch, generateQuestions, evaluateAnswer } from './llm.js';
import { analyzeSkillGaps, generateCareerGrowthPlan } from './skillGapLlm.js';
import { 
  createSession, 
  getSession, 
  addViolation, 
  recordAnswer, 
  completeSession 
} from './mockInterviewStore.js';
import { 
  generateMockQuestions, 
  evaluateMockAnswer, 
  generateFinalScorecard 
} from './mockInterviewLlm.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for local development ports
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer memory storage configuration for PDF files
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only accept PDFs
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported!'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to count words
function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Global request log
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * Endpoint 1: Match Analysis & ATS Scoring
 * Route: POST /api/v1/match/analyze
 */
app.post('/api/v1/match/analyze', async (req, res, next) => {
  try {
    const { resumeText, jobDescription, candidateId, jobId } = req.body;

    // 1. Missing fields check -> 400 Bad Request
    if (!resumeText || !jobDescription) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: resumeText and jobDescription must be provided.'
      });
    }

    // 2. Length check -> 422 Unprocessable Entity
    const resumeWordCount = countWords(resumeText);
    const jobWordCount = countWords(jobDescription);

    if (resumeWordCount < 50 || jobWordCount < 50) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Validation failed: Both resumeText and jobDescription must be at least 50 words long.',
        details: {
          resumeWordCount,
          jobWordCount,
          requiredMin: 50
        }
      });
    }

    console.log(`Analyzing match (Resume: ${resumeWordCount} words, Job: ${jobWordCount} words)...`);
    
    // Parse resume first to check authenticity
    const parsedResume = await parseResume(resumeText);
    if (parsedResume.isAuthentic === false) {
      return res.status(200).json({
        matchId: "match-" + Math.floor(Math.random() * 100000),
        atsScore: 0,
        breakdown: {
          skillsMatchScore: 0,
          experienceScore: 0,
          educationScore: 0,
          keywordDensityScore: 0
        },
        summary: "Match analysis blocked: The uploaded resume failed verification checks. " + (parsedResume.validationErrors || []).join(", "),
        matchingSkills: [],
        missingSkills: [],
        gaps: [],
        atsFeedback: {
          formattingNotes: ["Resume verification failed: " + (parsedResume.validationErrors || []).join(", ")],
          actionVerbsCheck: "Failed verification",
          keywordFrequency: []
        },
        isAuthentic: false,
        validationErrors: parsedResume.validationErrors || []
      });
    }

    const analysisResult = await analyzeMatch(resumeText, jobDescription);
    
    // Attach input IDs if passed
    if (candidateId) analysisResult.candidateId = candidateId;
    if (jobId) analysisResult.jobId = jobId;

    // Attach authenticity flags to the response
    analysisResult.isAuthentic = parsedResume.isAuthentic;
    analysisResult.validationErrors = parsedResume.validationErrors;

    return res.status(200).json(analysisResult);
  } catch (error) {
    next(error);
  }
});

/**
 * Endpoint 2: Interview Question Generator
 * Route: POST /api/v1/interview/questions
 */
app.post('/api/v1/interview/questions', async (req, res, next) => {
  try {
    const { resumeText, jobDescription, difficulty, questionCount } = req.body;

    // 1. Missing fields check -> 400 Bad Request
    if (!resumeText || !jobDescription) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: resumeText and jobDescription must be provided.'
      });
    }

    // 2. Length check -> 422 Unprocessable Entity
    const resumeWordCount = countWords(resumeText);
    const jobWordCount = countWords(jobDescription);

    if (resumeWordCount < 50 || jobWordCount < 50) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Validation failed: Both resumeText and jobDescription must be at least 50 words long.',
        details: { resumeWordCount, jobWordCount }
      });
    }

    const count = questionCount ? parseInt(questionCount, 10) : 5;
    const diff = difficulty || 'Mid';

    console.log(`Generating ${count} ${diff} questions...`);
    const result = await generateQuestions(resumeText, jobDescription, diff, count);
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Endpoint 3: Resume Parser (File Upload)
 * Route: POST /api/v1/resume/parse
 */
app.post('/api/v1/resume/parse', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No file uploaded. Please upload a PDF resume file under key "file".'
      });
    }

    console.log(`Parsing PDF file: ${req.file.originalname} (${req.file.size} bytes)...`);

    // Parse PDF buffer to text
    let resumeText = '';
    try {
      const parsedPdf = await pdf(req.file.buffer);
      resumeText = parsedPdf.text;
    } catch (pdfError) {
      console.warn('PDF parsing library failed, attempting fallback binary stream extraction...', pdfError.message);
      try {
        resumeText = extractTextFromCorruptedPdf(req.file.buffer);
      } catch (fallbackError) {
        console.error('Fallback PDF extraction also failed:', fallbackError);
      }

      if (!resumeText || resumeText.trim().length < 10) {
        return res.status(422).json({
          error: 'Unprocessable Entity',
          message: 'Failed to extract text from the PDF file. The file may be corrupt or encrypted.'
        });
      }
    }
    const wordCount = countWords(resumeText);

    if (wordCount < 10) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Extracted text from resume is too short. Please upload a textual PDF (non-scanned or with OCR).'
      });
    }

    console.log(`Successfully extracted ${wordCount} words from PDF. Querying LLM for details...`);
    const parsedDetails = await parseResume(resumeText);

    return res.status(200).json({
      resumeText,
      parsedDetails
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Bonus Endpoint: Interview Answer Evaluator
 * Route: POST /api/v1/interview/evaluate
 */
app.post('/api/v1/interview/evaluate', async (req, res, next) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: question and answer must be provided.'
      });
    }

    console.log(`Evaluating answer for question...`);
    const result = await evaluateAnswer(question, answer);
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Multer configuration for audio file uploads
const audioUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.endsWith('.webm') || file.originalname.endsWith('.wav')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are supported!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Route: POST /api/v1/mock-interview/start
 */
app.post('/api/v1/mock-interview/start', async (req, res, next) => {
  try {
    const { candidateId, jobDescription, resumeText, targetRole } = req.body;

    if (!candidateId || !jobDescription || !resumeText || !targetRole) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: candidateId, jobDescription, resumeText, and targetRole must be provided.'
      });
    }

    console.log(`Generating mock interview questions for role: ${targetRole}...`);
    const questions = await generateMockQuestions(resumeText, jobDescription, targetRole);

    const sessionId = `interview-session-${Math.floor(1000 + Math.random() * 9000)}`;
    const session = createSession(sessionId, candidateId, jobDescription, resumeText, targetRole, questions);

    return res.status(200).json({
      sessionId: session.sessionId,
      status: session.status,
      rounds: [
        { roundId: 1, name: "Aptitude", durationMinutes: 15, totalQuestions: session.roundQuestions.round1.length },
        { roundId: 2, name: "Technical", durationMinutes: 25, totalQuestions: session.roundQuestions.round2.length },
        { roundId: 3, name: "HR & Behavioral", durationMinutes: 15, totalQuestions: session.roundQuestions.round3.length }
      ],
      proctorConfig: session.proctorConfig
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Route: GET /api/v1/mock-interview/questions
 */
app.get('/api/v1/mock-interview/questions', async (req, res, next) => {
  try {
    const { sessionId, roundId } = req.query;

    if (!sessionId || !roundId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required query parameters: sessionId and roundId must be provided.'
      });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Interview session with ID ${sessionId} not found.`
      });
    }

    const rId = parseInt(roundId, 10);
    let questionsList = [];
    let roundName = "";

    if (rId === 1) {
      questionsList = session.roundQuestions.round1;
      roundName = "Aptitude";
    } else if (rId === 2) {
      questionsList = session.roundQuestions.round2;
      roundName = "Technical";
    } else if (rId === 3) {
      questionsList = session.roundQuestions.round3;
      roundName = "HR & Behavioral";
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid roundId. Must be 1, 2, or 3.'
      });
    }

    // Strip correctAnswerIndex from MCQs so candidates can't cheat by viewing JSON!
    const safeQuestionsList = questionsList.map(q => {
      if (q.type === 'MCQ') {
        const { correctAnswerIndex, ...rest } = q;
        return rest;
      }
      return q;
    });

    return res.status(200).json({
      roundId: rId,
      roundName,
      questions: safeQuestionsList
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Route: POST /api/v1/mock-interview/submit-answer
 */
app.post('/api/v1/mock-interview/submit-answer', async (req, res, next) => {
  try {
    const { sessionId, roundId, questionId, userAnswerText } = req.body;

    if (!sessionId || !roundId || !questionId || userAnswerText === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: sessionId, roundId, questionId, and userAnswerText must be provided.'
      });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Interview session with ID ${sessionId} not found.`
      });
    }

    if (session.status === 'TERMINATED') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Session has been terminated due to proctor violations.'
      });
    }

    const rId = parseInt(roundId, 10);
    let evaluationResult = null;

    if (rId === 1) {
      const questionsList = session.roundQuestions.round1;
      const question = questionsList.find(q => q.questionId === questionId);
      
      if (!question) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Question with ID ${questionId} not found in this round.`
        });
      }

      const correctOptionIndex = question.correctAnswerIndex;
      const correctOptionText = question.options[correctOptionIndex];
      const isCorrect = (userAnswerText.trim().toLowerCase() === correctOptionText.trim().toLowerCase()) || 
                        (userAnswerText.trim() === String(correctOptionIndex));

      evaluationResult = {
        score: isCorrect ? 10.0 : 0.0,
        instantFeedback: isCorrect 
          ? `Correct! The answer is indeed: ${correctOptionText}.` 
          : `Incorrect. The correct answer was: ${correctOptionText}.`,
        evaluatedCriteria: {
          technicalAccuracy: isCorrect ? 10.0 : 0.0,
          clarity: 10.0,
          relevanceToRole: 10.0
        }
      };
    } else if (rId === 2 || rId === 3) {
      const questionsList = rId === 2 ? session.roundQuestions.round2 : session.roundQuestions.round3;
      const question = questionsList.find(q => q.questionId === questionId);

      if (!question) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Question with ID ${questionId} not found in this round.`
        });
      }

      console.log(`Evaluating round ${rId} answer for question ${questionId}...`);
      evaluationResult = await evaluateMockAnswer(question.questionText, userAnswerText, rId);
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid roundId. Must be 1, 2, or 3.'
      });
    }

    const savedAnswer = recordAnswer(sessionId, questionId, userAnswerText, evaluationResult);

    return res.status(200).json({
      questionId,
      score: savedAnswer.score,
      instantFeedback: savedAnswer.feedback,
      evaluatedCriteria: savedAnswer.evaluatedCriteria
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Route: POST /api/v1/mock-interview/proctor-event
 */
app.post('/api/v1/mock-interview/proctor-event', async (req, res, next) => {
  try {
    const { sessionId, violationType, timestamp } = req.body;

    if (!sessionId || !violationType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: sessionId and violationType must be provided.'
      });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Interview session with ID ${sessionId} not found.`
      });
    }

    const result = addViolation(sessionId, violationType, timestamp || new Date().toISOString());

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Route: POST /api/v1/mock-interview/complete
 */
app.post('/api/v1/mock-interview/complete', async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: sessionId must be provided.'
      });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Interview session with ID ${sessionId} not found.`
      });
    }

    completeSession(sessionId);

    console.log(`Compiling final mock interview scorecard for session ${sessionId}...`);
    const scorecard = await generateFinalScorecard(session);

    let aptitudeSum = 0, aptitudeCount = 0;
    let technicalSum = 0, technicalCount = 0;
    let hrSum = 0, hrCount = 0;

    session.roundQuestions.round1.forEach(q => {
      const ans = session.answers[q.questionId];
      if (ans) {
        aptitudeSum += ans.score;
        aptitudeCount++;
      }
    });

    session.roundQuestions.round2.forEach(q => {
      const ans = session.answers[q.questionId];
      if (ans) {
        technicalSum += ans.score;
        technicalCount++;
      }
    });

    session.roundQuestions.round3.forEach(q => {
      const ans = session.answers[q.questionId];
      if (ans) {
        hrSum += ans.score;
        hrCount++;
      }
    });

    const roundBreakdown = {
      aptitudeScore: aptitudeCount > 0 ? Math.round((aptitudeSum / (aptitudeCount * 10)) * 100) : 0,
      technicalScore: technicalCount > 0 ? Math.round((technicalSum / (technicalCount * 10)) * 100) : 0,
      hrScore: hrCount > 0 ? Math.round((hrSum / (hrCount * 10)) * 100) : 0
    };

    return res.status(200).json({
      sessionId: session.sessionId,
      overallScore: session.status === 'TERMINATED' ? 0 : scorecard.overallScore,
      proctorStatus: session.status === 'TERMINATED' ? 'TERMINATED_DUE_TO_CHEATING' : 'PASSED',
      totalViolationsLogged: session.violationCount,
      roundBreakdown,
      strengths: session.status === 'TERMINATED' ? [] : scorecard.strengths,
      improvementAreas: scorecard.improvementAreas,
      hiringRecommendation: scorecard.hiringRecommendation
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Route: POST /api/v1/mock-interview/transcribe-audio
 */
app.post('/api/v1/mock-interview/transcribe-audio', audioUpload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No audio file uploaded. Please upload an audio file under key "audio".'
      });
    }

    console.log(`Received audio file: ${req.file.originalname} (${req.file.size} bytes)...`);

    // Simulated speech-to-text response
    const transcript = "To optimize a React application, I use React.memo to prevent unnecessary re-renders, lazy loading with React.Suspense for code splitting, and useCallback/useMemo for stable function references.";
    
    return res.status(200).json({
      success: true,
      transcript: transcript
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Route: POST /api/v1/skill-gaps/analyze
 */
app.post('/api/v1/skill-gaps/analyze', async (req, res, next) => {
  try {
    const { resumeText, parsedSkills, targetRole, jobDescription } = req.body;

    console.log(`Analyzing skill gaps for target role: ${targetRole || 'Software Engineer'}...`);
    const result = await analyzeSkillGaps(resumeText, parsedSkills, targetRole, jobDescription);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Route: POST /api/v1/career-growth/plan
 */
app.post('/api/v1/career-growth/plan', async (req, res, next) => {
  try {
    const { missingSkills, targetRole, resumeText } = req.body;

    console.log(`Generating career growth plan for target role: ${targetRole || 'Software Engineer'}...`);
    const result = await generateCareerGrowthPlan(missingSkills, targetRole, resumeText);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

function extractTextFromCorruptedPdf(buffer) {
  const content = buffer.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let text = '';

  while ((match = streamRegex.exec(content)) !== null) {
    const streamData = match[1];
    const textRegex = /\(([^)]+)\)\s*(?:Tj|TJ)/g;
    let textMatch;
    while ((textMatch = textRegex.exec(streamData)) !== null) {
      text += textMatch[1] + ' ';
    }
  }

  return text.trim();
}

// Central error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Handled Multer errors
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `File upload error: ${err.message}`
    });
  }
  
  if (err.message && err.message.includes('CORS')) {
    return res.status(400).json({
      error: 'CORS Blocked',
      message: err.message
    });
  }

  return res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred on the server.'
  });
});

app.listen(port, () => {
  console.log(`CareerLens backend server running at http://localhost:${port}`);
  console.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);
});
