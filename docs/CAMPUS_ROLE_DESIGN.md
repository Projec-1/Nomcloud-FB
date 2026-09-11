# Nom Cloud — Campus and Expanded Role Design

**Status:** Design only. This document proposes additive database and authorization
changes. It does not implement SQL, migrations, application code, Supabase changes,
or frontend UI.

**Authority:** [SCHEMA_DESIGN.md](./SCHEMA_DESIGN.md) remains the Phase 3 schema
authority. [AUTH_DESIGN.md](./AUTH_DESIGN.md) remains the Phase 4 authentication
authority except where this document explicitly proposes a future amendment for the
six-role, multi-campus model.

## §A. GAP ANALYSIS — CURRENT STATE

### A.1 Repository and live-database evidence

The applied migration set is still the Phase 3 series through
`20260905000002`, followed by the Phase 4 invitation migrations
`20260906000001` and `20260906000002`. No campus migration exists.

The live Supabase REST API was queried read-only on 2026-09-08 using the public
publishable key. The expected 34 public tables are present. For every relevant
table tested — including `schools`, `classes`, `class_subjects`,
`class_enrollments`, `timetable_slots`, `attendance_records`, `grade_records`,
`homework`, `homework_submissions`, `exams`, `teachers`, `students`,
`guardians`, `student_guardians`, `memberships`, `profiles`, and `invitations` —
`select=campus_id` returned PostgreSQL `42703`: the column does not exist.

The live catalog also accepted reads of:

- `teachers.staff_no`;
- `students.admission_no`;
- `memberships.role`, `memberships.teacher_id`, and `memberships.guardian_id`;
- `profiles.school_id`.

The queried people and membership tables are empty except for the known bootstrap
profile, so live rows cannot demonstrate role variety. The applied migration
`20260903000001_extensions_and_enums.sql` defines `user_role` with only
`admin`, `teacher`, and `parent`; the live `memberships.role` shape therefore
matches the current three-role design.

### A.2 Current capability matrix

| Capability | Current status | Evidence |
|---|---|---|
| Multiple campuses per school | **Does not support** | No `campuses` table or `campus_id` column exists in the applied migrations or live REST schema. |
| Table-level notion of physical campus | **Does not support** | Live `campus_id` probes returned `42703` for all evaluated tables. |
| More than three roles | **Does not support** | `user_role` is the three-value Phase 3 enum: `admin`, `teacher`, `parent`. |
| Membership scoped to selected campuses | **Does not support** | `memberships` has school and role identity only; no campus scope relation exists. |
| Organization-wide aggregate across campuses | **Partially supports** | School-wide rows can be queried by `school_id`, but there are no campus partitions, campus-aware authorization predicates, or campus-aware reporting dimensions. |

The live database and design documents agree on these gaps. The only material
documentation/application drift relevant here is that `AUTH_DESIGN.md` still
contains historical platform-admin bootstrap and authority text, while the
platform UI was removed as out-of-scope. That historical identity concept is not
reused as a campus role.

## §B. PROPOSED CAMPUS MODEL

### B.1 Campus entity

Add a school-owned `campuses` entity:

- `id` as the campus identifier;
- `school_id NOT NULL`;
- human name and optional code;
- address/contact fields appropriate to a physical site;
- lifecycle status (`active`, `inactive`, or another explicitly approved
  vocabulary);
- timestamps and the standard `(school_id, id)` unique target.

The campus belongs to exactly one school. Its uniqueness rules should be
per-school, not global: campus code and campus name must not collide within one
school, while different schools may reuse them.

The existing tenancy rule remains unchanged: campus-owned rows continue to carry
`school_id`, and relationships to campus use composite
`(school_id, campus_id) -> campuses(school_id, id)`. This prevents cross-school
campus references structurally.

### B.2 Campus placement by table

