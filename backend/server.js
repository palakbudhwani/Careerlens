import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import pdf from 'pdf-parse';
import { parseResume, analyzeMatch, generateQuestions, evaluateAnswer } from './llm.js';

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

// pdf-parse bundles several pdf.js builds. Use the newest bundled one: older
// builds (the default v1.10.100) are far less tolerant of modern PDFs.
const PDF_PARSE_VERSION = 'v2.0.550';

// Multer stores uploads in memory as Node Buffers. Node allocates small Buffers
// from a shared pool, so they carry a non-zero byteOffset into a larger
// ArrayBuffer. The bundled pdf.js reads the xref table from that raw
// ArrayBuffer and fails with "bad XRef entry" on perfectly valid PDFs.
// Copying into a fresh Uint8Array (byteOffset 0) fixes this reliably.
function toPlainPdfBytes(buffer) {
  return new Uint8Array(buffer);
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
    const analysisResult = await analyzeMatch(resumeText, jobDescription);
    
    // Attach input IDs if passed
    if (candidateId) analysisResult.candidateId = candidateId;
    if (jobId) analysisResult.jobId = jobId;

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
    let parsedPdf;
    try {
      parsedPdf = await pdf(toPlainPdfBytes(req.file.buffer), { version: PDF_PARSE_VERSION });
    } catch (pdfError) {
      console.error('PDF parsing library failed:', pdfError);
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Failed to extract text from the PDF file. The file may be corrupt or encrypted.'
      });
    }

    const resumeText = parsedPdf.text;
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
