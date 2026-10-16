import type { JobMatch } from '@/types'

// Static pre-computed match scores were removed together with the fictional demo jobs.
// Real listings are only scored through the ATS flow in Match Analysis (see deriveJobMatches).
export const matches: JobMatch[] = []

export const matchResults = matches
