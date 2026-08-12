import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Briefcase, FileText, GraduationCap, Layers, Mail, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DashboardSectionHeader } from '@/components/dashboard/section-header'
import type { DashboardData } from '@/components/dashboard/dashboard-data'

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <Icon className="mx-auto size-4 text-muted-foreground" aria-hidden />
      <p className="mt-1.5 font-display text-lg font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export function ResumeOverview({ data }: { data: DashboardData }) {
  const resume = data.resume
  if (!resume) return null
  const parsed = resume.parsed
  const uploadedLabel = new Date(resume.uploadedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <DashboardSectionHeader
        icon={FileText}
        eyebrow="Resume Intelligence"
        title="Resume overview"
        description="Health of your latest upload"
        viewAllTo="/skill-gaps"
        viewAllLabel="Open"
      />

      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{resume.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {resume.fileType.toUpperCase()} · {resume.fileSizeKb} KB · uploaded {uploadedLabel}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Completeness score</span>
            <span className="font-semibold text-foreground">{resume.completeness}%</span>
          </div>
          <Progress
            value={resume.completeness}
            className="h-2"
            indicatorClassName="bg-brand-500 dark:bg-brand-400"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat icon={Layers} label="Skills" value={parsed.skills.length} />
          <MiniStat icon={Briefcase} label="Roles" value={parsed.experience.length} />
          <MiniStat icon={GraduationCap} label="Education" value={parsed.education.length} />
        </div>

        {(parsed.contact.email || parsed.contact.phone) && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              {parsed.contact.email ? (
                <Mail className="size-5" aria-hidden />
              ) : (
                <Phone className="size-5" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              {parsed.contact.email ? (
                <p className="truncate text-sm font-semibold text-foreground">{parsed.contact.email}</p>
              ) : (
                <p className="truncate text-sm font-semibold text-foreground">{parsed.contact.phone}</p>
              )}
              <p className="text-xs text-muted-foreground">Contact information</p>
            </div>
          </div>
        )}

        <Link to="/skill-gaps" className="block">
          <Button
            className="w-full"
            variant="outline"
            rightIcon={<ArrowRight className="size-4" aria-hidden />}
          >
            Analyze Skill Gaps
          </Button>
        </Link>
      </div>
    </div>
  )
}
