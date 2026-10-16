import { describe, expect, it } from 'vitest'

import { createRunGuard } from '@/lib/run-guard'

describe('run guard', () => {
  it('dedupes identical in-flight and completed requests unless forced', () => {
    const guard = createRunGuard()

    const first = guard.begin('key-1')
    expect(first).toBe(1)
    expect(guard.isCurrent(first as number)).toBe(true)

    // Same key while in flight → skip (StrictMode double-mount / re-render).
    expect(guard.begin('key-1')).toBeNull()

    guard.markCompleted(first as number)
    expect(guard.end(first as number)).toBe(true)
    expect(guard.isInFlight()).toBe(false)

    // Same key after completion → skip, results are already current.
    expect(guard.begin('key-1')).toBeNull()

    // Forced re-run (manual refresh button) is allowed.
    expect(guard.begin('key-1', { force: true })).toBe(2)

    // A different key (e.g. another resume or role) is allowed too.
    expect(guard.begin('key-2')).toBe(3)
  })

  it('discards a late response for an invalidated run so it cannot overwrite the new run', () => {
    const guard = createRunGuard()

    // Resume A starts analyzing.
    const seqA = guard.begin('resume-A') as number
    expect(guard.isCurrent(seqA)).toBe(true)

    // The user uploads Resume B → the coordinator is invalidated.
    guard.invalidate()
    expect(guard.isCurrent(seqA)).toBe(false)
    expect(guard.isInFlight()).toBe(false)

    // Resume B starts analyzing.
    const seqB = guard.begin('resume-B') as number
    expect(seqB).not.toBe(seqA)

    // B completes and its result is applied.
    guard.markCompleted(seqB)
    expect(guard.isCurrent(seqB)).toBe(true)
    expect(guard.end(seqB)).toBe(true)

    // A's response arrives late: it is stale, its completion must not run,
    // and it must not clear B's state.
    expect(guard.isCurrent(seqA)).toBe(false)
    guard.markCompleted(seqA)
    expect(guard.end(seqA)).toBe(false)
    expect(guard.isInFlight()).toBe(false)
    expect(guard.isCurrent(seqB)).toBe(true)
  })

  it('invalidate clears dedupe state so the same key can run again', () => {
    const guard = createRunGuard()

    const firstSeq = guard.begin('same-key') as number
    expect(guard.begin('same-key')).toBeNull()

    guard.invalidate()

    const secondSeq = guard.begin('same-key')
    expect(secondSeq).not.toBeNull()
    expect(secondSeq as number).toBeGreaterThan(firstSeq)
  })
})
