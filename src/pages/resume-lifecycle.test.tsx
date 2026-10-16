import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apiService,
  type CareerGrowthPlanResponse,
  type InterviewQuestion,
  type InterviewQuestionsResponse,
  type MatchAnalysisResponse,
  type ParsedDetails,
  type ResumeParseResponse,
  type SkillGapAnalysisResponse,
} from '@/lib/api-service'
import CareerGrowthPage from '@/pages/career-growth'
import MatchPage from '@/pages/match'
import SkillGapsPage from '@/pages/skill-gaps'
import {
  clearStoredResume,
  readStoredResume,
  writeStoredResume,
  type StoredResume,
} from '@/lib/resume-store'

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

function makeResume(fileName: string, resumeText: string): StoredResume {
  return {
    fileName,
    fileSize: 2048,
    uploadedAt: '2026-01-01T00:00:00.000Z',
    parsedDetails: parsedDetails(),
    resumeText,
  }
}

function pdfFile(fileName: string): File {
  return new File(['pdf-bytes'], fileName, { type: 'application/pdf' })
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null
  if (!input) throw new Error('file input not found')
  return input
}

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms))
  })
}

function parseResponse(resumeText: string): ResumeParseResponse {
  return { resumeText, parsedDetails: parsedDetails() }
}

function skillGapAnalysis(summary: string): SkillGapAnalysisResponse {
  return {
    targetRole: 'Full-Stack Engineer',
    readinessScore: 55,
    summary,
    matchingSkills: ['React'],
    requiredSkills: ['TypeScript'],
    missingSkills: [],
  }
}

