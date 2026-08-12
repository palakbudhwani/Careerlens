import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'

import { ResumeUploadProvider } from '@/components/resume/resume-upload-provider'
import { ThemeProvider } from '@/lib/theme'
import AppRoutes from '@/routes'

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ResumeUploadProvider>
            <AppRoutes />
          </ResumeUploadProvider>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  )
}