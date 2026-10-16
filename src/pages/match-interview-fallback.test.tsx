import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apiService,
  type InterviewQuestion,
  type InterviewQuestionsResponse,
  type MatchAnalysisResponse,
  type ParsedDetails,
  type ResumeParseResponse,
} from '@/lib/api-service'
import MatchPage from '@/pages/match'
import { clearStoredResume } from '@/lib/resume-store'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function parsedDetails(): ParsedDetails {
  return {
    name: 'Test User',
    email: 'test@example.com',
    skills: ['React'],
    workExperience: [],
    education: [],
  }
}

function parseResponse(resumeText: string): ResumeParseResponse {
  return { resumeText, parsedDetails: parsedDetails() }
}

function pdfFile(fileName: string): File {
  return new File(['pdf-bytes'], fileName, { type: 'application/pdf' })
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null
  if (!input) throw new Error('file input not found')
  return input
}

function matchAnalysis(summary: string): MatchAnalysisResponse {
  return {
    matchId: `match-${summary}`,
    atsScore: 72,
    breakdown: {
      skillsMatchScore: 70,
      experienceScore: 80,
      educationScore: 75,
      keywordDensityScore: 65,
    },
    summary,
    matchingSkills: ['React'],
    missingSkills: ['Kubernetes'],
    gaps: [],
    atsFeedback: {
      formattingNotes: ['Clear structure.'],
      actionVerbsCheck: 'Good action verbs',
      keywordFrequency: [],
    },
    isAuthentic: true,
    validationErrors: [],
  }
}

function question(id: string, text: string): InterviewQuestion {
  return {
    id,
    type: 'Technical',
    question: text,
    context: 'Derived from your resume.',
    sampleAnswerOutline: ['Identify the goal', 'Describe your approach', 'Share the outcome'],
    evalCriteria: 'Mid level. Technical depth.',
  }
}

const bankQuestions: InterviewQuestionsResponse = {
  resumeBasedQuestions: [question('q-res-1', 'At ACME Corp, describe a trade-off you made.'), question('q-res-2', 'Walk through a React feature you shipped.')],
  roleBasedQuestions: [question('q-role-1', 'The job calls for Docker. What is your ramp-up plan?')],
  source: 'Rule-based fallback',
}

