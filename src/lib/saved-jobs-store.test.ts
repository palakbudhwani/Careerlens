import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearSavedJobs,
  readSavedJobs,
  toggleSavedJob,
  useSavedJobs,
} from '@/lib/saved-jobs-store'

beforeEach(() => {
  window.localStorage.clear()
})

describe('saved jobs store', () => {
  it('starts with no saved jobs', () => {
    expect(readSavedJobs()).toEqual([])
  })

  it('saves and unsaves through toggle', () => {
    expect(toggleSavedJob('job-a')).toBe(true)
    expect(readSavedJobs()).toEqual(['job-a'])
    expect(toggleSavedJob('job-a')).toBe(false)
    expect(readSavedJobs()).toEqual([])
  })

  it('persists saved ids to localStorage', () => {
    toggleSavedJob('job-a')
    toggleSavedJob('job-b')
    expect(window.localStorage.getItem('careerlens.savedJobs')).toBe(
      JSON.stringify(['job-a', 'job-b']),
    )
  })

  it('ignores corrupt stored values', () => {
    window.localStorage.setItem('careerlens.savedJobs', '{not json')
    expect(readSavedJobs()).toEqual([])
    window.localStorage.setItem('careerlens.savedJobs', JSON.stringify(['ok', 3, null]))
    expect(readSavedJobs()).toEqual(['ok'])
  })

  it('keeps hook consumers in sync', () => {
    const { result } = renderHook(() => useSavedJobs())
    expect(result.current).toEqual([])

    act(() => {
      toggleSavedJob('job-a')
    })
    expect(result.current).toEqual(['job-a'])

    act(() => {
      clearSavedJobs()
    })
    expect(result.current).toEqual([])
  })
})
