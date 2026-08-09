import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'

import { ThemeProvider } from '@/lib/theme'
import AppRoutes from '@/routes'

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  )
}