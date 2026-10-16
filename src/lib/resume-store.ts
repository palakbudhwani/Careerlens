import { useEffect, useState } from 'react'

import type { ParsedDetails } from '@/lib/api-service'

/**
 * Result of a successful resume parse, held for the current browser session.
 *
 * The resume is deliberately NOT persisted: every fresh session starts with no
 * resume loaded, and only a resume explicitly uploaded during this session is
 * used for analysis. There is no localStorage read path, so a stale resume can
 * never be restored on refresh.
 */
export interface StoredResume {
  fileName: string
  fileSize: number
  uploadedAt: string
  parsedDetails: ParsedDetails
  resumeText: string
}

// Keys written by earlier versions of CareerLens. The resume key is no longer
// read or written at all; both the resume and the analysis results derived
// from it (the skill-gap handoff) are removed on startup so nothing stale can
// resurface. Unrelated settings (theme, profile fields, accounts) are untouched.
const LEGACY_RESUME_KEY = 'careerlens.resume'
const SKILL_GAPS_KEY = 'careerlens.skillgaps'

type Listener = () => void

const listeners = new Set<Listener>()

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

function removeStorageItem(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // storage may be unavailable
  }
}

/**
 * Startup cleanup (called once from main.tsx): removes previously persisted
 * resume data and the analysis results derived from it. Safe to call repeatedly.
 */
export function clearPersistedResumeData(): void {
  removeStorageItem(LEGACY_RESUME_KEY)
  removeStorageItem(SKILL_GAPS_KEY)
}

// Session-scoped resume. Starts empty on every page load; replaced only when
// the user explicitly uploads a file, cleared on logout/new upload.
let sessionResume: StoredResume | null = null

export function readStoredResume(): StoredResume | null {
  return sessionResume
}

export function writeStoredResume(resume: StoredResume): void {
  sessionResume = resume
  // A new upload invalidates every analysis derived from the previous resume.
  removeStorageItem(SKILL_GAPS_KEY)
  notifyListeners()
}

export function clearStoredResume(): void {
  sessionResume = null
  removeStorageItem(LEGACY_RESUME_KEY)
  removeStorageItem(SKILL_GAPS_KEY)
  notifyListeners()
}

/**
 * Reactive view of the session resume. Subscribes so consumers re-render when
 * a resume is written or cleared from anywhere in the app.
 */
export function useStoredResume(): StoredResume | null {
  const [resume, setResume] = useState<StoredResume | null>(readStoredResume)

  useEffect(() => {
    const sync = () => setResume(readStoredResume())
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  return resume
}
