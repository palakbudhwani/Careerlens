import { useState } from 'react'
import { LogIn, Sparkles, UserPlus, ArrowRight, Lock, Mail, User, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const validateEmail = (emailStr: string): boolean => {
    return /\S+@\S+\.\S+/.test(emailStr)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    // 1. Email format check
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !validateEmail(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. user@example.com).')
      return
    }

    // 2. Name validation on Sign Up
    const trimmedName = name.trim()
    if (mode === 'signup' && !trimmedName) {
      setErrorMsg('Please enter your full name.')
      return
    }

    // 3. Password verification
    const trimmedPassword = password.trim()
    if (!trimmedPassword || trimmedPassword.length < 4) {
      setErrorMsg('Wrong password. Password must be at least 4 characters long.')
      return
    }

    if (mode === 'signin') {
      // Verify saved password if account exists
      try {
        const savedPass = window.localStorage.getItem(`careerlens.pass_${trimmedEmail.toLowerCase()}`)
        const savedName = window.localStorage.getItem(`careerlens.name_${trimmedEmail.toLowerCase()}`)
        
        if (savedPass && savedPass !== trimmedPassword) {
          setErrorMsg('Wrong password. Please try again.')
          return
        }

        // Determine user display name
        const finalName = savedName || trimmedName || trimmedEmail.split('@')[0]
        const formattedName = finalName.charAt(0).toUpperCase() + finalName.slice(1)
        window.localStorage.setItem('careerlens.user_name', formattedName)
        window.localStorage.setItem('careerlens.user_email', trimmedEmail)
      } catch (e) {
        console.error('LocalStorage error:', e)
      }
    } else {
      // Sign Up: save credentials
      const formattedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1)
      try {
        window.localStorage.setItem('careerlens.user_name', formattedName)
        window.localStorage.setItem('careerlens.user_email', trimmedEmail)
        window.localStorage.setItem(`careerlens.pass_${trimmedEmail.toLowerCase()}`, trimmedPassword)
        window.localStorage.setItem(`careerlens.name_${trimmedEmail.toLowerCase()}`, formattedName)
      } catch (e) {
        console.error('LocalStorage error:', e)
      }
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 400)
  }

  const handleDemoClick = () => {
    try {
      if (!window.localStorage.getItem('careerlens.user_name')) {
        window.localStorage.setItem('careerlens.user_name', 'Guest')
      }
    } catch (e) {}
    navigate('/dashboard')
  }

  return (
    <AuthLayout>
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
            <Sparkles className="size-6" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            {mode === 'signin' ? 'Sign in to CareerLens' : 'Create your CareerLens Account'}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {mode === 'signin'
              ? 'Enter your credentials to access AI resume analysis, skill gap mapping, and interview prep.'
              : 'Join CareerLens to analyze your resume, close skill gaps, and accelerate your tech career.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-3">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 rounded-xl bg-secondary p-1 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setErrorMsg(null)
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                mode === 'signin'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LogIn className="size-3.5" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setErrorMsg(null)
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                mode === 'signup'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserPlus className="size-3.5" /> Sign Up
            </button>
          </div>

          {/* Validation Error Banner */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Your Full Name {mode === 'signin' && <span className="text-muted-foreground font-normal">(Optional for Sign In)</span>}
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. Amardeep Singh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 text-xs sm:text-sm"
                  required={mode === 'signup'}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">
                  Password
                </Label>
                {mode === 'signin' && (
                  <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 cursor-pointer hover:underline">
                    Forgot password?
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-xs sm:text-sm"
                  required
                />
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full shadow-md">
              {mode === 'signin' ? 'Sign In & Continue' : 'Create Account & Continue'} <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              Or Instant Demo Access
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleDemoClick}
            className="w-full text-xs font-semibold"
          >
            Explore Demo Account Directly
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setErrorMsg(null)
                  }}
                  className="font-bold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Sign up now
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setErrorMsg(null)
                  }}
                  className="font-bold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Sign in here
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}