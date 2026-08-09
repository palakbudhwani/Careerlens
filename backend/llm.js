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
const DEFAULT_MODEL = 'gemini-2.5-flash';

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
    }
  },
  required: ["name", "email", "skills", "workExperience", "education"]
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
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          type: { type: "STRING", description: "Must be one of: Technical, Behavioral, Gap-Addressing" },
          question: { type: "STRING" },
          context: { type: "STRING" },
          sampleAnswerOutline: { type: "ARRAY", items: { type: "STRING" } },
          evalCriteria: { type: "STRING" }
        },
        required: ["id", "type", "question", "context", "sampleAnswerOutline", "evalCriteria"]
      }
    }
  },
  required: ["questions"]
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
 * Parse raw resume text
 */
export async function parseResume(resumeText) {
  const systemInstruction = `You are a resume parsing AI. Extract structured details from the resume text into the requested JSON schema. Be highly accurate, do not invent details, and structure the work experience highlights as bullet-point lists.`;
  const prompt = `Please parse the following resume text:\n\n${resumeText}`;

  if (!ai) {
    console.log('No LLM client. Returning mock parsed details.');
    return getMockParsedDetails(resumeText);
  }

  try {
    return await callLLM(prompt, systemInstruction, resumeParserSchema);
  } catch (error) {
    console.error('LLM parseResume failed, returning mock details:', error);
    return getMockParsedDetails(resumeText);
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
Generate ${count} tailored interview questions for a candidate with the provided resume applying to the target job description.
The difficulty of the questions should be: ${difficulty}.
Include a mix of:
- Technical (covering key skills required for the role)
- Behavioral (situational/culture fit)
- Gap-Addressing (exploring areas where the candidate's resume shows gaps relative to the job description)

For each question, explain the context (why you are asking it), provide a sampleAnswerOutline, and list the evalCriteria.
Enforce JSON format matching the schema.`;

  const prompt = `
Difficulty Level: ${difficulty}
Generate exactly ${count} questions.

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

function getMockParsedDetails(text) {
  return {
    name: "John Doe",
    email: "john.doe@example.com",
    skills: ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Tailwind CSS", "Git"],
    workExperience: [
      {
        role: "Frontend Engineer",
        company: "Pixel Craft Studios",
        location: "New York, NY",
        start: "Jan 2023",
        end: "Present",
        highlights: [
          "Developed and shipped 10+ dynamic React/TypeScript features using Tailwind CSS.",
          "Optimized page load speed by 25% by implementing lazy loading and code splitting.",
          "Collaborated closely with designers and product managers to maintain design systems."
        ]
      },
      {
        role: "Junior Developer",
        company: "Webflow Co",
        location: "Remote",
        start: "Jun 2021",
        end: "Dec 2022",
        highlights: [
          "Maintained and updated customer-facing web layouts in HTML/CSS and JavaScript.",
          "Fixed UI bugs and added unit tests, improving test coverage by 15%."
        ]
      }
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        institution: "State University",
        year: "2021",
        field: "Software Engineering"
      }
    ]
  };
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

function getMockInterviewQuestions(resumeText, jobDescription, difficulty, count) {
  const questions = [];
  const categories = ["Technical", "Behavioral", "Gap-Addressing"];
  
  for (let i = 1; i <= count; i++) {
    const type = categories[(i - 1) % categories.length];
    let qText = "";
    let context = "";
    let outline = [];
    let criteria = "";

    if (type === "Technical") {
      qText = `How do you manage complex application state in a React application with TypeScript? Can you discuss the pros and cons of using Context API vs custom state libraries?`;
      context = `Assesses the candidate's understanding of state management patterns in modern React, which is key for this role.`;
      outline = ["Explain basic component state.", "Discuss when Context API starts causing re-renders.", "Mention Redux or Zustand as alternatives for global state.", "Provide typing examples with TypeScript."];
      criteria = `Looks for depth of experience with state performance trade-offs and TypeScript safety.`;
    } else if (type === "Behavioral") {
      qText = `Describe a situation where you had a disagreement with a designer or product manager regarding how a feature should be implemented. How did you resolve it?`;
      context = `Evaluates communication, negotiation skills, and cross-functional collaboration.`;
      outline = ["Describe the context of disagreement.", "Discuss how you actively listened to their user experience concerns.", "Explain how you proposed a compromise or backed it up with data/performance metrics.", "State the final positive outcome."];
      criteria = `Checks for empathy, professional communication, and constructive problem-solving skills.`;
    } else {
      qText = `I notice your resume highlights frontend work, but this role lists GraphQL and Docker. How would you go about getting up to speed with these tools in your first few weeks?`;
      context = `Addresses the gap between your frontend focus and the backend containerization requirements.`;
      outline = ["Acknowledge familiarity with the concepts.", "Explain your learning methodology (docs, tutorial projects).", "Mention how you've quickly learned new tech in a past role."];
      criteria = `Assesses adaptability, enthusiasm for learning, and proactive problem-solving.`;
    }

    questions.push({
      id: `q-mock-00${i}`,
      type,
      question: qText,
      context,
      sampleAnswerOutline: outline,
      evalCriteria: criteria
    });
  }

  return { questions };
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
