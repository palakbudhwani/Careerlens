import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useDashboardData } from '@/components/dashboard/dashboard-data'
import type { ParsedDetails } from '@/lib/api-service'
import { clearStoredResume, writeStoredResume, type StoredResume } from '@/lib/resume-store'

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
    fileSize: 2048,
    uploadedAt: '2026-01-01T00:00:00.000Z',
    parsedDetails: parsedDetails(),
    resumeText: `Resume text of ${fileName}`,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  clearStoredResume()
})

describe('dashboard data before any resume upload', () => {
  it('shows no resume, no matches, and no analysis results', () => {
    const { result } = renderHook(() => useDashboardData())

    expect(result.current.hasAnalysis).toBe(false)
    expect(result.current.resume).toBeUndefined()
    expect(result.current.matchCount).toBe(0)
    expect(result.current.strongMatchCount).toBe(0)
    expect(result.current.careerReadiness).toBe(0)
    expect(result.current.resumeStrength).toBe(0)
    expect(result.current.topMatches).toEqual([])
    expect(result.current.topGaps).toEqual([])
    expect(result.current.topRecommendations).toEqual([])
  })
})

describe('dashboard data after an upload in this session', () => {
  it('derives the dashboard from the uploaded resume only', () => {
    const { result } = renderHook(() => useDashboardData())
    expect(result.current.hasAnalysis).toBe(false)

    act(() => {
      writeStoredResume(makeResume('Resume A.pdf'))
    })

    expect(result.current.hasAnalysis).toBe(true)
    expect(result.current.resume?.fileName).toBe('Resume A.pdf')
    expect(result.current.topSkills.length).toBeGreaterThan(0)

    act(() => {
      writeStoredResume(makeResume('Resume B.pdf'))
    })

    expect(result.current.resume?.fileName).toBe('Resume B.pdf')
    expect(JSON.stringify(result.current.resume)).not.toContain('Resume A.pdf')
  })
})
