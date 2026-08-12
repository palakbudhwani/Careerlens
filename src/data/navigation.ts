import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Clock,
  Gauge,
  GitCompare,
  LayoutDashboard,
  ScanSearch,
  Settings,
  TrendingUp,
  UserCog,
  Video,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Discover',
    items: [
      { label: 'Jobs', to: '/jobs', icon: Briefcase },
      { label: 'Match Analysis', to: '/match', icon: ScanSearch },
      { label: 'Mock Interview', to: '/mock-interview', icon: Video },
      { label: 'Skill Gaps', to: '/skill-gaps', icon: Gauge },
      { label: 'Career Growth', to: '/career-growth', icon: TrendingUp },
      { label: 'Compare Jobs', to: '/compare', icon: GitCompare },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'History', to: '/history', icon: Clock },
      { label: 'Profile', to: '/profile', icon: UserCog },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

export const mobileNavGroups = navGroups