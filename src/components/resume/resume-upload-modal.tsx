import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'

import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { apiService } from '@/lib/api-service'
import type { StoredResume } from '@/lib/resume-store'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const PARSE_TIMEOUT_MS = 90_000

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadError {
  title: string
  message: string
}

interface ResumeUploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (resume: StoredResume) => void
  onAnalyzeStart?: (fileName: string) => void
  onAnalyzeResult?: (result: StoredResume | null) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('load failed') ||
    normalized.includes('fetch failed') ||
    normalized.includes('network') ||
    normalized.includes('typeerror')
  ) {
    return "We couldn't reach the analysis service. Make sure the backend is running, then try again."
  }
  if (normalized.includes('took too long') || normalized.includes('abort')) {
    return 'The analysis took too long to complete. Please try again.'
  }
  return message || 'Something went wrong while analyzing your resume. Please try again.'
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-card px-2 py-2 text-center">
      <p className="font-display text-base font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export function ResumeUploadModal({
  open,
  onClose,
  onSuccess,
  onAnalyzeStart,
  onAnalyzeResult,
}: ResumeUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<UploadError | null>(null)
  const [successResume, setSuccessResume] = useState<StoredResume | null>(null)

  const reset = useCallback(() => {
    setFile(null)
    setDragActive(false)
    setStatus('idle')
    setError(null)
    setSuccessResume(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  const selectFile = useCallback((candidate: File | null) => {
    if (!candidate) return
    const isPdf =
      candidate.type === 'application/pdf' || candidate.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setFile(null)
      setStatus('error')
      setError({
        title: 'Unsupported file type',
        message: 'Only PDF resumes are supported. Please choose a file ending in .pdf.',
      })
      return
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setFile(null)
      setStatus('error')
      setError({
        title: 'File too large',
        message: `"${candidate.name}" is ${formatBytes(candidate.size)}. The maximum file size is 5 MB.`,
      })
      return
    }
    setFile(candidate)
    setStatus('idle')
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragActive(false)
      selectFile(event.dataTransfer.files?.[0] ?? null)
    },
    [selectFile],
  )

  const openBrowser = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRemove = useCallback(() => {
    setFile(null)
    setStatus('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!file) {
      setStatus('error')
      setError({
        title: 'No file selected',
        message: 'Please choose a PDF resume before analyzing.',
      })
      return
    }
    if (status === 'uploading') return

    const controller = new AbortController()
    controllerRef.current = controller
    setStatus('uploading')
    setError(null)
    onAnalyzeStart?.(file.name)

    try {
      const result = await apiService.parseResume(file, {
        timeoutMs: PARSE_TIMEOUT_MS,
        signal: controller.signal,
      })
      if (!mountedRef.current) return
      const stored: StoredResume = {
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        parsedDetails: result.parsedDetails,
        resumeText: result.resumeText,
      }
      setSuccessResume(stored)
      setStatus('success')
      onAnalyzeResult?.(stored)
    } catch (parseError) {
      if (!mountedRef.current) return
      setStatus('error')
      setError({
        title: "Couldn't analyze your resume",
        message: toErrorMessage(parseError),
      })
      onAnalyzeResult?.(null)
    } finally {
      controllerRef.current = null
    }
  }, [file, status, onAnalyzeStart, onAnalyzeResult])

  const isUploading = status === 'uploading'

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Upload resume"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25, ease: easeOut }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-card-lg"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-400">
                  <UploadCloud className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                    Upload your resume
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Unlock personalized insights from your PDF
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="px-6 py-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  selectFile(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />

              {status === 'success' && successResume ? (
                <div className="flex flex-col items-center py-2 text-center">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="size-8" aria-hidden />
                  </motion.div>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                    Resume analyzed!
                  </h3>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    We extracted your profile details. Your personalized CareerLens dashboard is
                    ready.
                  </p>

                  <div className="mt-5 w-full rounded-xl border border-border bg-muted/40 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                        <FileText className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {successResume.fileName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          PDF · {formatBytes(successResume.fileSize)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
                      <Stat label="Skills" value={successResume.parsedDetails.skills.length} />
                      <Stat
                        label="Roles"
                        value={successResume.parsedDetails.workExperience.length}
                      />
                      <Stat label="Education" value={successResume.parsedDetails.education.length} />
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="mt-6 w-full"
                    onClick={() => {
                      onSuccess(successResume)
                      onClose()
                    }}
                    rightIcon={<ArrowRight className="size-4" aria-hidden />}
                  >
                    Continue to Dashboard
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Resume PDF
                  </p>

                  {error && status === 'error' && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-destructive">{error.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {error.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {file ? (
                    <div className="rounded-2xl border border-border bg-muted/40 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                          <FileText className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {file.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            PDF · {formatBytes(file.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleRemove}
                          aria-label="Remove file"
                          className="shrink-0"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                      {isUploading && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-muted-foreground">
                              Analyzing resume…
                            </span>
                            <span className="font-semibold text-brand-600 dark:text-brand-400">
                              Extracting profile data
                            </span>
                          </div>
                          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full w-1/3 rounded-full bg-brand-500"
                              animate={{ x: ['-120%', '340%'] }}
                              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openBrowser}
                      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openBrowser()
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDragActive(true)
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      className={cn(
                        'group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-all duration-200',
                        'hover:border-brand-300 hover:bg-brand-500/5',
                        dragActive &&
                          'border-brand-400 bg-brand-500/5 ring-4 ring-brand-500/10',
                      )}
                    >
                      <motion.span
                        animate={dragActive ? { y: -4, scale: 1.05 } : { y: 0, scale: 1 }}
                        className="flex size-14 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-600 shadow-card transition-colors dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-400"
                      >
                        <UploadCloud className="size-6" aria-hidden />
                      </motion.span>
                      <p className="mt-4 text-sm font-semibold text-foreground">
                        {dragActive ? 'Drop your resume here' : 'Drag & drop your resume'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        PDF only · Maximum file size 5 MB
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4"
                        onClick={(event) => {
                          event.stopPropagation()
                          openBrowser()
                        }}
                      >
                        Browse files
                      </Button>
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-2.5">
                    {status === 'error' ? (
                      <>
                        {file && (
                          <Button
                            size="lg"
                            className="w-full"
                            onClick={handleAnalyze}
                            leftIcon={<RefreshCw className="size-4" aria-hidden />}
                          >
                            Try again
                          </Button>
                        )}
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full"
                          onClick={openBrowser}
                          leftIcon={<FileText className="size-4" aria-hidden />}
                        >
                          {file ? 'Choose a different file' : 'Browse for a PDF'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="lg"
                        className="w-full"
                        loading={isUploading}
                        onClick={handleAnalyze}
                        leftIcon={<Sparkles className="size-4" aria-hidden />}
                      >
                        {isUploading ? 'Analyzing resume…' : 'Analyze Resume'}
                      </Button>
                    )}
                  </div>

                  <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    Your PDF is parsed securely and never shared · PDF only · up to 5 MB
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
