import type {
  Candidate,
  CareerRecommendation,
  Job,
  JobMatch,
  MatchBreakdown,
  MissingSkill,
  Proficiency,
  SkillCategory,
  SkillGap,
} from '@/types'
import type { StoredResume } from '@/lib/resume-store'

/**
 * Resume-driven analysis derivation.
 *
 * Takes the stored (parsed) resume and derives personalized job matches, skill
 * gaps, and career recommendations against the existing CareerLens job
 * dataset. Nothing here is hard-coded: every score, gap, and recommendation is
 * computed from the uploaded resume's actual skills, experience, and education.
 *
 * Reuses the existing domain types (Job, JobMatch, SkillGap,
 * CareerRecommendation) and the skill-weighting philosophy used by the backend
 * match analysis (hard 50%, soft 20%, experience 20%, education 10%).
 */

const ALIASES: Record<string, string> = {
  js: 'js',
  javascript: 'js',
  ts: 'ts',
  typescript: 'ts',
  node: 'node',
  nodejs: 'node',
  'node.js': 'node',
  react: 'react',
  reactjs: 'react',
  'react.js': 'react',
  next: 'next',
  nextjs: 'next',
  'next.js': 'next',
  graphql: 'graphql',
  python: 'python',
  sql: 'sql',
  postgres: 'sql',
  postgresql: 'sql',
  pytorch: 'pytorch',
  torch: 'pytorch',
  ml: 'ml',
  'machine learning': 'ml',
  'applied ml': 'ml',
  'applied machine learning': 'ml',
  llm: 'llm',
  'llm apis': 'llm',
  'llm api': 'llm',
  'llm integration (vercel ai sdk)': 'llm',
  'prompt engineering': 'promptengineering',
  docker: 'docker',
  'docker & kubernetes': 'kubernetes',
  kubernetes: 'kubernetes',
  k8s: 'kubernetes',
  git: 'git',
  java: 'java',
  go: 'go',
  golang: 'go',
  html: 'html',
  css: 'css',
  aws: 'aws',
  gcp: 'gcp',
  'design systems': 'designsystems',
  'technical leadership': 'leadership',
  mentorship: 'leadership',
  'stakeholder communication': 'communication',
  'product thinking': 'product',
}

