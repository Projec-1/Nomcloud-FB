import { Wrench } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'

// ---------------------------------------------------------------------------
// Template studio — not available yet, and honest about it.
//
// This page let an administrator write receipt, record, announcement and email
// templates, and kept them in localStorage under 'nomcloud-template-studio'.
// That meant the templates lived in one person's browser: invisible to
// colleagues, lost when the cache cleared, and never used by anything that
// actually sends a receipt or an email.
//
// There is no templates table, and inventing one is a design decision — a
// template is school-scoped, has a kind, a default per kind, and needs its
// placeholders agreed with whatever renders them. So the page states plainly
// that it is not ready rather than appearing to save work that goes nowhere.
//
// The route and the navigation entries stay, so the work can continue here.
// ---------------------------------------------------------------------------

type TemplateKind = 'receipt' | 'record' | 'announcement' | 'email'

const labels: Record<TemplateKind, string> = {
  receipt: 'Money receipt templates',
  record: 'Record templates',
  announcement: 'Announcement templates',
  email: 'Email templates',
}

export default function AdminTemplates({ kind }: { kind: TemplateKind }) {
  return (
    <div>
      <PageHeader
        title={labels[kind]}
        description="Reusable wording for the documents and messages your school sends."
      />
      <div className="card p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/[0.06] text-graphite dark:bg-white/[0.1]">
          <Wrench className="h-5 w-5" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-ink dark:text-white">Not available yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-graphite">
          Templates are not stored anywhere yet, so anything written here could not be shared with your colleagues or used
          by the receipts and emails Nom Cloud sends. This screen will open once templates have a home in your school&rsquo;s
          records.
        </p>
      </div>
    </div>
  )
}
