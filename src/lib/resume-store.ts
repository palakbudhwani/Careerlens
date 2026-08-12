import { useEffect, useState } from 'react'

import type { ParsedDetails } from '@/lib/api-service'

/**
 * Result of a successful resume parse, persisted locally.
 *
 * This becomes the seed for the personalized CareerLens profile in a later
 * step. For now it simply records that the user has uploaded/analyzed a resume
 * so the Dashboard can transition out of the onboarding state.
 */
export interface StoredResume {
  fileName: string
  fileSize: number
  uploadedAt: string
  parsedDetails: ParsedDetails
  resumeText: string
}

const STORAGE_KEY = 'careerlens.resume'

type Listener = () => void

const listeners = new Set<Listener>()

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

export function readStoredResume(): StoredResume | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredResume
    if (!parsed || typeof parsed.fileName !== 'string') return null
    if (!parsed.parsedDetails || typeof parsed.parsedDetails !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredResume(resume: StoredResume): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resume))
  } catch {
    // storage may be unavailable; consumers still get notified below
  }
  notifyListeners()
}

export function clearStoredResume(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
  notifyListeners()
}

/**
 * Reactive view of the stored resume. Subscribes so consumers re-render when
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
