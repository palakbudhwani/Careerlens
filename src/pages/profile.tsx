import { useEffect, useState } from 'react'
import {
  UserCog,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Save,
  LogOut,
  CheckCircle2,
  ShieldCheck,
  Edit3,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Textarea } from '@/components/ui/textarea'
import { useStoredResume } from '@/lib/resume-store'
import { candidateFromStoredResume } from '@/lib/effective-candidate'

export default function ProfilePage() {
  const storedResume = useStoredResume()
  const candidate = storedResume ? candidateFromStoredResume(storedResume) : null
  const navigate = useNavigate()

  // Profile Form States - default to empty unless user filled or extracted from uploaded resume
  const [name, setName] = useState<string>('')
  const [jobTitle, setJobTitle] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [headline, setHeadline] = useState<string>('')
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)

  useEffect(() => {
    const storedName = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_name') : null
    const storedEmail = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_email') : null
    const storedPhone = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_phone') : null
    const storedCity = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_city') : null
    const storedTitle = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_title') : null
    const storedBio = typeof window !== 'undefined' ? window.localStorage.getItem('careerlens.user_bio') : null

    // Real resume extracted values or user entered values ONLY - zero mock fallbacks
    const resolvedName = storedName || (candidate?.name && candidate.name !== 'User' && candidate.name !== 'Your Profile' ? candidate.name : '')
    const resolvedEmail = storedEmail || candidate?.email || ''
    const resolvedPhone = storedPhone || candidate?.phone || ''
    const resolvedCity = storedCity || candidate?.location || ''
    const resolvedTitle = storedTitle || candidate?.title || candidate?.targetRole || ''
    const resolvedBio = storedBio || candidate?.headline || candidate?.summary || ''

    setName(resolvedName)
    setEmail(resolvedEmail)
    setPhone(resolvedPhone)
    setCity(resolvedCity)
    setJobTitle(resolvedTitle)
    setHeadline(resolvedBio)
  }, [storedResume])

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      window.localStorage.setItem('careerlens.user_name', name.trim())
      window.localStorage.setItem('careerlens.user_email', email.trim())
      window.localStorage.setItem('careerlens.user_phone', phone.trim())
      window.localStorage.setItem('careerlens.user_city', city.trim())
      window.localStorage.setItem('careerlens.user_title', jobTitle.trim())
      window.localStorage.setItem('careerlens.user_bio', headline.trim())

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3500)
    } catch (err) {
      console.error('LocalStorage write error:', err)
    }
  }

  const handleLogout = () => {
    try {
      window.localStorage.removeItem('careerlens.user_name')
      window.localStorage.removeItem('careerlens.user_email')
      window.localStorage.removeItem('careerlens.user_phone')
      window.localStorage.removeItem('careerlens.user_city')
      window.localStorage.removeItem('careerlens.user_title')
      window.localStorage.removeItem('careerlens.user_bio')
      window.localStorage.removeItem('careerlens.skillgaps')
    } catch (err) {
      console.error('Logout cleanup error:', err)
    }
    navigate('/login')
  }

  const getInitials = (n: string) => {
    if (!n || !n.trim()) return '?'
    const parts = n.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  }

  const isProfileEmpty = !name && !email && !phone && !city && !jobTitle

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="User Profile & Settings"
        description="Fill out your profile details below to customize your identity across CareerLens."
        icon={UserCog}
        badge={
          <Badge variant="primary" dot>
            User Managed
          </Badge>
        }
      />

      {/* Profile Helper Banner if empty */}
      {isProfileEmpty && (
        <Card className="border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
          <div className="flex items-start gap-3">
            <Edit3 className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-400" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Your profile information is currently empty
              </p>
              <p className="text-xs text-muted-foreground">
                Please fill in your Full Name, Job Title, Email, Phone, and City below and click <strong>Save Profile Details</strong> to personalize your account!
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Top Identity Card */}
      <Card className="border-border bg-gradient-to-br from-card to-secondary/30 shadow-sm p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-600/15 text-2xl font-extrabold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              {getInitials(name)}
            </span>
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {name || <span className="text-muted-foreground italic font-normal">No Name Entered</span>}
              </h2>
              <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {jobTitle || <span className="text-muted-foreground italic font-normal">No Job Title Set</span>}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="size-3 text-muted-foreground" /> {email || 'No email provided'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-muted-foreground" /> {city || 'No city/location provided'}
                </span>
              </div>
            </div>
          </div>

          <Badge variant={name ? 'success' : 'outline'} className="w-fit text-xs font-semibold">
            <ShieldCheck className="mr-1 size-3.5" /> {name ? 'Active Profile' : 'Incomplete Profile'}
          </Badge>
        </div>
      </Card>

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">
              Fill Your Profile Details
            </CardTitle>
            <CardDescription>
              Enter your real contact details and professional background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prof-name" className="text-xs font-semibold">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="prof-name"
                    type="text"
                    placeholder="e.g. Amardeep Singh"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-title" className="text-xs font-semibold">
                  Job Profile / Target Role
                </Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="prof-title"
                    type="text"
                    placeholder="e.g. Full-Stack Engineer / Software Developer"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-email" className="text-xs font-semibold">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="prof-email"
                    type="email"
                    placeholder="e.g. name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-phone" className="text-xs font-semibold">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="prof-phone"
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="prof-city" className="text-xs font-semibold">
                  City / Location
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="prof-city"
                    type="text"
                    placeholder="e.g. Mumbai, India"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="prof-headline" className="text-xs font-semibold">
                  Bio / Professional Summary
                </Label>
                <Textarea
                  id="prof-headline"
                  rows={3}
                  placeholder="Write a brief description of your technical background, interest areas, or upskilling goals..."
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {saveSuccess ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" /> Profile saved successfully!
                </div>
              ) : (
                <span />
              )}
              <Button type="submit" variant="primary" size="sm">
                <Save className="mr-1.5 size-4" /> Save Profile Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Logout Card */}
      <Card className="border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-foreground">Sign Out of CareerLens</h4>
            <p className="text-xs text-muted-foreground">
              End your active session and return to the Sign In screen.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleLogout}
            className="shrink-0 border-border text-foreground hover:bg-muted/80 hover:text-foreground"
          >
            <LogOut className="mr-2 size-4 text-muted-foreground" /> Sign Out / Logout
          </Button>
        </div>
      </Card>
    </div>
  )
}