import { candidate } from '@/data/candidate'
import { careerRecommendations } from '@/data/career-recommendations'
import { history } from '@/data/history'
import { jobs } from '@/data/jobs'
import { matches } from '@/data/matches'
import { resume } from '@/data/resume'
import { skillGaps } from '@/data/skill-gaps'
import type {
  Candidate,
  CareerRecommendation,
  HistoryEntry,
  Job,
  JobMatch,
  Resume,
  SkillGap,
} from '@/types'

function resolveUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export const mockStore = {
  getCandidate(): Candidate {
    const storedUserName = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_name') : null
    const storedUserEmail = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_email') : null
    
    if (storedUserName && storedUserName.trim()) {
      const name = storedUserName.trim()
      return {
        ...candidate,
        name,
        initials: resolveUserInitials(name),
        email: storedUserEmail || candidate.email,
      }
    }
    return candidate
  },

  getResume(): Resume {
    return resume
  },

  getJobs(): Job[] {
    return jobs
  },

  getJob(id: string): Job | undefined {
    return jobs.find((job) => job.id === id)
  },

  getMatches(): JobMatch[] {
    return matches
  },

  getMatchForJob(jobId: string): JobMatch | undefined {
    return matches.find((match) => match.jobId === jobId)
  },

  getSkillGaps(): SkillGap[] {
    return skillGaps
  },

  getRecommendations(): CareerRecommendation[] {
    return careerRecommendations
  },

  getHistory(): HistoryEntry[] {
    return history
  },
}