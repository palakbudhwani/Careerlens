import type { ReactNode } from 'react'

import { ShieldCheck, Sparkles, Target } from 'lucide-react'

import { Logo, LogoMark } from '@/components/ui/logo'

const sellingPoints = [
  {
    icon: Target,
    title: 'See how well you really match',
    description: 'A single score, broken into the hard skills, soft skills, and experience that drive it.',
  },
  {
    icon: Sparkles,
    title: 'Understand the why',
    description: 'Evidence-backed strengths and the exact gaps standing between you and the role.',
  },
  {
    icon: ShieldCheck,
    title: 'Know what to do next',
    description: 'Prioritized, concrete actions — not generic career advice.',
  },
]

const stats = [
  { value: '92%', label: 'best match score' },
  { value: '6', label: 'roles analyzed' },
  { value: '7', label: 'skill gaps mapped' },
]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="relative hidden w-[46%] overflow-hidden bg-navy-950 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-brand-600/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 right-0 size-[28rem] rounded-full bg-blue-600/15 blur-3xl" aria-hidden />
        <div className="absolute left-1/3 top-2/3 size-64 rounded-full bg-violet-600/15 blur-3xl" aria-hidden />

        <div className="relative">
          <Logo textClassName="text-white" />
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
            Know exactly how well you match the job you want.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-navy-300">
            CareerLens turns your resume into a living map of your fit — score, reasons, gaps, and
            a plan.
          </p>
          <ul className="mt-8 space-y-5">
            {sellingPoints.map((point) => (
              <li key={point.title} className="flex items-start gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-brand-300">
                  <point.icon className="size-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{point.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-navy-300">{point.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-8">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-0.5 text-xs text-navy-300">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <LogoMark size={30} />
          <span className="font-display text-lg font-bold tracking-tight">CareerLens</span>
        </div>
        <div className="w-full max-w-md animate-fade-in-up">{children}</div>
      </div>
    </div>
  )
}