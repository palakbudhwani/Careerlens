import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, Mail, LockKeyhole, User, Briefcase, ArrowRight, LoaderCircle, AlertCircle } from 'lucide-react'

import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/auth-context'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [targetRole, setTargetRole] = useState('Senior Frontend Engineer (AI Products)')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) {
      setError('Please fill in all required fields.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await signup({ name, email, password, targetRole })
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-md shadow-xl border-border/60 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-400">
            <UserPlus className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold font-display tracking-tight">Create your account</CardTitle>
          <CardDescription>
            Join CareerLens to get AI-powered career readiness scoring, job matches & gap analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-foreground">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card/60 pl-9 pr-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-foreground">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="priya@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card/60 pl-9 pr-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-foreground">Target Role</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Engineer (AI Products)"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card/60 pl-9 pr-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-foreground">Password</label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card/60 pl-9 pr-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full font-medium mt-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" /> Creating account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Create Account <ArrowRight className="size-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground pt-2">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}