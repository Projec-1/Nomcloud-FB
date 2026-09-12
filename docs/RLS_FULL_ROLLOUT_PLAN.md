# Nom Cloud — Phase 7 Full RLS Rollout Plan

**Status:** Batch 1 of 6 applied (`20260912000001_platform_and_identity_rls`,
2026-09-12). Seven of the 31 unprotected tables now carry RLS; 24 remain.
Sections A-D and F-H remain the design; §E carries live batch status.

**Authority:** [SCHEMA_DESIGN.md](./SCHEMA_DESIGN.md), especially §§A.2, B,
H, 10, 13 and the standing rules; [CAMPUS_ROLE_DESIGN.md](./CAMPUS_ROLE_DESIGN.md),
especially §§B, D, E and J; and [MIGRATIONS.md](./MIGRATIONS.md). Recommendations
that go beyond those documents are marked **approval required**.

---

# §A. Scope and common rules

## A.1 Scope

RLS is already enabled on six of 37 public application tables: `schools`,
`campuses`, `memberships`, `membership_campus_scopes`, `invitations`, and
`invitation_campus_scopes`. This plan covers the other 31 only.

The existing six-table policies are the baseline: PA (unrevoked platform admin)
has cross-school authority; Owner, Director, and Administrator (collectively
**ODA**) are organisation-wide within their school; Principal and Teacher are
staff; and Guardian access is only through `student_guardians`. Lower roles
must never be able to create a membership, invitation, scope, participant, or
other record that grants the actor or another person more capability than the
actor already has.

RLS is an additional gate, not a replacement for grants. A command needs both
a privilege grant and a matching RLS policy. Enabling RLS cannot restore the
existing `audit_logs` revokes of UPDATE, DELETE, and TRUNCATE. No migration in
this series should introduce `FORCE ROW LEVEL SECURITY`: the existing
SECURITY DEFINER invitation and approval transactions intentionally rely on
owner RLS bypass.

## A.2 Terms

| Term | Meaning |
|---|---|
| PA | Unrevoked platform admin, determined only by `platform_admins`. |
| ODA | Owner, Director, or Administrator with an active membership in the row's school. |
| P-all / T-all | Active Principal / Teacher with `scope_mode='all'`. |
| P-selected / T-selected | Active Principal / Teacher with `scope_mode='selected'`. |
| Own student | A student linked to the caller's guardian membership through `student_guardians`. |
| Taught class/subject | A class where the caller's `teacher_id` is `classes.class_teacher_id`, or the matching `class_subjects.teacher_id` for subject-specific work. |

For selected Principals, a class row is in scope only when `classes.campus_id`
is in the membership's `membership_campus_scopes`. For selected Teachers, the
effective campus set is the approved union of explicit scope grants and
class-derived scope (Campus/Role Design §J5). That union supplies a campus
boundary; it does not itself justify access to every class or student inside the
boundary. The teaching-table entries below make that choice per table.

Classes with `campus_id IS NULL` remain visible to ODA and all-scope staff but
must not be visible to selected-scope staff through a campus predicate. NULL is
not a campus grant.

## A.3 Established user-reference classification

- **Access-granting, composite tenant-bound references:**
  `notifications.user_id`, `message_thread_participants.user_id`.
- **Attribution-only, single-column references:**
  `school_applications.reviewed_by`, `contact_messages.handled_by`,
  `memberships.invited_by`, `attendance_records.marked_by`,
  `grade_records.recorded_by`, `homework.created_by`,
  `fee_payments.recorded_by`, `announcements.created_by`,
  `message_threads.created_by`, `messages.sender_id`, and
  `audit_logs.actor_user_id`.
- `platform_admins.user_id` is the platform-authority grant;
  `platform_admins.granted_by` is attribution. `profiles.id` is identity, not a
  child-row visibility grant.

All other table entries below have no user reference unless expressly stated.

---

# §B. Campus-scoping map

`classes` is the only direct campus anchor. No policy may trust a client campus
value or add redundant campus columns to descendants.

