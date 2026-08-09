import type { Resume } from '@/types'

export const resume: Resume = {
  id: 'res-001',
  fileName: 'alex-morgan-resume-2026.pdf',
  uploadedAt: '2026-08-01T09:24:00Z',
  fileType: 'pdf',
  fileSizeKb: 412,
  completeness: 88,
  parsed: {
    contact: {
      email: 'alex.morgan@example.com',
      phone: '+1 (212) 555-0134',
      location: 'New York, NY',
      linkedin: 'linkedin.com/in/alexmorgan',
      portfolio: 'alexmorgan.dev',
    },
    summary:
      'Senior frontend engineer focused on AI product surfaces, design systems, and performance. 7 years shipping TypeScript + React at scale.',
    skills: [
      'TypeScript',
      'React',
      'Next.js',
      'Node.js',
      'GraphQL',
      'Tailwind CSS',
      'Playwright',
      'Design Systems',
      'Docker',
      'Python',
    ],
    experience: [
      {
        role: 'Senior Frontend Engineer',
        company: 'Nimbus AI',
        location: 'New York, NY',
        start: '2022-03',
        end: null,
        highlights: [
          'Led design-system migration for 5+ teams, cutting front-end complexity by 40%.',
          'Shipped an AI-assisted analytics dashboard used by 20k+ daily active users.',
        ],
      },
      {
        role: 'Frontend Engineer',
        company: 'Vantage Analytics',
        location: 'Remote',
        start: '2019-06',
        end: '2022-02',
        highlights: [
          'Built real-time visualization modules with TypeScript, GraphQL, and WebSockets.',
          'Improved time-to-interactive on core dashboards from 4.2s to 1.6s.',
        ],
      },
      {
        role: 'Frontend Engineer',
        company: 'CodeSpring',
        location: 'Boston, MA',
        start: '2017-07',
        end: '2019-05',
        highlights: [
          'Shipped landing and onboarding experiences for a B2B SaaS product.',
          'Established shared component libraries across three product teams.',
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
  },
}