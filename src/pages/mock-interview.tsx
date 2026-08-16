import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Mic, 
  ShieldAlert, 
  AlertTriangle, 
  BrainCircuit, 
  CheckCircle2, 
  Send, 
  FileText, 
  ChevronRight, 
  User, 
  FileQuestion, 
  Lock, 
  Play, 
  Camera, 
  Volume2, 
  RefreshCw,
  LoaderCircle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiService } from '@/lib/api-service'
import type { 
  MockInterviewQuestion, 
  MockInterviewStartResponse, 
  MockInterviewAnswerResponse, 
  MockInterviewCompleteResponse 
} from '@/lib/api-service'
import { mockStore } from '@/lib/mock-store'

export default function MockInterviewPage() {
  // Wizard stages: 'setup' | 'loading' | 'interview' | 'terminated' | 'scorecard'
  const [step, setStep] = useState<'setup' | 'loading' | 'interview' | 'terminated' | 'scorecard'>('setup')

  // Setup inputs
  const [candidateName, setCandidateName] = useState('')
  const [targetRole, setTargetRole] = useState('React Frontend Developer')
  const [resumeText, setResumeText] = useState('')
  const [resumeName, setResumeName] = useState('')
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Available mock jobs for job description reference
  const availableJobs = useMemo(() => mockStore.getJobs(), [])
  const [selectedJobId, setSelectedJobId] = useState(availableJobs[0]?.id || '')

  // Active Session states
  const [session, setSession] = useState<MockInterviewStartResponse | null>(null)
  const [activeRoundId, setActiveRoundId] = useState(1) // 1 = Aptitude, 2 = Tech, 3 = HR
  const [questions, setQuestions] = useState<MockInterviewQuestion[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedMCQOption, setSelectedMCQOption] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [currentEvaluation, setCurrentEvaluation] = useState<MockInterviewAnswerResponse | null>(null)
  
  // Violations & Proctor State
  const [violationsCount, setViolationsCount] = useState(0)
  const [maxViolations, setMaxViolations] = useState(3)
  const [lastWarningMsg, setLastWarningMsg] = useState('')
  const [showWarningAlert, setShowWarningAlert] = useState(false)

  // Audio recording simulation states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTimer, setRecordingTimer] = useState(0)
  
  // Final Results
  const [scorecard, setScorecard] = useState<MockInterviewCompleteResponse | null>(null)

  // Timer states (Countdown)
  const [timeLeft, setTimeLeft] = useState(900) // 15 mins default
  const timerIntervalRef = useRef<any>(null)

  // Real AI Proctoring Webcam & TF.js Refs & State
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const animationFrameIdRef = useRef<number | null>(null)
  const gazeAwayTimerRef = useRef<number | null>(null)

  const activeJob = useMemo(() => {
    return availableJobs.find(j => j.id === selectedJobId) || null
  }, [selectedJobId, availableJobs])

  const activeJobDescription = useMemo(() => {
    if (!activeJob) return 'Software Developer Job Description'
    return `${activeJob.title} at ${activeJob.company}\n\nRequirements:\n${activeJob.requirements.join('\n')}`
  }, [activeJob])

  // --- Dynamic AI Proctoring Model Loader ---
  useEffect(() => {
    let active = true
    const loadAI = async () => {
      try {
        console.log('Loading TensorFlow.js via CDN...')
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs')
        console.log('Loading BlazeFace and CocoSSD models...')
        await Promise.all([
          loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface'),
          loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd'),
        ])
        if (active) {
          setModelsLoaded(true)
          console.log('AI models loaded successfully!')
        }
      } catch (err) {
        console.error('Failed to load AI proctoring models:', err)
        if (active) {
          setWebcamError('Failed to load AI models. Please check your internet connection.')
        }
      }
    }
    loadAI()
    return () => {
      active = false
    }
  }, [])

  // --- Webcam Access & AI Frame Processing Loop ---
  useEffect(() => {
    if (step !== 'interview' || !modelsLoaded || !session) return

    let localStream: MediaStream | null = null

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false, // Mic is separately handled for recording answers
        })
        localStream = stream
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Failed to access webcam:', err)
        setWebcamError('Unable to access webcam. Please verify camera permissions.')
      }
    }

    const runDetectionLoop = async () => {
      const tf = (window as any).tf
      const blazeface = (window as any).blazeface
      const cocoSsd = (window as any).cocoSsd

      if (!tf || !blazeface || !cocoSsd) {
        console.error('TensorFlow libraries not available on window.')
        return
      }

      const faceModel = await blazeface.load()
      const objectModel = await cocoSsd.load()
      console.log('AI Proctor models ready!')

      let lastPhoneWarningTime = 0
      let lastGazeWarningTime = 0

      const triggerViolation = async (type: 'GAZE_AWAY' | 'PHONE_DETECTED') => {
        try {
          const timestamp = new Date().toISOString()
          const res = await apiService.logProctorEvent(session.sessionId, type, timestamp)
          setViolationsCount(res.currentViolations)
          setLastWarningMsg(res.warningMessage)
          setShowWarningAlert(true)

          if (res.action === 'TERMINATE_SESSION') {
            setStep('terminated')
          }
        } catch (err) {
          console.error('Failed to log AI proctor violation:', err)
        }
      }

      const processFrame = async () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        if (!ctx) return

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          // Draw mirrored video
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          ctx.setTransform(1, 0, 0, 1, 0, 0)

          try {
            // Face detection
            const faces = await faceModel.estimateFaces(video, false)
            // Object/Phone detection
            const objects = await objectModel.detect(video)

            let isLookingAway = false
            let isPhoneDetected = false

            if (faces && faces.length > 0) {
              const face = faces[0]
              const start = face.topLeft
              const end = face.bottomRight
              const size = [end[0] - start[0], end[1] - start[1]]

              // Draw green face bounding box
              ctx.strokeStyle = '#10B981'
              ctx.lineWidth = 3
              const xPos = canvas.width - end[0]
              ctx.strokeRect(xPos, start[1], size[0], size[1])

              if (face.landmarks && face.landmarks.length >= 3) {
                const rightEye = face.landmarks[0]
                const leftEye = face.landmarks[1]
                const nose = face.landmarks[2]

                const distLeft = Math.abs(nose[0] - leftEye[0])
                const distRight = Math.abs(nose[0] - rightEye[0])
                const gazeRatio = distLeft / distRight

                // Draw eyes
                ctx.fillStyle = '#6366F1'
                ctx.beginPath()
                ctx.arc(canvas.width - rightEye[0], rightEye[1], 4, 0, 2 * Math.PI)
                ctx.arc(canvas.width - leftEye[0], leftEye[1], 4, 0, 2 * Math.PI)
                ctx.fill()

                // Draw nose
                ctx.fillStyle = '#F59E0B'
                ctx.beginPath()
                ctx.arc(canvas.width - nose[0], nose[1], 4, 0, 2 * Math.PI)
                ctx.fill()

                // Gaze tracking bounds check
                if (gazeRatio > 1.7 || gazeRatio < 0.58) {
                  isLookingAway = true
                  ctx.strokeStyle = '#EF4444'
                  ctx.fillStyle = '#EF4444'
                  ctx.font = 'bold 16px sans-serif'
                  ctx.fillText('WARNING: LOOKING AWAY', 20, 40)
                } else {
                  ctx.strokeStyle = '#10B981'
                  ctx.fillStyle = '#10B981'
                  ctx.font = 'bold 12px sans-serif'
                  ctx.fillText('GAZE STATUS: OK', 20, 40)
                }

                // Draw gaze vector visualizer lines
                const gazeVectorX = (gazeRatio > 1.7) ? -45 : (gazeRatio < 0.58) ? 45 : 0
                ctx.beginPath()
                ctx.moveTo(canvas.width - rightEye[0], rightEye[1])
                ctx.lineTo(canvas.width - rightEye[0] - gazeVectorX, rightEye[1] - 20)
                ctx.moveTo(canvas.width - leftEye[0], leftEye[1])
                ctx.lineTo(canvas.width - leftEye[0] - gazeVectorX, leftEye[1] - 20)
                ctx.stroke()
              }
            } else {
              isLookingAway = true
              ctx.fillStyle = '#EF4444'
              ctx.font = 'bold 16px sans-serif'
              ctx.fillText('WARNING: NO FACE DETECTED', 20, 40)
            }

            // Phone check
            if (objects && objects.length > 0) {
              for (const obj of objects) {
                if (obj.class === 'cell phone' && obj.score > 0.5) {
                  isPhoneDetected = true
                  const [x, y, w, h] = obj.bbox
                  ctx.strokeStyle = '#EF4444'
                  ctx.lineWidth = 4
                  ctx.strokeRect(canvas.width - x - w, y, w, h)

                  ctx.fillStyle = '#EF4444'
                  ctx.font = 'bold 14px sans-serif'
                  ctx.fillText(`PROHIBITED: PHONE (${Math.round(obj.score * 100)}%)`, 20, 70)
                }
              }
            }

            const now = Date.now()

            // Trigger violation on phone detection
            if (isPhoneDetected) {
              if (now - lastPhoneWarningTime > 10000) {
                lastPhoneWarningTime = now
                triggerViolation('PHONE_DETECTED')
              }
            }

            // Trigger violation on looking away (3 seconds hold)
            if (isLookingAway) {
              if (!gazeAwayTimerRef.current) {
                gazeAwayTimerRef.current = window.setTimeout(() => {
                  if (now - lastGazeWarningTime > 12000) {
                    lastGazeWarningTime = Date.now()
                    triggerViolation('GAZE_AWAY')
                  }
                  gazeAwayTimerRef.current = null
                }, 3000)
              }
            } else {
              if (gazeAwayTimerRef.current) {
                clearTimeout(gazeAwayTimerRef.current)
                gazeAwayTimerRef.current = null
              }
            }

          } catch (err) {
            console.error('Frame inference error:', err)
          }
        }

        animationFrameIdRef.current = requestAnimationFrame(processFrame)
      }

      processFrame()
    }

    startWebcam().then(() => {
      runDetectionLoop()
    })

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
      if (gazeAwayTimerRef.current) {
        clearTimeout(gazeAwayTimerRef.current)
      }
    }
  }, [step, modelsLoaded, session])

  // --- Proctoring Violations Listener ---
  useEffect(() => {
    if (step !== 'interview' || !session) return

    const handleWindowBlur = async () => {
      try {
        const timestamp = new Date().toISOString()
        const res = await apiService.logProctorEvent(session.sessionId, 'TAB_SWITCH', timestamp)
        setViolationsCount(res.currentViolations)
        setLastWarningMsg(res.warningMessage)
        setShowWarningAlert(true)

        if (res.action === 'TERMINATE_SESSION') {
          setStep('terminated')
        }
      } catch (err) {
        console.error('Failed to log proctor violation:', err)
      }
    }

    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [step, session])

  // --- Visual Timer countdown ---
  useEffect(() => {
    if (step === 'interview' && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [step, timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // --- Resume Upload Handler ---
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setResumeName(file.name)
    try {
      const res = await apiService.parseResume(file)
      setResumeText(res.resumeText)
    } catch (err) {
      console.error('Failed to parse resume:', err)
    } finally {
      setParsing(false)
    }
  }

  // --- Initialize mock interview ---
  const handleStartInterview = async () => {
    if (!candidateName.trim() || !resumeText.trim()) return
    setStep('loading')
    try {
      const initSession = await apiService.startMockInterview(
        candidateName,
        activeJobDescription,
        resumeText,
        targetRole
      )
      setSession(initSession)
      setMaxViolations(initSession.proctorConfig.maxAllowedViolations)
      
      // Load first round questions
      const roundQ = await apiService.getMockQuestions(initSession.sessionId, 1)
      setQuestions(roundQ.questions)
      setActiveRoundId(1)
      setCurrentQIndex(0)
      setTimeLeft(initSession.rounds[0].durationMinutes * 60)
      setStep('interview')
    } catch (err) {
      console.error('Error starting interview session:', err)
      setStep('setup')
    }
  }

  const activeQuestion = questions[currentQIndex] || null

  // --- Submit answer ---
  const handleSubmitAnswer = async () => {
    if (!session || !activeQuestion) return
    setEvaluating(true)
    
    let answerPayload = ''
    if (activeQuestion.type === 'MCQ') {
      answerPayload = selectedMCQOption || ''
    } else {
      answerPayload = answerText
    }

    try {
      const evaluation = await apiService.submitMockAnswer(
        session.sessionId,
        activeRoundId,
        activeQuestion.questionId,
        answerPayload
      )
      setCurrentEvaluation(evaluation)
    } catch (err) {
      console.error('Error submitting answer:', err)
    } finally {
      setEvaluating(false)
    }
  }

  // --- Next question or next round ---
  const handleNext = async () => {
    if (!session) return
    setCurrentEvaluation(null)
    setSelectedMCQOption(null)
    setAnswerText('')

    if (currentQIndex < questions.length - 1) {
      // Go to next question in same round
      setCurrentQIndex(prev => prev + 1)
    } else {
      // Next round transition
      const nextRoundId = activeRoundId + 1
      if (nextRoundId <= 3) {
        setStep('loading')
        try {
          const nextRoundQ = await apiService.getMockQuestions(session.sessionId, nextRoundId)
          setQuestions(nextRoundQ.questions)
          setActiveRoundId(nextRoundId)
          setCurrentQIndex(0)
          
          const roundConfig = session.rounds.find(r => r.roundId === nextRoundId)
          setTimeLeft((roundConfig?.durationMinutes || 15) * 60)
          setStep('interview')
        } catch (err) {
          console.error('Error switching rounds:', err)
        }
      } else {
        // Complete interview
        setStep('loading')
        try {
          const finalReport = await apiService.completeMockInterview(session.sessionId)
          setScorecard(finalReport)
          setStep('scorecard')
        } catch (err) {
          console.error('Error compiling final report:', err)
        }
      }
    }
  }

  // --- Audio Recording Simulation ---
  let recordingInterval = useRef<any>(null)
  const toggleRecording = () => {
    if (isRecording) {
      clearInterval(recordingInterval.current)
      setIsRecording(false)
      setRecordingTimer(0)
      // Simulate transcribed text response
      setAnswerText("To optimize a React application, I use React.memo to prevent unnecessary re-renders, lazy loading with React.Suspense for code splitting, and useCallback/useMemo for stable function references.")
    } else {
      setIsRecording(true)
      recordingInterval.current = setInterval(() => {
        setRecordingTimer(prev => prev + 1)
      }, 1000)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. SETUP STEP */}
      {step === 'setup' && (
        <Card className="max-w-3xl mx-auto shadow-xl border-border bg-card">
          <CardHeader className="border-b pb-6">
            <CardTitle className="flex items-center gap-2.5 text-xl font-bold">
              <BrainCircuit className="size-6 text-brand-600 animate-pulse" />
              Proctored AI Mock Interview Setup
            </CardTitle>
            <CardDescription>
              A 3-round simulated assessment designed to evaluate logic, technical coding proficiency, and behavioral alignment. Proctor rules require camera and tab focus monitoring.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Candidate Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs bg-background"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Job Role</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. React Frontend Engineer"
                  className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs bg-background"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Job Reference</label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-brand-500 text-xs bg-background"
                >
                  {availableJobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title} ({job.company})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upload Resume PDF</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="w-full text-xs rounded-xl"
                    onClick={() => fileRef.current?.click()}
                    loading={parsing}
                    leftIcon={<FileText className="size-3.5" />}
                  >
                    {resumeName ? `${resumeName.slice(0, 18)}...` : 'Choose PDF file'}
                  </Button>
                  <input
                    type="file"
                    ref={fileRef}
                    onChange={handleResumeUpload}
                    accept="application/pdf"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="size-4 text-brand-600" />
                Required Proctoring Permissions
              </h4>
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Camera className="size-4 text-emerald-500" />
                  <span>Webcam Verification</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mic className="size-4 text-emerald-500" />
                  <span>Microphone Access</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="size-4 text-emerald-500" />
                  <span>Active Tab Locking</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full py-2.5 rounded-xl font-semibold tracking-wide"
              onClick={handleStartInterview}
              disabled={!candidateName.trim() || !resumeText.trim()}
              leftIcon={<Play className="size-4" />}
            >
              Start Proctored Interview Session
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2. LOADING STEP */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
          <RefreshCw className="size-10 text-brand-600 animate-spin" />
          <h3 className="text-base font-bold text-foreground">Configuring Proctored Assessment Room</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Evaluating job parameters and generating custom logic, coding, and behavioral interview questions...
          </p>
        </div>
      )}

      {/* 3. INTERVIEW WORKSPACE STEP */}
      {step === 'interview' && session && activeQuestion && (
        <div className="grid gap-6 lg:grid-cols-3 items-start">
          
          {/* Left Column: Proctor Feed */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="shadow-lg border-border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Proctoring Feed</span>
                  <Badge variant="success" dot className="px-2 py-0.5 text-[10px]">Active</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                
                {/* Real Webcam Box with AI Overlay */}
                <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center border border-border">
                  <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 bg-black/75 px-2.5 py-1 rounded-full text-[10px] text-white font-semibold">
                    <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span>AI Proctor Feed</span>
                  </div>
                  
                  {webcamError ? (
                    <p className="text-xs text-red-500 px-4 text-center z-10">{webcamError}</p>
                  ) : !modelsLoaded ? (
                    <div className="text-center z-10 space-y-2">
                      <LoaderCircle className="size-8 animate-spin mx-auto text-brand-500" />
                      <p className="text-[11px] text-muted-foreground">Initializing AI Proctoring Models...</p>
                    </div>
                  ) : null}

                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover z-10"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover z-20 pointer-events-none"
                  />
                  
                  {/* Visual Waveform Overlay for Microphone */}
                  <div className="absolute bottom-2.5 right-2.5 z-30 flex items-end gap-0.5 h-6 bg-black/40 p-1 rounded">
                    <div className="w-1 bg-brand-500 rounded-full animate-bounce h-3" />
                    <div className="w-1 bg-brand-500 rounded-full animate-bounce h-5" style={{ animationDelay: '0.1s' }} />
                    <div className="w-1 bg-brand-500 rounded-full animate-bounce h-2" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1 bg-brand-500 rounded-full animate-bounce h-4" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Volume2 className="size-3.5" /> Mic Input level:
                  </span>
                  <span className="font-semibold text-emerald-600">Verifying...</span>
                </div>

                <hr />

                {/* Info and Timer Widget */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Active Assessment Round:</span>
                    <span className="font-semibold text-foreground">{session.rounds.find(r => r.roundId === activeRoundId)?.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Round Timer Countdown:</span>
                    <span className="font-bold font-mono text-brand-600 text-sm">{formatTime(timeLeft)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Session Integrity Warnings:</span>
                    <span className={`font-semibold ${violationsCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {violationsCount} / {maxViolations} violations
                    </span>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Tab Switched Warning overlay */}
            {showWarningAlert && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                  <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold">Security Violation Detected</h5>
                    <p className="mt-0.5 leading-relaxed">{lastWarningMsg}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="destructive" onClick={() => setShowWarningAlert(false)}>
                    Acknowledge Warning
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Question Workspace */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="shadow-lg border-border">
              <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-1.5">
                    <FileQuestion className="size-5 text-brand-600" />
                    Question {currentQIndex + 1} of {questions.length}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">Round {activeRoundId}: {activeRoundId === 1 ? 'Logic & Aptitude' : activeRoundId === 2 ? 'Technical Coding' : 'HR Fit'}</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">{activeQuestion.category}</Badge>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                
                {/* Question Text */}
                <div className="p-4 rounded-xl border bg-muted/20">
                  <h3 className="text-sm font-semibold text-foreground leading-relaxed">{activeQuestion.questionText}</h3>
                </div>

                {/* ROUND 1: MCQ Options */}
                {activeQuestion.type === 'MCQ' && activeQuestion.options && (
                  <div className="grid gap-3">
                    {activeQuestion.options.map((opt, idx) => {
                      const isSelected = selectedMCQOption === opt
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!currentEvaluation) setSelectedMCQOption(opt)
                          }}
                          disabled={!!currentEvaluation}
                          className={`w-full rounded-xl border p-3.5 text-left text-xs leading-relaxed transition ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-foreground font-semibold shadow-sm'
                              : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`size-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                              isSelected ? 'border-brand-500 bg-brand-500 text-white' : 'border-muted-foreground'
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span>{opt}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* ROUND 2 & 3: Free-Text Response */}
                {activeQuestion.type === 'FREE_TEXT' && (
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea
                        value={answerText}
                        onChange={(e) => {
                          if (!currentEvaluation) setAnswerText(e.target.value)
                        }}
                        disabled={!!currentEvaluation}
                        rows={7}
                        placeholder="Type your response detailed here..."
                        className="w-full rounded-xl border bg-background p-4 text-xs text-foreground outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition leading-relaxed"
                      />
                      
                      {/* Audio mic dictation simulation */}
                      {!currentEvaluation && (
                        <div className="absolute bottom-3 right-3">
                          <Button
                            size="sm"
                            variant={isRecording ? 'destructive' : 'outline'}
                            onClick={toggleRecording}
                            className="rounded-full flex items-center gap-1.5 py-1 px-3"
                          >
                            <Mic className={`size-3.5 ${isRecording ? 'animate-bounce' : ''}`} />
                            <span className="text-[10px]">
                              {isRecording ? `Dictating... (${recordingTimer}s)` : 'Speak Answer'}
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  {!currentEvaluation ? (
                    <Button
                      onClick={handleSubmitAnswer}
                      loading={evaluating}
                      disabled={activeQuestion.type === 'MCQ' ? !selectedMCQOption : !answerText.trim()}
                      leftIcon={<Send className="size-3.5" />}
                      className="rounded-xl px-5"
                    >
                      Submit Response for Grading
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      rightIcon={<ChevronRight className="size-3.5" />}
                      className="rounded-xl px-6"
                    >
                      {currentQIndex < questions.length - 1 
                        ? 'Next Question' 
                        : activeRoundId < 3 
                          ? `Proceed to Round ${activeRoundId + 1}` 
                          : 'Compile Final Report'}
                    </Button>
                  )}
                </div>

                {/* Grade and Instant Evaluation Feedback display */}
                {currentEvaluation && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between border-b pb-2 border-emerald-200/50">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="size-4" /> AI Proctor Feedback
                      </span>
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                        {currentEvaluation.score} / 10
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed pt-1">{currentEvaluation.instantFeedback}</p>
                    
                    <div className="grid gap-2 grid-cols-3 pt-2 text-[10px] text-muted-foreground border-t border-emerald-200/40">
                      <div>Accuracy: <strong className="text-foreground">{currentEvaluation.evaluatedCriteria.technicalAccuracy}/10</strong></div>
                      <div>Clarity: <strong className="text-foreground">{currentEvaluation.evaluatedCriteria.clarity}/10</strong></div>
                      <div>Relevance: <strong className="text-foreground">{currentEvaluation.evaluatedCriteria.relevanceToRole}/10</strong></div>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 4. TERMINATED STEP */}
      {step === 'terminated' && (
        <Card className="max-w-xl mx-auto shadow-xl border-red-200 bg-red-50/50 dark:bg-red-950/10">
          <CardContent className="pt-8 text-center space-y-5">
            <ShieldAlert className="size-16 text-red-600 mx-auto animate-bounce" />
            <h2 className="text-lg font-bold text-red-800 dark:text-red-400">Interview Session Terminated</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
              Leaving the assessment frame, swapping tabs, or un-focusing the window is strictly prohibited. Security systems detected multiple focus violations, and your session has been auto-flagged.
            </p>
            <div className="rounded-xl border border-red-200 bg-white dark:bg-slate-900/60 p-4 max-w-sm mx-auto text-xs text-left">
              <div className="flex justify-between"><span>Violations Count:</span><strong className="text-red-600">3 (Limit Exceeded)</strong></div>
              <div className="flex justify-between mt-1"><span>Proctor Status:</span><strong className="text-red-600 font-mono">DISQUALIFIED</strong></div>
            </div>
            <div className="pt-4">
              <Button onClick={() => setStep('setup')} variant="outline" className="rounded-xl">
                Return to Assessment Hub
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. SCORECARD STEP */}
      {step === 'scorecard' && scorecard && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <Card className="shadow-xl border-border bg-card">
            <CardHeader className="border-b pb-6 text-center space-y-2">
              <div className="size-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="size-7" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Proctored AI Assessment Scorecard</CardTitle>
                <CardDescription className="text-xs">Mock Interview Report summary for session {scorecard.sessionId}</CardDescription>
              </div>
              <div className="inline-block px-3 py-1 bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400 rounded-full font-bold text-xs">
                {scorecard.hiringRecommendation}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* Progress and scores grid */}
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-muted/20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Aptitude Score</span>
                  <span className="text-2xl font-black text-foreground mt-2">{scorecard.roundBreakdown.aptitudeScore}%</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-muted/20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Technical Score</span>
                  <span className="text-2xl font-black text-foreground mt-2">{scorecard.roundBreakdown.technicalScore}%</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-muted/20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">HR & Behavioral Score</span>
                  <span className="text-2xl font-black text-foreground mt-2">{scorecard.roundBreakdown.hrScore}%</span>
                </div>
              </div>

              {/* Strengths and Weaknesses */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-500" /> Key Strengths Observed
                  </h4>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5">
                    {scorecard.strengths.map((st, idx) => <li key={idx}>{st}</li>)}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-amber-500" /> Focus Improvement Areas
                  </h4>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5">
                    {scorecard.improvementAreas.map((imp, idx) => <li key={idx}>{imp}</li>)}
                  </ul>
                </div>
              </div>

              <hr />

              {/* Integrity status widgets */}
              <div className="flex flex-col sm:flex-row justify-between text-xs text-muted-foreground gap-3">
                <div>Proctor Integrity Status: <strong className="text-foreground font-mono">{scorecard.proctorStatus}</strong></div>
                <div>Total Proctor Warnings Logged: <strong className="text-foreground">{scorecard.totalViolationsLogged} warnings</strong></div>
              </div>

              <div className="pt-4 flex justify-center">
                <Button onClick={() => setStep('setup')} className="rounded-xl px-6">
                  Practice Another Interview
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
