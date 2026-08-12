import type { ReactNode } from 'react'

import { motion } from 'framer-motion'

import { CareerHero } from '@/components/dashboard/career-hero'
import { useDashboardData } from '@/components/dashboard/dashboard-data'
import { MetricTiles } from '@/components/dashboard/metric-tiles'
import { OnboardingState } from '@/components/dashboard/onboarding'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RecommendationsPanel } from '@/components/dashboard/recommendations-panel'
import { ResumeOverview } from '@/components/dashboard/resume-overview'
import { SkillGapsPanel } from '@/components/dashboard/skill-gaps-panel'
import { TopMatches } from '@/components/dashboard/top-matches'
import { TopSkills } from '@/components/dashboard/top-skills'
import { cn } from '@/lib/utils'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}

export default function DashboardPage() {
  const data = useDashboardData()

  if (!data.hasAnalysis) {
    return <OnboardingState />
  }

  return (
    <div className="space-y-6">
      <CareerHero data={data} />

      <Reveal>
        <MetricTiles data={data} />
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0.05} className="space-y-6">
          <ResumeOverview data={data} />
          <TopSkills data={data} />
        </Reveal>
        <Reveal delay={0.1} className={cn('lg:col-span-2')}>
          <TopMatches data={data} />
        </Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.05}>
          <SkillGapsPanel data={data} />
        </Reveal>
        <Reveal delay={0.1}>
          <RecommendationsPanel data={data} />
        </Reveal>
      </div>

      <Reveal delay={0.05}>
        <QuickActions />
      </Reveal>
    </div>
  )
}
