import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { clearPersistedResumeData } from './lib/resume-store'
import './index.css'

// Fresh sessions start empty: drop any previously persisted resume data and
// the analysis results derived from it before the app renders.
clearPersistedResumeData()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)