| Tables | Campus path | Is scope meaningful? |
|---|---|---|
| `classes` | `classes.campus_id` | Yes, direct. |
| `class_subjects`, `class_enrollments`, `timetable_slots`, `attendance_records`, `grade_records`, `homework`, `exams` | row → `classes` through its existing composite FK → `classes.campus_id` | Yes. |
| `homework_submissions` | submission → `homework` → `classes.campus_id` | Yes. |
| Class-targeted `announcements` | announcement → `classes.campus_id` | Yes, only when `audience='class'`. |
| `students`, `guardians`, `student_guardians` | person/link → current `class_enrollments` → `classes.campus_id` | Only after “current” is defined; see §H. |
| `teachers` | teacher → `classes.class_teacher_id` or `class_subjects.teacher_id` → `classes.campus_id` | For assignment/roster visibility; never a scalar campus on the teacher row. |
| `academic_years`, `terms`, `subjects` | None | No; deliberately school-wide. |
| `school_subscriptions`, `fee_records`, `fee_payments` | None approved | No; do not invent a student campus history. |
| `profiles`, `notifications`, messaging tables | None that is the authority boundary | No; identity, recipient, or participant rules apply. |
| `audit_logs` | None | No; the design deliberately has only optional school scope. |

`left_on IS NULL` alone is not a complete “current enrollment” definition: it
can leave active rows across different academic years. The provisional safe
predicate is an active enrollment in the school's active academic year at an
allowed campus. Treatment of unassigned, transferred, historical, and
NULL-campus cases is an open product decision.

---

# §C. Table-by-table access plan

“No” means no direct table policy. “Trusted writer” means a server/service
path or a purpose-built SECURITY DEFINER function, never browser-supplied
values.

## C.1 Platform and identity-adjacent tables

### 1. `subscription_plans` — PLATFORM

- **References:** none.
- **Read:** PA all; all users may read only `is_public=true` if Pricing remains
  database-backed. School role is irrelevant to the public subset.
- **Write:** PA/back-office only; all school roles and Guardians no.
- **Campus:** not meaningful.
- **Approval required:** confirm anonymous plan read if the frontend stops using
  hardcoded plans.

### 2. `reserved_shortcodes` — PLATFORM

- **References:** none.
- **Read/write:** PA/back-office only; no school role or Guardian access.
- **Campus:** not meaningful.
- **Risk:** `reject_reserved_shortcode()` is SECURITY INVOKER and reads this
  table from the schools trigger. Once RLS hides reserved rows, an allowed
  school update could falsely see no match. Before this table is protected,
  make that narrowly SECURITY DEFINER function retain `search_path=''`, or
  expose every reserved value to callers who can update a shortcode. SECURITY
  DEFINER is the recommended technical fix.

### 3. `school_applications` — PLATFORM, pre-tenant

- **References:** `reviewed_by` attribution-only; `applicant_position` is
  expressly not a membership grant.
- **Read:** PA all; ODA, Principal, Teacher, and Guardian no rows.
- **Write:** anonymous INSERT only for the public form; PA review/update/delete;
  no public SELECT, UPDATE, or DELETE.
- **Campus:** not meaningful because no tenant exists.
- **Risk:** preserve `20260911000001_restore_school_applications_public_insert`.
  `approve_school_application`, not a browser policy, owns the atomic approval.

### 4. `contact_messages` — PLATFORM

- **References:** `handled_by` attribution-only.
- **Read:** PA only; no school role or Guardian access.
- **Write:** anonymous INSERT only; PA may handle/update/delete.
- **Campus:** not meaningful.
- **Risk:** RLS does not provide rate limiting or spam control.

### 5. `platform_admins` — PLATFORM

- **References:** `user_id` is a platform-authority grant; `granted_by` is
  attribution-only.
- **Read:** PA platform roster (or only its own grant if no roster UI is needed);
  no school role/Guardian access.
- **Write:** no school role. Grant/revoke belongs to a controlled platform
  operation. Whether an existing PA may grant another PA or only a break-glass/
  service process may do so is **approval required**.
- **Campus:** not meaningful.
- **Risk:** existing SECURITY DEFINER `is_platform_admin()` continues to work
  when this table gains RLS if FORCE RLS is not enabled.

### 6. `audit_logs` — PLATFORM, optionally school-scoped

- **References:** `actor_user_id` attribution-only; role/email are snapshots.
- **Read:** PA all, including `school_id IS NULL`; ODA own school's non-NULL
  rows; Principal, Teacher, Guardian no direct audit access.
- **Write:** trusted audit writer only. No direct client INSERT; no application
  UPDATE, DELETE, or TRUNCATE.
- **Campus:** not meaningful; selected staff must be denied rather than receive
  an unfiltered school audit trail.
