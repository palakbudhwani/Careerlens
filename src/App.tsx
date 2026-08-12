import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'

import { ThemeProvider } from '@/lib/theme'
import { AuthProvider } from '@/context/auth-context'
import AppRoutes from '@/routes'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </MotionConfig>
      </AuthProvider>
    </ThemeProvider>
  )
}