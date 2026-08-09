import { LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in with the demo account — real authentication arrives in a later milestone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-4 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <LockKeyhole className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">Authentication is coming soon</p>
            <p className="text-xs text-muted-foreground">
              For now, skip straight into the demo workspace.
            </p>
          </div>
          <Link to="/dashboard" className="block">
            <Button className="w-full">Open dashboard</Button>
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            No account yet?{' '}
            <Link to="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}