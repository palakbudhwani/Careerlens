import type { Candidate, Resume, Skill } from '@/types'
import type { ParsedDetails } from '@/lib/api-service'
import type { StoredResume } from '@/lib/resume-store'

/**
 * Resolve initials from a candidate name.
 */
export function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'CL'
  return parts
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function skillCategoryFor(name: string): Skill['category'] {
  const lower = name.toLowerCase()
  if (
    /communicat|collaborat|teamwork|leadership|mentor|present|stakeholder|problem solv|critical think|adaptab|time manag|creativ|organiz|negotiat|emotion/i.test(
      lower,
    )
  ) {
    return 'soft'
  }
  if (
    /figma|jira|git|github|docker|kubernetes|excel|powerpoint|notion|slack|postman|linux|jenkins|ci\/cd|mlops|monorepo|trello|tableau|postman|vite/i.test(
      lower,
    )
  ) {
    return 'tool'
  }
  return 'technical'
}

function skillFromName(name: string, index: number): Skill {
  return {
    id: `res-skill-${index}`,
    name,
    category: skillCategoryFor(name),
    proficiency: 3,
  }
}

function extractYear(value: string | null | undefined): number | null {
  if (!value) return null
  const match = String(value).match(/(19|20)\d{2}/)
  return match ? Number(match[0]) : null
}

/**
 * Read an explicit "N years of experience" statement from the raw resume text
 * when the resume states one. Returns null when none is present so callers can
 * fall back to the date-based estimate.
 */
function extractExplicitYears(resumeText: string | undefined): number | null {
  if (!resumeText) return null
  const match = resumeText.match(
    /(\d{1,2})\+?\s*(?:-\s*\d{1,2})?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant\s+|work\s+)?experience/i,
  )
  if (!match) return null
  const years = Number(match[1])
  return Number.isFinite(years) ? Math.max(0, Math.min(40, years)) : null
}

/**
 * Estimate total years of experience from the resume's own work history
 * (latest end year minus earliest start year). Uses only dates found on the
 * uploaded resume — never a hard-coded value.
 */
function estimateYearsOfExperience(experience: ParsedDetails['workExperience']): number {
  if (!experience || experience.length === 0) return 0
  const currentYear = new Date().getFullYear()
  let earliestStart: number | null = null
  let latestEnd = 0

  for (const entry of experience) {
    const start = extractYear(entry.start)
    if (start !== null && (earliestStart === null || start < earliestStart)) {
      earliestStart = start
    }
    const end = extractYear(entry.end) ?? currentYear
    if (end > latestEnd) latestEnd = end
  }

  if (earliestStart === null) return 0
  return Math.max(0, latestEnd - earliestStart)
}

function computeCompleteness(details: ParsedDetails): number {
  const sections = [
    Boolean(details.name),
    Boolean(details.email),
    Boolean(details.phone),
    (details.skills ?? []).length >= 5,
    (details.workExperience ?? []).length >= 1,
    (details.education ?? []).length >= 1,
    Boolean(details.summary || details.headline),
  ]
  const present = sections.filter(Boolean).length
  return Math.round((present / sections.length) * 100)
}

/**
 * Build a Candidate from an uploaded resume. Every value is derived from the
 * parsed resume itself — nothing is invented from a hard-coded profile.
 * Fields the parser did not extract are left empty (empty-state) so the
 * Dashboard only ever shows real resume data.
 */
export function candidateFromStoredResume(stored: StoredResume): Candidate {
  const details = stored.parsedDetails
  const name = (details.name ?? '').trim() || 'Your Profile'
  const currentRole = details.workExperience?.[0]
  const title = (details.headline ?? '').trim() || (currentRole?.role ?? '').trim()
  const location = (details.location ?? '').trim() || (currentRole?.location ?? '').trim()

  const roles = (details.workExperience ?? [])
    .map((entry) => (entry.role ?? '').trim())
    .filter((role): role is string => role.length > 0)
  const preferredRoles = Array.from(new Set(roles))
  const targetRole = (details.headline ?? '').trim() || preferredRoles[0] || undefined

  return {
    id: 'cand-resume',
    name,
    initials: getInitials(name),
    title,
    location,
    yearsOfExperience:
      extractExplicitYears(stored.resumeText) ?? estimateYearsOfExperience(details.workExperience),
    email: (details.email ?? '').trim(),
    headline: (details.headline ?? '').trim() || undefined,
    summary: (details.summary ?? '').trim() || undefined,
    phone: details.phone?.trim() || undefined,
    linkedin: details.linkedin?.trim() || undefined,
    portfolio: details.portfolio?.trim() || undefined,
    topSkills: (details.skills ?? []).map(skillFromName),
    experience: details.workExperience ?? [],
    education: details.education ?? [],
    projects: details.projects,
    certifications: details.certifications,
    preferredRoles,
    targetRole,
  }
}

/**
 * Build the Dashboard's Resume view from an uploaded resume, so the uploaded
 * file (and its parsed content) is the source of truth.
 */
export function resumeFromStoredResume(stored: StoredResume): Resume {
  const details = stored.parsedDetails
  return {
    id: 'res-uploaded',
    fileName: stored.fileName,
    uploadedAt: stored.uploadedAt,
    fileType: 'pdf',
    fileSizeKb: Math.max(1, Math.round(stored.fileSize / 1024)),
    completeness: computeCompleteness(details),
    parsed: {
      contact: {
        email: (details.email ?? '').trim(),
        phone: details.phone?.trim() || undefined,
        location: details.location?.trim() || undefined,
        linkedin: details.linkedin?.trim() || undefined,
        portfolio: details.portfolio?.trim() || undefined,
      },
      summary: (details.summary ?? '').trim() || undefined,
      skills: details.skills,
      experience: details.workExperience,
      education: details.education,
      projects: details.projects,
      certifications: details.certifications,
    },
  }
}
