import { useMemo, useState } from 'react'
import { Copy, Eye, FilePlus as FilePlus2, Pencil, Star, Trash as Trash2, X } from '@phosphor-icons/react'
import { useToast } from '@/context/ToastContext'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'

type TemplateKind = 'receipt' | 'record' | 'announcement' | 'email'
type Template = { id: string; name: string; kind: TemplateKind; subject: string; body: string; isDefault: boolean; updatedAt: string }

const labels: Record<TemplateKind, string> = { receipt: 'Money Receipt Templates', record: 'Record Templates', announcement: 'Announcement Templates', email: 'Email Templates' }
const seed: Template[] = [
  { id: 'receipt-default', name: 'Payment receipt', kind: 'receipt', subject: 'Payment receipt — {{student_name}}', body: 'Hello {{parent_name}},\n\nThank you for your payment of {{amount}} for {{student_name}}.\n\nReceipt no: {{receipt_number}}\nPayment date: {{date}}', isDefault: true, updatedAt: 'Today' },
  { id: 'record-default', name: 'Student record update', kind: 'record', subject: 'Student record update — {{student_name}}', body: 'Hello {{parent_name}},\n\nA new record has been added for {{student_name}}.\n\nRecord: {{record_title}}\nDetails: {{details}}', isDefault: true, updatedAt: 'Today' },
  { id: 'announcement-default', name: 'School announcement', kind: 'announcement', subject: '{{announcement_title}}', body: 'Hello families,\n\n{{announcement_body}}\n\nThank you,\n{{school_name}}', isDefault: true, updatedAt: 'Today' },
  { id: 'email-default', name: 'Operator email', kind: 'email', subject: '{{announcement_title}}', body: 'Hello {{parent_name}},\n\n{{announcement_body}}\n\nThank you,\n{{school_name}}', isDefault: true, updatedAt: 'Today' },
]

function loadTemplates(): Template[] {
  try {
    return JSON.parse(localStorage.getItem('nomcloud-template-studio') ?? '') as Template[]
  } catch {
    return seed
  }
}

export default function AdminTemplates({ kind }: { kind: TemplateKind }) {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<Template[]>(loadTemplates)
  const [editing, setEditing] = useState<Template | null>(null)
  const [preview, setPreview] = useState<Template | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const visible = useMemo(() => templates.filter((template) => template.kind === kind), [templates, kind])
  const persist = (next: Template[]) => {
    setTemplates(next)
    localStorage.setItem('nomcloud-template-studio', JSON.stringify(next))
  }
  const openCreate = () => {
    setEditing({ id: `template-${Date.now()}`, name: `New ${kind} template`, kind, subject: '', body: '', isDefault: false, updatedAt: 'Just now' })
    setFormOpen(true)
  }
  const save = () => {
    if (!editing?.name.trim() || !editing.body.trim()) return
    const exists = templates.some((template) => template.id === editing.id)
    persist(exists ? templates.map((template) => template.id === editing.id ? editing : template) : [...templates, editing])
    setFormOpen(false)
    showToast({ type: 'success', title: 'Template saved', description: `${editing.name} is ready to use.` })
  }
  const duplicate = (template: Template) => {
    const copy = { ...template, id: `template-${Date.now()}`, name: `${template.name} copy`, isDefault: false, updatedAt: 'Just now' }
    persist([...templates, copy])
    showToast({ type: 'success', title: 'Template duplicated' })
  }
  const remove = (template: Template) => {
    persist(templates.filter((item) => item.id !== template.id))
    showToast({ type: 'success', title: 'Template deleted' })
  }
  const setDefault = (template: Template) => {
    persist(templates.map((item) => item.kind === kind ? { ...item, isDefault: item.id === template.id } : item))
    showToast({ type: 'success', title: 'Default template updated' })
  }

  return <div className="max-w-6xl">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Template Studio</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels[kind]}</h1><p className="mt-2 text-sm text-graphite">Create reusable, school-branded templates for your communications.</p></div>
      <Button variant="accent" onClick={openCreate}><FilePlus2 className="h-4 w-4" /> Create template</Button>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {visible.map((template) => <div key={template.id} className="card p-5">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-semibold">{template.name}</h2>{template.isDefault && <Badge tone="brand">Default</Badge>}</div><p className="mt-1 text-xs text-graphite">Updated {template.updatedAt}</p></div><button onClick={() => setDefault(template)} className={`rounded-lg p-2 ${template.isDefault ? 'text-brand' : 'text-graphite hover:text-brand'}`} title="Set as default"><Star className="h-4 w-4" fill={template.isDefault ? 'currentColor' : 'none'} /></button></div>
        <div className="mt-5 rounded-xl border border-[#dbe2eb] bg-white p-4 text-left"><TemplatePreview template={template} compact /></div>
        <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setPreview(template)}><Eye className="h-4 w-4" /> Preview</Button><Button size="sm" variant="ghost" onClick={() => { setEditing(template); setFormOpen(true) }}><Pencil className="h-4 w-4" /> Edit</Button><Button size="sm" variant="ghost" onClick={() => duplicate(template)}><Copy className="h-4 w-4" /> Duplicate</Button><Button size="sm" variant="ghost" onClick={() => remove(template)} disabled={template.isDefault}><Trash2 className="h-4 w-4" /> Delete</Button></div>
      </div>)}
    </div>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing?.id.startsWith('template-') && !templates.some((item) => item.id === editing.id) ? 'Create template' : 'Edit template'} description="Your changes are saved locally in this browser." size="lg" footer={<><Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button><Button variant="accent" onClick={save}>Save template</Button></>}>
      {editing && <div className="space-y-4"><label className="label">Template name<input className="input mt-2" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label className="label">Subject or heading<input className="input mt-2" value={editing.subject} onChange={(event) => setEditing({ ...editing, subject: event.target.value })} /></label><label className="label">Message body<textarea className="input mt-2 min-h-48 resize-y" value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} /></label><p className="text-xs text-graphite">Use placeholders such as <code>{'{{student_name}}'}</code>, <code>{'{{parent_name}}'}</code>, and <code>{'{{school_name}}'}</code>.</p></div>}
    </Modal>
    <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Template preview" description="Example rendering using the attached document style." size="lg">
      {preview && <TemplatePreview template={preview} />}
    </Modal>
  </div>
}

function TemplatePreview({ template, compact = false }: { template: Template; compact?: boolean }) {
  const replacements: Record<string, string> = { student_name: 'Ahmed Abdirahman', parent_name: 'Abdirahman Hassan', school_name: 'Nom Cloud School', amount: '$120.00', receipt_number: 'RC-000124', date: 'September 25, 2026', record_title: 'Attendance update', details: 'Your child’s record is available in the parent portal.', announcement_title: 'School announcement', announcement_body: 'The school will be closed tomorrow for staff development.' }
  const body = template.body.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => replacements[key] ?? `{{${key}}}`)
  return <div className={compact ? 'text-[10px]' : 'mx-auto max-w-xl text-sm'}><div className="border-t-[8px] border-[#e6252a] bg-white px-6 pb-8 pt-6 text-[#536273]"><div className="mb-7 text-center"><img src="/logo-512.png" alt="School logo" className="mx-auto h-20 w-20 object-contain" /><p className="mt-2 text-base font-semibold uppercase tracking-[0.12em] text-[#e6252a]">Nom Cloud School</p></div><h2 className="text-base font-bold text-[#073b82]">{template.subject || template.name}</h2><div className="mt-3 whitespace-pre-line leading-relaxed">{body}</div><p className="mt-6 text-xs">This message was generated from the {template.name} template.</p></div></div>
}
