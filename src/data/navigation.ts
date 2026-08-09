import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Clock,
  FileText,
  Gauge,
  GitCompare,
  LayoutDashboard,
  ScanSearch,
  Settings,
  TrendingUp,
  UserCog,
  UserRound,
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
      { label: 'Resume Intelligence', to: '/resume', icon: FileText },
      { label: 'Career Profile', to: '/career-profile', icon: UserRound },
    ],
  },
  {
    label: 'Discover',
    items: [
      { label: 'Jobs', to: '/jobs', icon: Briefcase },
      { label: 'Match Analysis', to: '/match', icon: ScanSearch },
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