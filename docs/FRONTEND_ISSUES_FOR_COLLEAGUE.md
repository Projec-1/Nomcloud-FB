# Nom Cloud — frontend issue list

Read-only review of everything under `src/` (public, admin, teacher, parent, platform) on `main` at commit `e3df610`, 27 Sep 2026. No code was changed to produce this.

Severity: **HIGH** = misleads a user or blocks a task · **MEDIUM** = confusing or inconsistent · **LOW** = cosmetic.

---

## 1. Invented data presented as real

| File | Problem | |
|---|---|---|
| `src/pages/platform/Workspace.tsx:120` | `schoolTimeline` — five made-up events shown in the school **Activity** tab for *every* school, including "Leila Hassan approved the organization application." | HIGH |
| `src/pages/platform/Workspace.tsx:667` | **Documents** tab lists three invented filenames, all "Uploaded Sep 18, 2026 · Verification record", identical for every school. | HIGH |
| `src/pages/platform/Workspace.tsx:667` | **Billing** tab hardcodes "Renewal date Oct 08, 2026 / Billing status Paid / Usage 72% of plan limits". | HIGH |
| `src/pages/platform/Workspace.tsx:667` | **Overview** tab shows a private "Internal operator note: School requested an administrator change. Waiting for verification documents." on every school. | HIGH |
| `src/pages/platform/Workspace.tsx:667` | Users / Requests / Permissions / Audit History tabs render "Mock {tab} … is ready for backend connection." to a live operator. | HIGH |
| `src/pages/platform/Workspace.tsx:259` | `profile?.full_name` falls back to the literal `'Leila Hassan'` — the sidebar (l.319) and header (l.325) show a stranger's name whenever the profile has not loaded. | HIGH |
| `src/pages/app/admin/Tutorials.tsx`, `src/pages/app/teacher/Tutorials.tsx`, `src/pages/app/parent/Tutorials.tsx` | 15 tutorial videos advertised with exact durations ("4:12", "6:03"). None has a `videoUrl`; every click ends in "hasn't been uploaded yet". | HIGH |
| `src/pages/app/parent/Tutorials.tsx:6` | Promises paying fees "by card, mobile money, bank transfer, eDahab or EVC Plus". No payment flow exists. | HIGH |
| `src/components/marketing/previews/*` | Public-page previews contain invented pupil names and fee balances with no "illustration" caption. | LOW |

The Overview tab's plan, student count, teacher count and last activity **are** real — only the items above are fabricated.

## 2. Controls that do nothing

| File | Problem | |
|---|---|---|
| `src/pages/platform/Workspace.tsx:364` | "Emergency controls" says "These actions affect live platform access and will be written to the audit log" — all four red buttons only raise a toast. | HIGH |
| `src/pages/app/admin/Settings.tsx:317–343` | Email notifications / SMS notifications / **Parent portal access** save to the database but nothing reads them. Turning the parent portal off does not block a single parent, and there is no SMS channel. (Enforcement is mine — see the last section. Yours is only not to present them as active.) | HIGH |
| `src/pages/platform/Workspace.tsx:667` | SchoolModal "Request changes" and each Documents "Preview" button only raise a toast. | MEDIUM |
| `src/pages/platform/Workspace.tsx:456, 524` | "Export report" and "Export logs" look enabled, then say "not available yet". | MEDIUM |
| `src/components/layout/PublicFooter.tsx:172` | Four social icons, all `href="#"`. | MEDIUM |

## 3. Dead or wrong navigation

| File | Problem | |
|---|---|---|
| `src/App.tsx:227,231` | `/app/parent/fees` and `/app/parent/tutorials` are routed but appear in no menu and in no link anywhere in `src/`. The fees page is finished and works — a parent can never reach it. | HIGH |
| `src/components/dashboard/navConfig.ts:34–53` | 19 teacher menu items, 6 distinct destinations. `my-day`→Dashboard, `assignments`→Homework, `lessons`→Timetable, `progress` and `class-performance`→Grades, `students`→Classes, and `resources`/`exams`/`notifications`/`profile` all→the same tabbed Workspace. Clicking a different item often shows the same screen. | HIGH |
| `src/components/dashboard/navConfig.ts:41–42` | "Homework" and "Assignments" share both the icon (`ClipboardCheck`) and the page. | MEDIUM |
| `src/App.tsx:147–148` | "Email Templates" and "Announcement Templates" both render `kind="announcement"` — two names, one screen. | MEDIUM |
| `src/components/layout/PublicFooter.tsx:30–32` | Footer "Admin Dashboard", "Teacher Portal" and "Parent App" all point at `/signup`. | MEDIUM |
| `src/App.tsx:72`, `src/pages/platform/Placeholder.tsx` | `PlatformPlaceholder` is imported and never used; the page file is dead. | LOW |

