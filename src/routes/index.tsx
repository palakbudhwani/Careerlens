import { lazy as lazyPage, Suspense, type ReactNode } from 'react'

import { Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/app-layout'
import { LoaderCircle } from 'lucide-react'

const LandingPage = lazyPage(() => import('@/pages/landing'))
const LoginPage = lazyPage(() => import('@/pages/login'))
const SignupPage = lazyPage(() => import('@/pages/signup'))
const DashboardPage = lazyPage(() => import('@/pages/dashboard'))
const ResumePage = lazyPage(() => import('@/pages/resume'))
const CareerProfilePage = lazyPage(() => import('@/pages/career-profile'))
const JobsPage = lazyPage(() => import('@/pages/jobs'))
const JobDetailPage = lazyPage(() => import('@/pages/job-detail'))
const MatchPage = lazyPage(() => import('@/pages/match'))
const SkillGapsPage = lazyPage(() => import('@/pages/skill-gaps'))
const CareerGrowthPage = lazyPage(() => import('@/pages/career-growth'))
const ComparePage = lazyPage(() => import('@/pages/compare'))
const HistoryPage = lazyPage(() => import('@/pages/history'))
const ProfilePage = lazyPage(() => import('@/pages/profile'))
const SettingsPage = lazyPage(() => import('@/pages/settings'))
const NotFoundPage = lazyPage(() => import('@/pages/not-found'))

function PageFallback(): ReactNode {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/career-profile" element={<CareerProfilePage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/match/:jobId" element={<MatchPage />} />
          <Route path="/skill-gaps" element={<SkillGapsPage />} />
          <Route path="/career-growth" element={<CareerGrowthPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}