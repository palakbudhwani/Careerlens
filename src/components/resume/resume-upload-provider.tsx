import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import { ResumeUploadModal } from '@/components/resume/resume-upload-modal'
import { ResumeCinematicAnalysis } from '@/components/resume/resume-cinematic-analysis'
import { writeStoredResume } from '@/lib/resume-store'
import type { StoredResume } from '@/lib/resume-store'

interface CinematicState {
  fileName: string
  result: StoredResume | null
}

interface ResumeUploadContextValue {
  openResumeUpload: () => void
}

const ResumeUploadContext = createContext<ResumeUploadContextValue | null>(null)

/**
 * Global, app-wide resume upload experience.
 *
 * Renders a single shared ResumeUploadModal and lets any entry point (landing
 * page, dashboard, navigation) open it with `useResumeUpload().openResumeUpload()`.
 * On a successful parse it persists the resume via the resume-store and routes
 * the user to the Dashboard, which then reads the uploaded data.
 */
export function ResumeUploadProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [cinematic, setCinematic] = useState<CinematicState | null>(null)
  const navigate = useNavigate()

  const openResumeUpload = useCallback(() => {
    setOpen(true)
  }, [])

  const handleAnalyzeStart = useCallback((fileName: string) => {
    setCinematic({ fileName, result: null })
  }, [])

  const handleAnalyzeResult = useCallback((result: StoredResume | null) => {
    if (!result) {
      setCinematic(null)
      return
    }
    setCinematic((prev) => (prev ? { ...prev, result } : prev))
  }, [])

  const handleSuccess = useCallback(
    (resume: StoredResume) => {
      writeStoredResume(resume)
      setOpen(false)
      navigate('/dashboard')
    },
    [navigate],
  )

  const handleCinematicComplete = useCallback(
    (resume: StoredResume) => {
      setCinematic(null)
      handleSuccess(resume)
    },
    [handleSuccess],
  )

  const handleCinematicCancel = useCallback(() => {
    setCinematic(null)
    setOpen(false)
  }, [])

  const value = useMemo<ResumeUploadContextValue>(() => ({ openResumeUpload }), [openResumeUpload])

  return (
    <ResumeUploadContext.Provider value={value}>
      {children}
      <ResumeUploadModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
        onAnalyzeStart={handleAnalyzeStart}
        onAnalyzeResult={handleAnalyzeResult}
      />
      <AnimatePresence>
        {cinematic && (
          <ResumeCinematicAnalysis
            key="cinematic"
            fileName={cinematic.fileName}
            result={cinematic.result}
            onComplete={() => {
              if (cinematic.result) handleCinematicComplete(cinematic.result)
            }}
            onCancel={handleCinematicCancel}
          />
        )}
      </AnimatePresence>
    </ResumeUploadContext.Provider>
  )
}

export function useResumeUpload(): ResumeUploadContextValue {
  const context = useContext(ResumeUploadContext)
  if (!context) {
    throw new Error('useResumeUpload must be used within a ResumeUploadProvider')
  }
  return context
}