| Table | Recommendation | Reason |
|---|---|---|
| `schools` | No `campus_id` | A school is the tenant root and owns many campuses. |
| `campuses` | New table | Physical-site root inside a school. |
| `classes` | **Add `campus_id`** | A class is offered at one physical campus; this is the primary academic campus anchor. |
| `class_subjects` | Do not add | Campus is derivable through the composite FK to `classes`; carrying it again creates a second consistency obligation. |
| `class_enrollments` | Do not add | Campus is derivable through `class_id -> classes`; adding it would duplicate class location. |
| `timetable_slots` | Do not add initially | The slot belongs to a class, so campus is reachable through `class_id`. A separate room/site model may later be needed for cross-campus resources, but not for this first additive design. |
| `attendance_records` | Do not add | The record is tied to a class and student; class campus is derivable. |
| `grade_records` | Do not add | The academic context reaches a class and student; campus is derivable through class. |
| `homework` | Do not add | Homework is class-owned; campus follows the class. |
| `homework_submissions` | Do not add | Campus follows the submitted homework and its class. |
| `exams` | Do not add initially | The exam is class-owned. If an exam can be held at a different campus from its class, that is a separate examination-location requirement and should not be guessed here. |
| `teachers` | Do not add | A teacher may work at multiple campuses. Campus belongs in membership scope, not on the employment person row. |
| `students` | Do not add | A student may move campuses over time; current and historical placement belongs in enrollment/assignment records, not the person row. |
| `guardians` | Do not add | Guardian access is student-specific and must remain independent of campus. |
| `student_guardians` | Do not add | This relationship is the guardian access boundary, not a campus assignment. |
| `academic_years`, `terms`, `subjects` | Do not add | These are school-wide academic structures unless a later business decision explicitly makes them campus-specific. |
| `school_subscriptions` | Do not add | Commercial ownership is school-level. |
| `fee_records`, `fee_payments` | Do not add initially | Fees are student/term records; campus can be derived only if a separate student-campus history is approved. Do not imply a current campus by duplicating one. |
| `announcements` | Do not add initially | Existing audience semantics are school/class based. Campus-targeted announcements need a separate audience design, not an unexamined nullable column. |
| `notifications`, messaging tables | Do not add | Recipient and participation determine access. Campus filtering must be applied through the recipient's role/scope and related school records. |
| `audit_logs` | Do not add | Audit rows retain school scope and actor snapshots; campus can be recorded as an event entity/detail if operational audit requirements later demand it. |
| `profiles` | Do not add | A person can hold roles across campuses; personal identity is not campus identity. |
| `memberships` | Do not add a scalar `campus_id` | Scope is one-to-many and requires a scope relation described in §D. |
| `invitations` | Do not add initially | Invitations should carry role and, when needed, proposed campus scope through the future invitation/scope design, not a single campus column that cannot represent multiple campuses or all-campus scope. |

### B.3 Class descendants and redundant campus columns

`classes` is the recommended campus-bearing table because it is the common
physical-site anchor for class subjects, rosters, timetable, attendance, grades,
homework, submissions, and examinations. Those descendants already carry
`school_id` for the approved RLS/indexing pattern, but they should not also carry
`campus_id` merely to repeat a value reachable through a composite class FK.

If later requirements introduce records that can exist independently of a class
but still belong to a physical site, that record should be evaluated separately.
Campus must not be copied pre-emptively into all 34 tables.

## §C. PROPOSED ROLE MODEL

### C.1 Six role values

The future membership role vocabulary is:

| Role | Scope default | Identity attachment |
|---|---|---|
| `owner` | Organization-wide, all campuses | No separate person table |
| `director` | Organization-wide, all or selected campuses by policy | No separate person table |
| `administrator` | Organization-wide, all or selected campuses by policy | No separate person table |
| `principal` | One or more specific campuses | No separate person table |
| `teacher` | One or more specific campuses, usually through teaching assignments | `teacher_id` |
| `guardian` | Student-specific through `student_guardians` | `guardian_id` |

Owner, Director, Administrator, and Principal are organizational roles, not
employment/person entities equivalent to `teachers` or `guardians`. They should
attach directly to a membership. Their human identity remains `profiles` and
their authorization is membership plus scope.

### C.2 Membership constraint restructuring

The current positive membership check admits exactly:

```text
admin    + no teacher_id + no guardian_id
teacher  + teacher_id    + no guardian_id
parent   + no teacher_id + guardian_id
```

It must be replaced by an approved six-role check:

```text
owner         + no teacher_id + no guardian_id
director      + no teacher_id + no guardian_id
administrator + no teacher_id + no guardian_id
principal     + no teacher_id + no guardian_id
teacher       + teacher_id    + no guardian_id
guardian      + no teacher_id + guardian_id
```

