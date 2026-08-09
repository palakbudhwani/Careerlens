import type { CareerRecommendation } from '@/types'

export const careerRecommendations: CareerRecommendation[] = [
  {
    id: 'rec-001',
    title: 'Ship an AI-assisted frontend feature',
    description:
      'Build and release a small AI feature in your current product — e.g., a suggestion engine or a summarizer — end to end. This single move closes the two most critical skill gaps and creates interview evidence.',
    impact: 'high',
    effort: 'medium',
    timeframe: '4–6 weeks',
    category: 'portfolio',
  },
  {
    id: 'rec-002',
    title: 'Complete an applied ML fundamentals track',
    description:
      'Focus on evaluation and reasoning about model behavior, not research math. A 6-week track builds the vocabulary to work productively beside ML engineers.',
    impact: 'high',
    effort: 'medium',
    timeframe: '6–8 weeks',
    category: 'skill',
  },
  {
    id: 'rec-003',
    title: 'Write one staff-level architecture ADR per quarter',
    description:
      'Publishing a written architecture decision record strengthens the staff-scope narrative and gives your interview stories structure.',
    impact: 'medium',
    effort: 'low',
    timeframe: 'Ongoing (quarterly)',
    category: 'growth',
  },
  {
    id: 'rec-004',
    title: 'Get formal mentorship from an AI product lead',
    description:
      'A monthly session with someone inside an AI-product org accelerates the language and judgment you cannot get from courses.',
    impact: 'medium',
    effort: 'low',
    timeframe: 'Ongoing',
    category: 'mentorship',
  },
  {
    id: 'rec-005',
    title: 'Target the “AI Product Engineer” archetype',
    description:
      'Your match data shows the strongest trajectory toward AI Product Engineer roles. Reframe your resume headline and examples around AI surfaces you already ship.',
    impact: 'high',
    effort: 'medium',
    timeframe: '2–4 weeks',
    category: 'role',
  },
  {
    id: 'rec-006',
    title: 'Level up a Postgres schema for a side project',
    description:
      'A small, well-designed database schema with query-planning notes closes the SQL gap flagged in full-stack matches.',
    impact: 'low',
    effort: 'low',
    timeframe: '2–3 weeks',
    category: 'skill',
  },
]

export const growthPlan = {
  targetRole: 'AI Product Engineer',
  horizonMonths: 6,
  recommendations: careerRecommendations,
}