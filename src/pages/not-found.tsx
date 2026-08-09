import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That route does not exist in the CareerLens foundation build."
        action={
          <Link to="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    </div>
  )
}