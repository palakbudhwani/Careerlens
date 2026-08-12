import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  LoaderCircle,
  AlertCircle,
} from 'lucide-react';

import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Login using the email and password entered by the user
      await login({
        email: email.trim(),
        password,
      });

      // AuthContext saves the JWT and user information
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your email and password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Welcome back
          </CardTitle>

          <CardDescription className="text-sm leading-6">
            Sign in to access your personalized career analysis dashboard
            &amp; job matches.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ─────────────────────────────────────────────
              ERROR MESSAGE
          ───────────────────────────────────────────── */}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────
              LOGIN FORM
          ───────────────────────────────────────────── */}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="email"
                className="text-xs font-semibold text-foreground"
              >
                Email address
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />

                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card/60 py-2 pl-9 pr-3.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-foreground"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole className="absolute left-3 top-2.5 size-4 text-muted-foreground" />

                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card/60 py-2 pl-9 pr-3.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              className="w-full font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Sign In
                  <ArrowRight className="size-4" />
                </span>
              )}
            </Button>
          </form>

          {/* ─────────────────────────────────────────────
              SIGN UP
          ───────────────────────────────────────────── */}

          <p className="pt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Sign up now
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}