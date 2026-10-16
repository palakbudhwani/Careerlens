import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiHttpError,
  BackendConnectionError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HEALTH_TIMEOUT_MS,
  RequestTimeoutError,
  apiService,
  checkBackendHealth,
  describeConnectionFailure,
} from '@/lib/api-service'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('API failure classification', () => {
  it('marks Gemini/Groq failures as AI-provider errors', () => {
    const rateLimited = new ApiHttpError('The Gemini AI provider rate-limited the request.', {
      status: 429,
      code: 'AI_RATE_LIMITED',
    })
    expect(rateLimited.isAiProviderError).toBe(true)
    expect(rateLimited.status).toBe(429)
    expect(rateLimited.kind).toBe('http')

    const notConfigured = new ApiHttpError('AI provider is not configured.', {
      status: 503,
      code: 'AI_NOT_CONFIGURED',
    })
    expect(notConfigured.isAiProviderError).toBe(true)
  })

  it('keeps validation/application errors distinct from provider outages', () => {
    const badRequest = new ApiHttpError('Missing required fields: resumeText and jobDescription must be provided.', {
      status: 400,
    })
    expect(badRequest.isAiProviderError).toBe(false)
    expect(badRequest.code).toBeUndefined()

    const serverError = new ApiHttpError('HTTP Error 500: Internal Server Error', { status: 500 })
    expect(serverError.isAiProviderError).toBe(false)
    expect(serverError).not.toBeInstanceOf(BackendConnectionError)
  })

  it('describes a dead backend as a startup problem, not an app error', () => {
    const error = new BackendConnectionError(describeConnectionFailure())
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('backend-connection')
    expect(error.message).toContain('Could not reach the CareerLens backend at 127.0.0.1:5000')
    expect(error.message).toContain('npm run dev')
    expect(error).not.toBeInstanceOf(ApiHttpError)
  })
})

describe('backend health probe', () => {
  it('treats any HTTP answer as "backend is up"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as unknown as Response)
    await expect(checkBackendHealth()).resolves.toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('treats a refused connection as "backend is down"', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(checkBackendHealth()).resolves.toBe(false)
  })
})

/** fetch stand-in that stays pending until the request signal aborts. */
function hangingFetch(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('The operation was aborted.', 'AbortError')),
    )
  })
}

describe('request termination guarantees', () => {
  it('health probe answers "down" when the socket stalls', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(hangingFetch)

    const probe = checkBackendHealth()
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS + 1)
    await expect(probe).resolves.toBe(false)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('a stalled API call rejects with RequestTimeoutError instead of hanging', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(hangingFetch)

    const request = apiService.analyzeMatch('resume text', 'job description')
    const assertion = expect(request).rejects.toMatchObject({
      name: 'RequestTimeoutError',
      kind: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS + 1)
    await assertion
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('timeouts carry a human-readable, non-network message', () => {
    const error = new RequestTimeoutError('/match/analyze', DEFAULT_REQUEST_TIMEOUT_MS)
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('timeout')
    expect(error.message).toContain('/match/analyze')
    expect(error.message).toContain('130 seconds')
    expect(error.message).toContain('Please try again')
  })

  it('does not classify a timeout as a backend-connection failure', () => {
    const error = new RequestTimeoutError('/interview/questions', DEFAULT_REQUEST_TIMEOUT_MS)
    expect(error).not.toBeInstanceOf(BackendConnectionError)
    expect(error).not.toBeInstanceOf(ApiHttpError)
    expect(error).not.toBeInstanceOf(TypeError)
  })
})
