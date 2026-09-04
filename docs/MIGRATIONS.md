# Database Migrations

Reference for Nom Cloud's Supabase migration history and numbering. This document is the
authority on migration identity; a header comment inside an applied file is not.

## Numbering convention

- **Design numbers 01–11 are reserved** for the Phase 3 design plan (§I) and mean only that.
  `03` always means `schools`. A design number is never reused for anything else.
- **Corrective migrations carry no design number.** They are labelled `CORRECTIVE`, identified
  by their timestamp, and name the design migration they correct.
- **Applied migration files are never edited.** An applied file is a historical record. Errors in
  one are corrected by a new migration and, where the error is only in a comment, by this document.

## Applied

| Timestamp | Design # | What it did | Status |
|---|---|---|---|
| `20260903000001_extensions_and_enums` | **01** | Extensions `pgcrypto`, `citext` into `extensions`; enums `user_role`, `school_status`, `application_status`, `attendance_status`; shared `set_updated_at()` | Applied |
| `20260903000002_platform_core` | **02** | Tables `subscription_plans`, `reserved_shortcodes`, `contact_messages` | Applied |
| `20260904000001_drop_unapproved_contact_status_check` | **CORRECTIVE** — corrects 02 | Dropped `contact_messages_status_check`, a CHECK the approved design never specified | Applied |

### Correction to an applied file's header

`20260904000001_drop_unapproved_contact_status_check.sql` opens with a header reading
**"Migration 03 (corrective)"**. That label is **wrong** and collides with design migration 03
(`schools`). It must be read as **CORRECTIVE**, with no design number. The file cannot be edited
because it is applied; **this document supersedes its header.** Its body — the reasoning for the
drop — remains accurate.

## Planned (design §I, as amended)

| Design # | Migration | Contents |
|---|---|---|
| 03 | `schools` | `schools` (TENANT ROOT), `school_subscriptions` |
| 04 | `identity` | `profiles`, `platform_admins`, `memberships`, `invitations` |
| 05 | `school_applications` | applications table + `approved_school_id` FK |
| 06 | `academic_structure` | `academic_years`, `terms`, `subjects` |
| 07 | `people` | `teachers`, `guardians`, `students`, `student_guardians` |
| 08 | `classes_and_timetable` | `classes`, `class_subjects`, `class_enrollments`, `timetable_slots` |
| 09 | `teaching_records` | `attendance_records`, `grade_records`, `homework`, `homework_submissions`, `exams` |
| 10 | `finance` | `fee_records`, `fee_payments` + `amount_paid` trigger |
| 11 | `communication_and_audit` | `announcements`, `notifications`, `message_threads`, `message_thread_participants`, `messages`, `audit_logs` |

Two amendments changed this plan from its original form:

- **§14** removed `schools.active_academic_year_id`. Migration 03 is now self-contained with zero
  outbound foreign keys, and 06 no longer reaches back to alter `schools`. The word *deferrable*
  appears nowhere in the design.
- **RLS policies are not in this plan at all.** They are Phase 7, as their own migration series,
  applied after the schema is stable and verified.

## Outstanding, carried across migrations

- `contact_messages.handled_by` has no FK yet. The design specifies
  `handled_by → profiles(id) ON DELETE SET NULL`; **Migration 04 must add it**, since `profiles`
  is created there.
- `contact_messages.status` is plain `text NOT NULL DEFAULT 'new'` with **no vocabulary
  constraint**, deliberately, until one is approved.
