import type { JobMatch } from '@/types'

export const matches: JobMatch[] = [
  {
    id: 'match-001',
    jobId: 'job-001',
    score: 92,
    level: 'strong',
    summary:
      'Excellent fit. Your TypeScript + React depth, design-system leadership, and AI product experience map almost directly to this role. Close the Python/LLM gap to become a top-1% candidate.',
    breakdown: [
      {
        category: 'hard',
        score: 94,
        weight: 0.5,
        note: 'TypeScript, React, testing, and design systems all exceed requirements.',
      },
      {
        category: 'soft',
        score: 90,
        weight: 0.2,
        note: 'Leadership and cross-functional communication match the senior mandate.',
      },
      {
        category: 'experience',
        score: 92,
        weight: 0.2,
        note: '7 years with AI-product surface experience directly relevant.',
      },
      {
        category: 'education',
        score: 88,
        weight: 0.1,
        note: 'CS degree plus continuing education in ML fundamentals.',
      },
    ],
    strengths: [
      '7 years of production TypeScript + React experience.',
      'Led a design-system migration with measurable impact.',
      'Shipped AI-assisted dashboards at scale.',
      'Strong testing culture with Playwright at 85% critical coverage.',
    ],
    gaps: [
      'Limited production exposure to LLM/agentic frontend patterns.',
      'Python proficiency is below the level the team prefers for model-adjacent work.',
    ],
    missingSkills: [
      { skill: 'LLM Integration (Vercel AI SDK)', importance: 'important' },
      { skill: 'Python (intermediate)', importance: 'nice-to-have' },
    ],
  },
  {
    id: 'match-002',
    jobId: 'job-002',
    score: 84,
    level: 'strong',
    summary:
      'Strong match. Your platform instincts and mentorship record fit a staff mandate. The main gap is less direct evidence of platform-level architectural ownership on a multi-team codebase.',
    breakdown: [
      {
        category: 'hard',
        score: 88,
        weight: 0.5,
        note: 'Deep TypeScript/React, tooling, and architecture experience.',
      },
      {
        category: 'soft',
        score: 92,
        weight: 0.2,
        note: 'Strong mentorship and cross-team communication.',
      },
      {
        category: 'experience',
        score: 80,
        weight: 0.2,
        note: '7 years is slightly below the 8+ preference for staff scope.',
      },
      {
        category: 'education',
        score: 85,
        weight: 0.1,
        note: 'Solid CS foundation; no post-grad specialization.',
      },
    ],
    strengths: [
      'Design-system and component architecture experience.',
      'Mentorship of 4+ engineers and guild leadership.',
      'Performance engineering wins on data-dense dashboards.',
    ],
    gaps: [
      'Less evidence of owning architecture across a multi-team platform.',
      'No experience with internal developer-tooling products.',
    ],
    missingSkills: [
      { skill: 'Platform Architecture Ownership', importance: 'critical' },
      { skill: 'Internal Developer Tooling', importance: 'important' },
    ],
  },
  {
    id: 'match-003',
    jobId: 'job-003',
    score: 78,
    level: 'moderate',
    summary:
      'Good match with a fast-moving AI-native focus. Your product instincts are strong; level up hands-on LLM integration and prompt work to fully realize this fit.',
    breakdown: [
      {
        category: 'hard',
        score: 80,
        weight: 0.5,
        note: 'Strong React/TypeScript; LLM integration and prompt skills are emerging.',
      },
      {
        category: 'soft',
        score: 88,
        weight: 0.2,
        note: 'Product thinking and autonomy are excellent.',
      },
      {
        category: 'experience',
        score: 78,
        weight: 0.2,
        note: 'AI surface experience helps; small-team shipping cadence is proven.',
      },
      {
        category: 'education',
        score: 70,
        weight: 0.1,
        note: 'No formal AI/ML coursework on record.',
      },
    ],
    strengths: [
      'Proven ability to ship product-quality interfaces autonomously.',
      'Experience on AI-product surfaces and analytics.',
      'Strong collaboration with design and ML stakeholders.',
    ],
    gaps: [
      'Limited hands-on experience with LLM APIs and AI SDKs.',
      'No public examples of prompt engineering or agentic UI patterns.',
    ],
    missingSkills: [
      { skill: 'LLM APIs (OpenAI / Anthropic)', importance: 'critical' },
      { skill: 'Prompt Engineering', importance: 'critical' },
    ],
  },
  {
    id: 'match-004',
    jobId: 'job-004',
    score: 69,
    level: 'moderate',
    summary:
      'Decent match. Frontend strengths carry the fit, but SQL and backend ownership are thin for a true full-stack mandate. A targeted backend mini-course would shift this materially.',
    breakdown: [
      {
        category: 'hard',
        score: 74,
        weight: 0.5,
        note: 'TypeScript/Node strong; SQL and database design are the weak link.',
      },
      {
        category: 'soft',
        score: 85,
        weight: 0.2,
        note: 'Excellent collaboration and product instincts.',
      },
      {
        category: 'experience',
        score: 70,
        weight: 0.2,
        note: 'Frontend-heavy history with limited backend ownership.',
      },
      {
        category: 'education',
        score: 80,
        weight: 0.1,
        note: 'Strong foundation, but backend breadth is limited.',
      },
    ],
    strengths: [
      'Frontend and TypeScript excellence across the stack.',
      'Fast start-up cadence and shipping mindset.',
    ],
    gaps: [
      'Minimal production Postgres or database design experience.',
      'Limited ownership of server-side services.',
    ],
    missingSkills: [
      { skill: 'SQL / Postgres', importance: 'important' },
      { skill: 'Node.js Service Design', importance: 'important' },
    ],
  },
  {
    id: 'match-005',
    jobId: 'job-005',
    score: 41,
    level: 'weak',
    summary:
      'Not a fit in the current profile. This role is ML-first and Python/PyTorch-centric; your strengths are on the frontend. Revisit if you pivot toward applied ML over the next 6-12 months.',
    breakdown: [
      {
        category: 'hard',
        score: 35,
        weight: 0.5,
        note: 'Python and PyTorch are well below requirements.',
      },
      {
        category: 'soft',
        score: 75,
        weight: 0.2,
        note: 'Communication is strong, but domain language is thin.',
      },
      {
        category: 'experience',
        score: 45,
        weight: 0.2,
        note: 'No production ML model ownership on record.',
      },
      {
        category: 'education',
        score: 50,
        weight: 0.1,
        note: 'Only introductory ML coursework.',
      },
    ],
    strengths: [
      'Strong engineering discipline and testing habits transferable to ML pipelines.',
    ],
    gaps: [
      'Python and PyTorch proficiency far below bar.',
      'No model training or deployment experience.',
      'MLOps knowledge is absent from the profile.',
    ],
    missingSkills: [
      { skill: 'Python (advanced)', importance: 'critical' },
      { skill: 'PyTorch', importance: 'critical' },
      { skill: 'MLOps', importance: 'critical' },
    ],
  },
  {
    id: 'match-006',
    jobId: 'job-006',
    score: 74,
    level: 'moderate',
    summary:
      'Solid match for a tooling-focused contract. Build-tooling and CI/CD strengths align, but monorepo and module-federation depth should be verified in the interview.',
    breakdown: [
      {
        category: 'hard',
        score: 78,
        weight: 0.5,
        note: 'Strong TypeScript and CI/CD; monorepo experience is moderate.',
      },
      {
        category: 'soft',
        score: 82,
        weight: 0.2,
        note: 'Clear communication on technical trade-offs.',
      },
      {
        category: 'experience',
        score: 72,
        weight: 0.2,
        note: 'Tooling-adjacent work proven, but not a dedicated platform role.',
      },
      {
        category: 'education',
        score: 78,
        weight: 0.1,
        note: 'Strong CS fundamentals.',
      },
    ],
    strengths: [
      'Deep bundler, CI/CD, and performance tooling familiarity.',
      'TypeScript and testing excellence.',
    ],
    gaps: [
      'Limited production experience with large monorepos.',
      'Module federation and multi-brand token systems are not on the resume.',
    ],
    missingSkills: [
      { skill: 'Monorepo (Turborepo/Nx)', importance: 'important' },
      { skill: 'Design Tokens', importance: 'nice-to-have' },
    ],
  },
]

export const matchResults = matches