import { useState, useRef, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Upload, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  BrainCircuit, 
  History, 
  BarChart3, 
  Send,
  ScanSearch,
  FileCheck,
  Briefcase,
  ArrowRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { apiService } from '@/lib/api-service'
import type { MatchAnalysisResponse, InterviewQuestion, AnswerEvaluationResponse } from '@/lib/api-service'
import { mockStore } from '@/lib/mock-store'
import { useStoredResume, writeStoredResume } from '@/lib/resume-store'

export type InterviewDifficulty = 'Junior' | 'Mid' | 'Senior' | 'Lead'

export interface InterviewSessionItem {
  id: number
  resume_name: string
  question_count: number
  answer_count: number
}

export default function MatchPage() {
  const { jobId } = useParams<{ jobId?: string }>()
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const storedResume = useStoredResume()
  
  // Available mock jobs for mapping
  const availableJobs = useMemo(() => mockStore.getJobs(), [])
  
  // Job selection states
  const [selectedJobId, setSelectedJobId] = useState<string>(availableJobs[0]?.id || '')
  const [customJobDescription, setCustomJobDescription] = useState<string>('')
  const [useCustomJob, setUseCustomJob] = useState<boolean>(false)
  
  // Real dynamic states
  const [analysis, setAnalysis] = useState<MatchAnalysisResponse | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [resumeName, setResumeName] = useState('')
  const [resumeQuestions, setResumeQuestions] = useState<InterviewQuestion[]>([])
  const [roleQuestions, setRoleQuestions] = useState<InterviewQuestion[]>([])
  const [questionTab, setQuestionTab] = useState<'resume' | 'role'>('resume')
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [evaluation, setEvaluation] = useState<AnswerEvaluationResponse | null>(null)
  const [history, setHistory] = useState<InterviewSessionItem[]>([])
  
  const [difficulty, setDifficulty] = useState<string>('Mid')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill job ID if passed in route parameters
  useEffect(() => {
    if (jobId) {
      const exists = availableJobs.some(j => j.id === jobId)
      if (exists) {
        setSelectedJobId(jobId)
        setUseCustomJob(false)
      }
    }
  }, [jobId, availableJobs])

  const activeJob = useMemo(() => {
    if (useCustomJob) return null
    return availableJobs.find(j => j.id === selectedJobId) || null
  }, [useCustomJob, selectedJobId, availableJobs])

  const activeJobDescription = useMemo(() => {
    if (useCustomJob) {
      return customJobDescription
    }
    if (!activeJob) return ''
    return `${activeJob.title} at ${activeJob.company}\n\nJob Description:\n${activeJob.description}\n\nRequirements:\n${activeJob.requirements.join('\n')}\n\nPreferred:\n${activeJob.preferred.join('\n')}`
  }, [useCustomJob, customJobDescription, activeJob])

  const isResumeFake = storedResume?.parsedDetails?.isAuthentic === false || analysis?.isAuthentic === false
  const validationErrors = analysis?.validationErrors || storedResume?.parsedDetails?.validationErrors || []

  // Upload PDF, Parse & Perform ATS Match
  const processUploadedResume = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Please upload a valid PDF resume.')
      return
    }

    if (useCustomJob && customJobDescription.trim().split(/\s+/).filter(Boolean).length < 50) {
      setError('The custom job description must be at least 50 words long to perform accurate ATS matching.')
      return
    }

    setLoading(true)
    setError(null)
    setEvaluation(null)
    setAnalysis(null)
    setResumeQuestions([])
    setRoleQuestions([])
    setSelectedQuestion(null)

    try {
      // 1. Call Resume Parser Endpoint
      const parseResult = await apiService.parseResume(file)
      const extractedText = parseResult.resumeText
      setResumeText(extractedText)
      setResumeName(file.name)

      // Store in global resume-store so other pages (Skill Gaps, Dashboard) get it reactively
      writeStoredResume({
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        parsedDetails: parseResult.parsedDetails,
        resumeText: extractedText
      })

      // 2. Call ATS Match Analysis Endpoint
      const analysisResult = await apiService.analyzeMatch(
        extractedText,
        activeJobDescription,
        'candidate-001',
        activeJob?.id || 'custom-job'
      )
      setAnalysis(analysisResult)

      // Add to session history
      const sessionId = Date.now()
      setHistory(prev => [
        {
          id: sessionId,
          resume_name: file.name,
          question_count: 0,
          answer_count: 0
        },
        ...prev
      ])

      // 3. Generate tailored interview questions
      await generateRealQuestions(extractedText, activeJobDescription, difficulty)

    } catch (err: any) {
      setError(err.message || 'Failed to complete resume analysis. Make sure the backend server is running.')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Auto-run analysis when storedResume loads or when selected job targets change
  useEffect(() => {
    if (storedResume && storedResume.resumeText && activeJobDescription) {
      const isNewResume = storedResume.resumeText !== resumeText
      const noAnalysisYet = !analysis
      
      if (isNewResume || noAnalysisYet) {
        setResumeText(storedResume.resumeText)
        setResumeName(storedResume.fileName)
        
        const runSavedMatch = async () => {
          setLoading(true)
          setError(null)
          setAnalysis(null)
          setResumeQuestions([])
          setRoleQuestions([])
          setSelectedQuestion(null)
          try {
            const analysisResult = await apiService.analyzeMatch(
              storedResume.resumeText,
              activeJobDescription,
              'candidate-001',
              activeJob?.id || 'custom-job'
            )
            setAnalysis(analysisResult)
            await generateRealQuestions(storedResume.resumeText, activeJobDescription, difficulty)
          } catch (err: any) {
            setError(err.message || 'Failed to complete resume analysis.')
          } finally {
            setLoading(false)
          }
        }
        runSavedMatch()
      }
    }
  }, [storedResume, selectedJobId, useCustomJob])

  // Generates real interview questions based on parsed user data and selected difficulty
  const generateRealQuestions = async (text: string, jobDesc: string, diff: string) => {
    setGenerating(true)
    setEvaluation(null)
    setAnswer('')
    
    try {
      const result = await apiService.generateQuestions(text, jobDesc, diff, 5)
      setResumeQuestions(result.resumeBasedQuestions || [])
      setRoleQuestions(result.roleBasedQuestions || [])
      
      const defaultQ = (result.resumeBasedQuestions && result.resumeBasedQuestions[0]) || 
                       (result.roleBasedQuestions && result.roleBasedQuestions[0]) || null;
      setSelectedQuestion(defaultQ)
      setQuestionTab('resume')

      // Update history count
      const totalQuestionsCount = (result.resumeBasedQuestions?.length || 0) + (result.roleBasedQuestions?.length || 0)
      setHistory(prev =>
        prev.map(item =>
          item.resume_name === resumeName
            ? { ...item, question_count: totalQuestionsCount }
            : item
        )
      )
    } catch (err: any) {
      setError(err.message || 'Failed to generate tailored interview questions.')
    } finally {
      setGenerating(false)
    }
  }

  // Triggers question regeneration on difficulty or job description shifts
  const triggerRegenerateQuestions = async (newDiff: string) => {
    if (!resumeText) return
    setDifficulty(newDiff)
    await generateRealQuestions(resumeText, activeJobDescription, newDiff)
  }

  // Submit Answer to LLM Evaluator
  const evaluateAnswer = async () => {
    if (!selectedQuestion || !answer.trim()) return
    setEvaluating(true)
    setError(null)

    try {
      const evalResult = await apiService.evaluateAnswer(
        selectedQuestion.question,
        answer
      )
      setEvaluation(evalResult)

      const markAnswered = (list: InterviewQuestion[]) => 
        list.map((q) => (q.id === selectedQuestion.id ? { ...q, answered: true } : q))

      setResumeQuestions(prev => markAnswered(prev))
      setRoleQuestions(prev => markAnswered(prev))
      setSelectedQuestion(prev => prev ? { ...prev, answered: true } : null)

      setHistory(prev =>
        prev.map(item =>
          item.resume_name === resumeName
            ? { ...item, answer_count: item.answer_count + 1 }
            : item
        )
      )
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate answer.')
    } finally {
      setEvaluating(false)
    }
  }

  const strengths = useMemo(() => analysis?.matchingSkills || [], [analysis])
  const weaknesses = useMemo(() => analysis?.missingSkills || [], [analysis])
  const activeQuestions = useMemo(() => {
    return questionTab === 'resume' ? resumeQuestions : roleQuestions
  }, [questionTab, resumeQuestions, roleQuestions])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline">Match Analysis</Badge>
            <Badge variant={analysis ? "success" : "neutral"} dot>
              {analysis ? "Resume Analyzed" : "Awaiting Upload"}
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Match Analysis & Interview Prep
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your resume to parse skills, compute real ATS readiness, and practice customized interview questions.
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && processUploadedResume(e.target.files[0])}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            leftIcon={<Upload className="size-4" aria-hidden />}
          >
            {loading ? 'Analyzing PDF...' : 'Upload Resume'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Target Job Selection Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="size-5 text-brand-600" />
            1. Select Target Job Posting
          </CardTitle>
          <CardDescription>
            Choose a mock job listing from the platform or input a custom job description to analyze your resume against.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={!useCustomJob ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setUseCustomJob(false)}
            >
              Choose Existing Job
            </Button>
            <Button
              variant={useCustomJob ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setUseCustomJob(true)}
            >
              Enter Custom Job
            </Button>
          </div>

          {!useCustomJob ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Job Posting</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full rounded-xl border bg-background p-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-brand-500"
              >
                {availableJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} · {job.company} ({job.location})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job Description (Minimum 50 words)</label>
              <textarea
                value={customJobDescription}
                onChange={(e) => setCustomJobDescription(e.target.value)}
                placeholder="Paste the full job posting details here (responsibilities, requirements, tools required)..."
                rows={5}
                className="w-full rounded-xl border bg-background p-3 text-xs text-foreground outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {isResumeFake && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-950/30 dark:bg-red-950/20 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
              <AlertCircle className="size-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-950 dark:text-red-200">
                Resume Verification Warning
              </h3>
              <p className="mt-1 text-xs text-red-800 dark:text-red-300 leading-relaxed">
                Our AI validator has detected formatting anomalies or potential authenticity issues in this document. Please verify that this is a valid, authentic resume document.
              </p>
            </div>
          </div>
          {validationErrors.length > 0 && (
            <div className="pl-13 text-xs space-y-1.5 text-red-800 dark:text-red-300">
              <p className="font-semibold uppercase tracking-wider text-[10px]">Detected Inconsistencies:</p>
              <div className="flex flex-wrap gap-1.5">
                {validationErrors.map((err, idx) => (
                  <span key={idx} className="font-mono bg-red-100/60 dark:bg-red-950/40 px-2.5 py-1 rounded text-red-900 dark:text-red-300">
                    • {err}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resume Analysis Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanSearch className="size-5 text-brand-600" />
              Resume & ATS Breakdown
            </CardTitle>
            <CardDescription>
              Parsed PDF information, skills, and ATS compatibility metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">File Analyzed</p>
                    <p className="mt-1 font-semibold text-foreground truncate">{resumeName}</p>
                    <p className="mt-0.5 text-xs text-emerald-600 flex items-center gap-1">
                      <FileCheck className="size-3" /> Successfully Parsed
                    </p>
                  </div>
                  <div className="rounded-xl border bg-brand-50/50 dark:bg-brand-950/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-brand-600">Skills Match Score</p>
                    <p className="mt-1 font-display text-2xl font-bold text-brand-600">{analysis.breakdown.skillsMatchScore}%</p>
                    <Progress value={analysis.breakdown.skillsMatchScore} className="mt-2 h-1.5" />
                  </div>
                  <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                    <div className="flex-1">
                      <p className={`text-xs font-medium uppercase tracking-wider ${isResumeFake ? 'text-red-600' : 'text-emerald-600'}`}>ATS Match Score</p>
                      <p className={`mt-1 font-display text-2xl font-bold ${isResumeFake ? 'text-red-600' : 'text-emerald-600'}`}>{isResumeFake ? 'Blocked' : `${analysis.atsScore}%`}</p>
                      <Progress value={isResumeFake ? 0 : analysis.atsScore} className={`mt-2 h-1.5 ${isResumeFake ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950/20' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Weighted Sub-metrics Breakdown */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detailed Score Attribution</p>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <div className={`rounded-xl border p-3.5 ${isResumeFake ? 'bg-red-50/20 dark:bg-red-950/5 border-red-200/50' : 'bg-brand-50/30 dark:bg-brand-950/10'}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-wider ${isResumeFake ? 'text-red-500' : 'text-brand-600'}`}>Skills (40%)</p>
                      <p className={`mt-1 font-display text-lg font-bold ${isResumeFake ? 'text-red-500' : 'text-brand-600'}`}>{isResumeFake ? '0%' : `${analysis.breakdown.skillsMatchScore}%`}</p>
                      <Progress value={isResumeFake ? 0 : analysis.breakdown.skillsMatchScore} className={`mt-1.5 h-1 ${isResumeFake ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950/20' : ''}`} />
                    </div>
                    <div className={`rounded-xl border p-3.5 ${isResumeFake ? 'bg-red-50/20 dark:bg-red-950/5 border-red-200/50' : 'bg-indigo-50/30 dark:bg-indigo-950/10'}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-wider ${isResumeFake ? 'text-red-500' : 'text-indigo-600'}`}>Experience (30%)</p>
                      <p className={`mt-1 font-display text-lg font-bold ${isResumeFake ? 'text-red-500' : 'text-indigo-600'}`}>{isResumeFake ? '0%' : `${analysis.breakdown.experienceScore}%`}</p>
                      <Progress value={isResumeFake ? 0 : analysis.breakdown.experienceScore} className={`mt-1.5 h-1 ${isResumeFake ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950/20' : ''}`} />
                    </div>
                    <div className={`rounded-xl border p-3.5 ${isResumeFake ? 'bg-red-50/20 dark:bg-red-950/5 border-red-200/50' : 'bg-amber-50/30 dark:bg-amber-950/10'}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-wider ${isResumeFake ? 'text-red-500' : 'text-amber-600'}`}>Education (10%)</p>
                      <p className={`mt-1 font-display text-lg font-bold ${isResumeFake ? 'text-red-500' : 'text-amber-600'}`}>{isResumeFake ? '0%' : `${analysis.breakdown.educationScore}%`}</p>
                      <Progress value={isResumeFake ? 0 : analysis.breakdown.educationScore} className={`mt-1.5 h-1 ${isResumeFake ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950/20' : ''}`} />
                    </div>
                    <div className={`rounded-xl border p-3.5 ${isResumeFake ? 'bg-red-50/20 dark:bg-red-950/5 border-red-200/50' : 'bg-teal-50/30 dark:bg-teal-950/10'}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-wider ${isResumeFake ? 'text-red-500' : 'text-teal-600'}`}>Keyword (20%)</p>
                      <p className={`mt-1 font-display text-lg font-bold ${isResumeFake ? 'text-red-500' : 'text-teal-600'}`}>{isResumeFake ? '0%' : `${analysis.breakdown.keywordDensityScore}%`}</p>
                      <Progress value={isResumeFake ? 0 : analysis.breakdown.keywordDensityScore} className={`mt-1.5 h-1 ${isResumeFake ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950/20' : ''}`} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Analysis Summary</p>
                  <p className="text-xs leading-relaxed text-muted-foreground bg-muted/20 p-3.5 rounded-xl border">{analysis.summary}</p>
                </div>

                {/* Identified Gaps list */}
                {analysis.gaps && analysis.gaps.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actionable Skill & Experience Gaps</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {analysis.gaps.map((gap, idx) => (
                        <div key={idx} className="rounded-xl border p-4 bg-muted/10 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{gap.category}</span>
                            <Badge variant={gap.impact === 'High' ? 'destructive' : gap.impact === 'Medium' ? 'warning' : 'outline'} className="text-[10px] py-0 px-1.5">
                              {gap.impact} Impact
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-foreground">{gap.description}</p>
                          <p className="text-[11px] text-muted-foreground border-t pt-1.5 mt-1.5">
                            <strong>Recommendation:</strong> {gap.recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keyword density check and formatting notes */}
                <div className="grid gap-4 md:grid-cols-2 border-t pt-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formatting & Style Audit</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                      {analysis.atsFeedback.formattingNotes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                    <div className="mt-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-950/50">
                      <strong>Action Verbs Audit:</strong> {analysis.atsFeedback.actionVerbsCheck}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Keyword Frequency</p>
                    <div className="overflow-hidden rounded-xl border bg-card">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-2 pl-3">Keyword</th>
                            <th className="p-2 text-center">Count</th>
                            <th className="p-2 pr-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.atsFeedback.keywordFrequency.map((freq, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2 pl-3 font-medium text-foreground">{freq.keyword}</td>
                              <td className="p-2 text-center text-muted-foreground">{freq.count}</td>
                              <td className="p-2 pr-3 text-right">
                                <Badge variant={freq.status === 'Optimal' ? 'success' : freq.status === 'Missing' ? 'destructive' : 'warning'} className="text-[10px] py-0">
                                  {freq.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center bg-muted/20">
                <FileText className="mb-2 size-10 text-muted-foreground/60" />
                <p className="text-sm font-semibold text-foreground">No Resume Analyzed Yet</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  Upload your PDF resume to parse real skills, leadership, and project details for an instant ATS score.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  leftIcon={<Upload className="size-3.5" />}
                >
                  Upload Resume PDF
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Readiness Score Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-brand-600" />
              Readiness Score
            </CardTitle>
            <CardDescription>Real-time interview readiness rating</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className={`font-display text-5xl font-extrabold ${isResumeFake ? 'text-red-500 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
                    {isResumeFake ? 0 : (analysis ? analysis.atsScore : 0)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">/ 100</span>
                </div>
                {isResumeFake && (
                  <div className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider bg-red-100/50 dark:bg-red-950/30 px-2.5 py-1 rounded w-fit">
                    Score Blocked: Verification Failed
                  </div>
                )}
                <Progress 
                  value={isResumeFake ? 0 : (analysis ? analysis.atsScore : 0)} 
                  className={`mt-3 h-2 ${isResumeFake ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950/20' : ''}`} 
                />
              </div>

              {analysis && (
                <div className="p-3 bg-muted/20 border rounded-xl text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">ATS MATCH ID</p>
                  <code className="text-indigo-600 dark:text-indigo-400 font-mono text-[10px] break-all">{analysis.matchId}</code>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t pt-4 text-xs mt-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Total Sessions:</span>
                <span className="font-semibold text-foreground">{history.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Skills Matches:</span>
                <span className="font-semibold text-foreground">{analysis?.matchingSkills.length || 0}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Gaps Identified:</span>
                <span className="font-semibold text-foreground">{analysis?.gaps.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Gap Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matching Skills & Strengths</CardTitle>
            <CardDescription>Target job skills matching your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <BadgeGroup title="" items={strengths} variant="success" />
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base">Missing Skills & Gaps</CardTitle>
            <CardDescription>Required keywords missing from resume</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BadgeGroup title="" items={weaknesses} variant="destructive" />
            {analysis && (
              <div className="pt-4 border-t flex justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => navigate('/skill-gaps')}
                  className="text-xs flex items-center gap-1.5"
                >
                  Analyze Skill Gaps Detail
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Interview Questions */}
      <Card>
        <CardHeader className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="size-5 text-brand-600" />
              Tailored Interview Questions
            </CardTitle>
            <CardDescription>
              {analysis 
                ? `Questions generated directly from ${resumeName}` 
                : 'Upload a resume to generate custom questions'}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={difficulty}
              onChange={(e) => {
                const diff = e.target.value
                setDifficulty(diff)
                if (resumeText) triggerRegenerateQuestions(diff)
              }}
              disabled={!analysis || generating}
              className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            >
              <option value="Junior">Junior</option>
              <option value="Mid">Mid</option>
              <option value="Senior">Senior</option>
              <option value="Lead">Lead</option>
            </select>

            <Button
              size="sm"
              onClick={() => triggerRegenerateQuestions(difficulty)}
              disabled={generating || !resumeText}
              leftIcon={<Sparkles className="size-3.5" aria-hidden />}
            >
              {generating ? 'Generating...' : 'Regenerate Questions'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {(resumeQuestions.length > 0 || roleQuestions.length > 0) && (
            <div className="mb-5 flex border-b border-border">
              <button
                onClick={() => {
                  setQuestionTab('resume')
                  setEvaluation(null)
                  setAnswer('')
                  setSelectedQuestion(resumeQuestions[0] || null)
                }}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  questionTab === 'resume'
                    ? 'border-brand-600 text-brand-600 font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Resume-Based Questions ({resumeQuestions.length})
              </button>
              <button
                onClick={() => {
                  setQuestionTab('role')
                  setEvaluation(null)
                  setAnswer('')
                  setSelectedQuestion(roleQuestions[0] || null)
                }}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  questionTab === 'role'
                    ? 'border-brand-600 text-brand-600 font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Role-Based Questions ({roleQuestions.length})
              </button>
            </div>
          )}

          {activeQuestions.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Prompts</p>
                {activeQuestions.map((q) => {
                  const isSelected = selectedQuestion?.id === q.id
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setSelectedQuestion(q)
                        setEvaluation(null)
                        setAnswer('')
                      }}
                      className={`w-full rounded-xl border p-3.5 text-left text-xs leading-relaxed transition ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-foreground font-medium shadow-sm'
                          : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <p className="text-foreground">{q.question}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="py-0 text-[10px]">{q.type}</Badge>
                        <span>•</span>
                        <span>{difficulty}</span>
                        {q.answered && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-medium text-emerald-600">
                              <CheckCircle2 className="size-3" /> Answered
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-col justify-between space-y-4 rounded-xl border bg-muted/30 p-5">
                {selectedQuestion ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">Active Question</span>
                        <span className="text-[10px] text-muted-foreground">{selectedQuestion.type}</span>
                      </div>
                      <h3 className="mt-1 text-xs font-semibold text-foreground leading-relaxed">{selectedQuestion.question}</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground italic"><strong>Context:</strong> {selectedQuestion.context}</p>
                    </div>

                    {selectedQuestion.sampleAnswerOutline && selectedQuestion.sampleAnswerOutline.length > 0 && (
                      <div className="space-y-2 border-t pt-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sample Answer Outline</span>
                        <ul className="list-decimal pl-4 text-[11px] text-muted-foreground space-y-0.5">
                          {selectedQuestion.sampleAnswerOutline.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        rows={5}
                        placeholder="Write your answer here..."
                        className="w-full rounded-xl border bg-background p-3 text-xs text-foreground outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                      />
                      <Button
                        className="mt-3 w-full"
                        onClick={evaluateAnswer}
                        disabled={evaluating || !answer.trim()}
                        leftIcon={<Send className="size-3.5" aria-hidden />}
                      >
                        {evaluating ? 'Evaluating with LLM...' : 'Submit & Evaluate Answer'}
                      </Button>
                    </div>

                    {evaluation && (
                      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">AI Evaluation Feedback</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{evaluation.score}/100</span>
                        </div>
                        <p className="text-foreground leading-relaxed">{evaluation.feedback}</p>
                        {evaluation.suggested_improvement && (
                          <p className="pt-2 border-t border-emerald-200/60 text-emerald-800 dark:text-emerald-300">
                            <strong>Suggested Improvement:</strong> {evaluation.suggested_improvement}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <BrainCircuit className="mb-2 size-8 opacity-40" />
                    <p className="text-xs font-medium">Select a question on the left to start practicing.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Upload a resume PDF above to automatically generate interview questions tailored to your experience.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-5 text-muted-foreground" />
            Session History
          </CardTitle>
          <CardDescription>Previous uploaded resume sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {history.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-xl border bg-card p-3.5 text-left"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold text-foreground truncate">{session.resume_name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {session.question_count} Questions · {session.answer_count} Answered
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No resume sessions recorded yet. Upload a PDF to begin.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BadgeGroup({ title, items, variant }: { title: string; items: string[]; variant?: 'outline' | 'success' | 'warning' | 'destructive' }) {
  return (
    <div>
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <Badge key={idx} variant={variant || 'outline'} className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">None detected yet.</p>
      )}
    </div>
  )
}