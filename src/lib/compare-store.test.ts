import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  MAX_COMPARE_JOBS,
  readCompareSelection,
  toggleCompareJob,
  useCompareSelection,
  writeCompareSelection,
} from '@/lib/compare-store'

beforeEach(() => {
  window.localStorage.clear()
})

describe('compare store', () => {
  it('starts with an empty selection', () => {
    expect(readCompareSelection()).toEqual([])
  })

  it('adds and removes jobs through toggle', () => {
    expect(toggleCompareJob('a')).toBe(true)
    expect(readCompareSelection()).toEqual(['a'])
    expect(toggleCompareJob('a')).toBe(true)
    expect(readCompareSelection()).toEqual([])
  })

  it('rejects a fourth selection', () => {
    writeCompareSelection(['a', 'b', 'c'])
    expect(toggleCompareJob('d')).toBe(false)
    expect(readCompareSelection()).toEqual(['a', 'b', 'c'])
    expect(MAX_COMPARE_JOBS).toBe(3)
  })

  it('deduplicates and caps stored values', () => {
    writeCompareSelection(['a', 'a', 'b', 'c', 'd'])
    expect(readCompareSelection()).toEqual(['a', 'b', 'c'])
  })

  it('persists the selection to localStorage', () => {
    writeCompareSelection(['jobs-1', 'jobs-2'])
    expect(window.localStorage.getItem('careerlens.compare')).toBe(
      JSON.stringify(['jobs-1', 'jobs-2']),
    )
  })

  it('keeps hook consumers in sync across toggles', () => {
    const { result } = renderHook(() => useCompareSelection())

    expect(result.current.ids).toEqual([])
    expect(result.current.remaining).toBe(3)

    act(() => {
      result.current.toggle('jobs-1')
    })

    expect(result.current.ids).toEqual(['jobs-1'])
    expect(result.current.remaining).toBe(2)
    expect(readCompareSelection()).toEqual(['jobs-1'])

    act(() => {
      result.current.setIds(['x', 'y'])
    })

    expect(result.current.ids).toEqual(['x', 'y'])

    act(() => {
      result.current.clear()
    })

    expect(result.current.ids).toEqual([])
    expect(window.localStorage.getItem('careerlens.compare')).toBe('[]')
  })
})
