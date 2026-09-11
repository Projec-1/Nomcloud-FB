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
| `20260904000012_communication_and_audit` | **11** | `announcements`, `notifications`, `message_threads`, `message_thread_participants`, `messages`, `audit_logs`; access-granting composite user references and append-only audit snapshots | Applied |
| `20260905000001_revoke_audit_log_mutation` | **CORRECTIVE** — corrects 11 | Revoked UPDATE and DELETE on `audit_logs` from `anon`, `authenticated`, and `service_role`, preserving insert-only application access | Applied |
| `20260905000002_revoke_audit_log_truncate` | **CORRECTIVE** — extends `20260905000001` | Revoked TRUNCATE on `audit_logs` from the same three roles. §H named only UPDATE and DELETE, but TRUNCATE erases every row in one statement and fires no row-level trigger | Applied |
| `20260908000001_campuses` | **CAMPUS/ROLE EXPANSION 1 of 8** | Created `campuses`, the school-owned physical-site entity, with per-school identity/uniqueness, active/inactive status CHECK, composite-FK target `(school_id, id)`, and `set_updated_at` trigger. This belongs to the campus/role expansion approved in `docs/CAMPUS_ROLE_DESIGN.md`, not the original Phase 3 design plan. | Applied |
| `20260908000002_membership_role_expansion` | **CAMPUS/ROLE EXPANSION 2 of 8** | Replaced `user_role` with the six approved values, renamed `admin` to `administrator` and `parent` to `guardian` without aliases, replaced the membership role/identity CHECK, and enforced one Owner per school with a partial unique index. | Applied |
| `20260908000003_school_application_details_and_approval` | **CAMPUS/ROLE EXPANSION — APPLICATION EXTENSION** | Added typed school-application detail columns, migrated parseable structured-message rows, and created the platform-admin-only transactional `approve_school_application` function. This belongs to the approved application-flow extension, not the original Phase 3 design plan. | Applied |
| `20260909000001_approval_auth_boundary` | **CORRECTIVE** — corrects application approval | Refactored `approve_school_application` to accept an Auth user created by the server-side `approve-school-application` Edge Function; removed direct `auth.users` account creation from the SQL transaction. | Applied |
| `20260911000001_restore_school_applications_public_insert` | **CORRECTIVE** — corrects an out-of-band dashboard change | Disabled row-level security on `school_applications`. RLS had been enabled on that table alone from the Supabase dashboard on 2026-09-11 at 16:35:20Z with no policy, which denied every row regardless of grants: the public sign-up form failed with 42501 returned as HTTP 401 for `anon`, and the platform-admin pending list silently returned zero rows. No migration caused it. Restores the pre-Phase-7 posture shared by every other table. | Applied |
| `20260911000002_membership_campus_scope` | **CAMPUS/ROLE EXPANSION 3 of 8** | Added `memberships.scope_mode` (`all`/`selected`) as an explicit campus breadth, the `memberships (school_id, id)` unique key needed as a composite-FK target, and the `membership_campus_scopes` join table with composite tenancy to `memberships (school_id, id)` and `campuses (school_id, id)`. `scope_mode = 'selected'` is restricted by CHECK to `principal` and `teacher`; organisation-wide roles and `guardian` cannot be campus-scoped. Does not enforce selected-requires-at-least-one-scope-row: §J open question 6 is unresolved and §I assigns that to Migration 5. Table count now 36. | Applied |

### Correction to an applied file's header

`20260904000001_drop_unapproved_contact_status_check.sql` opens with a header reading
**"Migration 03 (corrective)"**. That label is **wrong** and collides with design migration 03
(`schools`). It must be read as **CORRECTIVE**, with no design number. The file cannot be edited
because it is applied; **this document supersedes its header.** Its body — the reasoning for the
drop — remains accurate.

## Phase 4 — AUTHENTICATION

| Timestamp | What it did | Status |
|---|---|---|
| `20260906000001_accept_invitation` | Atomic, locked invitation redemption function; creates/completes profiles and memberships | Applied |
| `20260906000002_revoke_accept_invitation_anon` | Corrective privilege hardening; removes anonymous EXECUTE and grants only authenticated EXECUTE | Applied |

`accept_invitation` is `SECURITY DEFINER` because an invite recipient cannot write their
profile or membership before redemption. It pins `search_path` to the empty string,
schema-qualifies database objects, requires `auth.uid()` to match the supplied user id,
reads tenancy and role fields only from the locked invitation, and is executable only by
`authenticated`. The row lock serialises simultaneous redemption of one token.

## Phase 3 — CLOSED

**Design migrations 01–11 and all five correctives are applied and verified. Phase 3 is closed.**

Closed out by a full schema audit against the live database: 34 tables, 88 foreign keys
(42 composite, 46 single-column), 5 scoped composite SET NULLs, 4 enums, 3 functions — all
`SECURITY INVOKER` with `search_path` pinned — 35 triggers, 111 indexes. Every §13 row matched.
No credential-bearing column anywhere.

**Two closeout fixes were applied after the audit:**

- `docs/SCHEMA_DESIGN.md` §13's summary tally was corrected from *"87 / 35 / 52"* to **88 / 42 / 46**,
  with a note recording why the old figures were wrong. No individual row changed, and the `19–41`
  range label was deliberately left alone because every migration prompt cites that block by name.
- `20260905000002` revoked TRUNCATE on `audit_logs` — see below.

**Deliberately left as is, to revisit in Phase 15 with real query data:** `attendance_records`
carries both `..._date_key` (UNIQUE, ASC) and `..._date_idx` (`date DESC`) on the same leading
columns. The unique index can serve the DESC query by backward scan, so the second is arguably
redundant — but it is design-specified (§C table 23) and the table is empty, so there is no
evidence to act on yet.

### Append-only enforcement on `audit_logs` — two findings

**ALTER DEFAULT PRIVILEGES will re-grant TRUNCATE on any future table.** Supabase's platform
defaults on `public` grant `arwdDxtm` to `anon`, `authenticated` and `service_role`, and **`D` is
TRUNCATE**. The revoke protects `public.audit_logs` only; it cannot protect a table that does not
exist yet. **If `payment_events` (deferred, §11) is to be append-only, its Phase 11 migration must
issue its own `REVOKE UPDATE, DELETE, TRUNCATE`.**

**No other table has this gap.** `audit_logs` is the only append-only table in the design, confirmed
two ways: it is the only table with no `updated_at` column, and the only table where `anon` cannot
UPDATE. Separately and more broadly, 33 of 34 tables still allow all three application roles to
TRUNCATE — that is the general pre-RLS exposure, not an append-only defect, and Phase 7 addresses it
as a whole. **Not acted on beyond `audit_logs`.**

## Planned

**None for Phase 3.** RLS policies are Phase 7, as their own migration series, applied after the
schema is stable and verified.

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
