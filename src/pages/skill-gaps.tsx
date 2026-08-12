import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  Gauge,
  Target,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  BookOpen,
  FileText,
  TrendingUp,
  UploadCloud,
  LoaderCircle,
  FileUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { apiService, type SkillGapAnalysisResponse, type SkillGapItem } from '@/lib/api-service'
import { useStoredResume, writeStoredResume, type StoredResume } from '@/lib/resume-store'
import { candidateFromStoredResume } from '@/lib/effective-candidate'

const PRESET_ROLES = [
  'Full-Stack Engineer',
  'Senior Frontend Engineer',
  'Backend Engineer',
  'Data Scientist',
  'AI Product Engineer',
  'DevOps Engineer',
  'Mobile Developer',
]

export default function SkillGapsPage() {
  const storedResume = useStoredResume()
  const candidate = storedResume ? candidateFromStoredResume(storedResume) : null
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const defaultRole = candidate?.targetRole || candidate?.preferredRoles?.[0] || 'Full-Stack Engineer'
  const [selectedRole, setSelectedRole] = useState<string>(defaultRole)
  const [customRoleInput, setCustomRoleInput] = useState<string>('')
  
  // Analysis states
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<SkillGapAnalysisResponse | null>(null)

  // Resume Upload states
  const [uploading, setUploading] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [showUploadForm, setShowUploadForm] = useState<boolean>(!storedResume)

  useEffect(() => {
    if (candidate?.targetRole && selectedRole === 'Full-Stack Engineer' && candidate.targetRole !== 'Full-Stack Engineer') {
      setSelectedRole(candidate.targetRole)
    }
  }, [candidate])

  const runAnalysis = async (roleToAnalyze: string) => {
    setLoading(true)
    setError(null)
    try {
      const resumeText = storedResume?.resumeText || ''
      const parsedSkills = candidate?.topSkills?.map((s) => s.name) || storedResume?.parsedDetails?.skills || []

      const result = await apiService.analyzeSkillGaps(resumeText, parsedSkills, roleToAnalyze)
      setAnalysis(result)
    } catch (err: any) {
      console.error('Failed to analyze skill gaps:', err)
      setError(err.message || 'Failed to analyze skill gaps. Please check backend server status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runAnalysis(selectedRole)
  }, [selectedRole, storedResume])

  // Handle PDF Resume Upload
  const handleFileUpload = async (file: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadError('Only PDF resume files are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be under 5MB.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      console.log(`Parsing uploaded resume file: ${file.name}...`)
      const parseResult = await apiService.parseResume(file)

      const newStoredResume: StoredResume = {
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        parsedDetails: parseResult.parsedDetails,
        resumeText: parseResult.resumeText,
      }

      writeStoredResume(newStoredResume)
      setShowUploadForm(false)

      // Immediately run analysis with newly uploaded resume text and parsed skills
      const parsedSkills = parseResult.parsedDetails?.skills || []
      setLoading(true)
      const gapResult = await apiService.analyzeSkillGaps(parseResult.resumeText, parsedSkills, selectedRole)
      setAnalysis(gapResult)
    } catch (err: any) {
      console.error('Resume upload/parsing error:', err)
      setUploadError(err.message || 'Failed to parse resume. Please ensure the backend is running.')
    } finally {
      setUploading(false)
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role)
    setCustomRoleInput('')
  }

  const handleCustomRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customRoleInput.trim()) {
      setSelectedRole(customRoleInput.trim())
    }
  }

  const handleGoToCareerGrowth = () => {
    if (analysis?.missingSkills) {
      try {
        window.localStorage.setItem(
          'careerlens.skillgaps',
          JSON.stringify({
            targetRole: analysis.targetRole,
            missingSkills: analysis.missingSkills,
            updatedAt: new Date().toISOString(),
          })
        )
      } catch (e) {
        console.error('LocalStorage write error:', e)
      }
    }
    navigate('/career-growth')
  }

  const getPriorityBadgeVariant = (priority: string): 'destructive' | 'warning' | 'primary' => {
    const p = (priority || '').toLowerCase()
    if (p === 'high') return 'destructive'
    if (p === 'medium') return 'warning'
    return 'primary'
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Skill Gap Analysis"
        description="Upload your resume and evaluate your skills against target roles to uncover missing requirements and prioritize your upskilling path."
        icon={Gauge}
        badge={
          <Badge variant="primary" dot>
            Resume Driven
          </Badge>
        }
      />

      {/* Resume Upload Card Section */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <FileText className="size-5 text-brand-600 dark:text-brand-400" />
                Your Resume Context
              </CardTitle>
              <CardDescription>
                Upload your PDF resume to extract skills automatically for instant gap evaluation.
              </CardDescription>
            </div>
            {storedResume && !showUploadForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadForm(true)}
              >
                <FileUp className="mr-1.5 size-3.5" /> Replace Resume
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {storedResume && !showUploadForm ? (
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{storedResume.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded: {new Date(storedResume.uploadedAt).toLocaleDateString()} • {storedResume.parsedDetails?.skills?.length || 0} skills detected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success" className="text-xs">
                  Active Resume
                </Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                    : 'border-border bg-secondary/30 hover:border-brand-300 hover:bg-secondary/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploading ? (
                  <div className="space-y-2 text-center">
                    <LoaderCircle className="mx-auto size-8 animate-spin text-brand-600 dark:text-brand-400" />
                    <p className="text-sm font-semibold text-foreground">Parsing Resume & Extracting Skills...</p>
                    <p className="text-xs text-muted-foreground">Please wait a few seconds while our backend analyzes your document.</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                      <UploadCloud className="size-6" />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      Click to upload resume PDF <span className="font-normal text-muted-foreground">or drag and drop</span>
                    </p>
                    <p className="text-xs text-muted-foreground">PDF files up to 5MB are supported</p>
                  </div>
                )}
              </div>

              {uploadError && (
                <p className="text-xs font-semibold text-destructive">{uploadError}</p>
              )}

              {storedResume && showUploadForm && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowUploadForm(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Role Selector Card */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Target className="size-5 text-brand-600 dark:text-brand-400" />
            Select Target Career Role
          </CardTitle>
          <CardDescription>
            Choose a role below or enter a custom job title to analyze required vs existing skills.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESET_ROLES.map((role) => {
              const isActive = selectedRole.toLowerCase() === role.toLowerCase()
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {role}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleCustomRoleSubmit} className="flex gap-2 sm:max-w-md">
            <Input
              type="text"
              placeholder="Or enter custom role (e.g., Cloud Architect)..."
              value={customRoleInput}
              onChange={(e) => setCustomRoleInput(e.target.value)}
              className="text-xs sm:text-sm"
            />
            <Button type="submit" variant="secondary" size="sm">
              Analyze Role
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6">
          <Card>
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-5 w-2/3 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-4/5" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <Card className="border-destructive/30 bg-destructive/10 p-5 text-destructive">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={() => runAnalysis(selectedRole)}>
              <RefreshCw className="mr-1.5 size-3.5" /> Retry Analysis
            </Button>
          </div>
        </Card>
      )}

      {/* Main Analysis Results */}
      {!loading && !error && analysis && (
        <div className="space-y-8">
          <Card className="overflow-hidden border-border bg-gradient-to-br from-card to-secondary/30 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" className="text-xs font-semibold">
                      Target Role
                    </Badge>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      {analysis.targetRole}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{analysis.summary}</p>
                </div>

                <div className="flex shrink-0 items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-brand-600 dark:text-brand-400">
                      {analysis.readinessScore}%
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Role Readiness
                    </div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> {analysis.matchingSkills?.length || 0} Skills Matched
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="size-3.5" /> {analysis.missingSkills?.length || 0} Skill Gaps
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5 text-foreground">
                  <span>Match Readiness Progress</span>
                  <span>{analysis.readinessScore}% Match</span>
                </div>
                <Progress value={analysis.readinessScore} className="h-2.5" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Skills You Already Have ({analysis.matchingSkills?.length || 0})
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.matchingSkills?.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {skill}
                </span>
              ))}
              {(!analysis.matchingSkills || analysis.matchingSkills.length === 0) && (
                <p className="text-xs text-muted-foreground">No explicit matching skills found for this role target.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
                  Priority Skill Gaps ({analysis.missingSkills?.length || 0})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Skills required for {analysis.targetRole} that are missing or require upskilling.
                </p>
              </div>
              <Button onClick={handleGoToCareerGrowth} size="sm" className="w-fit">
                <BookOpen className="mr-1.5 size-3.5" /> View Recommended Courses
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analysis.missingSkills?.map((gap: SkillGapItem) => (
                <Card key={gap.name} className="flex flex-col justify-between border-border transition-all hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold text-foreground">
                        {gap.name}
                      </CardTitle>
                      <Badge variant={getPriorityBadgeVariant(gap.priority)} className="shrink-0 text-[10px] font-bold">
                        {gap.priority} Priority
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="capitalize rounded bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                        {gap.category || 'Technical'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {gap.description}
                    </p>
                    <div className="rounded-md border border-border bg-secondary/40 p-2.5 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Level:</span>
                        <span className="font-semibold text-foreground">{gap.currentProficiency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Required Level:</span>
                        <span className="font-semibold text-brand-600 dark:text-brand-400">{gap.requiredProficiency}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="border-brand-200 bg-gradient-to-r from-brand-50 to-brand-100/50 p-6 dark:border-brand-900/50 dark:from-brand-950/40 dark:to-brand-900/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h4 className="flex items-center gap-2 text-base font-bold text-brand-950 dark:text-brand-100">
                  <TrendingUp className="size-5 text-brand-600 dark:text-brand-400" />
                  Ready to close these skill gaps?
                </h4>
                <p className="text-xs text-brand-800 dark:text-brand-300">
                  Explore curated upskilling courses from Udemy, Coursera, freeCodeCamp, and YouTube with direct links and milestone roadmaps.
                </p>
              </div>
              <Button size="md" onClick={handleGoToCareerGrowth} className="shrink-0 shadow-md">
                <BookOpen className="mr-2 size-4" /> Start Learning Roadmap
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}