- **Risk:** the existing UPDATE/DELETE/TRUNCATE grant revokes remain the
  append-only protection; RLS adds row-select and insert gates and cannot undo
  those revokes. The audit-emission path is **approval required**.

### 7. `profiles` — IDENTITY

- **References:** `id` is Auth identity and `school_id` is the authoritative
  one-school assignment; neither is an access-granting child reference.
- **Read:** ODA all profiles in school; every user self; Principal/Teacher/
  Guardian additionally only profiles of participants in message threads they
  can read. No general profile directory for non-ODA staff.
- **Write:** invitation acceptance and school approval create profiles. A user
  may update approved self-service fields only; never `id`, `school_id`, or
  Auth-owned email. No direct school-role insert/delete.
- **Campus:** not meaningful for a personal identity.
- **Risk:** RLS is row-level, not column-level. Self-edit needs column grants or
  a controlled RPC/function; the editable field list is **approval required**.

## C.2 School-wide structure and people

### 8. `school_subscriptions` — SCHOOL-OWNED

- **References:** none.
- **Read:** PA all; ODA own school; P/T (all or selected) and Guardian no.
- **Write:** platform billing/back-office only; no school role changes commercial
  status, periods, or `external_ref`.
- **Campus:** not meaningful; commercial ownership is school-level.

### 9. `academic_years` — SCHOOL-OWNED

- **References:** none.
- **Read:** ODA, P-all, T-all, P-selected, and T-selected read school-wide;
  Guardian no direct read.
- **Write:** ODA only. Principal calendar authority is not approved.
- **Campus:** not meaningful; school-wide by design.

### 10. `terms` — SCHOOL-OWNED

- **References:** none.
- **Read:** same as `academic_years`; all active staff school-wide, Guardian no.
- **Write:** ODA only.
- **Campus:** not meaningful; `terms → academic_years` remains school-wide.

### 11. `subjects` — SCHOOL-OWNED

- **References:** none.
- **Read:** same as `academic_years`; shared school-wide subjects, Guardian no.
- **Write:** ODA only.
- **Campus:** not meaningful; Campus/Role Design §J9 keeps subjects shared.

### 12. `teachers` — SCHOOL-OWNED

- **References:** no user reference here; membership's composite `teacher_id`
  is the person-to-user connection.
- **Read:** ODA all; P-all school roster; P-selected teachers assigned in a
  scoped campus; Teacher self and teaching-context records; Guardian no.
- **Write:** ODA only; no Principal/Teacher direct employment-record mutation.
- **Campus:** teacher → class teacher/class subject assignment → class campus.
- **Risk:** selected Principals cannot see unassigned teachers under this rule.
  Whether they manage unassigned staff is **approval required**.

### 13. `guardians` — SCHOOL-OWNED

- **References:** no direct user reference; membership's `guardian_id` connects
  a guardian user.
- **Read:** ODA all; P-all school-wide; P-selected guardians of current
  scoped-campus students; Teacher only guardians of taught students; Guardian
  self only.
- **Write:** ODA only initially; guardian self-service contact editing is not
  assumed.
- **Campus:** guardian → student_guardians → student → current enrollment →
  class campus.

### 14. `students` — SCHOOL-OWNED

- **References:** none.
- **Read:** ODA/P-all all school students; P-selected current scoped-campus
  students; Teacher taught-class/subject roster only; Guardian Own-student only.
- **Write:** ODA only initially. Principal admissions/transfers are unapproved.
- **Campus:** student → current class_enrollments → class campus.
- **Trade-off:** school-wide-within-campus Teacher read is simpler but exposes
  student PII beyond teaching responsibility. Taught-class restriction is
  recommended despite its assignment joins.

### 15. `student_guardians` — SCHOOL-OWNED join

- **References:** no user reference; this join is the Guardian access boundary.
- **Read:** ODA/P-all all; P-selected through linked student's current class;
  Teacher only taught students; Guardian only own `guardian_id` links.
- **Write:** ODA only. A Guardian must never add itself to a student or change
  primary/pickup authority.
- **Campus:** link → student → current enrollment → class campus.
- **Risk:** INSERT here is the most direct Guardian self-privilege-escalation
  path and must always be denied.

## C.3 Classes, roster, and timetable

### 16. `classes` — SCHOOL-OWNED

- **References:** no user reference; `class_teacher_id` is a person reference,
  not a user grant.
- **Read:** ODA/P-all school-wide; P-selected direct campus scope; Teacher
  taught/class-teacher classes; Guardian classes with Own-student active roster.
