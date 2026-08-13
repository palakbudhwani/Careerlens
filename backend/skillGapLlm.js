import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('Gemini API client initialized in skillGapLlm module.');
  } catch (error) {
    console.error('Failed to initialize Gemini API in skillGapLlm:', error);
  }
}

const DEFAULT_MODEL = 'gemini-flash-latest';

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
 * Call Gemini LLM with schema
 */
async function callLLM(prompt, systemInstruction, schema) {
  if (!ai) throw new Error('LLM client not initialized');
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.2
    }
  });
  return JSON.parse(response.text);
}

/**
 * Main Function 1: Skill Gap Analysis
 */
export async function analyzeSkillGaps(resumeText, parsedSkills = [], targetRole = 'Software Engineer', jobDescription = '') {
  const prompt = `
Target Role: ${targetRole}
Job Description Context: ${jobDescription || 'Standard requirements for ' + targetRole}

Candidate Parsed Skills: ${JSON.stringify(parsedSkills)}

Candidate Full Resume:
${resumeText || 'No resume text available.'}

Evaluate the candidate's skills against the target role: "${targetRole}".
Identify matching skills, required role skills, missing skills (with category, priority: High/Medium/Low, current proficiency, required proficiency, and explanation), calculate a realistic readiness score (0-100), and write a concise executive summary.
`;

  const systemInstruction = `You are an expert Career Development Coach and Technical Recruiter.
Analyze the candidate's resume and skill list against the target role requirements.
Be accurate and realistic. Categorize missing skills clearly and assign priority based on critical role requirements.`;

  if (!ai) {
    console.log('[skillGapLlm] No LLM client available. Using deterministic Skill Gap analysis.');
    return getFallbackSkillGapAnalysis(parsedSkills, targetRole, jobDescription);
  }

  try {
    return await callLLM(prompt, systemInstruction, skillGapAnalysisSchema);
  } catch (error) {
    console.error('[skillGapLlm] LLM call failed, returning fallback skill gap analysis:', error);
    return getFallbackSkillGapAnalysis(parsedSkills, targetRole, jobDescription);
  }
}

/**
 * Main Function 2: Career Growth Plan & Course Recommendations
 */
export async function generateCareerGrowthPlan(missingSkills = [], targetRole = 'Software Engineer', resumeText = '') {
  const missingSkillNames = Array.isArray(missingSkills) 
    ? missingSkills.map(s => typeof s === 'string' ? s : s.name)
    : [];

  const prompt = `
Target Role: ${targetRole}
Missing Skills to Upskill: ${JSON.stringify(missingSkillNames)}

Candidate Resume Context:
${resumeText.slice(0, 1000) || 'Standard tech candidate'}

Generate a tailored Career Growth Plan to bridge these skill gaps for the target role: "${targetRole}".
For each missing skill (or top priority skills), recommend at least 1-2 high quality courses or learning resources.
Provide real, clickable external links to top platforms like Udemy, Coursera, freeCodeCamp, YouTube, edX, or Pluralsight.
Also construct a 3-stage milestone roadmap (Phase 1, Phase 2, Phase 3) for upskilling over 3 to 6 months.
`;

  const systemInstruction = `You are a Senior Learning & Development Director.
Suggest real, practical courses with accurate URLs on major learning platforms (Coursera, Udemy, YouTube, freeCodeCamp, edX, etc.).
Ensure course URLs are valid web links formatted cleanly.`;

  if (!ai) {
    console.log('[skillGapLlm] No LLM client available. Using deterministic Career Growth course generator.');
    return getFallbackCareerGrowthPlan(missingSkillNames, targetRole);
  }

  try {
    const result = await callLLM(prompt, systemInstruction, careerGrowthPlanSchema);
    // Enrich or sanitize course links if necessary
    result.courses = (result.courses || []).map((c, i) => ({
      ...c,
      id: c.id || `course-${i + 1}`,
      url: validateOrFallbackUrl(c.skillName, c.url)
    }));
    return result;
  } catch (error) {
    console.error('[skillGapLlm] LLM call failed, returning fallback career growth plan:', error);
    return getFallbackCareerGrowthPlan(missingSkillNames, targetRole);
  }
}

// ---------------------------------------------------------------------------
// Fallback & Curated Knowledge Engine
// ---------------------------------------------------------------------------

