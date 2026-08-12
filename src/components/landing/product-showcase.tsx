import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, FileText, Gauge, Target, TrendingUp } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/landing/reveal'
import { SectionHeading } from '@/components/landing/section-heading'
import { GapCard, GrowthCard, MatchCard, ResumeAnalysisCard } from '@/components/landing/showcase-cards'
import { useResumeUpload } from '@/components/resume/resume-upload-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TabId = 'resume' | 'match' | 'gaps' | 'growth'

const tabs: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'resume', label: 'Resume intelligence', icon: FileText },
  { id: 'match', label: 'Job matching', icon: Target },
  { id: 'gaps', label: 'Skill gaps', icon: Gauge },
  { id: 'growth', label: 'Career growth', icon: TrendingUp },
]

const copy: Record<
  TabId,
  { heading: string; body: string; bullets: string[]; cta: string; to: string }
> = {
  resume: {
    heading: 'Know exactly how strong your resume is.',
    body: 'CareerLens scores your resume the way a recruiter would — section by section — then tells you which edits raise your score the most.',
    bullets: [
      'An overall score plus per-section coverage.',
      'Prioritized, actionable improvements, not generic advice.',
    ],
    cta: 'Analyze your resume',
    to: '/resume',
  },
  match: {
    heading: 'A match score you can trust — because it explains itself.',
    body: 'Every role gets an explained fit score. See which skills, experience, and projects drive the match — and what is still missing.',
    bullets: [
      'Explained fit scores for every role.',
      'Know the gap to a strong fit before you apply.',
    ],
    cta: 'Explore jobs',
    to: '/jobs',
  },
  gaps: {
    heading: 'Know what you are missing — and how much it costs.',
    body: 'CareerLens turns the gap between your profile and your target role into a clear, ranked list of what to learn first.',
    bullets: [
      'Gaps ranked by how much they move your match.',
      'Current vs required skill levels, side by side.',
    ],
    cta: 'View skill gaps',
    to: '/skill-gaps',
  },
  growth: {
    heading: 'A sequenced plan that closes your gaps in order.',
    body: 'Your roadmap: the skills to learn, the project that proves them, and the milestones that land you the role.',
    bullets: [
      'A prioritized list of next skills.',
      'One recommended project that pulls it together.',
    ],
    cta: 'See your roadmap',
    to: '/career-growth',
  },
}

function Visual({ tab }: { tab: TabId }) {
  if (tab === 'match') return <MatchCard />
  if (tab === 'gaps') return <GapCard />
  if (tab === 'growth') return <GrowthCard />
  return <ResumeAnalysisCard />
}

export function ProductShowcase() {
  const [active, setActive] = useState<TabId>('resume')
  const current = copy[active]
  const ActiveIcon = tabs.find((tab) => tab.id === active)?.icon
  const { openResumeUpload } = useResumeUpload()

  return (
    <section id="product-tour" className="border-y border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Product tour"
            title="One platform, four career superpowers."
            description="Resume analysis, job matching, skill gaps, and growth planning — four tools that work together as one career plan."
          />
        </Reveal>

        <div
          role="tablist"
          aria-label="Product tour"
          className="mt-10 flex flex-wrap justify-center gap-2"
        >
          {tabs.map((tab) => {
            const selected = active === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActive(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'border-border bg-card text-muted-foreground hover:border-brand-200 hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="mt-8 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="lg:min-h-[440px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                role="tabpanel"
                id={`panel-${active}`}
                aria-labelledby={`tab-${active}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex h-full flex-col justify-center"
              >
                {ActiveIcon && (
                  <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-brand-600 dark:text-brand-400">
                    <ActiveIcon className="size-5" aria-hidden />
                  </span>
                )}
                <h3 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {current.heading}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  {current.body}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {current.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        <Check className="size-3" aria-hidden />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {active === 'resume' ? (
                    <Button
                      rightIcon={<ArrowRight className="size-4" aria-hidden />}
                      onClick={openResumeUpload}
                    >
                      {current.cta}
                    </Button>
                  ) : (
                    <Link to={current.to}>
                      <Button rightIcon={<ArrowRight className="size-4" aria-hidden />}>
                        {current.cta}
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="lg:min-h-[440px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Visual tab={active} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}