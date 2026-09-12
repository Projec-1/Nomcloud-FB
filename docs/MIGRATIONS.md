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
| `20260911000003_classes_campus` | **CAMPUS/ROLE EXPANSION 4 of 8** | Added `classes.campus_id`, nullable, with composite FK `(school_id, campus_id)` to `campuses (school_id, id)` `ON DELETE RESTRICT`, matching the existing `class_teacher_id` pattern so deleting a campus that still has classes fails loudly instead of cascading away academic history or silently detaching it. Replaced `UNIQUE (school_id, academic_year_id, name)` with a `NULLS NOT DISTINCT` unique index on `(school_id, campus_id, academic_year_id, name)`, so two campuses may each run their own 'Grade 5A' while classes with no campus still cannot duplicate a name. Added `(school_id, campus_id)` lookup index. `classes` is the only campus-bearing table per CAMPUS_ROLE_DESIGN.md B.2/B.3; descendants derive campus through their composite FK to classes. Table count unchanged at 36. | Applied |
| `20260911000004_campus_scope_integrity` | **CAMPUS/ROLE EXPANSION 5 of 8** | Resolves CAMPUS_ROLE_DESIGN.md J open question 6: a membership with `scope_mode = 'selected'` and no `membership_campus_scopes` row is now rejected. Adds `public.assert_selected_scope_names_campus()` and two `DEFERRABLE INITIALLY DEFERRED` constraint triggers, one on `memberships` (insert/update) and one on `membership_campus_scopes` (delete/update). A plain CHECK cannot count rows in another table and an immediate trigger would forbid the only possible insert order, since scope rows carry a foreign key to their membership; deferring to commit lets Migration 7 write a membership and its scope rows together. Escape hatch: clearing the last scope row succeeds if `scope_mode` is set to `all` in the same transaction. Deleting the membership cascades and skips the assertion. Table count unchanged at 36. | Applied |
| `20260911000005_invitation_role_scope_expansion` | **CAMPUS/ROLE EXPANSION 6 of 8** | Added `invitations.scope_mode` with the same `all`/`selected` vocabulary and role restriction as `memberships.scope_mode`, the `invitations (school_id, id)` unique key needed as a composite-FK target, and the `invitation_campus_scopes` intent table with composite tenancy to `invitations (school_id, id)` and `campuses (school_id, id)`. A mirror table rather than an array column, because an array cannot carry a composite FK and could name a campus in another school. `public.assert_selected_invitation_names_campus()` plus two deferred constraint triggers require a selected invitation to name at least one campus, scoped to LIVE invitations (`accepted_at is null and revoked_at is null`) so historical intent never blocks a campus deletion; `expires_at` is deliberately excluded so the constraint does not vary with the clock. `invitations.role` already used the six-value enum from Migration 2. No token column was added; `token_hash` remains the only token material. Table count now 37. | Applied |
| `20260911000006_accept_invitation_role_scope` | **CAMPUS/ROLE EXPANSION 7 of 8** | `CREATE OR REPLACE` on `accept_invitation` only; no table, constraint, trigger or grant changed. The membership is now created with `scope_mode` taken from the invitation, and when that is `selected` the invitation's `invitation_campus_scopes` rows are copied into `membership_campus_scopes` in the same transaction, which is what Migration 5's deferred assertion exists to permit. Role needed no change: the function never enumerated role values, so Migration 2's retyping already carried all six; probes exercise each one explicitly. Before this, an accepted `selected` invitation silently produced an `all`-scope membership, widening what the invitation granted. SECURITY DEFINER, the pinned empty `search_path`, the signature, the `anon` revoke and every validity outcome (`not_found`, `already_accepted`, `revoked`, `expired`, `email_mismatch`, `role_already_held`) are preserved. Role and scope are read only from the invitation row. Table count unchanged at 37. | Applied |
| `20260911000007_campus_rls_and_grants` | **CAMPUS/ROLE EXPANSION 8 of 8 — CLOSES THE EXPANSION** | Enabled row-level security on the six campus/role tables only (`schools`, `campuses`, `memberships`, `membership_campus_scopes`, `invitations`, `invitation_campus_scopes`) and wrote 29 policies plus four SECURITY DEFINER helper predicates (`is_platform_admin`, `current_school_id`, `has_school_staff_role`, `has_school_admin_role`), which exist to stop a policy on `memberships` recursing through `memberships`. Platform admin gets ALL on all six across every school. Owner/director/administrator read and write within their own school. Principal and teacher read only; write on the authorisation tables is withheld so a teacher cannot insert an owner membership for themselves. Guardian gets their own membership row and their own school row only, which is what sign-in requires. `anon` gets nothing, and no policy names `anon`. Campus scope does not filter these tables; they are school-level identity records and B.2 names `classes` as the only campus-bearing table. No FORCE RLS anywhere, so `accept_invitation` and `approve_school_application` still bypass as owner; both were run end to end under RLS and needed no adjustment. `school_applications` is out of scope and its anonymous INSERT was re-verified through PostgREST. **Full Phase 7 RLS across the remaining 31 tables is a separate future task.** Table count unchanged at 37. | Applied |
| `20260912000001_platform_and_identity_rls` | **PHASE 7 RLS 1 of 6 — BATCH 1** | First batch of the full Phase 7 rollout defined in `docs/RLS_FULL_ROLLOUT_PLAN.md` section E. Enabled row-level security on seven tables — `subscription_plans`, `reserved_shortcodes`, `school_applications`, `contact_messages`, `platform_admins`, `audit_logs`, `profiles` — and wrote 13 policies. No new helper predicate was created: the four SECURITY DEFINER helpers from `20260911000007` are reused, which is why enabling RLS on `profiles` and `platform_admins` does not break every existing policy. Platform admin gets ALL on all seven. Owner/director/administrator get SELECT on their own school's `profiles` and on their own school's non-NULL `audit_logs` rows only. Every authenticated user reads and updates their own `profiles` row; principal, teacher and guardian get no profile directory and no audit access in this batch. `anon` keeps INSERT-only on `school_applications` (preserving corrective `20260911000001`) and on `contact_messages`, and can read nothing. **One existing function was changed because RLS genuinely broke it:** `reject_reserved_shortcode()` was SECURITY INVOKER and read `reserved_shortcodes`, so once that table gained RLS an owner/director/administrator — who can update their own school under `schools_admin_update` — saw an empty reserved list and the guard silently passed. Proven by counterfactual probe: with the pre-migration INVOKER body an administrator successfully renamed their school to `www`; with the shipped SECURITY DEFINER body the same statement is rejected with 23514. The pinned empty `search_path` is retained. `profiles` also moved from a table-wide UPDATE grant to a column-level grant on `full_name`, `phone`, `locale`, `avatar_url`, because RLS is row-level and cannot stop a self-update from rewriting `school_id` or `email`. `audit_logs` UPDATE/DELETE/TRUNCATE revokes from `20260905000001/2` are untouched and were re-verified as still denied, for platform admin and `service_role` too; `service_role` retains INSERT and BYPASSRLS, so the trusted audit writer path stays open. No FORCE RLS anywhere. `accept_invitation` and `approve_school_application` were run end to end under RLS and needed no change. The other 24 unprotected tables are batches 2-6 and are deliberately untouched. Table count unchanged at 37. | Applied |
| `20260912000002_restrict_anon_school_application_insert` | **CORRECTIVE** — corrects `20260912000001` | Tightened the `WITH CHECK` clause of `school_applications_anon_insert`, which batch 1 created as `WITH CHECK (true)`. That let an anonymous caller posting directly to PostgREST set any column on the row it inserted, including the reviewer/decision columns: a submission could arrive already marked `approved`, pointing at a real `approved_school_id`, or carrying a forged `reviewed_by`/`reviewed_at`. Verified before the fix: all of those returned `OK rows=1` as `anon`. No read access was granted at any point and approval always remained the SECURITY DEFINER `approve_school_application`; the damage was to the integrity of the platform review queue and the status metrics §A.4 says those columns exist to produce. The policy now pins `status = 'pending'`, `reviewed_by IS NULL`, `reviewed_at IS NULL` and `approved_school_id IS NULL`. `status` is pinned by equality rather than left to the column DEFAULT, because a DEFAULT only applies when the caller omits the column and does nothing about a caller that sends one. Every ordinary application field remains fully settable by the public form. Implemented with `ALTER POLICY`, not DROP and CREATE, so the policy's name, command, role list and permissive flag are provably unchanged and an INSERT policy has no USING clause to drift. One policy comment was also set. No table, column, constraint, trigger, function, grant or other policy is touched, and no table outside `school_applications` is named. Policy count unchanged at 42; tables with RLS unchanged at 13. | Applied |
| `20260912000003_school_people_rls` | **PHASE 7 RLS 2 of 6 — BATCH 2** | Enabled row-level security on eight tables — `school_subscriptions`, `academic_years`, `terms`, `subjects`, `teachers`, `guardians`, `students`, `student_guardians` — with 40 policies and five new SECURITY DEFINER helpers (`is_school_member`, `has_school_management_role`, `has_school_billing_role`, `current_guardian_id`, `is_guardian_of_student`), all with `search_path` pinned to the empty string. `is_guardian_of_student` is the guardian access predicate every later batch will resolve through. **Three findings changed the plan.** (1) Principal campus scope is not expressible on people tables: only `classes` carries `campus_id` and it is nullable, so the person-to-campus chain runs through class assignment and is not total — measured, a student in a NULL-campus class, a newly admitted student and a newly hired teacher all reach no campus. For writes it is impossible, not merely lossy, because a person a principal has just created has no assignment and so a campus-filtered WITH CHECK could never pass. Principal access is therefore school-wide on all eight, independent of `scope_mode`; campus becomes a real boundary in batch 3 on `classes`. (2) Guardians do need read on `academic_years`, `terms` and `subjects`: RLS filters joined tables too, and with those three ODA-only a guardian reading their own child's grade got zero rows through an inner join and a NULL label through a left join, so denying the read deletes the child's record from the parent's view rather than hiding a label. All three are reference data with no personal information. (3) `school_subscriptions` is owner/director only, excluding administrator, on explicit instruction; `RLS_FULL_ROLLOUT_PLAN` C.2.8 had said ODA, no commercial-sensitivity note exists in `SCHEMA_DESIGN.md`, and this is the first place director and administrator diverge, setting a precedent on `CAMPUS_ROLE_DESIGN` J3. No school role may write `school_subscriptions` at all. Teacher is read-only on all four people tables. A guardian reads only its own `guardians` row, only students linked through `student_guardians`, and only its own links; it can write none of them, which is the same treatment Migration 8 gave `memberships` and closes the most direct self-privilege-escalation path in the schema. 65 probes across owner, director, administrator, principal with `scope_mode='selected'`, teacher, guardian, a second school's administrator, platform admin and `anon`, all in rolled-back transactions. `accept_invitation` was re-run end to end for both the teacher and guardian roles, confirming the composite foreign keys into the now-protected `teachers` and `guardians` still validate, since referential integrity checks bypass RLS by design; `approve_school_application` was re-run too. No grant changed, no existing function altered, no FORCE RLS. Tables with RLS now 21 of 37; policies now 82. | Applied |
| `20260912000004_classes_and_timetable_rls` | **PHASE 7 RLS 3 of 6 — BATCH 3** | Enabled row-level security on `classes`, `class_subjects`, `class_enrollments` and `timetable_slots`, with 29 policies and five new SECURITY DEFINER helpers (`current_teacher_id`, `has_campus_scoped_management`, `can_manage_class`, `teaches_class`, `guardian_has_student_in_class`), all with `search_path` pinned to the empty string. **This is where campus scope becomes a real boundary**, unlike batch 2: `classes` carries `campus_id` directly from Migration 4. **Three conclusions were settled and probed.** (1) `campus_id IS NULL` is NOT visible to a principal with `scope_mode = 'selected'`. Migration 4 defines NULL as "no campus assigned yet" and uses `NULLS NOT DISTINCT`, and `RLS_FULL_ROLLOUT_PLAN` A.2 already recorded "NULL is not a campus grant". Making NULL universally visible would convert unassigned into readable-and-writable by every principal at every campus. Owner, director, administrator and `scope_mode = 'all'` principals keep full access, so unassigned classes are never orphaned; the rule is applied symmetrically so a selected-scope principal also cannot CREATE a NULL-campus class or NULL out an existing one as an escape. (2) "Assigned to teach a class" means the caller's `teachers.id` in `classes.class_teacher_id` OR in `class_subjects.teacher_id` for any subject of that class, which is the union CAMPUS_ROLE_DESIGN J5 calls class-derived scope and is what the locked batch-4 attendance decision requires. `timetable_slots.teacher_id` is deliberately excluded to avoid circularity, since slot visibility is itself derived from teaching the class; a cover teacher reads their own slot through a separate own-slot policy without that slot counting as an assignment. (3) Teacher `scope_mode = 'selected'` does not further restrict anything here and cannot: J5 defines teacher scope as the union of explicit grants and class-derived scope, whichever is broader, and assignment is strictly the narrower predicate, so a campus filter could only subtract classes the school explicitly assigned. Probed: a teacher scoped to SOUTH who teaches nothing there sees no SOUTH class. The three descendants carry no `campus_id` and derive it through `can_manage_class`, which resolves the parent class; campus logic is written once in `has_campus_scoped_management` and never restated. The `classes` UPDATE policy names the same predicate in USING and WITH CHECK, so a selected-scope principal can neither claim a class from another campus nor move one of their own out, which is the old-row/new-row test C.3.18 asks for. Teachers are read-only on all four tables, per C.3 and the Migration 8 self-escalation discipline: `class_subjects.teacher_id` is the batch-4 attendance grant, so a teacher able to write it could assign themselves to any class. A guardian reads the class, its subjects and its timetable, but `class_enrollments` is filtered per-student through `is_guardian_of_student` rather than per-class, so a parent never sees the rest of the roster. 47 probes across administrator, principal scoped to one campus of two, principal with `scope_mode = 'all'`, an assigned teacher, a cover teacher, a guardian, a second school's administrator and `anon`, all in rolled-back transactions against a real two-campus school. No grant changed, no existing function altered, no constraint from Migrations 4, 5 or 8 weakened, no FORCE RLS. Tables with RLS now 25 of 37; policies now 111. | Applied |
| `20260912000005_teaching_records_rls` | **PHASE 7 RLS 4 of 6 — BATCH 4** | Enabled row-level security on `attendance_records`, `grade_records`, `homework`, `homework_submissions` and `exams`, with 46 policies and four new SECURITY DEFINER helpers (`teaches_class_subject`, `can_manage_homework`, `teaches_homework`, `teaches_homework_class`), all with `search_path` pinned empty. Batch 3's assignment definition is **reused, not re-derived**: the policies call `public.teaches_class` directly, so the two can never drift. **Decision 1 implemented:** attendance is the one table here with no `subject_id`, keyed one row per pupil per day, so any teacher of the class may mark it. `teaches_class` already covers both `classes.class_teacher_id` and `class_subjects.teacher_id`, and both arms are probed separately: a homeroom teacher who teaches no subject and a subject-only teacher who is not the homeroom teacher both succeed on the same class, while a teacher assigned to neither is rejected. This supersedes C.4.20, which had recommended class-teacher-only and flagged the choice. **Subject-exact writes** on the three subject-bearing tables: `grade_records`, `homework` and `exams` require the exact (class, subject) pair through `teaches_class_subject`, so a Mathematics teacher cannot record English marks for a class they genuinely teach, and a homeroom teacher who teaches no subject cannot enter marks at all. **Stated divergence:** teacher READ is class-level (`teaches_class`) while WRITE is subject-level; C.4.21 recommended subject-exact read too, but a homeroom teacher unable to see their own class's grades would be a silent block, and the harm named there is changing marks, which the write predicate closes. **Decision 2 implemented:** no INSERT, UPDATE or DELETE policy naming a guardian exists on `homework` or `homework_submissions`; guardians get exactly one policy on each and it is FOR SELECT, so RLS denies writes by default with nothing to revoke. Verified at the catalog level: zero guardian write policies on those two tables. The teacher write policies on `homework_submissions` ARE the marks-it-reviewed-in-person path. **A NULL trap was avoided deliberately:** `marked_by`, `recorded_by` and `created_by` are all nullable attribution columns, so a check written as `col = auth.uid()` would evaluate NULL and reject every insert omitting the column; the checks are written `(col is null or col = auth.uid())`, which still blocks attributing a record to a colleague. Teacher DELETE is withheld on attendance, grades, submissions and exams per C.4.21 ("correct by update plus audit"); exams carry a `cancelled` status so cancelling is an update. `homework` is the one exception, where a subject teacher may delete their own. Guardians read their own child's attendance, grades and submissions per-student through `is_guardian_of_student`, and class-level homework and exams through `guardian_has_student_in_class`, never a classmate's records. No business-logic trigger exists on any of the five: the only trigger on each is `set_updated_at`, which assigns a column and reads no table, so there is no analogue here of the `amount_paid` aggregation trigger batch 5 must handle. 48 probes across a named three-teacher fixture (homeroom-only, subject-only, unrelated), a guardian, a campus-scoped principal, an administrator, a second school's administrator and `anon`, all rolled back. No grant changed, no existing function altered, no FORCE RLS. Tables with RLS now 30 of 37; policies now 157. | Applied |

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
