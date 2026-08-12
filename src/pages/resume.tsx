import { useEffect, useState } from 'react'
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Award,
  RefreshCw,
  LoaderCircle,
  Layers,
  HelpCircle,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { apiClient } from '@/lib/api-client'

export default function ResumePage() {
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [resumeData, setResumeData] = useState<any>(null)
  const [resumeText, setResumeText] = useState('')
  const [fileName] = useState('Alex_Morgan_Resume_2026.pdf')

  const loadResume = async () => {
    setLoading(true)
    try {
      const data = await apiClient<any>('/resume/latest')
      setResumeData(data)
      if (data?.resume?.rawText) setResumeText(data.resume.rawText)
    } catch {
      setResumeData({
        resume: {
          completeness: 88,
          fileName: 'Alex_Morgan_Resume_2026.pdf',
          uploadedAt: '2026-08-09',
          parsed: {
            contact: { email: 'alex.morgan@example.com', phone: '+1 555-0192', location: 'New York, NY' },
            summary: 'Senior Frontend Engineer crafting thoughtful interfaces for data-dense AI products.',
            skills: ['TypeScript', 'React', 'Next.js', 'Node.js', 'GraphQL', 'Tailwind CSS', 'Docker'],
          },
          suggestions: [
            'Quantify impact in experience section: Add metrics (e.g. "% performance improvement").',
            'Include explicit mention of LLM API integrations and prompt engineering experience.',
            'Add Docker & CI/CD workflow examples to raise your infrastructure keyword coverage.',
          ],
          keywordCoverage: [
            { keyword: 'React', status: 'present' },
            { keyword: 'TypeScript', status: 'present' },
            { keyword: 'Next.js', status: 'present' },
            { keyword: 'Node.js', status: 'present' },
            { keyword: 'Docker', status: 'present' },
            { keyword: 'Python', status: 'missing' },
            { keyword: 'Machine Learning', status: 'recommended' },
          ],
        },
        sections: {
          summary: { score: 90, status: 'Strong summary statement with targeted career focus.' },
          experience: { score: 85, status: 'Rich work experience, consider adding 1-2 quantified metrics.' },
          skills: { score: 92, status: 'Comprehensive tech stack listing.' },
          education: { score: 95, status: 'Accredited CS degree confirmed.' },
        },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadResume()
  }, [])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const data = await apiClient<any>('/resume/analyze', {
        method: 'POST',
        body: JSON.stringify({ resumeText, fileName }),
      })
      setResumeData(data)
    } catch (err) {
      console.error('Failed to analyze resume:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-brand-500" />
      </div>
    )
  }

  const resume = resumeData?.resume || {}
  const sections = resumeData?.sections || {}

  return (
    <div className="space-y-6 pb-12 text-left">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Resume Intelligence & Parsing</h1>
          <p className="text-sm text-muted-foreground">
            Parse your resume, measure ATS keyword coverage, and get actionable score-boosting edits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1 text-xs">
            <CheckCircle2 className="size-3" /> Parsed & Validated
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-brand-500" /> Resume Content & Editor
            </h3>
            <span className="text-xs text-muted-foreground font-mono">{resume.fileName}</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Paste or Edit Raw Resume Text for Instant AI Re-Scan:
            </label>
            <textarea
              rows={8}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your full resume text here..."
              className="w-full rounded-xl border border-border bg-slate-900/60 p-3.5 text-xs font-mono focus:border-brand-500 focus:outline-none leading-relaxed text-foreground"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UploadCloud className="size-4 text-brand-400" /> Last uploaded on {resume.uploadedAt || '2026-08-09'}
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="bg-brand-600 hover:bg-brand-500 text-xs font-semibold gap-1.5"
            >
              {analyzing ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" /> Re-Analyze Resume
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-5 border-brand-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-brand-950/40 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
            <Award className="size-7" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-brand-400 tracking-wider">Completeness Score</span>
            <p className="font-display text-4xl font-extrabold text-white mt-1">{resume.completeness || 88}%</p>
            <p className="text-xs text-muted-foreground mt-1">High ATS readability rating</p>
          </div>
          <Progress value={resume.completeness || 88} className="h-2.5 bg-slate-800" />

          <div className="border-t border-border/40 pt-3 text-xs text-muted-foreground text-left space-y-1.5">
            <div className="flex justify-between">
              <span>Parsed Skills:</span>
              <span className="font-bold text-foreground">{resume.parsed?.skills?.length || 7} detected</span>
            </div>
            <div className="flex justify-between">
              <span>Target Role Fit:</span>
              <span className="font-bold text-emerald-400">Strong</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-3 flex items-center gap-2">
            <Layers className="size-4 text-brand-500" /> Section Intelligence & Scores
          </h3>

          <div className="space-y-4">
            {Object.entries(sections).map(([key, val]: [string, any]) => (
              <div key={key} className="space-y-1.5 border-b border-border/30 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="capitalize text-foreground font-bold">{key} Section</span>
                  <span className="text-brand-400 font-display font-extrabold">{val.score}%</span>
                </div>
                <Progress value={val.score} className="h-1.5 bg-slate-800" />
                <p className="text-[11px] text-muted-foreground">{val.status}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-brand-500" /> Target Role Keyword Coverage
          </h3>

          <div className="flex flex-wrap gap-2 pt-1">
            {resume.keywordCoverage?.map((kw: any) => (
              <div
                key={kw.keyword}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  kw.status === 'present'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : kw.status === 'missing'
                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}
              >
                {kw.status === 'present' ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="size-3.5 text-amber-400" />
                )}
                <span>{kw.keyword}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Adding missing high-demand terms like <span className="font-semibold text-amber-300">Python</span> will increase match rates for AI product engineering roles.
          </p>
        </Card>
      </div>

      {resume.suggestions?.length > 0 && (
        <Card className="p-6 space-y-4 border-brand-500/30 bg-brand-950/20">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="size-4 text-brand-400" /> Concrete Improvement Suggestions
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {resume.suggestions.map((sug: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 font-bold text-xs">
                  {idx + 1}
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground">{sug}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}