## 4. Inconsistent design — please pick one version

| Both versions | |
|---|---|
| **School detail modal:** the inline `SchoolModal` in `src/pages/platform/Workspace.tsx:664` (the invented tabs above) **vs** `src/pages/platform/SchoolProfileModal.tsx` (307 lines, real data, honest empty states) — which is never imported anywhere. Switching to the second one fixes most of section 1. | HIGH |
| **Destructive confirmation:** `ConfirmDialog` in all 8 admin pages **vs** `Workspace.tsx:667` "Suspend school", which suspends a whole school on one click with no confirmation. | HIGH |
| **Request modal:** the inline `RequestModal` in `Workspace.tsx:684` **vs** the unused `src/pages/platform/RequestReviewModal.tsx` (251 lines). | MEDIUM |
| **Empty state:** `src/components/ui/EmptyState.tsx` (21 files) **vs** a bare `<p className="text-sm text-graphite">No …</p>` (all of `platform/`, plus `teacher/Dashboard.tsx`, `admin/Reports.tsx`, `admin/AcademicYears.tsx`). | MEDIUM |
| **Loading state:** the `ui/ResourceGate` skeleton (36 pages) **vs** plain `<p>Loading schools…</p>` (`Workspace.tsx:328, 330, 334, 336`). | MEDIUM |
| **Buttons:** `<Button variant="accent">` (30 files) **vs** raw `className="btn-accent …"` (14 files), which loses the loading spinner, the disabled styling and the touch height. | MEDIUM |
| **Page headers:** `ui/PageHeader` (37 files) **vs** `SectionHeader` (`Workspace.tsx:370`) **vs** a local `Header` (`teacher/Workspace.tsx:50`). | MEDIUM |
| **Tables:** `<table>` + `min-w-[…]` + `overflow-x-auto` (7 admin pages) **vs** hand-built `div` rows (platform, teacher, parent). | MEDIUM |
| `src/pages/platform/Workspace.tsx:370` | `SectionHeader` declares `eyebrow` as a required prop and never renders it, so every platform eyebrow ("Platform overview", "Traceability", …) is silently dropped. The teacher `Header` does render it. | LOW |
| `Workspace.tsx:127` and `SchoolProfileModal.tsx:19` | `statusStyle` / `statusStyles` duplicated — two copies of the same colour map to keep in step. | LOW |
| `Signup.tsx:53` vs `BookDemo.tsx:186` | School-size bands differ ("501–1,000 / 1,001+" vs "501–1,200 / 1,200+"), and the second pair overlaps at 1,200. | LOW |

## 5. Missing states

| File | Problem | |
|---|---|---|
| `src/pages/platform/Workspace.tsx:333` | "Requests & Reviews" has no loading branch, though Overview, Schools, Operators and Audit all have one — so it shows an empty queue before the data arrives. | MEDIUM |
| `src/components/dashboard/TutorialsPage.tsx:23–41` | The card shows a play button and a duration; nothing tells you the video is missing until after you click. | MEDIUM |
| `src/components/dashboard/TutorialsPage.tsx`, `admin/Templates.tsx`, `admin/TeacherActivity.tsx` | Static screens with no loading, empty or error path at all. Harmless today; will break the day they take real data. | LOW |

## 6. Accessibility and forms

| File | Problem | |
|---|---|---|
| `src/components/ui/Input.tsx:13`, `src/components/ui/Select.tsx:11` | `htmlFor`/`id` are set only when a caller passes `id` **or** `name`. **103 of the 118 labelled fields** in the app (21 files — every admin dialog and every auth screen) render a `<label>` attached to nothing: clicking it does not focus the field, and a screen reader never reads it. One fix in these two components: fall back to a generated id. | HIGH |
| same two files | The `error` text is a loose `<p>`: no `aria-describedby`, no `aria-invalid`. A screen-reader user never hears why the form was rejected. | HIGH |
| `src/components/ui/Switch.tsx:11` | A `<label>` wrapping a `<button role="switch">` gives the switch no accessible name — it is announced only as "switch, on". | MEDIUM |
| `src/components/ui/Modal.tsx:39` | `role="dialog" aria-modal="true"` with no `aria-labelledby`, no focus trap and no focus return; Tab walks straight out behind the overlay. Affects all 19 dialogs. | MEDIUM |
| `src/components/layout/PublicFooter.tsx:170` | Four different links all named `aria-label="Social link"`. | MEDIUM |
| `src/pages/app/admin/Students.tsx:579` | The only `Select` in the codebase given an `id` — inconsistent with its immediate neighbours. | LOW |

