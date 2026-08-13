import { useEffect, useId, useState } from 'react'
import {
  Settings,
  Globe,
  Palette,
  Bell,
  Shield,
  Sliders,
  Database,
  Search,
  Save,
  RotateCcw,
  Download,
  Trash2,
  CheckCircle2,
  Moon,
  Sun,
  Laptop,
  Smartphone,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/use-theme'

// Interface for all persisted user settings
interface UserSettings {
  // General & Regional
  language: string
  currency: string
  timezone: string
  dateFormat: string
  defaultLocation: string

  // Appearance
  density: 'comfortable' | 'compact'
  accentColor: 'indigo' | 'emerald' | 'violet' | 'amber' | 'slate'
  reducedMotion: boolean

  // Notifications
  emailNotifications: boolean
  digestFrequency: 'realtime' | 'daily' | 'weekly' | 'never'
  jobMatchAlerts: boolean
  skillGapAlerts: boolean
  mockInterviewReminders: boolean
  productUpdates: boolean

  // Privacy & Security
  profileVisibility: 'public' | 'network' | 'private'
  twoFactorAuth: boolean
  sessionTimeout: '15m' | '30m' | '1h' | '4h' | 'never'
  analyticsOptIn: boolean

  // App & Career Lens Defaults
  matchSensitivity: 'strict' | 'moderate' | 'flexible'
  defaultSeniority: 'all' | 'entry' | 'mid' | 'senior' | 'lead' | 'executive'
  autoAnalyzeResume: boolean
  autoSaveReports: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  language: 'en-US',
  currency: 'USD',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  defaultLocation: 'Remote',

  density: 'comfortable',
  accentColor: 'indigo',
  reducedMotion: false,

  emailNotifications: true,
  digestFrequency: 'daily',
  jobMatchAlerts: true,
  skillGapAlerts: true,
  mockInterviewReminders: true,
  productUpdates: false,

  profileVisibility: 'network',
  twoFactorAuth: false,
  sessionTimeout: '1h',
  analyticsOptIn: true,

  matchSensitivity: 'moderate',
  defaultSeniority: 'all',
  autoAnalyzeResume: true,
  autoSaveReports: true,
}

const STORAGE_KEY = 'careerlens.settings'

type SettingsTab = 'general' | 'appearance' | 'notifications' | 'privacy' | 'defaults' | 'data'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  // State management
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      }
    } catch {
      // Fallback on storage error
    }
    return DEFAULT_SETTINGS
  })

  const [initialSettings, setInitialSettings] = useState<UserSettings>(settings)
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [searchQuery, setSearchQuery] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Unique IDs for form controls
  const langSelectId = useId()
  const currSelectId = useId()
  const tzSelectId = useId()
  const dfSelectId = useId()
  const locInputId = useId()
  const densitySelectId = useId()
  const digestSelectId = useId()
  const visibilitySelectId = useId()
  const timeoutSelectId = useId()
  const matchSensSelectId = useId()
  const senioritySelectId = useId()

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings)

  // Auto-hide toast notifications
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const handleUpdate = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setInitialSettings(settings)
      setSaveSuccess(true)
      setToastMessage('All settings saved successfully.')
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setToastMessage('Error saving settings to local storage.')
    }
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
    setInitialSettings(DEFAULT_SETTINGS)
    setToastMessage('Settings restored to default values.')
  }

  const handleDiscard = () => {
    setSettings(initialSettings)
    setToastMessage('Unsaved changes discarded.')
  }

  const handleExportData = () => {
    try {
      const dataToExport = {
        settings,
        exportedAt: new Date().toISOString(),
        user_name: localStorage.getItem('careerlens.user_name') || 'Guest User',
        user_email: localStorage.getItem('careerlens.user_email') || '',
      }
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `careerlens_settings_backup_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setToastMessage('Backup configuration file downloaded.')
    } catch {
      setToastMessage('Failed to export settings data.')
    }
  }

  const handleClearCache = () => {
    try {
      const keysToKeep = ['careerlens.user_name', 'careerlens.user_email', STORAGE_KEY]
      const currentKeys = Object.keys(localStorage)
      currentKeys.forEach((key) => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key)
        }
      })
      setShowClearConfirm(false)
      setToastMessage('Local cache and history cleared successfully.')
    } catch {
      setToastMessage('Error clearing local cache.')
    }
  }

  const tabs: { id: SettingsTab; label: string; icon: typeof Globe; description: string }[] = [
    { id: 'general', label: 'General & Region', icon: Globe, description: 'Language, currency & location' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Themes, density & colors' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email alerts & digest frequency' },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield, description: 'Visibility, 2FA & sessions' },
    { id: 'defaults', label: 'App Defaults', icon: Sliders, description: 'Match sensitivity & AI rules' },
    { id: 'data', label: 'Data & Backup', icon: Database, description: 'Export, backup & cache reset' },
  ]

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true
    return text.toLowerCase().includes(searchQuery.toLowerCase())
  }

  return (
    <div className="relative space-y-6 pb-20">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-primary/20 bg-card px-4 py-3 text-sm shadow-xl animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="size-5 text-primary shrink-0" />
          <span className="font-medium text-foreground">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Settings"
        description="Manage your account preferences, notifications, theme styling, security rules, and data."
        icon={Settings}
        badge={
          <Badge variant="primary" dot>
            General Preferences
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="size-3.5" />}
              onClick={handleExportData}
            >
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="size-3.5" />}
              onClick={handleReset}
            >
              Reset Defaults
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="size-3.5" />}
              onClick={handleSave}
              disabled={!isDirty && !saveSuccess}
            >
              {saveSuccess ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {/* Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Tabs & Content Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3">
          <nav className="flex flex-row overflow-x-auto lg:flex-col gap-1 rounded-xl border border-border bg-card p-1.5 shadow-xs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  <div className="hidden lg:block min-w-0">
                    <p className="truncate leading-none">{tab.label}</p>
                    <p className={`mt-1 truncate text-xs font-normal ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      {tab.description}
                    </p>
                  </div>
                  <span className="lg:hidden truncate">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Settings Panels */}
        <div className="space-y-6 lg:col-span-9">
          {/* TAB 1: GENERAL & REGIONAL */}
          {(activeTab === 'general' || searchQuery) && matchesSearch('general language currency timezone location date') && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="size-5 text-primary" />
                  <CardTitle>General & Regional Preferences</CardTitle>
                </div>
                <CardDescription>
                  Configure your language, default region, time zone, and currency display settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={langSelectId}>Display Language</Label>
                    <Select
                      id={langSelectId}
                      value={settings.language}
                      onChange={(e) => handleUpdate('language', e.target.value)}
                    >
                      <option value="en-US">English (United States)</option>
                      <option value="en-GB">English (United Kingdom)</option>
                      <option value="es-ES">Spanish (Español)</option>
                      <option value="fr-FR">French (Français)</option>
                      <option value="de-DE">German (Deutsch)</option>
                      <option value="ja-JP">Japanese (日本語)</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={currSelectId}>Preferred Currency</Label>
                    <Select
                      id={currSelectId}
                      value={settings.currency}
                      onChange={(e) => handleUpdate('currency', e.target.value)}
                    >
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="CAD">CAD ($) - Canadian Dollar</option>
                      <option value="AUD">AUD ($) - Australian Dollar</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={tzSelectId}>Time Zone</Label>
                    <Select
                      id={tzSelectId}
                      value={settings.timezone}
                      onChange={(e) => handleUpdate('timezone', e.target.value)}
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">Eastern Time (US & Canada)</option>
                      <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                      <option value="Europe/London">London (GMT / BST)</option>
                      <option value="Europe/Paris">Central European Time (CET)</option>
                      <option value="Asia/Kolkata">India Standard Time (IST)</option>
                      <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={dfSelectId}>Date Format</Label>
                    <Select
                      id={dfSelectId}
                      value={settings.dateFormat}
                      onChange={(e) => handleUpdate('dateFormat', e.target.value)}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/14/2026)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 14/08/2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-14)</option>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor={locInputId}>Default Job Target Location</Label>
                  <Input
                    id={locInputId}
                    type="text"
                    placeholder="e.g. San Francisco, CA or Remote"
                    value={settings.defaultLocation}
                    onChange={(e) => handleUpdate('defaultLocation', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This location will automatically populate your job search filters and salary insight comparisons.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: APPEARANCE & CUSTOMIZATION */}
          {(activeTab === 'appearance' || searchQuery) && matchesSearch('appearance theme dark light accent motion density') && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="size-5 text-primary" />
                  <CardTitle>Appearance & Styling</CardTitle>
                </div>
                <CardDescription>
                  Tailor the visual theme, spacing density, motion settings, and interface accents.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Mode Selector */}
                <div className="space-y-3">
                  <Label>Interface Theme</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all ${
                        theme === 'light'
                          ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <Sun className="size-6" />
                      <span className="text-sm font-medium">Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <Moon className="size-6" />
                      <span className="text-sm font-medium">Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all ${
                        theme === 'system'
                          ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <Laptop className="size-6" />
                      <span className="text-sm font-medium">System</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Theme mode is applied instantly across all workspace pages and remembered on this browser.
                  </p>
                </div>

                <Separator />

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={densitySelectId}>Layout Density</Label>
                    <Select
                      id={densitySelectId}
                      value={settings.density}
                      onChange={(e) => handleUpdate('density', e.target.value as 'comfortable' | 'compact')}
                    >
                      <option value="comfortable">Comfortable (Standard padding)</option>
                      <option value="compact">Compact (Tighter lists & cards)</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Accent Color Tint</Label>
                    <div className="flex items-center gap-3 pt-1">
                      {(['indigo', 'emerald', 'violet', 'amber', 'slate'] as const).map((color) => {
                        const colorMap = {
                          indigo: 'bg-indigo-600',
                          emerald: 'bg-emerald-600',
                          violet: 'bg-violet-600',
                          amber: 'bg-amber-600',
                          slate: 'bg-slate-600',
                        }
                        const isSelected = settings.accentColor === color
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => handleUpdate('accentColor', color)}
                            className={`size-7 rounded-full ${colorMap[color]} transition-transform ${
                              isSelected ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                            }`}
                            aria-label={`Select ${color} accent`}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Reduced Motion</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Minimize fluid animations and transitions for improved system efficiency.
                    </p>
                  </div>
                  <Switch
                    checked={settings.reducedMotion}
                    onCheckedChange={(checked) => handleUpdate('reducedMotion', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: NOTIFICATIONS & ALERTS */}
          {(activeTab === 'notifications' || searchQuery) && matchesSearch('notifications email digest alert matches gap interview product') && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="size-5 text-primary" />
                  <CardTitle>Notification Preferences</CardTitle>
                </div>
                <CardDescription>
                  Choose how and when CareerLens delivers match reports, skill gap alerts, and updates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Master Email Notifications</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Enable or pause all automated email communications.
                    </p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => handleUpdate('emailNotifications', checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor={digestSelectId}>Email Digest Frequency</Label>
                  <Select
                    id={digestSelectId}
                    value={settings.digestFrequency}
                    onChange={(e) => handleUpdate('digestFrequency', e.target.value as UserSettings['digestFrequency'])}
                    disabled={!settings.emailNotifications}
                  >
                    <option value="realtime">Real-time (Instant as alerts trigger)</option>
                    <option value="daily">Daily Digest (Summary once per day)</option>
                    <option value="weekly">Weekly Digest (Summary every Monday)</option>
                    <option value="never">Never (Mute email notifications)</option>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Job Match Score Alerts</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Notify me when a high-priority job match exceeding 80% is discovered.
                      </p>
                    </div>
                    <Switch
                      checked={settings.jobMatchAlerts && settings.emailNotifications}
                      disabled={!settings.emailNotifications}
                      onCheckedChange={(checked) => handleUpdate('jobMatchAlerts', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Skill Gap Recommendations</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Alert me when new target role skills are identified for my learning roadmap.
                      </p>
                    </div>
                    <Switch
                      checked={settings.skillGapAlerts && settings.emailNotifications}
                      disabled={!settings.emailNotifications}
                      onCheckedChange={(checked) => handleUpdate('skillGapAlerts', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Mock Interview Reminders</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Send preparation tips and reminders before scheduled practice sessions.
                      </p>
                    </div>
                    <Switch
                      checked={settings.mockInterviewReminders && settings.emailNotifications}
                      disabled={!settings.emailNotifications}
                      onCheckedChange={(checked) => handleUpdate('mockInterviewReminders', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Product Updates & Tips</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Receive news on newly launched AI features, templates, and career advice.
                      </p>
                    </div>
                    <Switch
                      checked={settings.productUpdates && settings.emailNotifications}
                      disabled={!settings.emailNotifications}
                      onCheckedChange={(checked) => handleUpdate('productUpdates', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: PRIVACY & SECURITY */}
          {(activeTab === 'privacy' || searchQuery) && matchesSearch('privacy security visibility 2fa session analytics device') && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="size-5 text-primary" />
                  <CardTitle>Privacy & Security</CardTitle>
                </div>
                <CardDescription>
                  Manage account visibility, authentication security, session timeouts, and data sharing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor={visibilitySelectId}>Profile & Resume Visibility</Label>
                  <Select
                    id={visibilitySelectId}
                    value={settings.profileVisibility}
                    onChange={(e) => handleUpdate('profileVisibility', e.target.value as UserSettings['profileVisibility'])}
                  >
                    <option value="public">Public - Visible to all verified recruiters</option>
                    <option value="network">Network Only - Visible to matched companies</option>
                    <option value="private">Private - Completely hidden (Only visible to you)</option>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label>Two-Factor Authentication (2FA)</Label>
                      {settings.twoFactorAuth ? (
                        <Badge variant="primary">Enabled</Badge>
                      ) : (
                        <Badge variant="neutral">Disabled</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Require an authenticator app code during sign in for enhanced protection.
                    </p>
                  </div>
                  <Switch
                    checked={settings.twoFactorAuth}
                    onCheckedChange={(checked) => {
                      handleUpdate('twoFactorAuth', checked)
                      setToastMessage(checked ? 'Two-Factor Authentication enabled.' : 'Two-Factor Authentication disabled.')
                    }}
                  />
                </div>

                <Separator />

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={timeoutSelectId}>Automatic Session Timeout</Label>
                    <Select
                      id={timeoutSelectId}
                      value={settings.sessionTimeout}
                      onChange={(e) => handleUpdate('sessionTimeout', e.target.value as UserSettings['sessionTimeout'])}
                    >
                      <option value="15m">15 Minutes of Inactivity</option>
                      <option value="30m">30 Minutes of Inactivity</option>
                      <option value="1h">1 Hour of Inactivity</option>
                      <option value="4h">4 Hours of Inactivity</option>
                      <option value="never">Never (Stay signed in)</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Analytics & Usage Data</Label>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">Share anonymous diagnostic data</span>
                      <Switch
                        checked={settings.analyticsOptIn}
                        onCheckedChange={(checked) => handleUpdate('analyticsOptIn', checked)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Active Sessions */}
                <div className="space-y-3">
                  <Label>Active Sessions & Devices</Label>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Smartphone className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Windows PC · Chrome Browser</p>
                        <p className="text-xs text-muted-foreground">Current Session — Active Now (Local IP)</p>
                      </div>
                    </div>
                    <Badge variant="primary">Current Device</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: APPLICATION DEFAULTS */}
          {(activeTab === 'defaults' || searchQuery) && matchesSearch('defaults match sensitivity seniority ai resume analysis report') && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sliders className="size-5 text-primary" />
                  <CardTitle>Application & Career Lens Defaults</CardTitle>
                </div>
                <CardDescription>
                  Configure automated AI resume scoring behavior, default filters, and report saving rules.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={matchSensSelectId}>Match Score Sensitivity</Label>
                    <Select
                      id={matchSensSelectId}
                      value={settings.matchSensitivity}
                      onChange={(e) => handleUpdate('matchSensitivity', e.target.value as UserSettings['matchSensitivity'])}
                    >
                      <option value="strict">Strict (High similarity threshold 85%+)</option>
                      <option value="moderate">Moderate (Balanced threshold 70%+)</option>
                      <option value="flexible">Flexible (Broad match threshold 50%+)</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={senioritySelectId}>Default Seniority Filter</Label>
                    <Select
                      id={senioritySelectId}
                      value={settings.defaultSeniority}
                      onChange={(e) => handleUpdate('defaultSeniority', e.target.value as UserSettings['defaultSeniority'])}
                    >
                      <option value="all">All Seniority Levels</option>
                      <option value="entry">Entry-Level / Junior</option>
                      <option value="mid">Mid-Level</option>
                      <option value="senior">Senior Level</option>
                      <option value="lead">Team Lead / Manager</option>
                      <option value="executive">Director / Executive</option>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label>Automatic AI Resume Parsing</Label>
                        <Sparkles className="size-3.5 text-primary" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Automatically extract work history and skill scores immediately upon drag-and-drop file upload.
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoAnalyzeResume}
                      onCheckedChange={(checked) => handleUpdate('autoAnalyzeResume', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Auto-Save Generated Reports</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Save all skill gap and resume comparison reports to your History tab automatically.
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoSaveReports}
                      onCheckedChange={(checked) => handleUpdate('autoSaveReports', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 6: DATA MANAGEMENT & BACKUP */}
          {(activeTab === 'data' || searchQuery) && matchesSearch('data export backup cache clear reset local storage') && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="size-5 text-primary" />
                  <CardTitle>Data Management & Cache</CardTitle>
                </div>
                <CardDescription>
                  Export your saved configurations, clear local cache, or reset workspace defaults.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
                  <div>
                    <Label>Export Account Configuration</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Download a JSON backup containing all your saved preferences, target roles, and settings.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Download className="size-4" />}
                    onClick={handleExportData}
                  >
                    Download JSON
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
                  <div>
                    <Label>Reset Settings to Factory Defaults</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Revert all toggles, regional preferences, and notification rules back to original initial values.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<RotateCcw className="size-4" />}
                    onClick={handleReset}
                  >
                    Reset Defaults
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div>
                    <Label className="text-destructive">Clear Local Workspace Cache</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Remove stored search history, cached reports, and uploaded resume drafts from browser memory.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    leftIcon={<Trash2 className="size-4" />}
                    onClick={() => setShowClearConfirm(true)}
                  >
                    Clear Cache
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Clearing Cache */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md animate-in fade-in zoom-in-95">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                <CardTitle>Clear Local Cache?</CardTitle>
              </div>
              <CardDescription>
                This action will clear all locally stored match history and temporary resume uploads. Your account settings and profile details will remain safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClearCache}>
                Confirm & Clear
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating Unsaved Changes Bar */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-primary/20 bg-card px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary animate-pulse" />
            <span className="text-sm font-medium text-foreground">You have unsaved changes</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Save className="size-3.5" />} onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}