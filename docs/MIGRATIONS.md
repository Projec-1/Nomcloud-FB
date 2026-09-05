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
| `20260904000008_classes_and_timetable` | **08** | `classes`, `class_subjects`, `class_enrollments` (time-scoped), `timetable_slots`; first migration written under the scoped-SET-NULL rule | Applied |
| `20260904000009_teaching_records` | **09** | `attendance_records`, `grade_records`, `homework`, `homework_submissions`, `exams`; five RESTRICTs protecting academic history | Applied |
| `20260904000010_finance` | **10** | `fee_records`, `fee_payments`, and `sync_fee_record_amount_paid()` — the first business-logic trigger | Applied |
| `20260904000011_index_fee_payments_fee_record` | **CORRECTIVE** — corrects 10 | Added `fee_payments_school_id_fee_record_id_idx`, the access path the `amount_paid` trigger queries on every payment write | Applied |

### Correction to an applied file's header

`20260904000001_drop_unapproved_contact_status_check.sql` opens with a header reading
**"Migration 03 (corrective)"**. That label is **wrong** and collides with design migration 03
(`schools`). It must be read as **CORRECTIVE**, with no design number. The file cannot be edited
because it is applied; **this document supersedes its header.** Its body — the reasoning for the
drop — remains accurate.

## Planned (design §I, as amended)

| Design # | Migration | Contents |
|---|---|---|
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

### Deliberately absent — `fee_records.status`

**`fee_records` has NO status column, and this must not be "fixed".** paid / partial / unpaid /
overdue is derived from `amount`, `amount_paid` and `due_date` at read time. It cannot be a
generated column either: `overdue` depends on today's date, and a generated column must be
IMMUTABLE. §F: a stored copy *"drifts and produces wrong money"*. No view was created for it —
computing it at read is Phase 8's job, and the design specifies no view.

Related: **`fee_records.amount_paid` is maintained by `sync_fee_record_amount_paid()`**, never
written by the application. An overpayment is rejected by `amount_paid <= amount` (verified:
SQLSTATE 23514), and a `fee_records` row with payments against it cannot be deleted (verified:
SQLSTATE 23503, `ON DELETE RESTRICT`).

**Settled — the trigger's access path.** That trigger sums
`WHERE school_id = $1 AND fee_record_id = $2` on every payment write. PostgreSQL indexes only the
*referenced* side of a foreign key, so no index covered it and each write planned a sequential
scan. `20260904000011` added `fee_payments_school_id_fee_record_id_idx`; the planner now chooses
it, with both columns in the Index Cond. The same predicate serves the "all payments against this
fee" read.

### Payment events — deferred to Phase 11

Recorded verbatim in `20260904000010_finance.sql`: *"payment_events (provider event id, event
type, received_at, verification status, processed_at, idempotency guard) is DEFERRED from Phase 3
and REQUIRED before production payment integration in Phase 11."* Nothing blocks adding it —
`fee_payments.external_ref` is already the unconstrained join point, and no unique constraint would
collide with a later idempotency key. **One prerequisite:** amendment §11 has `payment_events`
referencing `fee_payments (school_id, id)` compositely, so Phase 11 must first add
`UNIQUE (school_id, id)` to `fee_payments`.

### No secrets are stored

The finance layer holds **no credential fields** — no API secrets, private keys, passwords,
signing secrets or raw provider credentials. `reference` and `external_ref` are ordinary
transaction identifiers, not secrets. Schema-wide, the only credential-adjacent column is
`invitations.token_hash`, which stores a **hash** and never the token itself, so a database dump
yields no working invites. Credentials live in Supabase Auth; the application schema never carries
a `password` or `password_hash` column.

### Deliberately unconstrained

Two `status` columns are plain `text` with no CHECK, because the design defines no vocabulary for
them. A CHECK is added only where the design enumerates the values.

- `contact_messages.status` — `NOT NULL DEFAULT 'new'`
- `guardians.status` — `NOT NULL DEFAULT 'active'`