The existing `teacher_id` and `guardian_id` composite foreign keys extend
cleanly for the two person-linked roles. They do not need to be generalized to
the four organizational roles. The role/identity check must change, and the
existing `admin` and `parent` values require an explicit naming decision:

- `admin` should not silently mean all of Owner, Director, Administrator, and
  Principal. The proposed model uses distinct values.
- Existing `parent` data, if any, must be renamed or mapped to `guardian` in a
  deliberate compatibility migration. No destructive rename should be assumed.

### C.3 One account and multiple memberships

The identity rule remains one `auth.users` row per human. A person with
Administrator and Director roles receives two memberships under the same
profile, not two accounts. The existing unique key `(user_id, role)` remains
appropriate within the one-school model, subject to the role-value expansion.

## §D. PROPOSED SCOPE MODEL

### D.1 Scope cannot be a scalar

`all campuses` and `these specific campuses` are different cardinalities. A
nullable scalar `memberships.campus_id` cannot represent both without sentinel
values or ambiguous NULL semantics. Sentinel values would be authorization
hazards and violate the schema's preference for explicit relational state.

Add a join table, named for example `membership_campus_scopes`, with:

- `school_id`;
- `membership_id`;
- `campus_id`;
- standard timestamps if operationally useful;
- composite foreign key from membership to the same school;
- composite foreign key from campus to the same school;
- unique `(school_id, membership_id, campus_id)`.

The all-campus case should be represented by an explicit membership scope mode,
not by an empty join-table set whose meaning could be mistaken for no access.
Two viable shapes exist:

1. `memberships.scope_mode = 'all' | 'selected'`, with selected memberships
   requiring one or more join rows; or
2. a separate `membership_scope_modes` one-to-one table.

The first is simpler and remains auditable if enforced by a constraint or
transactional operation. It should be preferred unless future scope types
(`school-wide`, `campus-group`, time-bounded scope) justify a richer policy
table.

For Owner, and normally Director/Administrator, `scope_mode='all'` grants
organization-wide campus scope. Principal and Teacher normally use `selected`.
Guardian does not use campus scope to authorize student data: guardian access
continues through `student_guardians` (§E).

### D.2 Composite tenancy

The scope join table must use the same composite-tenancy discipline as the
existing schema. A membership from school A must not point to a campus in school
B, even if a caller supplies both IDs. Scope checks in Phase 7 must combine:

1. authenticated user;
2. membership;
3. role;
4. school;
5. campus scope where the role is campus-scoped.

The active-role switcher remains presentation state and never becomes scope
authority.

## §E. GUARDIAN ACCESS — UNCHANGED

Guardian access remains student-specific through `student_guardians`, exactly as
already designed and audited. The campus expansion must not redesign this
relationship, add campus-wide guardian access, or infer guardian access from a
guardian's membership role alone.

A guardian may be linked to multiple students, and students may have multiple
guardians. The guardian sees only records authorized through those relationships
and the applicable student-owned records. Any student's campus is a property of
the student's academic placement, not a grant to every guardian in that campus.

## §F. IDENTITY IDENTIFIERS

Identifiers such as `SNS-ADM-001` must not be implemented as authoritative
stored columns in this design.

Current support is uneven:

- `teachers.staff_no` already exists and is unique per school when present.
- `students.admission_no` already exists and is required and unique per school.
- `guardians` has no equivalent identifier column.
- Owner, Director, Administrator, and Principal have no separate identity table
  or identifier column; they are memberships attached to profiles.

A display-only label can be derived from the school's `shortcode`, a role
abbreviation, and a deterministic sequence over existing records. However, a
sequence derived from query order is not a stable authoritative identifier
unless a stored sequence or identifier is later approved. Therefore:

1. use existing `staff_no` and `admission_no` where they are present;
2. treat any `SNS-*` value for other roles as presentation-only;
3. do not use display labels in foreign keys, RLS, invitations, or audit
   authorization;
4. defer stored guardian/admin/person identifiers to a separate decision and
   migration.

## §G. IMPACT ON EXISTING DESIGN

### G.1 Leave untouched

- The 34 Phase 3 tables remain the foundation.
- `auth.users -> profiles -> memberships` remains the identity chain.
- One human still has one Auth account and one school under the current
  one-school model.
