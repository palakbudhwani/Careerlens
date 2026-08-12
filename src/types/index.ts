export type SkillCategory = 'technical' | 'soft' | 'tool'

export type Proficiency = 1 | 2 | 3 | 4 | 5

export type MatchLevel = 'strong' | 'moderate' | 'weak'

export type MatchCategory = 'hard' | 'soft' | 'experience' | 'education'

export interface Skill {
  id: string
  name: string
  category: SkillCategory
  proficiency: Proficiency
  years?: number
}

export interface Experience {
  role: string
  company: string
  location: string
  start: string
  end: string | null
  highlights: string[]
}

export interface Education {
  degree: string
  institution: string
  year: string
  field?: string
}

export interface Contact {
  email: string
  phone?: string
  location?: string
  linkedin?: string
  portfolio?: string
}

export interface Project {
  name: string
  description: string
  technologies: string[]
}

export interface Certification {
  name: string
  issuer?: string
  year?: string
}

export interface ResumeExport {
  contact: Contact
  summary?: string
  skills: string[]
  experience: Experience[]
  education: Education[]
  projects?: Project[]
  certifications?: Certification[]
}

export interface Resume {
  id: string
  fileName: string
  uploadedAt: string
  fileType: 'pdf' | 'docx'
  fileSizeKb: number
  completeness: number
  parsed: ResumeExport
}

export interface Candidate {
  id: string
  name: string
  initials: string
  title: string
  location: string
  yearsOfExperience: number
  email: string
  headline?: string
  summary?: string
  phone?: string
  linkedin?: string
  portfolio?: string
  topSkills: Skill[]
  experience: Experience[]
  education: Education[]
  projects?: Project[]
  certifications?: Certification[]
  preferredRoles?: string[]
  targetRole?: string
  openToRemote?: boolean
  desiredSalaryRange?: { min: number; max: number }
}

export type JobType = 'full-time' | 'contract' | 'internship'

export type WorkMode = 'remote' | 'hybrid' | 'onsite'

export interface Job {
  id: string
  title: string
  company: string
  location: string
  type: JobType
  workMode: WorkMode
  salaryRange: { currency: string; min: number; max: number }
  postedDaysAgo: number
  description: string
  responsibilities: string[]
  requirements: string[]
  preferred: string[]
  skills: Skill[]
  tags: string[]
  matchScore?: number
  matchLevel?: MatchLevel
}

export interface MatchBreakdown {
  category: MatchCategory
  score: number
  weight: number
  note: string
}

export interface MissingSkill {
  skill: string
  importance: 'critical' | 'important' | 'nice-to-have'
}

export interface JobMatch {
  id: string
  jobId: string
  score: number
  level: MatchLevel
  summary: string
  breakdown: MatchBreakdown[]
  strengths: string[]
  gaps: string[]
  missingSkills: MissingSkill[]
}

export interface SkillGap {
  id: string
  skill: string
  category: SkillCategory
  currentLevel: Proficiency
  requiredLevel: Proficiency
  importance: 'critical' | 'important' | 'nice-to-have'
  relatedRoles: string[]
  recommendedAction: string
  resources: { label: string; type: 'course' | 'book' | 'project' | 'mentor' }[]
}

export type RecommendationCategory = 'learning' | 'project' | 'mentorship' | 'certification' | 'networking'

export interface CareerRecommendation {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  timeframe: string
  category: CareerCategory
}

export type CareerCategory = 'skill' | 'role' | 'portfolio' | 'network' | 'growth' | 'mentorship'

export type HistoryAction =
  | 'resume-scan'
  | 'job-match'
  | 'job-compare'
  | 'skill-gap'
  | 'career-plan'
  | 'view'

export interface HistoryEntry {
  id: string
  action: HistoryAction
  title: string
  description: string
  createdAt: string
  score?: number
  href: string
}

export interface NotificationItem {
  id: string
  title: string
  description: string
  createdAt: string
  unread: boolean
  kind: 'match' | 'gap' | 'system'
}