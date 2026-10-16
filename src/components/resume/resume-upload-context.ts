import { createContext, useContext } from 'react'

export interface ResumeUploadContextValue {
  openResumeUpload: () => void
}

/**
 * Shared context for the app-wide resume upload experience.
 *
 * Lives in its own (component-free) module so both `useResumeUpload` and the
 * non-throwing `useOptionalResumeUpload` can be consumed without dragging a
 * component into the exporting file.
 */
export const ResumeUploadContext = createContext<ResumeUploadContextValue | null>(null)

/**
 * Throws when no provider is mounted — for call sites that are guaranteed to
 * render inside `ResumeUploadProvider` (dashboard, landing, navigation).
 */
export function useResumeUpload(): ResumeUploadContextValue {
  const context = useContext(ResumeUploadContext)
  if (!context) {
    throw new Error('useResumeUpload must be used within a ResumeUploadProvider')
  }
  return context
}

/**
 * Non-throwing variant for optional entry points (e.g. the Career Fit invite
 * on the Jobs page). Returns null when no provider is mounted so the UI can
 * still render — the button simply becomes inert instead of crashing.
 */
export function useOptionalResumeUpload(): ResumeUploadContextValue | null {
  return useContext(ResumeUploadContext)
}