function normalizeSkill(value: string): string {
  const raw = value.trim().toLowerCase()
  const aliased = ALIASES[raw]
  if (aliased) return aliased
  return raw.replace(/[^a-z0-9+#]/g, '')
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resumeSkillSet(resume: StoredResume): Set<string> {
  return new Set((resume.parsedDetails.skills ?? []).map(normalizeSkill))
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>()
  for (const word of text.toLowerCase().split(/[^a-z0-9+#.]+/)) {
    const normalized = normalizeSkill(word)
    if (normalized.length >= 2) tokens.add(normalized)
  }
  return tokens
}

function jobRequiredKeys(job: Job): string[] {
  const keys = new Set<string>()
  for (const skill of job.skills) keys.add(normalizeSkill(skill.name))
  for (const tag of job.tags) keys.add(normalizeSkill(tag))
  return Array.from(keys)
}

function jobSignalKeys(job: Job): Set<string> {
  const text = [
    job.title,
    job.description,
    ...job.requirements,
    ...job.preferred,
    ...job.responsibilities,
  ].join(' ')
  return tokenize(text)
}

const importanceRank = {
  critical: 0,
  important: 1,
  'nice-to-have': 2,
} as const

function strongerImportance(
  a: MissingSkill['importance'],
  b: MissingSkill['importance'],
): MissingSkill['importance'] {
  return importanceRank[a] <= importanceRank[b] ? a : b
}

function requiredLevelForImportance(importance: MissingSkill['importance']): Proficiency {
  if (importance === 'critical') return 5
  if (importance === 'important') return 4
  return 3
}

function gapCategoryForSkill(skill: string): SkillCategory {
  if (/communicat|leadership|collaborat|mentorship|presentation|stakeholder/i.test(skill)) {
    return 'soft'
  }
  if (/ci|docker|kubernetes|monorepo|design token|figma|jira|git/i.test(skill)) return 'tool'
  return 'technical'
}

export interface JobLookup {
  (jobId: string): Job | undefined
}

/**
 * Compare the uploaded resume against every existing job and produce a
 * personalized JobMatch with score, level, breakdown, strengths, gaps, and
 * missing skills. Different resumes produce different scores and rankings.
 */
export function deriveJobMatches(
  resume: StoredResume,
  candidate: Candidate,
  jobs: Job[],
): JobMatch[] {
  const resumeSkills = (resume.parsedDetails.skills ?? [])
    .map((skill) => skill.trim())
    .filter(Boolean)
  const skillSet = resumeSkillSet(resume)
  const softPresent = resumeSkills.some((skill) =>
    /lead|communicat|collaborat|mentor|present|stakeholder|team|design/i.test(skill),
  )
  const years = candidate.yearsOfExperience
  const hasEducation = (resume.parsedDetails.education?.length ?? 0) > 0

  return jobs.map((job) => {
    const requiredKeys = jobRequiredKeys(job)
    const requiredSet = new Set(requiredKeys)
    const signalKeys = jobSignalKeys(job)

    const matchedRequired = requiredKeys.filter((key) => skillSet.has(key)).length

    const jobCoverage = requiredKeys.length ? matchedRequired / requiredKeys.length : 0
    const relevantInResume = resumeSkills
      .map(normalizeSkill)
      .filter((key) => requiredSet.has(key) || signalKeys.has(key)).length
    const resumeRelevance = resumeSkills.length ? relevantInResume / resumeSkills.length : 0

    const hardScore = Math.round(clamp((0.75 * jobCoverage + 0.25 * resumeRelevance) * 100, 5, 98))
    const softScore = softPresent ? 78 : 55
    const experienceScore = Math.round(clamp(40 + years * 8, 40, 95))
    const educationScore = hasEducation ? 78 : 45

    const score = Math.round(
      clamp(
        hardScore * 0.5 + softScore * 0.2 + experienceScore * 0.2 + educationScore * 0.1,
        8,
        98,
      ),
    )
    const level: JobMatch['level'] = score >= 65 ? 'strong' : score >= 48 ? 'moderate' : 'weak'

    const matchedSkills = job.skills.filter((skill) => skillSet.has(normalizeSkill(skill.name)))
    const missingSkills: MissingSkill[] = job.skills
      .filter((skill) => !skillSet.has(normalizeSkill(skill.name)))
      .map((skill) => ({
        skill: skill.name,
        importance:
          skill.proficiency >= 4 ? 'critical' : skill.proficiency >= 3 ? 'important' : 'nice-to-have',
      }))

    const matchedNames = matchedSkills.map((skill) => skill.name)
    const missingNames = missingSkills.map((missing) => missing.skill)

    const breakdown: MatchBreakdown[] = [
      {
        category: 'hard',
        score: hardScore,
        weight: 0.5,
        note:
          jobCoverage >= 0.5
            ? 'Covers most of the required skill set for this role.'
            : 'Only partially covers the required skill set.',
      },
      {
        category: 'soft',
        score: softScore,
        weight: 0.2,
        note: softPresent
          ? 'Leadership, communication, or collaboration signals detected in the resume.'
          : 'Limited explicit leadership or communication signals detected.',
      },
      {
        category: 'experience',
        score: experienceScore,
        weight: 0.2,
        note:
          years > 0
            ? `${years} year${years === 1 ? '' : 's'} estimated from the resume's work history.`
            : 'No dated work history found to estimate experience.',
      },
      {
        category: 'education',
        score: educationScore,
        weight: 0.1,
        note: hasEducation
          ? 'Education entries found on the resume.'
          : 'No education entries found.',
      },
    ]

    const strengths: string[] = []
    if (matchedNames.length > 0) {
      strengths.push(`Direct overlap on ${matchedNames.slice(0, 4).join(', ')}.`)
    }
    if (years > 0) {
      strengths.push(`${years} year${years === 1 ? '' : 's'} of estimated experience.`)
    }
    if (softPresent) {
      strengths.push('Leadership and collaboration skills visible in the profile.')
    }
    if (strengths.length === 0) {
      strengths.push('Foundational technical skills are present on the resume.')
    }

    const gaps = missingSkills.map((missing) => `${missing.skill} (${missing.importance})`)

    const summary =
      matchedNames.length > 0
        ? `Baseline fit: you show ${matchedNames.length} of ${job.skills.length} core requirements for ${job.title}.${
            missingNames.length > 0
              ? ` Focus next on ${missingNames.slice(0, 3).join(', ')} to raise this fit.`
              : ''
          }`
        : `Limited overlap with ${job.title}. Build exposure to ${missingNames
            .slice(0, 3)
            .join(', ')} to make this a realistic target.`

    return {
      id: `res-match-${job.id}`,
      jobId: job.id,
      score,
      level,
      summary,
      breakdown,
      strengths,
      gaps,
      missingSkills,
    }
  })
}

/**
 * Derive personalized skill gaps from the top matching jobs: required skills
 * those roles want minus what the uploaded resume already shows. Never the
 * static demo gaps — always the resume's actual missing skills.
 */
export function deriveSkillGapsForProfile(
  topMatches: JobMatch[],
  lookup: JobLookup,
): SkillGap[] {
  const byName = new Map<string, SkillGap>()
  const sourceCount = new Map<string, number>()

  for (const match of topMatches) {
    const role = lookup(match.jobId)?.title
    for (const missing of match.missingSkills) {
      const existing = byName.get(missing.skill)
      if (existing) {
        existing.importance = strongerImportance(existing.importance, missing.importance)
        if (role) existing.relatedRoles = Array.from(new Set([...existing.relatedRoles, role]))
        sourceCount.set(missing.skill, (sourceCount.get(missing.skill) ?? 1) + 1)
      } else {
        byName.set(missing.skill, {
          id: `res-gap-${missing.skill.replace(/\s+/g, '-').toLowerCase()}`,
          skill: missing.skill,
          category: gapCategoryForSkill(missing.skill),
          currentLevel: 1,
          requiredLevel: requiredLevelForImportance(missing.importance),
          importance: missing.importance,
          relatedRoles: role ? [role] : [],
          recommendedAction: `Build evidence for ${missing.skill} — complete a focused project or course, then add it to your resume so match analysis can detect it.`,
          resources: [
            { label: 'Focused course or workshop', type: 'course' },
            { label: 'Hands-on portfolio project', type: 'project' },
          ],
        })
        sourceCount.set(missing.skill, 1)
      }
    }
  }

  const ranked = Array.from(byName.values())
    .map((gap) => {
      if ((sourceCount.get(gap.skill) ?? 1) >= 2 && gap.importance === 'nice-to-have') {
        return { ...gap, importance: 'important' as const }
      }
      return gap
    })
    .sort((a, b) => importanceRank[a.importance] - importanceRank[b.importance])
    .slice(0, 5)

  return ranked
}

/**
 * Derive career recommendations from the resume's actual strengths, its
 * strongest match, and its most important gap. Uses the existing
 * CareerRecommendation structure; text is templated around real resume-derived
 * job titles, skills, and gap names.
 */
export function deriveRecommendationsForProfile(
  topMatches: JobMatch[],
  topGaps: SkillGap[],
  candidate: Candidate,
  lookup: JobLookup,
): CareerRecommendation[] {
  const recommendations: CareerRecommendation[] = []
  const best = topMatches[0]
  const bestJob = best ? lookup(best.jobId) : undefined

  if (bestJob) {
    const roleTitle = bestJob.title.split(' —')[0]
    recommendations.push({
      id: 'res-rec-target-role',
      title: `Pursue ${roleTitle}`,
      description: `Your resume already covers key requirements for ${roleTitle}. Tailor your headline and project examples around ${roleTitle.toLowerCase()} to raise match scores further.`,
      impact: 'high',
      effort: 'low',
      timeframe: '1–2 weeks',
      category: 'role',
    })
  }

  const primaryGap = topGaps[0]
  if (primaryGap) {
    recommendations.push({
      id: 'res-rec-gap',
      title: `Close the ${primaryGap.skill} gap`,
      description: primaryGap.recommendedAction,
      impact: 'high',
      effort: 'medium',
      timeframe: '4–6 weeks',
      category: 'skill',
    })
  }

  const topSkills = candidate.topSkills.slice(0, 3).map((skill) => skill.name)
  if (topSkills.length > 0) {
    recommendations.push({
      id: 'res-rec-portfolio',
      title: 'Package your strengths into proof',
      description: `Create 1–2 self-contained projects showcasing ${topSkills.join(
        ', ',
      )} so match analysis has concrete evidence to detect.`,
      impact: 'medium',
      effort: 'medium',
      timeframe: '2–4 weeks',
      category: 'portfolio',
    })
  }

  return recommendations.slice(0, 3)
}