- **Write:** ODA only initially. Scoped Principal class management is feasible
  only with old- and new-row campus `WITH CHECK`; grant is **approval required**.
- **Campus:** direct `classes.campus_id`.

### 17. `class_subjects` — SCHOOL-OWNED join

- **References:** no user reference; nullable `teacher_id` is an assignment.
- **Read:** ODA/P-all school-wide; P-selected through class; Teacher own
  assignment; Guardian Own-student active-class subjects.
- **Write:** ODA only. Principal curriculum scheduling is **approval required**.
- **Campus:** class_subjects → classes.campus_id.

### 18. `class_enrollments` — SCHOOL-OWNED

- **References:** none.
- **Read:** ODA/P-all all; P-selected through enrolled class; Teacher taught
  class roster only; Guardian Own-student only.
- **Write:** ODA only. Principal-controlled admission/transfer is **approval
  required** because this table defines later people/Guardian reachability.
- **Campus:** class_enrollments → classes.campus_id.
- **Risk:** any approved scoped write must test actor scope against both the old
  and new class so a move cannot become a cross-campus data grant.

### 19. `timetable_slots` — SCHOOL-OWNED

- **References:** no user reference; nullable teacher reference is attribution/
  schedule assignment, not a user grant.
- **Read:** ODA/P-all all; P-selected through class; Teacher own slots and taught
  classes; Guardian Own-student active-class timetable.
- **Write:** ODA only initially. Scoped Principal timetable management is
  plausible but **approval required**; Teacher direct schedule changes denied.
- **Campus:** timetable_slots → classes.campus_id.

## C.4 Teaching records

### 20. `attendance_records` — SCHOOL-OWNED

- **References:** `marked_by` attribution-only.
- **Read:** ODA/P-all all; P-selected through class; Guardian Own-student;
  Teacher taught/led classes only.
- **Write:** ODA and scoped Principal in-class scope. Recommended Teacher write:
  only `classes.class_teacher_id`, never a generic campus policy.
- **Campus:** attendance.class_id → classes.campus_id.
- **Trade-off / approval:** attendance is daily, not per subject. Class-teacher
  marking is safer; allowing subject teachers is convenient but lets them set
  whole-class daily attendance. Choose before implementation.

### 21. `grade_records` — SCHOOL-OWNED

- **References:** `recorded_by` attribution-only.
- **Read:** ODA/P-all all; P-selected through class; Guardian Own-student;
  Teacher matching `class_subjects.teacher_id` only.
- **Write:** ODA/scoped Principal in scope; assigned Teacher insert/update own
  class/subject grades. Teacher DELETE denied; correct by update plus audit.
- **Campus:** grade.class_id → classes.campus_id.
- **Trade-off:** class/subject restriction is recommended: the row already has
  keys to prohibit a Mathematics teacher seeing/changing English grades.

### 22. `homework` — SCHOOL-OWNED

- **References:** `created_by` attribution-only.
- **Read:** ODA/P-all all; P-selected through class; Teacher own assigned
  class/subject; Guardian Own-student active-class homework.
- **Write:** ODA/scoped Principal in scope; assigned Teacher manages own
  class/subject homework with `created_by=auth.uid()` enforced. Authorship
  alone must not grant sight.
- **Campus:** homework.class_id → classes.campus_id.

### 23. `homework_submissions` — SCHOOL-OWNED

- **References:** none.
- **Read:** ODA/P-all all; P-selected through homework/class; assigned Teacher
  only; Guardian Own-student only.
- **Write:** ODA/scoped Principal as approved; assigned Teacher grades/feeds
  back; Guardian no direct write initially.
- **Campus:** submission → homework → classes.campus_id.
- **Approval required:** students have no login and no `submitted_by` column.
  Guardian submission would be an unrecorded impersonation rule and cannot be
  inferred.

### 24. `exams` — SCHOOL-OWNED

- **References:** none.
- **Read:** ODA/P-all all; P-selected through class; assigned Teacher; Guardian
  Own-student class/subject schedule.
- **Write:** ODA only initially. Principal scheduling and teacher proposal
  authority are **approval required**.
- **Campus:** exams.class_id → classes.campus_id.
- **Risk:** scope follows class campus; no separate exam-location model is
  invented.

## C.5 Commercial and financial tables

### 25. `fee_records` — SCHOOL-OWNED, FIN

