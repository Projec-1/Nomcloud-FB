# Frontend / backend gap — my colleague's work in `src/`

Read-only review of what was added or changed in the real `src/` between
`0b82371` and `origin/main` (`fc01882`). The `Nomcloud-main/` duplicate was not
read. Nothing in this document has been built or changed.

---

## ⚠️ Read this first — two of my auth fixes were reverted

Commit **`eff6b1e` "transfer duplicate app work to root"** (25 Sep, 55 files)
copied the older `Nomcloud-main/` snapshot over the root `src/`. It deleted:

| What | File | Effect now live |
|---|---|---|
| Homepage rescue for activation links | `src/lib/recoveryLanding.ts` (−34) | an invite link that lands on `/` strands the person again |
| Post-submit workspace redirect | `src/pages/public/ActivateAccount.tsx` (−21) | newly activated people can be bounced to `/login` |

The Edge Function side (`APP_ORIGIN`), the auth 401 retry and bulk invite all
survived. **This is why activation reports are still coming in.** It needs a
decision from you before anything else on this list.

---

## Feature-by-feature

| Feature / route | Data today | Backend that exists | Missing for real use | Effort |
|---|---|---|---|---|
| **Operator Workspace** — `/platform` + `actions, schools, people, requests, communications, operators, permissions, features, integrations, billing, data, activity, audit, security, health, maintenance, analytics, settings` (18 routes, all one component) | **Hardcoded.** Zero Supabase calls in the file | `schools`, `school_applications`, `profiles`, `memberships`, `platform_admins`, `audit_logs`, `contact_messages`, `subscription_plans`, `school_subscriptions` — all with platform-admin RLS | Read services per section; `audit_logs` never written to; nothing at all for security / health / maintenance / feature flags / analytics | **Large** |
| **Admin Timetables** — `/app/admin/timetables` | **Mock** `mockTimetable` + `localStorage` | `timetable_slots`, `classes`, `subjects`, `teachers`; `createTimetableSlot`, `deleteTimetableSlot` exist | Service to read/write `timetable_slots` instead of localStorage. Table is already right | **Small** |
| **Teacher Timetable** — `/app/teacher/timetable` | **Mock** `mockTimetable` | same as above, plus `fetchTeacherWorkspace` returns the teacher's slots | Same service; read-only view | **Small** |
| **Teacher Activity** — `/app/admin/teacher-activity` | **Mock** `mockTeacherActivity` + mock classes/teachers | Nothing purpose-built. `audit_logs` is the natural source but is empty | Decide the source: write `audit_logs`, or derive from attendance/grades/homework timestamps | **Medium** |
| **Teacher Workspace** — `/app/teacher/*` | **Mock** classes/lessons | `fetchTeacherWorkspace` already returns real classes, rosters, subjects, timetable | Point it at the existing service — data is already there | **Small** |
| **Parent Workspace** — `/app/parent/*` | **Mock** classes/lessons + `localStorage` child selection | `student_guardians`, `students`, `class_enrollments`, attendance, grades, fees all real with guardian RLS | Point it at existing services; keep child selection local | **Small** |
| **Template Studio** — `/app/admin/templates`, `/platform/templates/{email,announcements,receipts,records}` | **`localStorage`** key `nomcloud-template-studio` | None | New table (school-scoped templates: kind, name, body, is_default) + RLS | **Medium** |
| **Email outbox / branded email** — used by Signup, `contactService`, `demoService` | **`localStorage`** key | Real email goes out via Supabase Auth + Gmail SMTP for invitations only | Decide whether product email is needed at all beyond Auth; if yes, a queue table + sender | **Medium** |
| **Fee Analysis card** — admin dashboard | Props only, no fetch | `fee_records`, `fee_payments` real | Aggregate query; parent already reads fees | **Small** |
| **Request Processing** — UI component | Presentational only | — | Nothing | — |
| **Guardians page** — `/app/admin/guardians` | **Hybrid**: real Supabase list **merged with** `mockGuardianStore` from localStorage | Fully built and working (directory, access, invite, bulk invite) | Remove the mock merge — see flag below | **Small** |
| **Students bulk import** (his) — `/app/admin/students` | Writes guardians to **`localStorage`** via `saveMockGuardians` | Real import exists: `src/services/import/*` writes real students, guardians, links and enrolments | Decide which import survives — see flag below | **Medium** |

---

## 1. Already works — needs nothing from me

- **Guardians, Teachers, Students, Classes** core pages — still on real Supabase services with real RLS (his edits are layout/UX, apart from the mock merge flagged below).
- **Approval panel** — `/platform/applications` — real, unchanged.
- **Fees (parent + admin), Announcements, Attendance, Grades, Homework, Messages** — untouched data paths, still real.
- **Request Processing, Fee Analysis card, Sidebar/navConfig/translations/layout/CSS** — presentational only, no backend needed.

## 2. Needs backend — ordered by what a real school needs first

1. **Teacher Workspace** — point at existing `fetchTeacherWorkspace`; no new backend.
2. **Parent Workspace** — point at existing student/attendance/grade/fee services; no new backend.
3. **Timetables (admin + teacher)** — one service over the existing `timetable_slots` table.
4. **Students import** — reconcile with the real importer so guardians reach the database.
5. **Operator Workspace** — needs read services per section; `audit_logs` needs a writer; security/health/maintenance/flags/analytics have no data model at all.
6. **Teacher Activity** — needs a decided source before any table work.
7. **Template Studio** — needs a new table.
8. **Email outbox** — needs a decision before a table.

## 3. Decisions for me

- **The reverted auth fixes** — restore them on top of `origin/main`, or re-apply by hand? Nothing else should be built until activation is reliable.
- **Two student imports now exist.** His writes guardians to localStorage; mine writes real rows with validation, preview and per-row results. Which one survives?
- **Operator Workspace scope.** 18 routes all render one hardcoded component. Which sections are actually wanted first? Five of them (security, health, maintenance, feature flags, analytics) have **no table and no design** — they are new products, not wiring.
- **Teacher Activity source.** Start writing `audit_logs`, or derive activity from existing timestamps? Different sizes of job.
- **Is product email wanted?** Today only Auth email is real. The outbox implies transactional email we removed earlier by decision.
- **Template Studio** — wanted, and school-scoped or platform-scoped?

## Flags

**Duplicates something already built**
- `src/pages/platform/Templates.tsx` is a one-line re-export of the admin Templates page — the same screen serves an operator route and a school route.
- His **students import** duplicates the real `src/services/import/*` importer (teachers, classes, students + guardians, with validation and preview) and takes a different, non-database path for guardians.
- No second Guardians page — but the single Guardians page **merges mock localStorage rows into the real directory**, so a school sees invented guardians alongside real ones, and they cannot be invited.

**Mock data files still imported in `src/`**
- `src/data/mockTimetable.ts` → admin Timetables, teacher Timetable, teacher Workspace, parent Workspace, admin TeacherActivity
- `src/data/mockTeacherActivity.ts` → admin TeacherActivity
- `src/data/mockGuardianStore.ts` → **admin Guardians, admin Students** (both real pages)
- `src/services/emailOutbox.ts` (localStorage) → Signup, `contactService`, `demoService`

**Routes pointing at placeholders or shared stubs**
- 18 `/platform/*` routes all render the same `PlatformWorkspace` component — the path changes, the data does not.
- 4 `/platform/templates/*` routes render the same admin Templates component.
- `PlatformPlaceholder` is still imported in `App.tsx` but no longer used by any route — dead import.
- No route points at a missing file; the app builds.
