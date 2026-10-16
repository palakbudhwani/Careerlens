import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ParsedDetails } from '@/lib/api-service'
import {
  clearPersistedResumeData,
  clearStoredResume,
  readStoredResume,
  useStoredResume,
  writeStoredResume,
  type StoredResume,
} from '@/lib/resume-store'

const LEGACY_RESUME_KEY = 'careerlens.resume'
const SKILL_GAPS_KEY = 'careerlens.skillgaps'

function parsedDetails(): ParsedDetails {
  return {
    name: 'Test User',
    email: 'test@example.com',
    skills: ['React'],
    workExperience: [],
    education: [],
  }
}

function makeResume(fileName: string): StoredResume {
  return {
    fileName,
    fileSize: 4242,
    uploadedAt: '2026-01-01T00:00:00.000Z',
    parsedDetails: parsedDetails(),
    resumeText: `Resume text of ${fileName}`,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  clearStoredResume()
})

describe('fresh session state', () => {
  it('starts with no resume loaded and removes a stale persisted resume on startup', () => {
    window.localStorage.setItem(LEGACY_RESUME_KEY, JSON.stringify(makeResume('Stale.pdf')))
    window.localStorage.setItem(SKILL_GAPS_KEY, JSON.stringify({ targetRole: 'Old Role' }))

    // Startup cleanup called once from main.tsx.
    clearPersistedResumeData()

    expect(readStoredResume()).toBeNull()
    expect(window.localStorage.getItem(LEGACY_RESUME_KEY)).toBeNull()
    expect(window.localStorage.getItem(SKILL_GAPS_KEY)).toBeNull()
  })

  it('never restores a persisted resume on read — there is no browser persistence path', () => {
    window.localStorage.setItem(LEGACY_RESUME_KEY, JSON.stringify(makeResume('Stale.pdf')))

    expect(readStoredResume()).toBeNull()
    expect(window.localStorage.getItem(SKILL_GAPS_KEY)).toBeNull()
  })

  it('keeps unrelated application settings and user data untouched', () => {
    window.localStorage.setItem('careerlens.user_name', 'Keep Me')
    window.localStorage.setItem('careerlens.theme', 'dark')
    window.localStorage.setItem('careerlens.accounts', '{"keep":true}')
    window.localStorage.setItem(LEGACY_RESUME_KEY, JSON.stringify(makeResume('Stale.pdf')))

    clearPersistedResumeData()

    expect(window.localStorage.getItem('careerlens.user_name')).toBe('Keep Me')
    expect(window.localStorage.getItem('careerlens.theme')).toBe('dark')
    expect(window.localStorage.getItem('careerlens.accounts')).toBe('{"keep":true}')
  })
})

describe('only the current upload is used', () => {
  it('uses only Resume B after uploading A then B', () => {
    writeStoredResume(makeResume('Resume A.pdf'))
    writeStoredResume(makeResume('Resume B.pdf'))

    const current = readStoredResume()
    expect(current?.fileName).toBe('Resume B.pdf')
    expect(current?.resumeText).toBe('Resume text of Resume B.pdf')
    expect(JSON.stringify(current)).not.toContain('Resume A.pdf')
  })

  it('never writes the resume to browser storage', () => {
    writeStoredResume(makeResume('Resume A.pdf'))

    expect(window.localStorage.getItem(LEGACY_RESUME_KEY)).toBeNull()
    expect(window.localStorage.getItem(SKILL_GAPS_KEY)).toBeNull()
  })

  it('clears derived analysis results whenever a new resume is uploaded', () => {
    window.localStorage.setItem(SKILL_GAPS_KEY, JSON.stringify({ targetRole: 'Stale Role' }))

    writeStoredResume(makeResume('Resume B.pdf'))

    expect(window.localStorage.getItem(SKILL_GAPS_KEY)).toBeNull()
  })

  it('clears the resume and its derived results on clearStoredResume', () => {
    window.localStorage.setItem(SKILL_GAPS_KEY, JSON.stringify({ targetRole: 'Stale Role' }))
    writeStoredResume(makeResume('Resume A.pdf'))

    clearStoredResume()

    expect(readStoredResume()).toBeNull()
    expect(window.localStorage.getItem(LEGACY_RESUME_KEY)).toBeNull()
    expect(window.localStorage.getItem(SKILL_GAPS_KEY)).toBeNull()
  })
})

describe('useStoredResume', () => {
  it('starts empty, updates on upload, and empties again on clear', () => {
    const { result } = renderHook(() => useStoredResume())
    expect(result.current).toBeNull()

    act(() => {
      writeStoredResume(makeResume('Resume A.pdf'))
    })
    expect(result.current?.fileName).toBe('Resume A.pdf')

    act(() => {
      clearStoredResume()
    })
    expect(result.current).toBeNull()
  })

  it('does not restore stale localStorage data for a fresh subscriber', () => {
    window.localStorage.setItem(LEGACY_RESUME_KEY, JSON.stringify(makeResume('Stale.pdf')))

    const { result } = renderHook(() => useStoredResume())

    expect(result.current).toBeNull()
  })
})