- **References:** none.
- **Read:** PA all; ODA own school; Guardian Own-student; P/T, all or selected,
  no direct read initially.
- **Write:** ODA/trusted billing path only. `amount_paid` is never client-written.
  Deletion/correction needs an approved financial-retention procedure.
- **Campus:** not meaningful; fees are student/term records with no approved
  student-campus history.
- **Risk:** RLS cannot make one column immutable. Column grants or a controlled
  RPC/function must prevent client changes to `amount_paid`.

### 26. `fee_payments` — SCHOOL-OWNED, FIN

- **References:** `recorded_by` attribution-only.
- **Read:** PA all; ODA own school; Guardian payments for Own-student fees; P/T
  no direct read initially.
- **Write:** ODA/trusted payment ingestion only. Guardian payment initiation
  goes through a payment flow, never a direct INSERT. UPDATE/DELETE require an
  approved correction/void process.
- **Campus:** not meaningful; fee_payment → fee_record reaches no campus model.
- **Risk:** `sync_fee_record_amount_paid()` is SECURITY INVOKER. It selects all
  payments for a fee and updates the parent. It needs no function change only
  if every permitted writer has school-wide SELECT on payments and UPDATE on the
  matching fee record. The recommended ODA-only finance writer has that property;
  selected-campus finance write is technically unsound today.

## C.6 Communication and personal delivery

### 27. `announcements` — SCHOOL-OWNED

- **References:** `created_by` attribution-only.
- **Read:** ODA all; P-all all; P-selected class-targeted scope plus appropriate
  school-wide staff notices; Teacher `all`/`teachers` plus taught-class notices;
  Guardian `all`/`parents` plus Own-student-class notices. `students` has no
  direct recipient in V1, and does not automatically mean Guardians.
- **Write:** ODA all. Recommended Principal write only `audience='class'` in
  scope and never a change into school-wide audience. Teacher authoring and
  `students` semantics are **approval required**.
- **Campus:** meaningful only for `audience='class'` via class campus;
  school-wide audiences are not campus rows.

### 28. `notifications` — SCHOOL-OWNED

- **References:** `user_id` is access-granting and composite tenant-bound.
- **Read:** every role, including ODA, only `user_id=auth.uid()`; PA all for
  support. No school-wide notification inbox.
- **Write:** trusted delivery writer. Recipient may mark only its own `read_at`;
  may not create, retarget, delete, or rewrite a notification.
- **Campus:** not meaningful; recipient identity grants access.
- **Risk:** own-row UPDATE alone lets a user alter title/body/type. This requires
  column grants or a controlled read-receipt function.

### 29. `message_threads` — SCHOOL-OWNED

- **References:** `created_by` attribution-only; visibility is granted only by
  `message_thread_participants`.
- **Read:** PA all for approved support; every other role, including ODA, only
  threads it participates in. This is a deliberate private-message exception to
  generic organisation-wide read.
- **Write:** user may create an own-school thread with `created_by=auth.uid()`
  only while valid initial participants are created atomically. No ordinary
  participant update/delete initially.
- **Campus:** not meaningful. Nullable `student_id` is context, not a grant.
- **Approval required:** management visibility and thread governance.

### 30. `message_thread_participants` — SCHOOL-OWNED join

- **References:** `user_id` is access-granting; this join is the visibility
  boundary for threads/messages.
- **Read:** PA all; a participant sees the roster only for a thread it joins;
  no ODA/P/T/Guardian school-wide list.
- **Write:** controlled thread-creation/participant-management path only. A
  direct self-insert into an inaccessible thread is prohibited as direct
  self-privilege escalation.
- **Campus:** not meaningful; participant identity is the boundary.
- **Risk:** a policy that queries this table to determine participation recurses.
  Use a narrowly scoped SECURITY DEFINER participation helper with
  `search_path=''`, analogous to existing membership helpers.

### 31. `messages` — SCHOOL-OWNED

- **References:** `sender_id` attribution-only; visibility comes from thread
  participation.
- **Read:** PA all; every other role only messages in a participant thread;
  no school/campus/student-link override by default.
- **Write:** active participant inserts `sender_id=auth.uid()` in the thread's
  school. No ordinary UPDATE/DELETE initially.
- **Campus:** not meaningful; thread participant access is not class access.
- **Risk:** use the same non-recursive participation helper. Sender attribution
  alone would otherwise permit posting to a thread the caller cannot read.

