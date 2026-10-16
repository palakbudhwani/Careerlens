import { describe, expect, it } from 'vitest'

import {
  API_BASE_URL,
  API_HEALTH_URL,
  API_ORIGIN,
  API_ORIGIN_LABEL,
  BACKEND_WAIT_BUDGET_MS,
  BACKEND_WAIT_INTERVAL_MS,
  IS_TEST_RUN,
} from '@/lib/api-config'

describe('API base URL configuration', () => {
  it('defaults to the local backend when VITE_API_BASE_URL is not set', () => {
    expect(API_BASE_URL).toBe('http://127.0.0.1:5000/api/v1')
    expect(API_ORIGIN).toBe('http://127.0.0.1:5000')
    expect(API_ORIGIN_LABEL).toBe('127.0.0.1:5000')
  })

  it('derives the health probe from the same base URL', () => {
    expect(API_HEALTH_URL).toBe(`${API_BASE_URL}/health`)
    expect(API_HEALTH_URL).toBe('http://127.0.0.1:5000/api/v1/health')
  })

  it('never produces a trailing slash (which would break route joins)', () => {
    expect(API_BASE_URL.endsWith('/')).toBe(false)
    expect(API_ORIGIN.endsWith('/')).toBe(false)
  })

  it('keeps automated tests free of backend waiting', () => {
    expect(IS_TEST_RUN).toBe(true)
    expect(BACKEND_WAIT_BUDGET_MS).toBeGreaterThan(0)
    expect(BACKEND_WAIT_INTERVAL_MS).toBeGreaterThan(0)
  })
})