const ROLE_SKILLS_MAP = {
  'frontend engineer': ['TypeScript', 'React', 'Next.js', 'CSS & Tailwind', 'State Management', 'Web Performance', 'Jest & Testing', 'REST & GraphQL'],
  'senior frontend engineer': ['TypeScript', 'React', 'Next.js', 'Design Systems', 'Web Performance', 'Micro-Frontends', 'CI/CD & Testing', 'GraphQL'],
  'backend engineer': ['Node.js', 'Python', 'PostgreSQL', 'Docker', 'Kubernetes', 'Redis', 'System Design', 'REST & gRPC APIs'],
  'full-stack engineer': ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'System Design', 'GraphQL'],
  'data scientist': ['Python', 'SQL', 'Machine Learning', 'Pandas & NumPy', 'PyTorch / TensorFlow', 'Data Visualization', 'Statistics', 'MLOps'],
  'ai product engineer': ['Python', 'TypeScript', 'React', 'LLM APIs & Prompting', 'Vector DBs (Pinecone/Chroma)', 'LangChain / LlamaIndex', 'Node.js', 'FastAPI'],
  'ai / ml engineer': ['Python', 'PyTorch', 'Transformers & HuggingFace', 'MLOps & MLflow', 'Docker', 'CUDA & GPU Computing', 'Vector DBs', 'System Design'],
  'devops engineer': ['Docker', 'Kubernetes', 'Terraform', 'AWS / Cloud Infrastructure', 'CI/CD Pipelines', 'Linux Administration', 'Prometheus & Grafana', 'Python / Bash'],
  'mobile developer': ['React Native / Flutter', 'TypeScript', 'iOS / Swift', 'Android / Kotlin', 'Mobile State Management', 'REST & GraphQL', 'App Store Deployment']
};

