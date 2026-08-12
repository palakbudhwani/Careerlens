import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Briefcase, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CountUp } from '@/components/landing/count-up'
import { Button } from '@/components/ui/button'
import type { DashboardData } from '@/components/dashboard/dashboard-data'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function ReadinessRing({ value }: { value: number }) {
  const id = useId()
  const reduced = useReducedMotion()
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const ratio = Math.min(100, Math.max(0, value)) / 100
  const hidden = circumference * (1 - ratio)

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90" aria-hidden>
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#b8c6ff" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="10" />
      <motion.circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={`url(#${id}-stroke)`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: reduced ? hidden : circumference }}
        animate={{ strokeDashoffset: hidden }}
        transition={{ duration: 1, ease: easeOut }}
      />
    </svg>
  )
}

export function CareerHero({ data }: { data: DashboardData }) {
  const { candidate, careerReadiness, matchCount, strongMatchCount, criticalGapCount } = data
  const storedName = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_name') : null
  const displayName = storedName || (candidate.name && candidate.name !== 'Your Profile' ? candidate.name.split(' ')[0] : 'User')

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOut }}
      className="relative overflow-hidden rounded-3xl border border-brand-200/70 bg-gradient-to-br from-brand-600 via-brand-500 to-blue-600 text-white shadow-card-lg dark:border-brand-400/20"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_70%_at_72%_18%,black,transparent)]" />
        <div className="absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 size-72 rounded-full bg-blue-400/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden />
              AI Career Intelligence Hub
            </span>
            {candidate.targetRole && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                <Target className="size-3.5" aria-hidden />
                Targeting {candidate.targetRole}
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Hello, {displayName}!
          </h1>
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
            Welcome to CareerLens! Follow our step-by-step guidance below to upload your resume, identify skill gaps, upskill with curated courses, practice AI mock interviews, and explore active job matches.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/skill-gaps">
              <Button
                size="lg"
                className="bg-white text-brand-700 shadow-lg hover:bg-white/90 hover:text-brand-700 dark:bg-white dark:text-brand-700"
                leftIcon={<Sparkles className="size-4 text-brand-600" aria-hidden />}
              >
                Analyze Skill Gaps & Resume
              </Button>
            </Link>
            <Link to="/jobs">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                leftIcon={<Briefcase className="size-4" aria-hidden />}
              >
                Explore Active Jobs
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-center">
          <div className="flex items-center gap-5 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
            <div className="relative">
              <ReadinessRing value={careerReadiness} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-bold">
                  <CountUp value={careerReadiness} suffix="%" />
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/75">
                  Readiness
                </span>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-300" aria-hidden />
                <span className="font-semibold text-white">{strongMatchCount} strong matches</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-white/70" aria-hidden />
                <span className="text-white/90">{matchCount} roles analyzed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-300" aria-hidden />
                <span className="text-white/90">{criticalGapCount} critical gaps</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
