import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { ResumeUploadModal } from '@/components/resume/resume-upload-modal'
import { RequestTimeoutError, apiService, type ResumeParseResponse } from '@/lib/api-service'
import type { StoredResume } from '@/lib/resume-store'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function parseResponse(): ResumeParseResponse {
  return {
    resumeText: 'resume text',
    parsedDetails: {
      name: 'Test User',
      email: 'test@example.com',
      skills: ['React'],
      workExperience: [],
      education: [],
    },
  }
}

function pdfFile(name = 'resume.pdf'): File {
  return new File(['pdf-bytes'], name, { type: 'application/pdf' })
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null
  if (!input) throw new Error('file input not found')
  return input
}

function selectFile(file: File): void {
  fireEvent.change(fileInput(), { target: { files: [file] } })
}

let onSuccess: Mock<(resume: StoredResume) => void>
let onClose: Mock<() => void>
let onAnalyzeResult: Mock<(result: StoredResume | null) => void>

function renderModal() {
  return render(
    <ResumeUploadModal
      open
      onClose={onClose}
      onSuccess={onSuccess}
      onAnalyzeResult={onAnalyzeResult}
    />,
  )
}

beforeEach(() => {
  onSuccess = vi.fn<(resume: StoredResume) => void>()
  onClose = vi.fn<() => void>()
  onAnalyzeResult = vi.fn<(result: StoredResume | null) => void>()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('resume upload modal loading states', () => {
  it('runs the parse through its bounded timeout and finishes in the success view', async () => {
    vi.spyOn(apiService, 'parseResume').mockResolvedValue(parseResponse())

    renderModal()
    selectFile(pdfFile())
    fireEvent.click(screen.getByText('Analyze Resume'))

    await waitFor(() => expect(screen.getByText('Resume analyzed!')).toBeTruthy())
    expect(apiService.parseResume).toHaveBeenCalledTimes(1)
    expect(apiService.parseResume).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ timeoutMs: 90_000 }),
    )

    fireEvent.click(screen.getByText('Continue to Dashboard'))
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves the uploading state when the parse fails — no stuck spinner', async () => {
    const pending = deferred<ResumeParseResponse>()
    vi.spyOn(apiService, 'parseResume').mockImplementation(() => pending.promise)

    renderModal()
    selectFile(pdfFile('broken.pdf'))
    fireEvent.click(screen.getByText('Analyze Resume'))

    // While the request is in flight the progress UI is up…
    await waitFor(() => expect(screen.getAllByText('Analyzing resume…').length).toBeGreaterThan(0))

    pending.reject(new Error('PDF exploded during parsing'))

    // …and it comes back down the moment the request settles.
    await waitFor(() => expect(screen.queryByText('Analyzing resume…')).toBeNull())
    expect(screen.getByText("Couldn't analyze your resume")).toBeTruthy()
    expect(screen.getByText(/PDF exploded during parsing/)).toBeTruthy()
    expect(screen.getByText('Try again')).toBeTruthy()
    expect(screen.queryByText('Resume analyzed!')).toBeNull()
    expect(onAnalyzeResult).toHaveBeenCalledWith(null)
    expect(onSuccess).not.toHaveBeenCalled()

    // The retry path is live: a second attempt can succeed.
    vi.mocked(apiService.parseResume).mockResolvedValue(parseResponse())
    fireEvent.click(screen.getByText('Try again'))
    await waitFor(() => expect(screen.getByText('Resume analyzed!')).toBeTruthy())
  })

  it('turns a request timeout into friendly guidance instead of raw error text', async () => {
    vi.spyOn(apiService, 'parseResume').mockRejectedValue(
      new RequestTimeoutError('/resume/parse', 90_000),
    )

    renderModal()
    selectFile(pdfFile('slow.pdf'))
    fireEvent.click(screen.getByText('Analyze Resume'))

    await waitFor(() => expect(screen.getByText(/took too long/i)).toBeTruthy())
    expect(screen.queryByText('Analyzing resume…')).toBeNull()
    expect(screen.queryByText(/RequestTimeoutError|timed out/i)).toBeNull()
  })

  it('rejects a non-PDF before any request is made', async () => {
    const spy = vi.spyOn(apiService, 'parseResume')

    renderModal()
    selectFile(new File(['x'], 'notes.txt', { type: 'text/plain' }))

    await waitFor(() => expect(screen.getByText('Unsupported file type')).toBeTruthy())
    expect(spy).not.toHaveBeenCalled()
    expect(screen.queryByText('Analyzing resume…')).toBeNull()
  })
})
