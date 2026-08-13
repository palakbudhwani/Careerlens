import { Gauge, TrendingUp, Video, Briefcase, GitCompare, Heart, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/logo'

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-sm mt-12">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Brand Col */}
          <div className="space-y-4 lg:col-span-1">
            <Link to="/dashboard" className="inline-block" aria-label="CareerLens Dashboard">
              <Logo />
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              CareerLens is your all-in-one AI career co-pilot. Upload your resume, analyze skill gaps, discover curated upskilling courses, practice proctored mock interviews, and land target tech jobs.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              Backend AI Server Online
            </div>
          </div>

          {/* Tools Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Career Tools
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to="/skill-gaps" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Gauge className="size-3.5 text-brand-500" /> Skill Gap Analysis
                </Link>
              </li>
              <li>
                <Link to="/career-growth" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <TrendingUp className="size-3.5 text-purple-500" /> Course Recommendations
                </Link>
              </li>
              <li>
                <Link to="/mock-interview" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Video className="size-3.5 text-emerald-500" /> AI Mock Interviews
                </Link>
              </li>
              <li>
                <Link to="/jobs" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Briefcase className="size-3.5 text-blue-500" /> Explore Tech Jobs
                </Link>
              </li>
              <li>
                <Link to="/compare" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <GitCompare className="size-3.5 text-amber-500" /> Compare Job Offers
                </Link>
              </li>
            </ul>
          </div>

          {/* Overview Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard Overview
                </Link>
              </li>
              <li>
                <Link to="/match" className="hover:text-foreground transition-colors">
                  ATS Match Score
                </Link>
              </li>
              <li>
                <Link to="/history" className="hover:text-foreground transition-colors">
                  Interview Scorecards & History
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-foreground transition-colors">
                  User Profile
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-foreground transition-colors">
                  Account Settings
                </Link>
              </li>
            </ul>
          </div>

          {/* Privacy & Trust Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Privacy & Trust
            </h4>
            <div className="rounded-xl border border-border bg-secondary/50 p-3.5 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="size-4 text-emerald-500" /> Privacy First
              </div>
              <p className="text-[11px] leading-relaxed">
                Your uploaded resume and parsed career data are processed securely and locally.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/80 pt-6 sm:flex-row text-xs text-muted-foreground">
          <p>© 2026 CareerLens. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="size-3 text-rose-500 fill-rose-500" /> for your tech career growth
          </p>
        </div>
      </div>
    </footer>
  )
}
