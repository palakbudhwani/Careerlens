import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  FileText,
  Gauge,
  Layers,
  ScanSearch,
  Target,
  TrendingUp,
  TriangleAlert,
  Upload,
} from 'lucide-react'

/* ------------------------------------------------------------------ hero */

export interface HeroStat {
  label: string
  value: number
  suffix: string
}

export const heroStats: HeroStat[] = [
  { label: 'Career readiness', value: 84, suffix: '/100' },
  { label: 'Profile strength', value: 91, suffix: '%' },
  { label: 'Job compatibility', value: 92, suffix: '%' },
]

export interface HeroRole {
  title: string
  score: number
}

export const heroRoles: HeroRole[] = [
  { title: 'Machine Learning Engineer', score: 92 },
  { title: 'Data Scientist', score: 88 },
  { title: 'AI Engineer', score: 86 },
]

export interface HeroSkill {
  name: string
  covered: boolean
}

export const heroSkills: HeroSkill[] = [
  { name: 'Python', covered: true },
  { name: 'Machine Learning', covered: true },
  { name: 'SQL', covered: true },
  { name: 'TensorFlow', covered: true },
  { name: 'AWS', covered: false },
  { name: 'Docker', covered: false },
]

/* ------------------------------------------------- from resume to career */

export interface FlowStep {
  icon: LucideIcon
  title: string
  description: string
}

export const valueFlow: FlowStep[] = [
  {
    icon: FileText,
    title: 'Resume',
    description: 'Parsed into structured, editable profile data in seconds.',
  },
  {
    icon: Layers,
    title: 'Skills',
    description: 'Mapped and rated against what real roles actually require.',
  },
  {
    icon: Briefcase,
    title: 'Jobs',
    description: 'Curated opportunities ranked by your genuine fit.',
  },
  {
    icon: TriangleAlert,
    title: 'Skill gaps',
    description: 'What you are missing, and exactly how much it costs you.',
  },
  {
    icon: TrendingUp,
    title: 'Career growth',
    description: 'A prioritized plan of skills, projects, and next moves.',
  },
]

/* ----------------------------------------------------------- how it works */

export interface HowItWorksStep {
  icon: LucideIcon
  title: string
  description: string
}

export const howItWorks: HowItWorksStep[] = [
  {
    icon: Upload,
    title: 'Upload',
    description: 'Upload your resume. CareerLens parses it into a structured career profile.',
  },
  {
    icon: ScanSearch,
    title: 'Understand',
    description: 'Your skills, experience, and goals become a scoreable candidate profile.',
  },
  {
    icon: Target,
    title: 'Match',
    description: 'Discover jobs and understand your compatibility with every role.',
  },
  {
    icon: TrendingUp,
    title: 'Improve',
    description: 'See your skill gaps laid out, and exactly what to do about them next.',
  },
]

/* --------------------------------------------------------------- features */

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
  variant: 'resume' | 'match' | 'gaps' | 'growth'
}

export const features: Feature[] = [
  {
    icon: FileText,
    title: 'Resume Intelligence',
    description:
      'Scans your resume for structure, completeness, and the language recruiters expect — then scores it like a hiring manager would.',
    variant: 'resume',
  },
  {
    icon: Target,
    title: 'Job Matching',
    description:
      'Every role gets an explained fit score. See which skills, projects, and experience drive the match.',
    variant: 'match',
  },
  {
    icon: Gauge,
    title: 'Skill Gap Analysis',
    description:
      'A prioritized list of what is missing — ranked by how much each skill moves the needle.',
    variant: 'gaps',
  },
  {
    icon: TrendingUp,
    title: 'Career Growth',
    description:
      'A personal roadmap: courses, projects, and milestones that close your gaps in order.',
    variant: 'growth',
  },
]

/* ------------------------------------------------------ resume intelligence */

export const resumeAnalysis = {
  fileName: 'priya-sharma-resume.pdf',
  score: 87,
  metrics: [
    { label: 'Skills coverage', value: 94 },
    { label: 'Experience', value: 85 },
    { label: 'Projects', value: 91 },
  ],
  strengths: ['Strong technical foundation', 'Relevant project experience', 'Good academic profile'],
  improvements: [
    'Add measurable project outcomes',
    'Highlight AWS & Docker experience',
    'Strengthen the professional summary',
    'Close a moderate skill gap',
  ],
}

/* ------------------------------------------------------------ job matching */

export const matchPreview = {
  role: 'Machine Learning Engineer',
  score: 92,
  breakdown: [
    { label: 'Skills', value: 96 },
    { label: 'Experience', value: 92 },
    { label: 'Education', value: 100 },
    { label: 'Projects', value: 91 },
  ],
  matched: ['Python', 'Machine Learning', 'SQL', 'TensorFlow'],
  missing: ['AWS', 'Docker'],
}

/* --------------------------------------------------------------- skill gap */

export const careerPlan = {
  targetRole: 'Machine Learning Engineer',
  readiness: 84,
  nextSkills: ['AWS', 'Docker', 'MLOps'],
  project: 'Deploy a machine-learning model using Docker and AWS.',
  steps: [
    'Current skills',
    'Skill gaps',
    'Recommended actions',
    'Career goal',
  ],
}

/* --------------------------------------------------------- skill gaps data */

export interface SkillGap {
  skill: string
  current: number
  required: number
  impact: string
}

export const skillGaps: SkillGap[] = [
  { skill: 'AWS', current: 42, required: 80, impact: 'Blocks most cloud-based AI roles' },
  { skill: 'Docker', current: 58, required: 85, impact: 'Appears in 7 of 10 listings' },
  { skill: 'MLOps', current: 31, required: 75, impact: 'Unlocks senior AI positions' },
]

/* -------------------------------------------------------------------- CTA */

export const finalCta = {
  kicker: 'Start your career analysis',
  title: 'Turn your resume into your next opportunity.',
  description:
    'In a few minutes you will know how strong your resume is, which jobs fit you best, and the fastest path to close the gap. All in the browser.',
}

/* ------------------------------------------------------------------ footer */

export interface FooterColumn {
  heading: string
  links: FooterLinkEntry[]
}

export interface FooterLinkEntry {
  label: string
  to?: string
}

export const footerProductLinks: FooterLinkEntry[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Resume intelligence', to: '/resume' },
  { label: 'Discover jobs', to: '/jobs' },
  { label: 'Match analysis', to: '/match' },
]

export const footerCareerLinks: FooterLinkEntry[] = [
  { label: 'Skill gaps', to: '/skill-gaps' },
  { label: 'Career growth', to: '/career-growth' },
  { label: 'Compare jobs', to: '/compare' },
  { label: 'Job history', to: '/history' },
]

export const footerCompanyLinks: FooterLinkEntry[] = [
  { label: 'About', to: 'about' },
  { label: 'Contact', to: 'contact' },
  { label: 'Newsroom', to: 'newsroom' },
  { label: 'Careers', to: 'careers' },
]

export const footerLegalLinks: FooterLinkEntry[] = [
  { label: 'Privacy', to: 'privacy' },
  { label: 'Terms', to: 'terms' },
  { label: 'Security', to: 'security' },
  { label: 'Cookies', to: 'cookies' },
]

export const navAnchors = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
]