function renderMatch() {
  return render(
    <MemoryRouter initialEntries={['/match']}>
      <Routes>
        <Route path="/match" element={<MatchPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function trackMatch() {
  const runs: Array<Deferred<MatchAnalysisResponse>> = []
  const spy = vi.spyOn(apiService, 'analyzeMatch').mockImplementation(() => {
    const run = deferred<MatchAnalysisResponse>()
    runs.push(run)
    return run.promise
  })
  return { spy, runs }
}

function trackQuestions() {
  const runs: Array<Deferred<InterviewQuestionsResponse>> = []
  const spy = vi.spyOn(apiService, 'generateQuestions').mockImplementation(() => {
    const run = deferred<InterviewQuestionsResponse>()
    runs.push(run)
    return run.promise
  })
  return { spy, runs }
}

beforeEach(() => {
  window.localStorage.clear()
  clearStoredResume()
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('network is disabled in tests')))
  vi.spyOn(apiService, 'parseResume').mockImplementation(async (file: File) => parseResponse(`TEXT_${file.name}`))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function uploadResume(fileName = 'Resume A.pdf'): Promise<void> {
  fireEvent.change(fileInput(), { target: { files: [pdfFile(fileName)] } })
}

describe('Interview question fallback on the match page', () => {
  it('renders rule-based questions through the normal success path with no error UI', async () => {
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()
    await uploadResume()

    await waitFor(() => expect(match.runs).toHaveLength(1))
    await act(async () => {
      match.runs[0].resolve(matchAnalysis('MATCH_OK'))
    })
    await waitFor(() => expect(screen.getAllByText('MATCH_OK').length).toBeGreaterThan(0))

    // While the question request is pending the card shows a generating state.
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(1))
    expect(screen.getAllByText('Generating tailored interview questions...').length).toBeGreaterThan(0)

    await act(async () => {
      questions.runs[0].resolve(bankQuestions)
    })

    // Questions render through the ordinary success path.
    await waitFor(() =>
      expect(screen.getAllByText('At ACME Corp, describe a trade-off you made.').length).toBeGreaterThan(0),
    )
    expect(screen.getByText('Resume-Based Questions (2)')).toBeTruthy()
    expect(screen.getByText('Role-Based Questions (1)')).toBeTruthy()
    expect(screen.queryByTestId('questions-empty')).toBeNull()

    // The role tab carries the job-gap question.
    fireEvent.click(screen.getByText('Role-Based Questions (1)'))
    expect(screen.getAllByText('The job calls for Docker. What is your ramp-up plan?').length).toBeGreaterThan(0)

    // The source note explains the fallback honestly.
    const note = screen.getByTestId('result-source')
    expect(note.textContent).toContain('Rule-based fallback')
    expect(note.textContent).toMatch(/both AI providers were unavailable/i)
    expect(note.textContent).toMatch(/No AI was used/i)

    // Neither the global banner nor the card-level error note appears.
    expect(screen.queryByTestId('page-error')).toBeNull()
    expect(screen.queryByTestId('question-error')).toBeNull()
  })

  it('keeps question failures out of the global banner and offers a working inline Retry', async () => {
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()
    await uploadResume()

    await waitFor(() => expect(match.runs).toHaveLength(1))
    // First question attempt fails with raw provider noise.
    questions.spy.mockImplementationOnce(() => Promise.reject(new Error('AI_RATE_LIMITED: 429 RESOURCE_EXHAUSTED')))
    await act(async () => {
      match.runs[0].resolve(matchAnalysis('MATCH_OK'))
    })
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('question-error')).toBeTruthy())

    const note = screen.getByTestId('question-error')
    expect(note.textContent).toContain('We could not generate interview questions')
    expect(note.textContent).not.toContain('AI_RATE_LIMITED')
    expect(note.textContent).not.toContain('429')

    // The failure never reaches the global banner.
    expect(screen.queryByTestId('page-error')).toBeNull()

    // Retry issues a fresh request that succeeds.
    fireEvent.click(screen.getByTestId('question-error-retry'))
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(2))
    await act(async () => {
      questions.runs[0].resolve(bankQuestions)
    })
    await waitFor(() =>
      expect(screen.getAllByText('At ACME Corp, describe a trade-off you made.').length).toBeGreaterThan(0),
    )
    expect(screen.queryByTestId('question-error')).toBeNull()
    expect(screen.queryByTestId('page-error')).toBeNull()
  })

  it('shows the backend-reach message for network failures without raw text', async () => {
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()
    await uploadResume()

    await waitFor(() => expect(match.runs).toHaveLength(1))
    questions.spy.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
    await act(async () => {
      match.runs[0].resolve(matchAnalysis('MATCH_OK'))
    })
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(1))

    await waitFor(() => expect(screen.getByTestId('question-error')).toBeTruthy())
    const note = screen.getByTestId('question-error')
    expect(note.textContent).toContain('Could not reach the CareerLens backend at 127.0.0.1:5000')
    expect(note.textContent).toContain('npm run dev')
    expect(screen.queryByTestId('page-error')).toBeNull()
  })

  it('clears the previous job\'s questions when generation fails after a job switch', async () => {
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()
    await uploadResume()

    await waitFor(() => expect(match.runs).toHaveLength(1))
    await act(async () => {
      match.runs[0].resolve(matchAnalysis('MATCH_A'))
    })
    await waitFor(() => expect(questions.runs).toHaveLength(1))
    await act(async () => {
      questions.runs[0].resolve(bankQuestions)
    })
    await waitFor(() =>
      expect(screen.getAllByText('At ACME Corp, describe a trade-off you made.').length).toBeGreaterThan(0),
    )

    // Switch to a different curated job (the debounced effect re-runs both
    // requests against the new job description).
    const jobSelect = document.querySelector('select') as HTMLSelectElement | null
    expect(jobSelect).toBeTruthy()
    const options = Array.from(jobSelect!.options)
    expect(options.length).toBeGreaterThan(1)
    const otherValue = options.map((o) => o.value).find((v) => v !== jobSelect!.value)
    expect(otherValue).toBeTruthy()
    fireEvent.change(jobSelect!, { target: { value: otherValue } })

    // The new analysis resolves; the next question request will fail.
    await waitFor(() => expect(match.runs).toHaveLength(2), { timeout: 4000 })
    questions.spy.mockImplementationOnce(() => Promise.reject(new Error('AI_UPSTREAM_ERROR: model overloaded')))
    await act(async () => {
      match.runs[1].resolve(matchAnalysis('MATCH_B'))
    })
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(2))

    // Stale questions from the first job are gone; the card shows its own note.
    await waitFor(() => expect(screen.getByTestId('question-error')).toBeTruthy())
    expect(screen.queryAllByText('At ACME Corp, describe a trade-off you made.').length).toBe(0)
    expect(screen.queryAllByText('The job calls for Docker. What is your ramp-up plan?').length).toBe(0)
    expect(screen.queryByTestId('page-error')).toBeNull()

    // A later retry succeeds and repopulates the card.
    fireEvent.click(screen.getByTestId('question-error-retry'))
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(3))
    await act(async () => {
      questions.runs[1].resolve(bankQuestions)
    })
    await waitFor(() =>
      expect(screen.getAllByText('At ACME Corp, describe a trade-off you made.').length).toBeGreaterThan(0),
    )
    expect(screen.queryByTestId('question-error')).toBeNull()
  })
})