function growthPlan(summary: string): CareerGrowthPlanResponse {
  return {
    targetRole: 'Full-Stack Engineer',
    summary,
    courses: [],
    milestones: [],
  }
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

const emptyQuestions: InterviewQuestionsResponse = {
  resumeBasedQuestions: [],
  roleBasedQuestions: [],
}

let networkCalls = 0

beforeEach(() => {
  window.localStorage.clear()
  clearStoredResume()
  networkCalls = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    networkCalls += 1
    return Promise.reject(new Error('network is disabled in tests'))
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Skill Gaps page', () => {
  it('starts empty on a fresh session and never calls the AI provider', async () => {
    const analyzeSpy = vi.spyOn(apiService, 'analyzeSkillGaps')

    render(
      <MemoryRouter>
        <SkillGapsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('No Active Resume Found')).toBeTruthy()
    expect(screen.getByText(/nothing is restored from a previous session/)).toBeTruthy()

    await flush(750)

    expect(analyzeSpy).not.toHaveBeenCalled()
    expect(networkCalls).toBe(0)
  })

  it('uses only Resume B after B replaces A and discards a late response for A', async () => {
    const analyzeSpy = vi.spyOn(apiService, 'analyzeSkillGaps')
    const runA = deferred<SkillGapAnalysisResponse>()
    const runB = deferred<SkillGapAnalysisResponse>()
    analyzeSpy.mockImplementationOnce(() => runA.promise).mockImplementationOnce(() => runB.promise)

    render(
      <MemoryRouter>
        <SkillGapsPage />
      </MemoryRouter>,
    )

    act(() => {
      writeStoredResume(makeResume('Resume A.pdf', 'TEXT_A'))
    })
    await waitFor(() => expect(analyzeSpy).toHaveBeenCalledTimes(1))
    expect(analyzeSpy).toHaveBeenLastCalledWith('TEXT_A', expect.any(Array), expect.any(String))

    act(() => {
      writeStoredResume(makeResume('Resume B.pdf', 'TEXT_B'))
    })
    await waitFor(() => expect(analyzeSpy).toHaveBeenCalledTimes(2))
    expect(analyzeSpy).toHaveBeenLastCalledWith('TEXT_B', expect.any(Array), expect.any(String))

    // B's response lands first and is displayed.
    await act(async () => {
      runB.resolve(skillGapAnalysis('SKILL_GAP_SUMMARY_B'))
    })
    await waitFor(() => expect(screen.getByText('SKILL_GAP_SUMMARY_B')).toBeTruthy())

    // A's response arrives late and must be discarded.
    await act(async () => {
      runA.resolve(skillGapAnalysis('SKILL_GAP_SUMMARY_A'))
    })
    expect(screen.queryByText('SKILL_GAP_SUMMARY_A')).toBeNull()
    expect(screen.getByText('SKILL_GAP_SUMMARY_B')).toBeTruthy()

    expect(readStoredResume()?.fileName).toBe('Resume B.pdf')
    expect(window.localStorage.getItem('careerlens.resume')).toBeNull()
    expect(networkCalls).toBe(0)
  })
})

describe('Career Growth page', () => {
  it('starts empty on a fresh session and never calls the AI provider', async () => {
    const planSpy = vi.spyOn(apiService, 'getCareerGrowthPlan')

    render(
      <MemoryRouter>
        <CareerGrowthPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('No Active Resume Found')).toBeTruthy()
    expect(screen.getByText(/always generated from the resume you upload/)).toBeTruthy()

    await flush(750)

    expect(planSpy).not.toHaveBeenCalled()
    expect(networkCalls).toBe(0)
  })

  it('generates the plan only from the resume uploaded in this session', async () => {
    const planSpy = vi.spyOn(apiService, 'getCareerGrowthPlan')
    const runA = deferred<CareerGrowthPlanResponse>()
    planSpy.mockImplementationOnce(() => runA.promise)

    render(
      <MemoryRouter>
        <CareerGrowthPage />
      </MemoryRouter>,
    )
    expect(planSpy).not.toHaveBeenCalled()

    act(() => {
      writeStoredResume(makeResume('Resume A.pdf', 'TEXT_A'))
    })
    await waitFor(() => expect(planSpy).toHaveBeenCalledTimes(1))
    expect(planSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.any(String),
      'TEXT_A',
    )

    await act(async () => {
      runA.resolve(growthPlan('GROWTH_PLAN_A'))
    })
    await waitFor(() => expect(screen.getByText('GROWTH_PLAN_A')).toBeTruthy())

    expect(networkCalls).toBe(0)
  })
})

describe('Match Analysis page', () => {
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

  it('shows the upload prompt on a fresh session without calling the AI provider', async () => {
    const match = trackMatch()
    const questions = trackQuestions()
    vi.spyOn(apiService, 'parseResume')

    renderMatch()

    expect(screen.getByText('No Resume Analyzed Yet')).toBeTruthy()
    expect(screen.getByText(/Upload your resume to get started/)).toBeTruthy()

    await flush(750)

    expect(match.spy).not.toHaveBeenCalled()
    expect(questions.spy).not.toHaveBeenCalled()
    expect(networkCalls).toBe(0)
  })

  it('clears the analyzing state and reports the error when the PDF parse fails', async () => {
    let rejectParse!: (error: Error) => void
    vi.spyOn(apiService, 'parseResume').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectParse = reject
        }),
    )
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()
    fireEvent.change(fileInput(), { target: { files: [pdfFile('Broken.pdf')] } })

    // The upload is in flight — the button shows the analyzing label…
    await waitFor(() => expect(screen.getByText('Analyzing PDF...')).toBeTruthy())

    rejectParse(new Error('PDF exploded during parsing'))

    // …and the failure terminates it: idle label back, no spinner, error shown.
    await waitFor(() => expect(screen.queryByText('Analyzing PDF...')).toBeNull())
    expect(screen.getByText('Upload Resume')).toBeTruthy()
    expect(
      screen.getByText(/Failed to parse the resume PDF: PDF exploded during parsing/),
    ).toBeTruthy()
    expect(match.spy).not.toHaveBeenCalled()
    expect(questions.spy).not.toHaveBeenCalled()

    // The session was not poisoned: no half-stored resume lingers.
    expect(readStoredResume()).toBeNull()
  })

  it('analyzes only Resume B after replacing Resume A', async () => {
    vi.spyOn(apiService, 'parseResume').mockImplementation(async (file: File) =>
      parseResponse(file.name === 'Resume A.pdf' ? 'TEXT_A' : 'TEXT_B'),
    )
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()

    fireEvent.change(fileInput(), { target: { files: [pdfFile('Resume A.pdf')] } })
    await waitFor(() => expect(match.spy).toHaveBeenCalledTimes(1))
    expect(match.spy).toHaveBeenLastCalledWith(
      'TEXT_A',
      expect.any(String),
      'candidate-001',
      expect.any(String),
    )

    // A's analysis resolves and is displayed.
    await act(async () => {
      match.runs[0].resolve(matchAnalysis('MATCH_SUMMARY_A'))
    })
    await waitFor(() => expect(screen.getByText('MATCH_SUMMARY_A')).toBeTruthy())
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(1))
    expect(questions.spy).toHaveBeenLastCalledWith(
      'TEXT_A',
      expect.any(String),
      expect.any(String),
      5,
    )
    await act(async () => {
      questions.runs[0].resolve(emptyQuestions)
    })

    // Replacing with Resume B clears the stored resume and all A results first.
    fireEvent.change(fileInput(), { target: { files: [pdfFile('Resume B.pdf')] } })
    expect(screen.queryByText('MATCH_SUMMARY_A')).toBeNull()
    expect(readStoredResume()).toBeNull()

    // B's analysis replaces it.
    await waitFor(() => expect(match.spy).toHaveBeenCalledTimes(2))
    expect(match.spy).toHaveBeenLastCalledWith(
      'TEXT_B',
      expect.any(String),
      'candidate-001',
      expect.any(String),
    )
    await act(async () => {
      match.runs[1].resolve(matchAnalysis('MATCH_SUMMARY_B'))
    })
    await waitFor(() => expect(screen.getByText('MATCH_SUMMARY_B')).toBeTruthy())
    await waitFor(() => expect(questions.spy).toHaveBeenCalledTimes(2))
    await act(async () => {
      questions.runs[1].resolve(emptyQuestions)
    })

    expect(screen.queryByText('MATCH_SUMMARY_A')).toBeNull()
    expect(screen.getByText('MATCH_SUMMARY_B')).toBeTruthy()
    expect(readStoredResume()?.fileName).toBe('Resume B.pdf')
    expect(window.localStorage.getItem('careerlens.resume')).toBeNull()
    expect(networkCalls).toBe(0)
  })

  it('discards a late Resume A analysis after Resume B completed', async () => {
    vi.spyOn(apiService, 'parseResume').mockImplementation(async (file: File) =>
      parseResponse(file.name === 'Resume A.pdf' ? 'TEXT_A' : 'TEXT_B'),
    )
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()

    fireEvent.change(fileInput(), { target: { files: [pdfFile('Resume A.pdf')] } })
    await waitFor(() => expect(match.runs).toHaveLength(1))

    fireEvent.change(fileInput(), { target: { files: [pdfFile('Resume B.pdf')] } })
    await waitFor(() => expect(match.runs).toHaveLength(2))

    await act(async () => {
      match.runs[1].resolve(matchAnalysis('MATCH_SUMMARY_B'))
    })
    await waitFor(() => expect(screen.getByText('MATCH_SUMMARY_B')).toBeTruthy())
    await waitFor(() => expect(questions.runs).toHaveLength(1))
    await act(async () => {
      questions.runs[0].resolve(emptyQuestions)
    })

    // Resume A's analysis finally answers — it must not overwrite Resume B.
    await act(async () => {
      match.runs[0].resolve(matchAnalysis('MATCH_SUMMARY_A'))
    })
    expect(screen.queryByText('MATCH_SUMMARY_A')).toBeNull()
    expect(screen.getByText('MATCH_SUMMARY_B')).toBeTruthy()

    expect(readStoredResume()?.fileName).toBe('Resume B.pdf')
    expect(networkCalls).toBe(0)
  })

  it('uses only Resume 4 after uploading the four real resumes in sequence', async () => {
    // The four repository resumes, uploaded 1 → 2 → 3 → 4: each must be
    // analyzed with its own extracted text, and no state from an earlier
    // resume (match result, questions, extracted details) may be reused.
    const realFiles = [
      'CareerLens_Test_Resume_01_AI_FullStack.pdf',
      'CareerLens_Test_Resume_02_Frontend.pdf',
      'CareerLens_Test_Resume_03_ML_AI.pdf',
      'CareerLens_Test_Resume_04_Simple.pdf',
    ]
    vi.spyOn(apiService, 'parseResume').mockImplementation(async (file: File) =>
      parseResponse(`TEXT_${file.name}`),
    )
    const match = trackMatch()
    const questions = trackQuestions()

    renderMatch()

    for (let i = 0; i < realFiles.length; i += 1) {
      const fileName = realFiles[i]
      fireEvent.change(fileInput(), { target: { files: [pdfFile(fileName)] } })

      // Every previously displayed match result is cleared the moment a new
      // resume replaces the old one.
      for (let j = 0; j < i; j += 1) {
        expect(screen.queryByText(`MATCH_SUMMARY_${j + 1}`)).toBeNull()
      }

      await waitFor(() => expect(match.runs).toHaveLength(i + 1))
      expect(match.spy).toHaveBeenLastCalledWith(
        `TEXT_${fileName}`,
        expect.any(String),
        'candidate-001',
        expect.any(String),
      )

      await act(async () => {
        match.runs[i].resolve(matchAnalysis(`MATCH_SUMMARY_${i + 1}`))
      })
      await waitFor(() => expect(screen.getByText(`MATCH_SUMMARY_${i + 1}`)).toBeTruthy())

      await waitFor(() => expect(questions.runs).toHaveLength(i + 1))
      expect(questions.spy).toHaveBeenLastCalledWith(
        `TEXT_${fileName}`,
        expect.any(String),
        expect.any(String),
        5,
      )
      await act(async () => {
        questions.runs[i].resolve(emptyQuestions)
      })

      expect(readStoredResume()?.fileName).toBe(fileName)
      expect(window.localStorage.getItem('careerlens.resume')).toBeNull()
    }

    // Final state belongs exclusively to Resume 4.
    expect(screen.queryByText('MATCH_SUMMARY_1')).toBeNull()
    expect(screen.queryByText('MATCH_SUMMARY_2')).toBeNull()
    expect(screen.queryByText('MATCH_SUMMARY_3')).toBeNull()
    expect(screen.getByText('MATCH_SUMMARY_4')).toBeTruthy()

    // Each analysis request carried its own resume's text.
    expect(match.spy).toHaveBeenCalledTimes(4)
    expect(questions.spy).toHaveBeenCalledTimes(4)
    for (let i = 0; i < realFiles.length; i += 1) {
      expect(match.spy.mock.calls[i][0]).toBe(`TEXT_${realFiles[i]}`)
      expect(questions.spy.mock.calls[i][0]).toBe(`TEXT_${realFiles[i]}`)
    }

    expect(readStoredResume()?.fileName).toBe(realFiles[3])
    expect(window.localStorage.getItem('careerlens.resume')).toBeNull()
    expect(networkCalls).toBe(0)
  })
})

