import { Settings } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/hooks/use-theme'

const features: PlaceholderFeature[] = [
  {
    label: 'Appearance',
    description: 'Light, dark, or system — including accent and density options.',
  },
  {
    label: 'Notifications',
    description: 'Choose which match and gap alerts you want, and where they appear.',
  },
  {
    label: 'Report preferences',
    description: 'Defaults for currency, seniority level, and what reports include.',
  },
]

function SettingsPreview() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Dark mode</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Theme is applied instantly and remembered on this device.
            </p>
          </div>
          <Switch checked={theme !== 'light'} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Notification emails</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The notifications preference is part of the settings milestone.
            </p>
          </div>
          <Select defaultValue="daily" aria-label="Notification frequency" className="w-36">
            <option value="realtime">Realtime</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly</option>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Appearance, notifications, and report preferences."
      icon={Settings}
      preview={<SettingsPreview />}
      features={features}
      context="The toggle above is fully functional — theme changes apply across the entire app and persist locally."
    />
  )
}