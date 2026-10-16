// Single source of truth for the CareerLens backend URL.
//
// Local development default : http://127.0.0.1:5000/api/v1
// Deployed environments     : set VITE_API_BASE_URL in a root .env file (or in
// the hosting provider's environment) to the absolute base of the deployed API,
// e.g. VITE_API_BASE_URL=https://api.example.com/api/v1
//
// Nothing else in the frontend may hardcode a host, port, or machine path.

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:5000/api/v1'

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol')
    }
    return trimmed
  } catch {
    throw new Error(
      `Invalid VITE_API_BASE_URL "${raw}". Expected an absolute http(s) URL, for example ${DEFAULT_API_BASE_URL}.`,
    )
  }
}

const configuredBaseUrl = typeof import.meta.env.VITE_API_BASE_URL === 'string'
  ? import.meta.env.VITE_API_BASE_URL
  : ''

/** Base URL for every API request (no trailing slash). */
export const API_BASE_URL: string = normalizeBaseUrl(
  configuredBaseUrl.trim().length > 0 ? configuredBaseUrl : DEFAULT_API_BASE_URL,
)

/** Scheme + host + port of the backend (no path). */
export const API_ORIGIN: string = new URL(API_BASE_URL).origin

/** Human readable origin for error messages, e.g. "127.0.0.1:5000". */
export const API_ORIGIN_LABEL: string = (() => {
  const url = new URL(API_ORIGIN)
  return url.port ? `${url.hostname}:${url.port}` : url.hostname
})()

/** Lightweight backend health check (no AI provider involved). */
export const API_HEALTH_URL: string = `${API_BASE_URL}/health`

/**
 * After a request fails to connect, poll the health endpoint for at most this
 * long before giving up — this is what absorbs a backend that is still booting.
 */
export const BACKEND_WAIT_BUDGET_MS = 4000
export const BACKEND_WAIT_INTERVAL_MS = 400

/** True while automated tests run (they must never sleep/wait on a server). */
export const IS_TEST_RUN: boolean =
  import.meta.env.MODE === 'test' || import.meta.env.VITEST === true