---

# §D. Functions and triggers affected by RLS

| Function / trigger | Tables it touches | RLS effect and required action |
|---|---|---|
| `accept_invitation(text, uuid)` | Existing RLS tables plus newly `profiles` | SECURITY DEFINER, `search_path=''`, no FORCE RLS: continues to bypass policies while using only locked invitation role/scope. No body change; re-run end-to-end acceptance tests after profiles RLS. |
| `approve_school_application(uuid, uuid, text)` | `school_applications`, `schools`, `profiles`, `memberships`, `platform_admins` | SECURITY DEFINER, `search_path=''`, no FORCE RLS: atomic transaction and PA check continue to work. No body change; re-run success, non-PA denial, and rollback tests after Batch 1. The obsolete two-argument version was dropped and is not relevant. |
| `is_platform_admin()`, `current_school_id()`, `has_school_staff_role(uuid)`, `has_school_admin_role(uuid)` | `platform_admins`, `profiles`, `memberships` | Already SECURITY DEFINER to avoid recursion. Retain their narrow signatures/pinned paths; no change. |
| `set_updated_at()` and all its BEFORE UPDATE triggers | Assigns only `NEW.updated_at` | No adjustment; it does not query another table. Column grants/RPCs still determine what callers may change. |
| `reject_reserved_shortcode()` / `schools_reject_reserved_shortcode` | Reads `reserved_shortcodes` | **DONE in batch 1** (`20260912000001`). The adjustment was required and the break was demonstrated, not merely predicted: a counterfactual probe with the old INVOKER body let an administrator rename their school to the reserved `www`. Now SECURITY DEFINER with the pinned empty `search_path` retained. |
| `sync_fee_record_amount_paid()` / `fee_payments_sync_amount_paid` | Reads `fee_payments`; updates `fee_records` | SECURITY INVOKER. No body/security-mode change only under the ODA school-wide finance-write model: the trigger sees the complete sum and can update the parent. Do not grant partial/campus-only payment writes without redesigning the pair. |
| `assert_selected_scope_names_campus()` / deferred membership-scope triggers | Existing `memberships`, `membership_campus_scopes` | Direct writers are PA/ODA and existing policies reveal the relevant school rows, so the assertion observes its real set. It touches none of the 31. Retest deferred insert, last-scope removal, scope-to-all escape hatch, and acceptance; no change proposed. |
| `assert_selected_invitation_names_campus()` / deferred invitation-scope triggers | Existing `invitations`, `invitation_campus_scopes` | Same conclusion. Retest PA/ODA direct writes and acceptance; no change proposed. |

`audit_logs` has no trigger. Its append-only guarantee is the existing privilege
revokes supplemented by RLS, not a row trigger.

---

# §E. Proposed migration sequence

These are new Phase 7 migrations, not reused Phase 3 design numbers. Each batch
needs allowed and denied PostgREST probes as PA, ODA, P-all, P-selected, T-all,
T-selected, Guardian, authenticated-without-membership, and anon where public
access exists.

| Order | Batch | Tables | Dependency / review goal |
|---|---|---|---|
| 1 | **Platform, public intake, profile boundary** — **DONE**, applied as `20260912000001_platform_and_identity_rls` | `subscription_plans`, `reserved_shortcodes`, `school_applications`, `contact_messages`, `platform_admins`, `profiles`, **`audit_logs`** | Applied. `audit_logs` was moved forward from batch 6 into this batch because its access model is platform/ODA-only and shares no predicate with the messaging tables. The reserved-shortcode trigger was made SECURITY DEFINER first, as this row required. Public INSERT-only forms preserved and re-verified. Both SECURITY DEFINER functions re-run end to end. PA governance and the profile self-edit field list are recorded below as still-open decisions. |
| 2 | **People and Guardian boundary** | `teachers`, `guardians`, `students`, `student_guardians` | Depends on profile rules. Define current enrollment and prove Guardian discovery/link escalation is denied. |
| 3 | **Academic structure, classes, roster, timetable** | `academic_years`, `terms`, `subjects`, `classes`, `class_subjects`, `class_enrollments`, `timetable_slots` | Depends on people. Add/review shared campus/teaching helpers; prove selected scope, NULL-campus denial, and cross-campus move denial. |
| 4 | **Teaching records** | `attendance_records`, `grade_records`, `homework`, `homework_submissions`, `exams` | Depends on class/assignment predicates. Approve attendance-marker rules first; prove teacher/Guardian boundaries and every WITH CHECK path. |
| 5 | **Commercial and finance** | `school_subscriptions`, `fee_records`, `fee_payments` | Depends on people/terms. Approve finance corrections/voids; test Guardian own-student reads and all payment trigger cases. |
| 6 | **Announcements, private delivery, messaging** | `announcements`, `notifications`, `message_threads`, `message_thread_participants`, `messages` (`audit_logs` moved to batch 1) | Depends on people/classes. Establish non-recursive participant helper, notification read receipt, audit trusted writer, and privacy governance before policy SQL. |

