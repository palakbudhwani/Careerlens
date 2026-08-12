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

/**
 * Central data facade for the frontend demo.
 *
 * Static/demo data is still used for jobs, skills, recommendations, etc.
 * Authentication data comes from AuthContext.
 */

export const mockStore = {
  getCandidate(): Candidate {
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