- `profiles.school_id` remains authoritative.
- `school_id` remains directly present on school-owned tables.
- Composite foreign keys remain the structural cross-school protection.
- Scoped `SET NULL` remains mandatory wherever a future composite nullable
  reference needs it.
- `student_guardians` and guardian access remain unchanged.
- No password column is introduced.
- Phase 4 `accept_invitation` remains transactional and invitation-driven.

### G.2 Future changes required

| Existing object | Required future impact |
|---|---|
| `20260903000001_extensions_and_enums` / `user_role` | Extend or replace the role vocabulary with six approved values; choose compatibility handling for `admin` and `parent`. |
| `memberships` | Replace the positive three-role check with the six-role check; add explicit scope mode; preserve `(user_id, role)` uniqueness unless role history requirements change. |
| `teachers`, `guardians` | Leave columns and composite FKs intact; they remain person records for only Teacher and Guardian. |
| `classes` | Add composite campus reference and per-school/per-academic-year campus-aware uniqueness as needed. |
| New `campuses` table | Add after `schools`, before campus-bearing class changes. |
| `class_subjects`, `class_enrollments`, timetable and class descendants | Keep `school_id` and composite class FKs; do not add redundant `campus_id` by default. |
| New membership scope table | Add composite references to memberships and campuses. |
| `invitations` | Extend role validation and eventually carry role/scope intent; raw tokens remain hashed and single-use. |
| `accept_invitation` | Validate the expanded role set and create the requested membership/scope transactionally. It must never accept a caller-selected role or campus scope as authority. |
| `AUTH_DESIGN.md` | Amend the three-role tables, role resolution, invitation role rules, and one-school wording to describe six roles while retaining one account/one school. |
| Phase 7 RLS/grants | Add organization-wide versus campus-specific predicates; no RLS shortcut may treat active role or a client campus value as authority. |

The existing Phase 4 frontend role routes are not expanded by this document.
Until a later UI phase, new memberships may exist at the database level without
corresponding frontend routes.

## §H. DELIBERATELY OUT OF SCOPE

This document does not cover:

- frontend UI for Owner, Director, Administrator, Principal, Teacher, or
  Guardian as six separate experiences;
- a campus switcher interface;
- the three-step application form;
- public onboarding or school approval UX;
- invitation email delivery;
- Supabase/Vercel configuration;
- SQL, migrations, data backfills, or live database changes;
- RLS implementation itself;
- reporting screens or cross-campus dashboard UX.

This is a database and authorization-model design only.

## §I. MIGRATION PLAN — NAMES AND SEQUENCE ONLY

No SQL is specified here.

| Order | Proposed migration name | Contents | Depends on | Status |
|---|---|---|---|---|
| 1 | `campuses` | Create `campuses`, school ownership, per-school uniqueness, lifecycle fields, and composite-FK target | `20260904000002_schools` | **DONE** — applied as `20260908000001_campuses` |
| 2 | `membership_role_expansion` | Add six-role vocabulary compatibility and replace the three-role positive membership check | `20260903000001_extensions_and_enums`, `20260904000003_identity` | **DONE** — applied as `20260908000002_membership_role_expansion`; also added the J2 owner partial unique index |
| 3 | `membership_campus_scope` | Add explicit all/selected scope mode and `membership_campus_scopes` with composite tenancy | `membership_role_expansion`, `campuses` | **DONE** — applied as `20260911000002_membership_campus_scope` |
| 4 | `classes_campus` | Add campus ownership to classes, composite campus FK, and campus-aware class uniqueness/indexes | `campuses`, `20260904000008_classes_and_timetable` | **DONE** — applied as `20260911000003_classes_campus`; class naming is now campus-aware with `NULLS NOT DISTINCT` |
| 5 | `campus_scope_integrity` | Add or revise constraints/triggers needed to keep role, scope mode, and scope rows consistent | `membership_campus_scope`, `classes_campus` | **DONE** — applied as `20260911000004_campus_scope_integrity`; resolves J open question 6 |
| 6 | `invitation_role_scope_expansion` | Extend invitation role validation and store/validate invitation scope intent without storing bearer tokens | `membership_campus_scope`, `20260906000001_accept_invitation` | **DONE** — applied as `20260911000005_invitation_role_scope_expansion`; resolves J open question 11 |
| 7 | `accept_invitation_role_scope` | Update `accept_invitation` to create six-role memberships and approved campus scopes transactionally | `invitation_role_scope_expansion`, `20260906000002_revoke_accept_invitation_anon` | **DONE** — applied as `20260911000006_accept_invitation_role_scope` |
| 8 | `campus_rls_and_grants` | Phase 7 authorization policies for school-wide, campus-scoped, and guardian-student access | All preceding migrations; existing Phase 3 grants | NOT STARTED |