The order follows actual dependencies: platform/profile authority; people;
classes and assignments; teaching records; finance; then communications. Do not
merge these batches: each contains a different security boundary and test set.

## E.1 Batch 1 — applied and verified

**Status: batch 1 of 6 complete.** Seven tables carry RLS and 13 policies; 24
tables remain unprotected and are batches 2-6. Verified by 63 probes run as
platform admin, School A administrator, School A teacher, School A guardian,
School B administrator, `service_role`, and `anon`, each inside a rolled-back
transaction so no fixture persisted.

What batch 1 proved, beyond the policies themselves:

- **A real break was found and fixed.** `reject_reserved_shortcode()` was
  SECURITY INVOKER and read `reserved_shortcodes`. With RLS on that table an
  owner/director/administrator — who may update their own school under
  `schools_admin_update` — saw an empty reserved list, so the guard passed
  silently. A counterfactual probe restored the pre-migration body in a
  rolled-back transaction and confirmed an administrator could rename their
  school to `www`; the shipped SECURITY DEFINER body rejects it with 23514.
  This is the pattern §D predicted, now demonstrated rather than reasoned.
- **Grant ceilings outrank policies.** `audit_logs` UPDATE, DELETE and TRUNCATE
  stay denied for platform admin and `service_role` alike, because the
  `20260905000001/2` revokes are a ceiling no policy can raise. `service_role`
  keeps INSERT and BYPASSRLS, so the trusted audit writer path is open.
- **RLS cannot restrict columns.** `profiles` moved to a column-level UPDATE
  grant on `full_name`, `phone`, `locale`, `avatar_url`; attempts to update
  `school_id` or `email` fail with 42501 at the grant layer, not the policy layer.
- **RLS denial on UPDATE/DELETE is silent.** A cross-school UPDATE or DELETE
  returns zero rows rather than an error. That is correct Postgres behaviour and
  callers must not treat a zero row count as success.

## E.2 Decisions locked after batch 1

These were approved during batch 1 and bind the later batches. They are recorded
here so the batch that implements them does not re-open the question.

| # | Decision | Binds |
|---|---|---|
| 1 | Any teacher who teaches a class — any subject, not only the homeroom/class teacher — may mark that class's attendance. | Batch 4, `attendance_records`. Supersedes the C.4/§G.3 recommendation of class-teacher-only marking. |
| 2 | Principal has write access, not read-only, on `students`, `classes`, `homework` and `exams`, within campus scope. | Batches 2, 3 and 4. Resolves the "approval required" markers on those four tables. |
| 3 | Fee and payment write access is exactly the owner/director/administrator set, with no further restriction and no separate finance role. | Batch 5. Keeps `sync_fee_record_amount_paid()` sound as SECURITY INVOKER, per C.5/§D. |
| 4 | Guardians never digitally submit homework. Homework is physical and a teacher marks it reviewed in person. No guardian submission write path is needed anywhere. | Batch 4, `homework_submissions`. Closes §G.7 and §H.6. |

## E.3 Findings from batch 1 still open

Neither is a regression introduced by the policies; both are gaps the probes
exposed. Applied migrations are never edited, so each needs a corrective
migration if it is to be closed.

1. **A signed-in user cannot submit the public sign-up form.** `/signup` is an
   unguarded public route and `school_applications` has an INSERT policy for
   `anon` only, so an authenticated visitor submitting the form is rejected with
   42501. Either guard the route in the UI or add an authenticated INSERT policy.
   Arguably the denial is correct and only the UI needs to change.
2. **The anonymous INSERT policies use `with check (true)`.** `anon` can insert a
   `school_applications` row already marked `approved` pointing at a real school,
   or carrying a forged `reviewed_by`, and a `contact_messages` row marked
   `handled`. No data becomes readable, so this is queue and metric poisoning
   rather than an access escalation, but it is looser than the discipline applied
   everywhere else. A tightened `with check` pinning the review columns to their
   unset state would close it without affecting the real forms.

