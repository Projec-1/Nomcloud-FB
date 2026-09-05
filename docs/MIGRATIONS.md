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
| `20260904000002_schools` | **03** | `schools` (TENANT ROOT, zero outbound FKs), `school_subscriptions`; `reject_reserved_shortcode()` guard | Applied |
| `20260904000003_identity` | **04** | `profiles`, `platform_admins`, `memberships`, `invitations`; the one-school composite FK; the FK owed from 02 | Applied |
| `20260904000004_school_applications` | **05** | `school_applications` (PLATFORM-LEVEL, no `school_id`); both FKs land in one step | Applied |
| `20260904000005_academic_structure` | **06** | `academic_years`, `terms`, `subjects` — first SCHOOL-OWNED migration. Does not touch `schools` | Applied |
| `20260904000006_people` | **07** | `teachers`, `guardians`, `students`, `student_guardians`; **settles the four composite FKs owed since 04** | Applied |
| `20260904000007_fix_composite_set_null_scope` | **CORRECTIVE** — corrects 07 | Re-created `teachers_school_id_primary_subject_id_fkey` with `ON DELETE SET NULL (primary_subject_id)`; plain composite SET NULL blocked the delete with 23502 | Applied |

### Correction to an applied file's header

`20260904000001_drop_unapproved_contact_status_check.sql` opens with a header reading
**"Migration 03 (corrective)"**. That label is **wrong** and collides with design migration 03
(`schools`). It must be read as **CORRECTIVE**, with no design number. The file cannot be edited
because it is applied; **this document supersedes its header.** Its body — the reasoning for the
drop — remains accurate.

## Planned (design §I, as amended)

| Design # | Migration | Contents |
|---|---|---|
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

**Nothing is currently outstanding.** Every deferred constraint has been settled.

### Settled

- **The four composite FKs owed since Migration 04** were added by **Migration 07**, all
  `ON DELETE CASCADE`, all verified `col_count = 2` in the live catalog:
  `memberships (school_id, teacher_id) → teachers (school_id, id)` (§13 row 11, §16);
  `memberships (school_id, guardian_id) → guardians (school_id, id)` (row 12, §16);
  `invitations (school_id, teacher_id) → teachers (school_id, id)` (row 15, §17);
  `invitations (school_id, guardian_id) → guardians (school_id, id)` (row 16, §17).
  `teachers` and `guardians` each carry `UNIQUE (school_id, id)` as the target.
- `contact_messages.handled_by → profiles(id) ON DELETE SET NULL` was added by **Migration 04**.

### Standing rule — scoped `SET NULL` on composite foreign keys

**Every composite FK with `ON DELETE SET NULL` MUST name the column subset**, from Migration 08
onward and in any future correction:

```sql
on delete set null (the_reference_column)
```

Plain `ON DELETE SET NULL` nulls *every* referencing column, `school_id` included. Because
`school_id` is `NOT NULL` on all school-owned tables, the delete then fails with `23502` — RESTRICT
behaviour under a SET NULL label. Measured on this database: the plain form failed with
`23502: null value in column "school_id" ... violates not-null constraint`; the scoped form
succeeded, keeping `school_id` and nulling only the reference. The column-list syntax needs
PostgreSQL 15+; this project runs 17.

This is not a design change — it is the only way to implement what §13 describes. It applies to
**§13 rows 50, 55 and 56** in Migration 08 (`class_subjects.teacher_id`,
`timetable_slots.teacher_id`, `timetable_slots.subject_id`) and to every later composite SET NULL.
Single-column SET NULL FKs are unaffected and need no subset.

### Deliberately unconstrained

Two `status` columns are plain `text` with no CHECK, because the design defines no vocabulary for
them. A CHECK is added only where the design enumerates the values.

- `contact_messages.status` — `NOT NULL DEFAULT 'new'`
- `guardians.status` — `NOT NULL DEFAULT 'active'`