## 7. Responsiveness

| File | Problem | |
|---|---|---|
| `src/components/dashboard/Topbar.tsx:101` | The in-app language switcher is `hidden sm:block` and has no mobile alternative — a parent on a phone cannot change language once signed in. | HIGH |
| `src/pages/public/Pricing.tsx:213` vs `:234` | The plan-name row is `grid-cols-3` inside a centred `max-w-3xl`; the feature rows are `grid-cols-4` inside a card with a `sm:w-56` label column. The headings do not line up with the tick columns, so you cannot tell which plan a tick belongs to. Worst on a phone. | HIGH |
| `src/pages/public/Pricing.tsx:234` | `grid-cols-4` with no phone variant — four columns at 360px. | MEDIUM |
| `src/context/LanguageContext.tsx:28` | Arabic sets `dir="rtl"` on `<html>`, but no layout uses `rtl:` variants or logical properties, so the sidebar, icons, paddings and the `left-3.5` input icons all stay on the left. | MEDIUM |
| `admin/Guardians.tsx:233` (880px), `admin/Fees.tsx:491` (860), `admin/Teachers.tsx:390` (820), `admin/Students.tsx:446` (760), `admin/Exams.tsx:413` (720), `components/import/ImportDialog.tsx:312` (900) | Fixed minimum widths inside a horizontal scroller. They do not break the page, but there is no card layout, so a phone user scrolls sideways through every roster. | MEDIUM |
| `src/pages/app/parent/Children.tsx:131` | `grid-cols-3` with no phone variant. | LOW |

## 8. Text problems

| File | Problem | |
|---|---|---|
| all of `src/pages/app/**` and `src/pages/platform/**` | **0 of 41 in-app pages call `t()`.** Only the marketing site and the sidebar are translated, so choosing Somali gives a Somali shell wrapped round a fully English app. | HIGH |
| `src/data/translations.ts` | 15 sidebar labels exist in `en` only, so they show in English in Somali *and* Arabic: `dash.nav.overview`, `timetables`, `timetable`, `results`, `assignments`, `lessons`, `classPerformance`, `myDay`, `myStudents`, `resources`, `progress`, `profile`, `receiptTemplates`, `recordTemplates`, `announcementTemplates`. | MEDIUM |
| `src/pages/public/BookDemo.tsx:180` | Phone placeholder `+254 7XX XXX XXX` is a Kenyan number; Nom Cloud's own number on `Contact.tsx:25` is `+252`. | MEDIUM |
| `src/components/dashboard/GradeBook.tsx:50` | Assessment names hardcoded as 'CAT 1' / 'CAT 2' — Kenyan wording, and not changeable per school. | LOW |

Checked and clean: no "Lorem", "TODO", "FIXME" or "Mock" in any string a user can see outside `platform/Workspace.tsx`; about 30 common misspellings searched for, none found; every `t()` key used in code is defined. No message was found that blames the user for a system failure.

---

## Not yours — mine (backend). Please ignore these.

- **Contact form and demo booking.** `services/contactService.ts` and `services/demoService.ts` write to `localStorage` while the page says "Message received — we'll reply within one business day". Needs `contact_messages` / `demo_requests` plus an anon-insert policy. Until then the success wording is on me, not you.
- **`services/emailOutbox.ts`** — still `localStorage`.
- **`parent_portal_enabled` enforcement and an SMS channel** (the toggles in section 2).
- **Teacher Activity** data source, and the **Template studio** behind `admin/Templates.tsx`.
- **Teacher class announcements** are still refused `42501` — a held migration of mine.
- **The 12 operator sections that say "Not available yet"** (People, Communications, Activity, System Health, Features, Integrations, Billing, Data, Permissions, Security, Analytics, Maintenance) — those panels are deliberate and correct. Leave them as they are.
- **`components/ui/ResourceGate.tsx:53`** shows the raw database message as the error description. My component, my fix.
- Messaging display names, and `last_message_at` never updating.
