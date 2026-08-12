import { useMemo } from 'react'

import { candidateFromStoredResume, resumeFromStoredResume } from '@/lib/effective-candidate'
import { mockStore } from '@/lib/mock-store'
import {
  deriveJobMatches,
  deriveRecommendationsForProfile,
  deriveSkillGapsForProfile,
} from '@/lib/resume-analysis'
import { useStoredResume } from '@/lib/resume-store'
import type {
  Candidate,
  CareerRecommendation,
  Job,
  JobMatch,
  Resume,
  Skill,
  SkillGap,
} from '@/types'

export interface MatchWithJob {
  match: JobMatch
  job?: Job
}

export interface DashboardData {
  hasAnalysis: boolean
  candidate: Candidate
  resume?: Resume
  careerReadiness: number
  resumeStrength: number
  profileCompleteness: number
  strongMatchCount: number
  matchCount: number
  criticalGapCount: number
  totalGapCount: number
  topMatches: MatchWithJob[]
  topSkills: Skill[]
  topGaps: SkillGap[]
  topRecommendations: CareerRecommendation[]
  technicalCount: number
  softCount: number
  toolCount: number
  greeting: string
}

const importanceRank: Record<SkillGap['importance'], number> = {
  critical: 0,
  important: 1,
  'nice-to-have': 2,
}

const impactRank: Record<CareerRecommendation['impact'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function computeProfileCompleteness(candidate: Candidate, resume: Resume | undefined): number {
  const parsed = resume?.parsed
  const sections: boolean[] = [
    Boolean(parsed?.contact?.email || candidate.email),
    Boolean(parsed?.contact?.location || candidate.location),
    Boolean(parsed?.summary || candidate.summary),
    Boolean(candidate.headline),
    candidate.topSkills.length >= 5,
    candidate.experience.length >= 1,
    candidate.education.length >= 1,
    Boolean(candidate.targetRole && (candidate.preferredRoles?.length ?? 0) > 0),
    Boolean(candidate.desiredSalaryRange && typeof candidate.openToRemote === 'boolean'),
  ]
  const present = sections.filter(Boolean).length
  return Math.round((present / sections.length) * 100)
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function condenseText(text: string, max = 170): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`
}

export function useDashboardData(): DashboardData {
  const uploadedResume = useStoredResume()

  return useMemo(() => {
    const candidate = uploadedResume
      ? candidateFromStoredResume(uploadedResume)
      : mockStore.getCandidate()
    const resume = uploadedResume ? resumeFromStoredResume(uploadedResume) : mockStore.getResume()
    const jobs = mockStore.getJobs()
    const matches = uploadedResume
      ? deriveJobMatches(uploadedResume, candidate, jobs)
      : mockStore.getMatches()

    const rankedMatches = [...matches].sort((a, b) => b.score - a.score)
    const skillGaps = uploadedResume
      ? deriveSkillGapsForProfile(rankedMatches.slice(0, 4), (jobId) =>
          jobs.find((job) => job.id === jobId),
        )
      : mockStore.getSkillGaps()
    const recommendations = uploadedResume
      ? deriveRecommendationsForProfile(
          rankedMatches.slice(0, 3),
          skillGaps,
          candidate,
          (jobId) => jobs.find((job) => job.id === jobId),
        )
      : mockStore.getRecommendations()

    const hasAnalysis = Boolean(uploadedResume)

    const topMatches = rankedMatches.slice(0, 3).map((match) => ({
      match,
      job: jobs.find((job) => job.id === match.jobId),
    }))

    const careerReadiness = topMatches.length
      ? Math.round(topMatches.reduce((sum, item) => sum + item.match.score, 0) / topMatches.length)
      : 0

    const topSkills = [...candidate.topSkills]
      .sort((a, b) => b.proficiency - a.proficiency)
      .slice(0, 8)

    const topGaps = [...skillGaps]
      .sort((a, b) => importanceRank[a.importance] - importanceRank[b.importance])
      .slice(0, 4)

    const topRecommendations = [...recommendations]
      .sort((a, b) => impactRank[a.impact] - impactRank[b.impact])
      .slice(0, 3)

    const technicalCount = candidate.topSkills.filter((s) => s.category === 'technical').length
    const softCount = candidate.topSkills.filter((s) => s.category === 'soft').length
    const toolCount = candidate.topSkills.filter((s) => s.category === 'tool').length

    return {
      hasAnalysis,
      candidate,
      resume,
      careerReadiness,
      resumeStrength: resume?.completeness ?? 0,
      profileCompleteness: computeProfileCompleteness(candidate, resume),
      strongMatchCount: matches.filter((m) => m.level === 'strong').length,
      matchCount: matches.length,
      criticalGapCount: skillGaps.filter((g) => g.importance === 'critical').length,
      totalGapCount: skillGaps.length,
      topMatches,
      topSkills,
      topGaps,
      topRecommendations,
      technicalCount,
      softCount,
      toolCount,
      greeting: getGreeting(),
    }
  }, [uploadedResume])
}