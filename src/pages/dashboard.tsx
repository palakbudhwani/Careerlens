import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Gauge,
  TrendingUp,
  Video,
  GitCompare,
  Briefcase,
  ScanSearch,
  ArrowRight,
  Clock,
  User,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { CareerHero } from '@/components/dashboard/career-hero'
import { useDashboardData } from '@/components/dashboard/dashboard-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}

export default function DashboardPage() {
  const data = useDashboardData()

  return (
    <div className="space-y-10 pb-12">
      {/* Top Greeting & Welcome Hero */}
      <CareerHero data={data} />

      {/* Spacious 4-Step Introduction Guide */}
      <Reveal delay={0.05} className="space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" className="text-xs font-bold">
              User Workflow
            </Badge>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              How CareerLens Works
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow this 4-step guide to analyze your resume, close skill gaps, practice interviews, and land your ideal tech role.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Step 1 */}
          <Card className="flex flex-col justify-between border-border transition-all hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                  <Gauge className="size-6" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Step 1
                </span>
              </div>
              <CardTitle className="mt-3 text-lg font-bold text-foreground">
                Upload Resume & Skill Gap Analysis
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Upload your PDF resume to extract skills automatically. Select your target tech role to see your readiness score and priority skill gaps.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/skill-gaps" className="block w-full">
                <Button variant="primary" size="sm" className="w-full justify-between shadow-sm">
                  <span>Upload & Analyze Skill Gaps</span>
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="flex flex-col justify-between border-border transition-all hover:border-purple-300 hover:shadow-md dark:hover:border-purple-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <TrendingUp className="size-6" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Step 2
                </span>
              </div>
              <CardTitle className="mt-3 text-lg font-bold text-foreground">
                Upskill with Course Recommendations
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Bridge your identified skill gaps with hand-picked online courses from Udemy, Coursera, freeCodeCamp, and YouTube with direct links.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/career-growth" className="block w-full">
                <Button variant="secondary" size="sm" className="w-full justify-between">
                  <span>Explore Course Recommendations</span>
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="flex flex-col justify-between border-border transition-all hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Video className="size-6" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Step 3
                </span>
              </div>
              <CardTitle className="mt-3 text-lg font-bold text-foreground">
                Practice AI Mock Interviews
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Practice multi-round AI interviews (Aptitude MCQs, Technical Free-Text, HR) with proctoring enforcement and instant final scorecards.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/mock-interview" className="block w-full">
                <Button variant="secondary" size="sm" className="w-full justify-between">
                  <span>Start AI Mock Interview</span>
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Step 4 */}
          <Card className="flex flex-col justify-between border-border transition-all hover:border-blue-300 hover:shadow-md dark:hover:border-blue-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Briefcase className="size-6" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Step 4
                </span>
              </div>
              <CardTitle className="mt-3 text-lg font-bold text-foreground">
                Discover & Compare Target Jobs
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Browse active tech job openings, evaluate ATS match compatibility scores, and compare job offer packages side by side.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/jobs" className="block w-full">
                <Button variant="secondary" size="sm" className="w-full justify-between">
                  <span>Explore & Compare Jobs</span>
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Reveal>

      {/* Spacious Quick Navigation Portal */}
      <Reveal delay={0.1} className="space-y-4 pt-2">
        <h3 className="text-lg font-bold text-foreground">
          Quick Access Tools
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/match" className="group block">
            <Card className="p-5 transition-all group-hover:border-brand-400 group-hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <ScanSearch className="size-5 text-brand-600 dark:text-brand-400" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Match Analysis</h4>
                  <p className="text-[11px] text-muted-foreground">ATS match score breakdown</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/compare" className="group block">
            <Card className="p-5 transition-all group-hover:border-brand-400 group-hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <GitCompare className="size-5 text-purple-600 dark:text-purple-400" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Compare Jobs</h4>
                  <p className="text-[11px] text-muted-foreground">Side-by-side job offer comparison</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/history" className="group block">
            <Card className="p-5 transition-all group-hover:border-brand-400 group-hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Clock className="size-5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Interview History</h4>
                  <p className="text-[11px] text-muted-foreground">Past scorecard logs</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/profile" className="group block">
            <Card className="p-5 transition-all group-hover:border-brand-400 group-hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <User className="size-5 text-blue-600 dark:text-blue-400" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Profile & Settings</h4>
                  <p className="text-[11px] text-muted-foreground">Manage your account</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
