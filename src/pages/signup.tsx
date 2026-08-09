import { UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Registration is planned for the authentication milestone. The demo workspace is already
            open for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-4 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <UserPlus className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">Sign-up is coming soon</p>
            <p className="text-xs text-muted-foreground">
              Explore CareerLens with the seeded demo candidate in the meantime.
            </p>
          </div>
          <Link to="/dashboard" className="block">
            <Button className="w-full">Explore the demo</Button>
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}