const COURSE_DATABASE = {
  'typescript': [
    {
      title: 'Understanding TypeScript',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/understanding-typescript/',
      type: 'Paid / Certificate',
      duration: '15 hours',
      level: 'Beginner to Advanced',
      description: 'Master TypeScript, compiler configuration, design patterns, and integration with React/Node.'
    },
    {
      title: 'TypeScript Course for Beginners',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=gieEQFIfgYc',
      type: 'Free',
      duration: '5 hours',
      level: 'Beginner',
      description: 'Comprehensive guide covering types, interfaces, generics, classes, and project setups.'
    }
  ],
  'react': [
    {
      title: 'The Ultimate React Course: React, Redux & More',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/the-ultimate-react-course/',
      type: 'Paid / Certificate',
      duration: '65 hours',
      level: 'All Levels',
      description: 'Build modern React applications with hooks, state management, Query, and modern architecture.'
    },
    {
      title: 'React Course - Beginner\'s Tutorial',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
      type: 'Free',
      duration: '12 hours',
      level: 'Beginner',
      description: 'Learn components, JSX, props, state, hooks, and build hands-on applications.'
    }
  ],
  'node.js': [
    {
      title: 'Node.js, Express & MongoDB Dev to Deployment',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/',
      type: 'Paid / Certificate',
      duration: '42 hours',
      level: 'Intermediate',
      description: 'Master Node.js runtime, Express REST API development, security, authentication, and deployment.'
    },
    {
      title: 'Node.js Full Course for Beginners',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
      type: 'Free',
      duration: '8 hours',
      level: 'Beginner',
      description: 'Understand event loops, asynchronous I/O, Express routing, and backend fundamentals.'
    }
  ],
  'docker': [
    {
      title: 'Docker & Kubernetes: The Practical Guide',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/docker-kubernetes-the-practical-guide/',
      type: 'Paid / Certificate',
      duration: '23 hours',
      level: 'All Levels',
      description: 'Learn containerization, images, volumes, environment configuration, and Kubernetes orchestration.'
    },
    {
      title: 'Docker Tutorial for Beginners',
      provider: 'YouTube (Programming with Mosh)',
      url: 'https://www.youtube.com/watch?v=pTFZFxd4hOI',
      type: 'Free',
      duration: '2 hours',
      level: 'Beginner',
      description: 'Quick crash course on containers, Dockerfiles, images, ports, and Docker Compose.'
    }
  ],
  'kubernetes': [
    {
      title: 'Certified Kubernetes Application Developer (CKAD)',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/certified-kubernetes-application-developer/',
      type: 'Paid / Certificate',
      duration: '10 hours',
      level: 'Intermediate to Advanced',
      description: 'Hands-on training for Kubernetes pods, deployments, services, volumes, and ingress.'
    },
    {
      title: 'Kubernetes Course for Beginners',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=X48VuDVv0do',
      type: 'Free',
      duration: '4 hours',
      level: 'Beginner',
      description: 'Learn pods, deployments, services, ingress controllers, and cluster management.'
    }
  ],
  'python': [
    {
      title: '100 Days of Code: The Complete Python Pro Bootcamp',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/100-days-of-code/',
      type: 'Paid / Certificate',
      duration: '60 hours',
      level: 'Beginner to Intermediate',
      description: 'Master Python programming, web scraping, data analysis, automation, and backend projects.'
    },
    {
      title: 'Python for Beginners - Full Course',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
      type: 'Free',
      duration: '4 hours',
      level: 'Beginner',
      description: 'Core syntax, variables, data structures, loops, functions, and OOP in Python.'
    }
  ],
  'sql': [
    {
      title: 'The Complete SQL Bootcamp',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/',
      type: 'Paid / Certificate',
      duration: '9 hours',
      level: 'Beginner to Advanced',
      description: 'Master PostgreSQL, SQL queries, complex joins, GROUP BY aggregations, and database schemas.'
    },
    {
      title: 'SQL Tutorial - Full Database Course',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
      type: 'Free',
      duration: '4 hours',
      level: 'Beginner',
      description: 'Relational database fundamentals, SQL queries, table creation, and normalization.'
    }
  ],
  'aws': [
    {
      title: 'AWS Certified Solutions Architect Associate',
      provider: 'Udemy',
      url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/',
      type: 'Paid / Certificate',
      duration: '27 hours',
      level: 'Intermediate',
      description: 'Comprehensive AWS cloud computing, EC2, S3, RDS, Lambda, VPC, and architecture patterns.'
    },
    {
      title: 'AWS Basics for Beginners',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=ulprqHHWlng',
      type: 'Free',
      duration: '4 hours',
      level: 'Beginner',
      description: 'Overview of core AWS services, cloud hosting, IAM security, and serverless concepts.'
    }
  ],
  'system design': [
    {
      title: 'Grokking the System Design Interview',
      provider: 'DesignGurus',
      url: 'https://www.designgurus.io/course/grokking-the-system-design-interview',
      type: 'Paid',
      duration: '20 hours',
      level: 'Intermediate to Advanced',
      description: 'Master scalable architecture, load balancers, caching, database sharding, and message queues.'
    },
    {
      title: 'System Design Course for Beginners',
      provider: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=m8Icp_Cid5o',
      type: 'Free',
      duration: '5 hours',
      level: 'Beginner to Intermediate',
      description: 'Learn architectural design principles, CDN caching, SQL vs NoSQL, and scalability.'
    }
  ],
  'machine learning': [
    {
      title: 'Machine Learning Specialization by Andrew Ng',
      provider: 'Coursera',
      url: 'https://www.coursera.org/specializations/machine-learning-introduction',
      type: 'Certificate Option',
      duration: '60 hours',
      level: 'Beginner to Intermediate',
      description: 'Learn fundamental ML algorithms, supervised learning, neural networks, and model evaluation.'
    },
    {
      title: 'Practical Deep Learning for Coders',
      provider: 'fast.ai',
      url: 'https://course.fast.ai/',
      type: 'Free',
      duration: '30 hours',
      level: 'Intermediate',
      description: 'Hands-on deep learning with PyTorch, computer vision, NLP, and model deployment.'
    }
  ]
};

