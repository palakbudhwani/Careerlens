/**
 * Coordinates repeated async runs of the same logical task (match analysis,
 * question generation, skill-gap fetches, career-growth plans, ...):
 *
 * - `begin` dedupes identical in-flight/completed requests (StrictMode
 *   double-mounts and re-renders never re-fire) and returns the sequence
 *   number for the new run, or `null` when the request should be skipped.
 * - `isCurrent` / `markCompleted` / `end` let callers discard responses that a
 *   newer run has superseded, so a late response for an older resume can never
 *   overwrite results for the current one.
 * - `invalidate` is called when the underlying resume changes or is cleared:
 *   every outstanding run becomes stale immediately and its response will be
 *   dropped by the same guards.
 */
export interface RunGuard {
  begin(key: string, opts?: { force?: boolean }): number | null
  isCurrent(seq: number): boolean
  markCompleted(seq: number): void
  end(seq: number): boolean
  invalidate(): void
  isInFlight(): boolean
}

export function createRunGuard(): RunGuard {
  let key = ''
  let seq = 0
  let inFlight = false
  let completed = false

  return {
    begin(nextKey, opts) {
      if (!opts?.force && key === nextKey && (inFlight || completed)) return null
      seq += 1
      key = nextKey
      inFlight = true
      completed = false
      return seq
    },
    isCurrent(runSeq) {
      return runSeq === seq
    },
    markCompleted(runSeq) {
      if (runSeq === seq) completed = true
    },
    end(runSeq) {
      if (runSeq !== seq) return false
      inFlight = false
      return true
    },
    invalidate() {
      seq += 1
      key = ''
      inFlight = false
      completed = false
    },
    isInFlight() {
      return inFlight
    },
  }
}
