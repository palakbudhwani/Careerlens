import { motion } from 'framer-motion'
import { ArrowRight, Briefcase, Gauge, Sparkles, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useResumeUpload } from '@/components/resume/resume-upload-provider'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/ui/logo'
import type { LucideIcon } from 'lucide-react'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const promises: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Gauge,
    title: 'Career readiness score',
    description: 'A clear measure of how ready you are for your target role.',
  },
  {
    icon: Briefcase,
    title: 'Personalized job matches',
    description: 'See exactly which roles fit you and why, with live scores.',
  },
  {
    icon: Sparkles,
    title: 'Skill analysis & recommendations',
    description: 'Know what to learn next and get a step-by-step plan.',
  },
]

export function OnboardingState() {
  const { openResumeUpload } = useResumeUpload()

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOut }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-card-lg"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 size-64 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 py-14 text-center sm:px-10 sm:py-16">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 shadow-card dark:border-brand-500/25 dark:bg-brand-500/10">
          <LogoMark size={30} />
        </div>

        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Build your{' '}
          <span className="bg-gradient-to-r from-brand-600 to-blue-600 bg-clip-text text-transparent dark:from-brand-300 dark:to-blue-300">
            CareerLens
          </span>{' '}
          profile
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Upload your resume to unlock personalized career insights, job matches, skill analysis
          and career recommendations.
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            leftIcon={<Upload className="size-4" aria-hidden />}
            onClick={openResumeUpload}
          >
            Upload Resume
          </Button>
          <Link to="/jobs">
            <Button
              size="lg"
              variant="outline"
              rightIcon={<ArrowRight className="size-4" aria-hidden />}
            >
              Explore Jobs
            </Button>
          </Link>
        </div>

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          {promises.map((promise) => (
            <div
              key={promise.title}
              className="rounded-2xl border border-border bg-card/70 p-4 transition-colors hover:border-brand-200 dark:hover:border-brand-500/30"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <promise.icon className="size-4" aria-hidden />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-foreground">{promise.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {promise.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
