import type { SkillGap } from '@/types'

export const skillGaps: SkillGap[] = [
  {
    id: 'gap-001',
    skill: 'LLM Integration (Vercel AI SDK)',
    category: 'technical',
    currentLevel: 3,
    requiredLevel: 5,
    importance: 'critical',
    relatedRoles: ['AI Product Engineer', 'Senior Frontend Engineer (AI)'],
    recommendedAction:
      'Build one AI-assisted feature end to end — e.g., a chat-powered dashboard filter using the Vercel AI SDK with streaming response handling.',
    resources: [
      { label: 'Vercel AI SDK docs', type: 'course' },
      { label: 'Build & ship a copilot POC', type: 'project' },
    ],
  },
  {
    id: 'gap-002',
    skill: 'Prompt Engineering',
    category: 'technical',
    currentLevel: 2,
    requiredLevel: 4,
    importance: 'critical',
    relatedRoles: ['AI Product Engineer', 'AI Product Designer'],
    recommendedAction:
      'Complete a structured prompt-engineering track and publish an evaluation harness for prompt variants.',
    resources: [
      { label: 'Prompt Engineering track (course)', type: 'course' },
      { label: 'Prompt evaluation harness', type: 'project' },
    ],
  },
  {
    id: 'gap-003',
    skill: 'Python',
    category: 'technical',
    currentLevel: 2,
    requiredLevel: 3,
    importance: 'important',
    relatedRoles: ['Full-Stack Engineer (AI)', 'Data-adjacent roles'],
    recommendedAction:
      'Practice Python for scripting and data manipulation; complete a small API service written in Python.',
    resources: [
      { label: 'Python for scripting (course)', type: 'course' },
      { label: 'FastAPI mini-service', type: 'project' },
    ],
  },
  {
    id: 'gap-004',
    skill: 'Applied Machine Learning',
    category: 'technical',
    currentLevel: 2,
    requiredLevel: 3,
    importance: 'important',
    relatedRoles: ['AI Product Engineer', 'ML Platform (frontend)'],
    recommendedAction:
      'Take an applied ML survey course focused on how models are trained, evaluated, and served — not research depth.',
    resources: [
      { label: 'ML for Product Engineers (course)', type: 'course' },
      { label: 'Book: Build a recommendation demo', type: 'project' },
    ],
  },
  {
    id: 'gap-005',
    skill: 'SQL / Postgres',
    category: 'technical',
    currentLevel: 2,
    requiredLevel: 4,
    importance: 'important',
    relatedRoles: ['Full-Stack Engineer'],
    recommendedAction:
      'Learn CTEs, joins, and query planning; ship a schema and queries for a personal project.',
    resources: [
      { label: 'Postgres for Developers', type: 'course' },
      { label: 'Personal project schema', type: 'project' },
    ],
  },
  {
    id: 'gap-006',
    skill: 'Platform Architecture Ownership',
    category: 'technical',
    currentLevel: 2,
    requiredLevel: 4,
    importance: 'critical',
    relatedRoles: ['Staff Frontend Engineer'],
    recommendedAction:
      'Lead architecture for one cross-team initiative at work, then document the decision in a written ADR others can reference.',
    resources: [
      { label: 'Architecture decision records (book)', type: 'book' },
      { label: 'Senior mentor review', type: 'mentor' },
    ],
  },
  {
    id: 'gap-007',
    skill: 'Monorepo & Module Federation',
    category: 'tool',
    currentLevel: 2,
    requiredLevel: 3,
    importance: 'nice-to-have',
    relatedRoles: ['Frontend Platform Engineer'],
    recommendedAction:
      'Migrate a hobby project to a Turborepo monorepo and document the trade-offs.',
    resources: [
      { label: 'Turborepo workshop', type: 'course' },
    ],
  },
]

export const skillGapReport = { generatedAt: '2026-08-08T08:00:00Z', gaps: skillGaps }