---

# §F. Straightforward technical conclusions

1. School-owned rows first need the authoritative school predicate; subdomains
   and client campus inputs are never authority.
2. Campus scope is direct only on `classes` and inherited through §B's FK
   chains. Redundant descendant campus columns contradict the approved design.
3. Academic years, terms, and subjects are school-wide for selected staff.
4. Fees have no approved campus dimension; selected-campus finance writes are
   unsafe with the current trigger/query model.
5. Guardian access always follows `student_guardians`; it is never school-wide.
6. Notification recipients and thread participants are access-granting; author
   and sender fields are not.
7. Audit grant revokes survive RLS and must not be contradicted by policy.
8. Approval/invitation security-definer functions need no body change without
   FORCE RLS; the reserved-shortcode security-invoker trigger needs deliberate
   adjustment before its lookup table is protected.
9. RLS alone cannot constrain a user to `notifications.read_at`, preserve
   `fee_records.amount_paid`, or select profile fields. Those require column
   grants or controlled functions/RPCs.

---

# §G. Decisions requiring approval before Migration 9

> **Batch 1 is applied.** Items 3, 4 and 7 below, and the Principal-write half
> of item 2, were decided during batch 1 and are recorded in §E.2. The rest of
> this list still stands and gates batches 2-6. §E.3 adds two new open items
> that the batch 1 probes exposed.

1. Director versus Administrator permission matrix (Campus/Role Design §J3).
2. Principal operational writes: people, classes, enrollments, timetable,
   assessments, homework, exams, and announcements.
3. Class-teacher-only attendance marking (recommended) versus subject-teacher
   or campus-wide marking.
4. Financial authority, payment entry, correction/void/deletion workflow, and
   whether any role beyond ODA exists for it.
5. Definition of current enrollment/campus history, including unassigned,
   transferred, historical, and NULL-campus classes.
6. People-directory and contact-field privacy for selected Principals/Teachers.
7. Guardian self-service fields and guardian-as-homework-submitter behaviour.
8. Announcement authoring and the meaning/delivery of the `students` audience.
9. Private-message management visibility, participant changes, redaction, and
   retention.
10. Notification receipt/profile edit mechanisms and allowed fields.
11. Platform-admin grant/revoke governance, audit readers, and trusted audit
    emission path.
12. Anonymous read of public subscription plans if Pricing becomes database-led.

---

# §H. Open questions not resolvable from current documents

1. The approved documents avoid scalar campus fields on people and flag a
   future temporal campus-history model, but do not define the RLS treatment of
   unassigned, transferred, closed-year, or NULL-campus student data.
2. They do not define Principal write authority or distinguish Director from
   Administrator outside the existing authorisation-table policy.
3. They do not define a payment void/reversal workflow, finance-clerk role, or
   browser-versus-back-office payment entry.
4. They do not define message moderation, organisation-management visibility,
   or mutability; the schema establishes participant visibility only.
5. They do not identify self-editable profile fields or provide a column-level
   mechanism for `read_at`, `amount_paid`, and other restricted fields.
6. They do not say whether Guardians submit homework or receive student-only
   announcements in a system with no student logins.

These questions must remain open rather than be silently resolved in an RLS
predicate.

---

# §I. Acceptance criteria for each batch

- Cross-school SELECT/INSERT/UPDATE/DELETE is denied for every protected row.
- Selected staff cannot read or move a class descendant outside allowed
  campuses, including NULL-campus rows.
- Guardians see only Own-student data and cannot create `student_guardians`.
- Teachers cannot read/write another teacher's grades, homework, roster, or
  attendance outside the approved marker rule.
- Principals/Teachers cannot create memberships, invitations, participants, or
  other records that grant greater capability.
- `accept_invitation` and `approve_school_application` still pass end-to-end
  under RLS with no FORCE RLS.
- Payment insert/update/delete/repoint/overpayment probes keep `amount_paid`
  correct or roll back atomically.
- Audit UPDATE/DELETE/TRUNCATE remain denied by grants; audit read is tenant
  filtered; only the approved trusted writer inserts.
- Notification recipients cannot edit payload fields, and thread/message access
  is impossible without a participant row.

**End of investigation. No migration, policy, code, grant, or configuration
change is made by this document.**