function getFallbackSkillGapAnalysis(parsedSkills = [], targetRole = 'Software Engineer', jobDescription = '') {
  const roleKey = (targetRole || '').toLowerCase().trim();
  let reqSkills = ROLE_SKILLS_MAP[roleKey];

  if (!reqSkills) {
    const foundKey = Object.keys(ROLE_SKILLS_MAP).find(k => roleKey.includes(k) || k.includes(roleKey));
    reqSkills = foundKey ? ROLE_SKILLS_MAP[foundKey] : ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'System Design', 'Testing'];
  }

  const existingSkills = (parsedSkills || []).map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase());
  
  const matchingSkills = [];
  const missingSkills = [];

  reqSkills.forEach(req => {
    const isMatched = existingSkills.some(e => e.includes(req.toLowerCase()) || req.toLowerCase().includes(e));
    if (isMatched) {
      matchingSkills.push(req);
    } else {
      let category = 'technical';
      let priority = 'High';
      let reqProf = 'Advanced';
      let curProf = 'None';
      let desc = `Crucial requirement for ${targetRole}. Focus on gaining practical project exposure.`;

      if (/docker|kubernetes|aws|terraform|git|jest|testing/i.test(req)) {
        category = 'tool';
        priority = 'Medium';
        reqProf = 'Intermediate';
      } else if (/leadership|communication|agile|collaboration/i.test(req)) {
        category = 'soft';
        priority = 'Medium';
      }

      missingSkills.push({
        name: req,
        category,
        priority,
        currentProficiency: curProf,
        requiredProficiency: reqProf,
        description: desc
      });
    }
  });

  const totalReq = reqSkills.length;
  const matchCount = matchingSkills.length;
  const readinessScore = totalReq > 0 ? Math.round((matchCount / totalReq) * 100) : 50;

  return {
    targetRole,
    readinessScore,
    summary: `Based on your resume, you match ${matchCount} out of ${totalReq} key requirement areas for ${targetRole} (${readinessScore}% readiness). Focusing on the ${missingSkills.length} identified gap skills will significantly boost your interview match potential.`,
    matchingSkills,
    requiredSkills: reqSkills,
    missingSkills
  };
}

function getFallbackCareerGrowthPlan(missingSkills = [], targetRole = 'Software Engineer') {
  const skillsToAddress = missingSkills.length > 0 ? missingSkills : ['TypeScript', 'Docker', 'System Design', 'PostgreSQL'];
  const courses = [];

  skillsToAddress.forEach((skill, index) => {
    const cleanSkill = skill.toLowerCase().trim();
    const dbMatchKey = Object.keys(COURSE_DATABASE).find(k => cleanSkill.includes(k) || k.includes(cleanSkill));

    if (dbMatchKey && COURSE_DATABASE[dbMatchKey]) {
      COURSE_DATABASE[dbMatchKey].forEach((c, cIdx) => {
        courses.push({
          id: `course-${index + 1}-${cIdx + 1}`,
          skillName: skill,
          ...c
        });
      });
    } else {
      courses.push({
        id: `course-${index + 1}-1`,
        skillName: skill,
        title: `${skill} Mastery & Real-World Projects`,
        provider: 'Udemy / Coursera',
        url: `https://www.google.com/search?q=${encodeURIComponent(skill + ' course online freecodecamp udemy coursera')}`,
        type: 'Paid / Certificate',
        duration: '10–15 hours',
        level: 'Beginner to Intermediate',
        description: `Comprehensive training in ${skill} focusing on modern best practices and hands-on exercises.`
      });
    }
  });

  const milestones = [
    {
      phase: 'Phase 1 (Month 1-2)',
      focus: `Core Skill Foundation (${skillsToAddress.slice(0, 2).join(', ') || 'Primary Gaps'})`,
      action: 'Complete foundational video courses and implement code practice exercises daily.',
      targetOutcome: 'Build 1 hands-on feature or mini-project integrating the new skill.'
    },
    {
      phase: 'Phase 2 (Month 3-4)',
      focus: `Advanced Integration (${skillsToAddress.slice(2, 4).join(', ') || 'Secondary Gaps'})`,
      action: 'Build a production-grade portfolio project incorporating your new skills end-to-end.',
      targetOutcome: 'Publish project repository with documentation and live demo link.'
    },
    {
      phase: 'Phase 3 (Month 5-6)',
      focus: 'Interview Preparation & Resume Refinement',
      action: 'Update resume headline and bullet points to highlight new projects and certifications.',
      targetOutcome: 'Pass target role technical screen interviews with high match confidence.'
    }
  ];

  return {
    targetRole,
    summary: `Structured upskilling plan designed to bridge your top ${skillsToAddress.length} skill gaps for ${targetRole} within 3 to 6 months.`,
    courses,
    milestones
  };
}

function validateOrFallbackUrl(skillName = '', url = '') {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  return `https://www.google.com/search?q=${encodeURIComponent((skillName || 'tech') + ' course online')}`;
}
