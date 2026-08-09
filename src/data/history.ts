import type { HistoryEntry } from '@/types'

export const history: HistoryEntry[] = [
  {
    id: 'hst-001',
    action: 'resume-scan',
    title: 'Resume analyzed',
    description: 'Parsed 34 skills, 3 roles, and 2 education entries from alex-morgan-resume-2026.pdf.',
    createdAt: '2026-08-08T08:02:00Z',
    href: '/resume',
  },
  {
    id: 'hst-002',
    action: 'job-match',
    title: 'Match: Senior Frontend Engineer @ Nimbus AI',
    description: 'Scored 92% — strong match across hard skills, leadership, and AI experience.',
    createdAt: '2026-08-08T08:10:00Z',
    score: 92,
    href: '/match/job-001',
  },
  {
    id: 'hst-003',
    action: 'job-match',
    title: 'Match: Staff Frontend Engineer — ML Platform',
    description: 'Scored 84% — mentorship and architecture strength recognized; platform scope flagged.',
    createdAt: '2026-08-08T08:24:00Z',
    score: 84,
    href: '/match/job-002',
  },
  {
    id: 'hst-004',
    action: 'skill-gap',
    title: 'Skill gap report generated',
    description: '6 gaps surfaced; LLM integration and prompt engineering marked as critical.',
    createdAt: '2026-08-08T09:01:00Z',
    href: '/skill-gaps',
  },
  {
    id: 'hst-005',
    action: 'career-plan',
    title: 'Career plan drafted',
    description: '6-month roadmap toward AI Product Engineer with 6 prioritized actions.',
    createdAt: '2026-08-08T09:15:00Z',
    href: '/career-growth',
  },
  {
    id: 'hst-006',
    action: 'job-compare',
    title: 'Compared 2 roles',
    description: 'Senior Frontend Engineer @ Nimbus AI vs AI Product Engineer @ Lumenworks.',
    createdAt: '2026-08-07T20:40:00Z',
    href: '/compare',
  },
  {
    id: 'hst-007',
    action: 'job-match',
    title: 'Match: AI Product Engineer @ Lumenworks',
    description: 'Scored 78% — product instincts strong; LLM hands-on experience is the gap.',
    createdAt: '2026-08-07T20:32:00Z',
    score: 78,
    href: '/match/job-003',
  },
]

export const activityTimeline = history