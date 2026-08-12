import type { Candidate, Skill } from '@/types'

export const candidateSkills: Skill[] = [
  { id: 'sk-ts', name: 'TypeScript', category: 'technical', proficiency: 5, years: 6 },
  { id: 'sk-react', name: 'React', category: 'technical', proficiency: 5, years: 6 },
  { id: 'sk-next', name: 'Next.js', category: 'technical', proficiency: 4, years: 4 },
  { id: 'sk-node', name: 'Node.js', category: 'technical', proficiency: 4, years: 5 },
  { id: 'sk-graphql', name: 'GraphQL', category: 'technical', proficiency: 4, years: 3 },
  { id: 'sk-tailwind', name: 'Tailwind CSS', category: 'technical', proficiency: 5, years: 4 },
  { id: 'sk-jest', name: 'Testing (Jest + Playwright)', category: 'technical', proficiency: 4, years: 3 },
  { id: 'sk-docker', name: 'Docker & CI/CD', category: 'tool', proficiency: 3, years: 3 },
  { id: 'sk-python', name: 'Python', category: 'technical', proficiency: 2, years: 2 },
  { id: 'sk-ml', name: 'Machine Learning Fundamentals', category: 'technical', proficiency: 2, years: 1 },
  { id: 'sk-mgmt', name: 'Technical Leadership', category: 'soft', proficiency: 4, years: 3 },
  { id: 'sk-comms', name: 'Cross-functional Communication', category: 'soft', proficiency: 5, years: 6 },
  { id: 'sk-design', name: 'Design Systems', category: 'technical', proficiency: 4, years: 4 },
]

export const candidate: Candidate = {
  id: 'cand-001',
  name: 'User',
  initials: 'U',
  title: 'Software Engineer',
  location: 'Tech Hub',
  yearsOfExperience: 3,
  email: 'user@example.com',
  headline: 'Senior Frontend Engineer crafting thoughtful interfaces for data-dense products',
  summary:
    'Product-minded frontend engineer with 7 years of experience building design systems and high-scale interfaces for AI products. Strong advocate for type-safe codebases, accessible UI, and measurable performance. Currently deepening applied machine-learning literacy to bridge product and model teams.',
  topSkills: candidateSkills,
  experience: [
    {
      role: 'Senior Frontend Engineer',
      company: 'Nimbus AI',
      location: 'New York, NY',
      start: '2022-03',
      end: null,
      highlights: [
        'Led design-system migration across 5 product teams, cutting component duplication by 40%.',
        'Shipped an AI-assisted analytics dashboard used by 20k+ daily active users.',
        'Introduced a testing culture with Playwright, raising critical-path coverage to 85%.',
      ],
    },
    {
      role: 'Frontend Engineer',
      company: 'Vantage Analytics',
      location: 'Remote',
      start: '2019-06',
      end: '2022-02',
      highlights: [
        'Built real-time data visualization modules with React, GraphQL, and WebSockets.',
        'Reduced time-to-interactive on primary dashboards from 4.2s to 1.6s.',
        'Mentored 4 junior engineers and ran the front-end guild.',
      ],
    },
    {
      role: 'Frontend Engineer',
      company: 'CodeSpring',
      location: 'Boston, MA',
      start: '2017-07',
      end: '2019-05',
      highlights: [
        'Shipped customer-facing landing and onboarding flows for a B2B SaaS product.',
        'Introduced component libraries and reusable state patterns across 3 products.',
      ],
    },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      institution: 'Northeastern University',
      year: '2017',
      field: 'Computer Science',
    },
  ],
  preferredRoles: ['Senior Frontend Engineer', 'Staff Frontend Engineer', 'AI Product Engineer'],
  targetRole: 'Senior Frontend Engineer (AI Products)',
  openToRemote: true,
  desiredSalaryRange: { min: 160000, max: 195000 },
}