describe('AI source labels', () => {
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

  it('shows the rule-based source note on the skill gap analysis', async () => {
    const analyzeSpy = vi.spyOn(apiService, 'analyzeSkillGaps')
    const run = deferred<SkillGapAnalysisResponse>()
    analyzeSpy.mockImplementationOnce(() => run.promise)

    render(
      <MemoryRouter>
        <SkillGapsPage />
      </MemoryRouter>,
    )

    act(() => {
      writeStoredResume(makeResume('Resume A.pdf', 'TEXT_A'))
    })
    await waitFor(() => expect(analyzeSpy).toHaveBeenCalledTimes(1))

    await act(async () => {
      run.resolve({ ...skillGapAnalysis('GAP_SUMMARY_SOURCE'), source: 'Rule-based fallback' })
    })
    await waitFor(() => expect(screen.getByText('GAP_SUMMARY_SOURCE')).toBeTruthy())

    const note = screen.getByTestId('result-source')
    expect(note.textContent).toContain('Rule-based fallback')
    expect(note.textContent).toMatch(/both AI providers were unavailable/i)
    expect(note.textContent).toMatch(/No AI was used/i)
  })

  it('shows the fallback provider label on the career growth plan', async () => {
    const planSpy = vi.spyOn(apiService, 'getCareerGrowthPlan')
    const run = deferred<CareerGrowthPlanResponse>()
    planSpy.mockImplementationOnce(() => run.promise)

    render(
      <MemoryRouter>
        <CareerGrowthPage />
      </MemoryRouter>,
    )

    act(() => {
      writeStoredResume(makeResume('Resume A.pdf', 'TEXT_A'))
    })
    await waitFor(() => expect(planSpy).toHaveBeenCalledTimes(1))

    await act(async () => {
      run.resolve({ ...growthPlan('GROWTH_PLAN_SOURCE'), source: 'AI-generated (Groq fallback)' })
    })
    await waitFor(() => expect(screen.getByText('GROWTH_PLAN_SOURCE')).toBeTruthy())

    const note = screen.getByTestId('result-source')
    expect(note.textContent).toContain('AI-generated (Groq fallback)')
    expect(note.textContent).toMatch(/fallback AI provider/i)
  })

  it('labels match, question, and evaluation sources on the match page', async () => {
    vi.spyOn(apiService, 'parseResume').mockImplementation(async (file: File) => parseResponse(`TEXT_${file.name}`))
    const match = trackMatch()
    const questions = trackQuestions()
    const evalSpy = vi.spyOn(apiService, 'evaluateAnswer').mockResolvedValue({
      score: 61,
      feedback: 'Solid attempt with a clear structure.',
      suggested_improvement: 'Add measurable outcomes.',
      source: 'Rule-based fallback',
    })

    renderMatch()

    fireEvent.change(fileInput(), { target: { files: [pdfFile('Resume A.pdf')] } })
    await waitFor(() => expect(match.runs).toHaveLength(1))
    await act(async () => {
      match.runs[0].resolve({ ...matchAnalysis('MATCH_SUMMARY_SOURCE'), source: 'AI-generated (Gemini)' })
    })
    await waitFor(() => expect(screen.getByText('MATCH_SUMMARY_SOURCE')).toBeTruthy())

    // The match analysis note comes first and carries the primary AI label.
    await waitFor(() => expect(screen.getAllByTestId('result-source').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByTestId('result-source')[0].textContent).toContain('AI-generated (Gemini)')

    // Questions resolve with their own (different) source label.
    await waitFor(() => expect(questions.runs).toHaveLength(1))
    const question: InterviewQuestion = {
      id: 'q-source-1',
      type: 'Technical',
      question: 'How would you profile a slow React render?',
      context: 'Derived from your experience.',
      sampleAnswerOutline: ['Identify the hotspot', 'Apply a fix', 'Measure again'],
      evalCriteria: 'Technical depth',
    }
    await act(async () => {
      questions.runs[0].resolve({
        resumeBasedQuestions: [question],
        roleBasedQuestions: [],
        source: 'Rule-based fallback',
      })
    })
    await waitFor(() =>
      expect(screen.getAllByText('How would you profile a slow React render?').length).toBeGreaterThan(0),
    )
    expect(
      screen.getAllByTestId('result-source').some((n) => n.textContent?.includes('Rule-based fallback')),
    ).toBe(true)

    // Evaluate the auto-selected question and check the evaluation note + header.
    fireEvent.change(screen.getByPlaceholderText('Write your answer here...'), {
      target: { value: 'I would use the React Profiler to find the slow commit.' },
    })
    fireEvent.click(screen.getByText('Submit & Evaluate Answer'))
    await waitFor(() => expect(evalSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('Solid attempt with a clear structure.')).toBeTruthy())

    expect(screen.getByText('Evaluation Feedback')).toBeTruthy()
    expect(screen.queryByText('AI Evaluation Feedback')).toBeNull()
    expect(screen.getAllByTestId('result-source').length).toBeGreaterThanOrEqual(3)
    expect(networkCalls).toBe(0)
  })

  it('renders no source note when the response carries no source label', async () => {
    const analyzeSpy = vi.spyOn(apiService, 'analyzeSkillGaps')
    const run = deferred<SkillGapAnalysisResponse>()
    analyzeSpy.mockImplementationOnce(() => run.promise)

    render(
      <MemoryRouter>
        <SkillGapsPage />
      </MemoryRouter>,
    )

    act(() => {
      writeStoredResume(makeResume('Resume A.pdf', 'TEXT_A'))
    })
    await waitFor(() => expect(analyzeSpy).toHaveBeenCalledTimes(1))

    await act(async () => {
      run.resolve(skillGapAnalysis('GAP_SUMMARY_NO_SOURCE'))
    })
    await waitFor(() => expect(screen.getByText('GAP_SUMMARY_NO_SOURCE')).toBeTruthy())

    expect(screen.queryByTestId('result-source')).toBeNull()
  })
})
