import type { ReactNode } from 'react'

import { motion } from 'framer-motion'
import { Briefcase, GraduationCap, Rocket, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { HeroPreview } from '@/components/landing/hero-preview'
import { ScoreRing } from '@/components/landing/score-ring'
import { Eyebrow } from '@/components/landing/section-heading'
import { Button } from '@/components/ui/button'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function FloatingWrapper({
  className,
  entranceDelay,
  children,
}: {
  className?: string
  entranceDelay?: number
  children: ReactNode
}) {
  return (
    <motion.div
      className={`absolute z-10 hidden lg:block ${className ?? ''}`}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, delay: entranceDelay ?? 0, ease: easeOut }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function MatchFloatCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card-lg">
      <ScoreRing value={92} size={56} stroke={6} label="Match" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Best match</p>
        <p className="mt-0.5 text-sm font-semibold">Machine Learning Engineer</p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Strong fit</p>
      </div>
    </div>
  )
}

function SkillFloatCard() {
  return (
    <div className="w-56 rounded-2xl border border-border bg-card p-4 shadow-card-lg">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <GraduationCap className="size-4" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Next skill to learn</p>
          <p className="text-sm font-semibold">AWS + Docker</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Rocket className="size-3.5 text-brand-500" aria-hidden />
        <span>Deploy your model to the cloud</span>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-primary)_8%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-primary)_8%,transparent)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_32%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="absolute -right-24 top-48 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pb-16 lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="mx-auto max-w-3xl text-center"
        >
          <Eyebrow className="text-[13px]">
            <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
            AI career intelligence — runs entirely in your browser
          </Eyebrow>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Your resume knows your past.
            <span className="block bg-gradient-to-r from-brand-600 via-violet-600 to-blue-600 bg-clip-text text-transparent dark:from-brand-300 dark:via-violet-300 dark:to-blue-300">
              CareerLens shows your future.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Upload your resume and CareerLens builds your career profile, discovers jobs you actually
            fit, and explains every match with real scores — then shows you exactly which skills to
            learn and what to do next.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/skill-gaps" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto" leftIcon={<Sparkles className="size-4 text-amber-300" aria-hidden />}>
                Analyze My Resume
              </Button>
            </Link>
            <Link to="/jobs" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto" rightIcon={<Briefcase className="size-4" aria-hidden />}>
                Explore Jobs
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden /> Private by design
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-brand-500" aria-hidden /> Instant analysis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-blue-500" aria-hidden /> No account required
            </span>
          </div>
        </motion.div>

        <div className="relative mt-12 lg:mt-16">
          <div
            aria-hidden
            className="absolute -inset-x-6 -top-10 bottom-0 rounded-[2.5rem] bg-gradient-to-b from-brand-500/10 via-transparent to-transparent blur-2xl"
          />
          <FloatingWrapper className="-top-8 -right-4 xl:-right-16" entranceDelay={0.45}>
            <MatchFloatCard />
          </FloatingWrapper>
          <FloatingWrapper className="-bottom-10 -left-4 xl:-left-16" entranceDelay={0.6}>
            <SkillFloatCard />
          </FloatingWrapper>
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25, ease: easeOut }}
            className="relative mx-auto max-w-5xl"
          >
            <HeroPreview />
          </motion.div>
        </div>
      </div>
    </section>
  )
}