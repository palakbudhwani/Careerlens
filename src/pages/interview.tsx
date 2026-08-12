import { useEffect, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  LoaderCircle,
  Filter,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'

interface Question {
  id: string
  role: string
  category: 'technical' | 'behavioral' | 'system-design'
  difficulty: 'junior' | 'mid' | 'senior'
  question: string
  context: string
  keyPoints: string[]
  sampleAnswer: string
}

export default function InterviewPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')
  const [evaluationResult, setEvaluationResult] = useState<any>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const q = categoryFilter !== 'all' ? `?category=${categoryFilter}` : ''
      const data = await apiClient<Question[]>(`/interview/questions${q}`)
      setQuestions(data)
      if (data.length > 0 && !selectedQuestion) {
        setSelectedQuestion(data[0])
      }
    } catch {
      const fallbackQs: Question[] = [
        {
          id: 'iq-001',
          role: 'Senior Frontend Engineer',
          category: 'technical',
          difficulty: 'senior',
          question: 'How do you optimize render performance and prevent unnecessary re-renders in a complex React application with high-frequency live state updates?',
          context: 'Focus on state colocation, selector patterns, virtualized lists, and memoization placement strategy.',
          keyPoints: [
            'State colocation (pushing state down to child components)',
            'React.memo, useMemo, and useCallback placement strategy',
            'Using Zustand/Jotai or selector hooks instead of giant monolithic context',
            'Virtualization for rendering thousands of items',
          ],
          sampleAnswer:
            'To optimize React render performance under high-frequency updates, I isolate state closest to where it is consumed to minimize component subtree invalidation. I employ selector-based state managers to ensure components only re-render on precise slice updates.',
        },
      ]
      setQuestions(fallbackQs)
      setSelectedQuestion(fallbackQs[0])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [categoryFilter])

  const handleEvaluate = async () => {
    if (!selectedQuestion || !userAnswer.trim()) return
    setEvaluating(true)
    try {
      const result = await apiClient('/interview/evaluate', {
        method: 'POST',
        body: JSON.stringify({ questionId: selectedQuestion.id, userAnswer }),
      })
      setEvaluationResult(result)
    } catch (err) {
      console.error('Failed to evaluate answer:', err)
    } finally {
      setEvaluating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 text-left">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Interview Question & Practice AI</h1>
          <p className="text-sm text-muted-foreground">
            Practice real technical & behavioral questions with instant AI scoring and feedback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="size-3 text-purple-400" /> {questions.length} questions available
          </Badge>
        </div>
      </div>

      <Card className="p-3 bg-card/60 backdrop-blur-md border-border/60">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Filter className="size-3.5 text-muted-foreground ml-2" />
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              categoryFilter === 'all' ? 'bg-brand-600 text-white shadow font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Questions
          </button>
          <button
            onClick={() => setCategoryFilter('technical')}
            className={`px-3 py-1.5 rounded-lg transition ${
              categoryFilter === 'technical' ? 'bg-brand-600 text-white shadow font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Technical
          </button>
          <button
            onClick={() => setCategoryFilter('system-design')}
            className={`px-3 py-1.5 rounded-lg transition ${
              categoryFilter === 'system-design' ? 'bg-brand-600 text-white shadow font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            System Design
          </button>
          <button
            onClick={() => setCategoryFilter('behavioral')}
            className={`px-3 py-1.5 rounded-lg transition ${
              categoryFilter === 'behavioral' ? 'bg-brand-600 text-white shadow font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Behavioral
          </button>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Select Question</h3>
          {questions.map((q) => (
            <div
              key={q.id}
              onClick={() => {
                setSelectedQuestion(q)
                setEvaluationResult(null)
                setUserAnswer('')
              }}
              className={`cursor-pointer rounded-xl border p-4 transition text-left space-y-2 ${
                selectedQuestion?.id === q.id
                  ? 'border-brand-500 bg-brand-500/10 shadow-md'
                  : 'border-border/60 bg-card/60 hover:border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                  {q.category}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {q.difficulty}
                </Badge>
              </div>
              <p className="text-xs font-bold text-foreground line-clamp-2">{q.question}</p>
            </div>
          ))}
        </div>

        <div className="md:col-span-2 space-y-6">
          {selectedQuestion && (
            <Card className="p-6 space-y-5 border-border/60 bg-card/90">
              <div className="space-y-2 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" className="text-xs">
                    {selectedQuestion.role}
                  </Badge>
                  <Badge variant="outline" className="text-xs uppercase">
                    {selectedQuestion.category}
                  </Badge>
                </div>
                <h2 className="text-lg font-bold text-foreground font-display">{selectedQuestion.question}</h2>
                <p className="text-xs text-muted-foreground">{selectedQuestion.context}</p>
              </div>

              <div className="space-y-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-xs">
                <h4 className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="size-4 text-purple-400" /> Expected Key Evaluation Criteria
                </h4>
                <ul className="grid gap-1.5 sm:grid-cols-2 text-muted-foreground pt-1">
                  {selectedQuestion.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="mt-1 size-1.5 rounded-full bg-purple-400 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Your Practice Answer:</label>
                <textarea
                  rows={6}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your response here using STAR method or architectural principles..."
                  className="w-full rounded-xl border border-border bg-slate-900/60 p-3.5 text-xs focus:border-brand-500 focus:outline-none leading-relaxed text-foreground"
                />
              </div>

              <div className="flex items-center justify-end">
                <Button
                  onClick={handleEvaluate}
                  disabled={evaluating || !userAnswer.trim()}
                  className="bg-brand-600 hover:bg-brand-500 text-xs font-semibold gap-1.5"
                >
                  {evaluating ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" /> AI Evaluating...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" /> Evaluate Answer
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {evaluationResult && (
            <Card className="p-6 space-y-4 border-brand-500/40 bg-slate-950 text-foreground shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400 font-display text-xl font-bold border border-brand-500/30">
                    {evaluationResult.score}%
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">AI Evaluation Grade</span>
                    <h3 className="text-lg font-bold text-white">{evaluationResult.grade}</h3>
                  </div>
                </div>
                <Badge variant={evaluationResult.score >= 80 ? 'success' : 'warning'} className="text-xs font-bold px-3 py-1">
                  {evaluationResult.score}/100 Rating
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{evaluationResult.feedback}</p>

              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs">
                  <h4 className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> Covered Key Points
                  </h4>
                  <ul className="space-y-1 text-muted-foreground">
                    {evaluationResult.matchedPoints?.map((p: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="mt-1 size-1 rounded-full bg-emerald-400 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs">
                  <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="size-4" /> Recommended Additions
                  </h4>
                  <ul className="space-y-1 text-muted-foreground">
                    {evaluationResult.missedPoints?.map((p: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="mt-1 size-1 rounded-full bg-amber-400 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {evaluationResult.sampleAnswer && (
                <div className="rounded-xl border border-border/40 bg-slate-900/80 p-4 text-xs space-y-1.5">
                  <h4 className="font-bold text-brand-400 flex items-center gap-1.5">
                    <BookOpen className="size-4" /> Benchmark Optimal Answer
                  </h4>
                  <p className="text-muted-foreground leading-relaxed italic">{evaluationResult.sampleAnswer}</p>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
