import { useCallback, useEffect, useRef, useState } from 'react'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, FileText, LoaderCircle, SkipForward } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { StoredResume } from '@/lib/resume-store'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

// Timeline (milliseconds)
const SCAN_START = 3600
const SCAN_END = 6600

const DOC_LINES: Array<{ w: number; h: number }> = [
  { w: 0.3, h: 15 },
  { w: 0.58, h: 8 },
  { w: 0.46, h: 8 },
  { w: 0.64, h: 8 },
  { w: 0.3, h: 8 },
  { w: 0.52, h: 8 },
  { w: 0.42, h: 8 },
  { w: 0.3, h: 8 },
  { w: 0.6, h: 8 },
  { w: 0.5, h: 8 },
  { w: 0.28, h: 8 },
  { w: 0.56, h: 8 },
  { w: 0.44, h: 8 },
  { w: 0.32, h: 8 },
  { w: 0.5, h: 8 },
]

type Phase = 'rings' | 'scan' | 'reveal'

interface RevealChip {
  label: string
  value: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const base = ctx.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, '#0b0f22')
  base.addColorStop(1, '#131a36')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  const glow = ctx.createRadialGradient(
    w / 2,
    h * 0.35,
    0,
    w / 2,
    h * 0.35,
    Math.max(w, h) * 0.6,
  )
  glow.addColorStop(0, 'rgba(99, 92, 240, 0.16)')
  glow.addColorStop(1, 'rgba(99, 92, 240, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  ringsAlpha: number,
): void {
  if (ringsAlpha <= 0) return
  const cx = w / 2
  const cy = h / 2
  const t = elapsed
  const pulse = Math.sin(t * 0.0012) * 6

  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180 + pulse)
  halo.addColorStop(0, 'rgba(127, 136, 246, 0.35)')
  halo.addColorStop(0.5, 'rgba(99, 92, 240, 0.12)')
  halo.addColorStop(1, 'rgba(99, 92, 240, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, 180 + pulse, 0, Math.PI * 2)
  ctx.fill()

  const count = 8
  for (let i = 0; i < count; i++) {
    const r = 74 + i * 32 + Math.sin(t * 0.00035 + i * 0.9) * 7
    const alpha = Math.max((0.55 - i * 0.05) * ringsAlpha, 0)
    const dir = i % 2 === 0 ? 1 : -1
    const rot = t * 0.00012 * dir + i * 0.55
    ctx.strokeStyle = `rgba(127, 136, 246, ${alpha})`
    ctx.lineWidth = 1.6 + (i % 3) * 0.5
    ctx.setLineDash([26, 18])
    ctx.lineDashOffset = -t * 0.02 * dir
    ctx.beginPath()
    ctx.arc(cx, cy, r, rot, rot + Math.PI * 1.6)
    ctx.stroke()
  }
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.arc(cx, cy, 5 + Math.sin(t * 0.002) * 1.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fill()

  for (let i = 0; i < 70; i++) {
    const speed = i % 2 === 0 ? 0.8 : 1.2
    const angle = t * 0.0004 * speed + i * 2.39996
    const r = 92 + (i % 11) * 27 + Math.sin(t * 0.001 + i) * 6
    const px = cx + Math.cos(angle) * r
    const py = cy + Math.sin(angle) * r
    const twinkle = 0.5 + Math.sin(t * 0.003 + i) * 0.5
    ctx.fillStyle = `rgba(163, 174, 252, ${(0.25 + twinkle * 0.4) * ringsAlpha})`
    ctx.beginPath()
    ctx.arc(px, py, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawScan(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  phase: Phase,
): void {
  const cx = w / 2
  const docW = Math.min(w * 0.7, 560)
  const docH = Math.min(h * 0.56, 440)
  const gap = 9
  const totalH =
    DOC_LINES.reduce((sum, line) => sum + line.h, 0) + gap * (DOC_LINES.length - 1)
  const scale = docH / totalH
  const y0 = (h - docH) / 2

  const progress = clamp((elapsed - SCAN_START) / (SCAN_END - SCAN_START), 0, 1)
  const scanY = y0 + progress * docH
  const docAlpha = phase === 'reveal' ? 0.2 : 1

  let y = y0
  for (const line of DOC_LINES) {
    const lw = line.w * docW
    const lh = line.h * scale
    const centerY = y + lh / 2
    const revealed = phase === 'reveal' || centerY <= scanY
    const alpha = (revealed ? 0.92 : 0.08) * docAlpha
    ctx.fillStyle = `rgba(163, 174, 252, ${alpha})`
    roundRect(ctx, cx - lw / 2, y, lw, lh, Math.min(4, lh / 2))
    ctx.fill()
    y += lh + gap * scale
  }

  if (phase === 'scan') {
    const gradient = ctx.createLinearGradient(cx - docW / 2, 0, cx + docW / 2, 0)
    gradient.addColorStop(0, 'rgba(99, 92, 240, 0)')
    gradient.addColorStop(0.5, 'rgba(163, 174, 252, 0.9)')
    gradient.addColorStop(1, 'rgba(99, 92, 240, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(cx - docW / 2, scanY - 1, docW, 2)
    ctx.beginPath()
    ctx.arc(cx, scanY, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fill()
  }
}

export interface ResumeCinematicAnalysisProps {
  fileName: string
  result: StoredResume | null
  onComplete: () => void
  onCancel: () => void
}

export function ResumeCinematicAnalysis({
  fileName,
  result,
  onComplete,
  onCancel,
}: ResumeCinematicAnalysisProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(performance.now())
  const phaseRef = useRef<Phase>('rings')

  const [phase, setPhase] = useState<Phase>('rings')
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = (ms: number) => (reduced ? ms * 0.35 : ms)
    const scanTimer = window.setTimeout(
      () => setPhase((current) => (current === 'rings' ? 'scan' : current)),
      delay(SCAN_START),
    )
    const waitingTimer = window.setTimeout(() => setWaiting(true), delay(SCAN_END))
    return () => {
      window.clearTimeout(scanTimer)
      window.clearTimeout(waitingTimer)
    }
  }, [])

  useEffect(() => {
    if (phase === 'scan' && result) {
      setPhase('reveal')
    }
  }, [phase, result])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = 1
    let width = 0
    let height = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const elapsed = performance.now() - startRef.current
      ctx.clearRect(0, 0, width, height)
      drawBackdrop(ctx, width, height)
      const ringsAlpha = clamp(1 - (elapsed - (SCAN_START + 150)) / 600, 0, 1)
      if (ringsAlpha > 0) drawRings(ctx, width, height, elapsed, ringsAlpha)
      if (phaseRef.current === 'scan' || phaseRef.current === 'reveal') {
        drawScan(ctx, width, height, elapsed, phaseRef.current)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleSkip = useCallback(() => {
    startRef.current = performance.now() - SCAN_END
    setPhase((current) => (current === 'rings' ? 'scan' : current))
  }, [])

  const phaseLabel =
    phase === 'rings'
      ? 'Analyzing resume'
      : phase === 'scan'
        ? 'Extracting profile data'
        : 'Profile ready'

  const announcement =
    phase === 'rings'
      ? 'Analyzing your resume.'
      : phase === 'scan'
        ? 'Extracting skills, roles and education from your resume.'
        : result
          ? `Analysis complete. Found ${result.parsedDetails.skills.length} skills, ${result.parsedDetails.workExperience.length} roles and ${result.parsedDetails.education.length} education entries.`
          : ''

  const revealChips: RevealChip[] = result
    ? [
        { label: 'Skills', value: result.parsedDetails.skills.length },
        { label: 'Roles', value: result.parsedDetails.workExperience.length },
        { label: 'Education', value: result.parsedDetails.education.length },
      ]
    : []

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Analyzing your resume"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
      className="fixed inset-0 z-[60] overflow-hidden bg-navy-950"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-navy-950/85 to-transparent"
      />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-300">
            <FileText className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">CareerLens AI</p>
            <p className="text-[11px] text-navy-300">{phaseLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-navy-300 hover:bg-white/5 hover:text-white"
        >
          <SkipForward className="size-4" aria-hidden />
          Skip
        </Button>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <AnimatePresence mode="wait">
          {phase === 'rings' && (
            <motion.div
              key="rings"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="absolute inset-x-0 top-[14%] flex flex-col items-center px-6 text-center"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-300">
                Analysis
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Reading your resume
              </h2>
              <p className="mt-2 max-w-xs truncate text-sm text-navy-300">{fileName}</p>
            </motion.div>
          )}

          {phase === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="absolute inset-x-0 top-[13%] flex flex-col items-center px-6 text-center"
            >
              <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                {waiting ? 'Finalizing analysis' : 'Mapping your experience'}
              </h2>
              <p className="mt-1.5 text-sm text-navy-300">
                {waiting
                  ? 'Preparing your personalized dashboard…'
                  : 'Extracting skills, roles & education'}
              </p>
              {waiting && (
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-brand-300">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Still working
                </span>
              )}
            </motion.div>
          )}

          {phase === 'reveal' && result && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            >
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: easeOut }}
                className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-300"
              >
                Analysis complete
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5, ease: easeOut }}
                className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl"
              >
                Your profile is ready
              </motion.h2>

              <div className="mt-7 grid grid-cols-3 gap-3 sm:gap-4">
                {revealChips.map((chip, index) => (
                  <motion.div
                    key={chip.label}
                    initial={{ opacity: 0, y: 18, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.35 + index * 0.12, duration: 0.45, ease: easeOut }}
                    className="w-28 rounded-2xl border border-brand-500/25 bg-navy-900/85 px-3 py-5 text-center backdrop-blur-sm sm:w-32"
                  >
                    <p className="font-display text-3xl font-bold leading-none text-brand-300">
                      {chip.value}
                    </p>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-navy-300">
                      {chip.label}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5, ease: easeOut }}
                className="mt-8"
              >
                <Button
                  size="lg"
                  onClick={onComplete}
                  rightIcon={<ArrowRight className="size-4" aria-hidden />}
                >
                  Continue to Dashboard
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </motion.div>
  )
}
