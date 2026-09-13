import { useState } from 'react'
import { Save, School, Palette, Bell, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import ResourceGate from '@/components/ui/ResourceGate'
import { deriveResourceState } from '@/lib/resourceState'
import { schoolInitial, updateSchool, type SchoolSettingsUpdate } from '@/services/schoolService'
import type { SchoolRow } from '@/types/auth'

// Phase 8 batch 1. Reads and writes the real public.schools row for the
// signed-in user's own school, replacing the mock settings object.
//
// The logo upload that used to live here has been removed rather than left
// pointing at nothing. It produced a base64 data URL, which SCHEMA_DESIGN
// section F forbids persisting ("bloats every row ... uncacheable by CDN"), and
// the real column is logo_path, a Storage object path. No Storage bucket exists
// in any phase so far (plan section H.6, open decision 10). Keeping an upload
// control that silently discarded its file on reload would be worse than not
// offering one, so the badge now always renders the derived initial.

function toFormState(school: SchoolRow): SchoolSettingsUpdate {
  return {
    name: school.name,
    address: school.address,
    phone: school.phone,
    email: school.email,
    website: school.website,
    primary_color: school.primary_color,
    grading_scale: school.grading_scale,
    timezone: school.timezone,
    attendance_cutoff_time: school.attendance_cutoff_time,
    email_notifications: school.email_notifications,
    sms_notifications: school.sms_notifications,
    parent_portal_enabled: school.parent_portal_enabled,
  }
}

export default function AdminSettings() {
  const { school, refreshSchool, authState } = useAuth()
  const { showToast } = useToast()

  const state = deriveResourceState<SchoolRow>({
    isLoading: authState !== 'ready',
    // Derived from identity, never from the result: no school assignment means
    // there is no school profile to be entitled to.
    canAccess: authState !== 'ready' ? undefined : school !== null,
    data: school,
    isEmpty: () => false,
  })

  return (
    <ResourceGate
      state={state}
      empty={{ title: 'No school profile yet' }}
      deniedHint="School settings are managed by your school's administrator."
    >
      {(loaded) => <SettingsForm school={loaded} onSaved={refreshSchool} showToast={showToast} />}
    </ResourceGate>
  )
}

function SettingsForm({
  school,
  onSaved,
  showToast,
}: {
  school: SchoolRow
  onSaved: (next: SchoolRow) => void
  showToast: ReturnType<typeof useToast>['showToast']
}) {
  const [form, setForm] = useState<SchoolSettingsUpdate>(() => toFormState(school))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateSchool(school.id, form)
      if (!updated) {
        // RLS filters rather than raises, so a refused UPDATE returns no row
        // instead of throwing. A null result is a refusal, not a success.
        showToast({
          type: 'error',
          title: 'Not saved',
          description: "You don't have access to change these settings.",
        })
        return
      }
      onSaved(updated)
      setForm(toFormState(updated))
      showToast({ type: 'success', title: 'Settings saved', description: 'School settings have been updated.' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Could not save settings',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="School Settings"
        description="Manage your school's profile, grading and notification preferences."
        actions={
          <Button onClick={handleSave} disabled={saving} icon={<Save className="h-4 w-4" />}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-brand/10 p-2.5 text-brand">
              <School className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-ink dark:text-white">School Profile</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="label mb-2">School badge</p>
              <p className="mb-3 text-xs text-graphite">
                Shown throughout your dashboard — in the sidebar and top bar — instead of the Nom Cloud logo, so this
                feels like your school's own system. Logo image upload arrives with file storage.
              </p>
              <span
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
                style={{ backgroundColor: form.primary_color }}
              >
                {schoolInitial(form.name)}
              </span>
            </div>
            <Input
              label="School address on the web"
              value={`${school.shortcode}.class.so`}
              readOnly
              disabled
              hint="Your school's permanent web address. Contact support to change it."
            />
            <Input label="School name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input
              label="Address"
              value={form.address ?? ''}
              onChange={(e) => setForm({ ...form, address: e.target.value || null })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                value={form.phone ?? ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value || null })}
              />
              <Input
                label="Email"
                value={form.email ?? ''}
                onChange={(e) => setForm({ ...form, email: e.target.value || null })}
              />
            </div>
            <Input
              label="Website"
              value={form.website ?? ''}
              onChange={(e) => setForm({ ...form, website: e.target.value || null })}
            />
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
              <Palette className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-ink dark:text-white">Academics &amp; Branding</h3>
          </div>
          <div className="space-y-4">
            <Select
              label="Grading scale"
              value={form.grading_scale}
              onChange={(e) => setForm({ ...form, grading_scale: e.target.value as SchoolRow['grading_scale'] })}
            >
              <option value="percentage">Percentage (0–100)</option>
              <option value="letter">Letter Grades (A–D)</option>
              <option value="gpa">GPA (0.0–4.0)</option>
            </Select>
            <Input
              label="Timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              hint="Drives every date the school sees, including attendance days."
            />
            <Input
              label="Attendance cutoff time"
              type="time"
              value={form.attendance_cutoff_time.slice(0, 5)}
              onChange={(e) => setForm({ ...form, attendance_cutoff_time: e.target.value })}
            />
            <div>
              <p className="label mb-2">Brand color</p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Brand color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-11 w-16 cursor-pointer rounded-xl border border-ink/10 dark:border-white/15"
                />
                <span className="text-sm text-graphite">{form.primary_color}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
              <Bell className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-ink dark:text-white">Notifications</h3>
          </div>
          <div className="divide-y divide-ink/5 dark:divide-white/10">
            <Switch
              label="Email notifications"
              description="Send email updates for grades, fees and announcements"
              checked={form.email_notifications}
              onChange={(v) => setForm({ ...form, email_notifications: v })}
            />
            <Switch
              label="SMS notifications"
              description="Send SMS alerts for urgent announcements"
              checked={form.sms_notifications}
              onChange={(v) => setForm({ ...form, sms_notifications: v })}
            />
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-ink dark:text-white">Access</h3>
          </div>
          <Switch
            label="Parent portal access"
            description="Allow parents to log in and view their children's records"
            checked={form.parent_portal_enabled}
            onChange={(v) => setForm({ ...form, parent_portal_enabled: v })}
          />
        </div>
      </div>
    </div>
  )
}