Migration ordering must preserve the repository rule that applied migrations are
never edited; corrections are new migrations.

## §J. RISKS AND OPEN QUESTIONS

1. **J1 RESOLVED — role naming compatibility:** The existing `admin` is renamed
   outright to `administrator`, and `parent` is renamed outright to `guardian`.
   There is no compatibility alias period. This is a live data migration concern
   for Migration 2 (`membership_role_expansion`): it must handle existing rows,
   not only change the enum definition.
2. **J2 RESOLVED — Owner semantics:** Exactly one Owner is allowed per school.
   This is an enforced constraint, not documentation only, using the same pattern
   as the existing one-active-academic-year-per-school partial unique index from
   Phase 3. Migration 2 or 3 must add a partial unique index equivalent to
   `(school_id) WHERE role = 'owner'`.
3. **Director and Administrator distinction:** The brief supplies names but not
   the permission matrix. Database role values alone do not define actions.
4. **J4 RESOLVED — Principal scope:** A Principal may be scoped to one or more
   campuses. The `membership_campus_scopes` join table already supports this
   without further change.
5. **J5 RESOLVED — Teacher scope:** Teacher campus scope is the UNION of explicit
   scope grants through `membership_campus_scopes` and class-derived scope through
   existing class assignments. A teacher's effective scope is whichever is broader,
   not either source exclusively. Phase 7 authorization logic must compute this
   union rather than checking only one source.
6. **J6 RESOLVED — All-campus representation:** `scope_mode = 'selected'` with
   zero `membership_campus_scopes` rows is rejected. A membership scoped to
   specific campuses that names none can act nowhere, silently, which is far
   more likely a mistake than an intended lockout; `memberships.status` is the
   explicit way to suspend someone. Enforced by a DEFERRABLE INITIALLY DEFERRED
   constraint trigger in Migration 5, so a membership and its scope rows may be
   written in either order within one transaction and are checked once at
   commit.
7. **Campus history:** Students and teachers may move campuses. This design
   deliberately avoids scalar campus columns on people, but a temporal
   assignment/history table may be required for reporting and authorization.
8. **Non-class physical records:** Exams, fees, events, rooms, resources, and
   announcements may eventually need a physical location. This document does
   not assume those requirements.
9. **J9 RESOLVED — Cross-campus academic structures:** Subjects and academic years
   remain school-wide, shared across all campuses of one school. No `campus_id` is
   added to `academic_years`, `terms`, or `subjects`. This confirms the §B.2
   recommendation already made for these tables.
10. **Guardian notifications:** Guardian access is unchanged, but notification
    delivery may need campus-aware operational routing without changing the
    access relationship.
11. **J11 RESOLVED — Invitation scope:** An invitation carries the same shape a
    membership does. `invitations.scope_mode` is `'all'` or `'selected'` under
    the same role restriction, and a `'selected'` invitation names its intended
    campuses in `invitation_campus_scopes`. Those rows are intent only; the real
    grant is written to `membership_campus_scopes` at acceptance by Migration 7.
    The at-least-one-campus rule is enforced by a deferred constraint trigger
    limited to live invitations, so a pending invitation blocks deletion of the
    last campus it names while an accepted or revoked one never does.
12. **One-school rule:** The brief explicitly preserves the existing
    one-user-one-school model. Multi-campus access does not imply multi-school
    access; changing that remains a separate design.
13. **Phase 7 dependency:** With zero RLS policies and broad grants still
    present, campus columns and roles would provide no security until
    authorization policies and grants are implemented. No real school data
    should be entered before that work.

**Design conclusion:** Campuses should be a new school-owned entity anchored at
`classes`; scope should be an explicit membership mode plus a composite join
table; organization roles should be direct memberships; Teacher and Guardian
remain the only roles linked to existing person tables; and guardian access must
continue exclusively through `student_guardians`.
