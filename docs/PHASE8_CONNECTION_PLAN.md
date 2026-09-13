# Nom Cloud — Phase 8 Frontend-to-Database Connection Plan

**Status:** Discovery, amended 2026-09-13 with five locked decisions, and
**Batch 0 applied 2026-09-13**. Sections A to F remain the survey of the distance
between the prototype frontend and the finished database; §G carries live batch
status.

Batch 0 delivered the four-state contract, the decision 9 weekday and timezone
fixes, and the demo-tenant marker and boundary. Migration
`20260913000002_school_is_demo`. Batch 1 has not started.

**Five of the twelve decisions in §I.1 are settled** and are recorded in §A.5.
Sections D.5, D.6, E.2, F.7, G, H.1, H.5, H.9, I.1 and I.2 were revised to match
them. The demo-mode separation mechanism recommended in §H.9 was approved and is
built. Six decisions remain open, each blocking only the batch that touches it.

**Authority:** [SCHEMA_DESIGN.md](./SCHEMA_DESIGN.md) is the schema authority,
[AUTH_DESIGN.md](./AUTH_DESIGN.md) the identity authority,
[CAMPUS_ROLE_DESIGN.md](./CAMPUS_ROLE_DESIGN.md) the role and campus authority,
and [RLS_FULL_ROLLOUT_PLAN.md](./RLS_FULL_ROLLOUT_PLAN.md) the access-control
authority. Where this document draws a conclusion those four do not settle, it
is marked **approval required**.

---

# §A. Scope and method

## A.1 The situation in one paragraph

Phase 3 built 37 tables. Phase 4 made authentication real. Phase 7 put
row-level security on all 37 tables across 197 policies. The frontend did not
move. Every screen except sign-in still reads and writes
`src/data/mockData.ts` through `src/context/DataContext.tsx`, persisted to a
`localStorage` blob. The database is finished and empty; the application is
unfinished and full.

## A.2 Evidence base

Every statement about the frontend comes from reading the repository. Every
statement about the database comes from querying the live catalog on
2026-09-13, not from the design documents, because the design documents predate
seven Phase 7 migrations. Where the two disagree, this document reports the
catalog.

## A.3 Three layers, currently out of step

| Layer | State | Source of truth today |
|---|---|---|
| Identity | **Real.** Sign-in, profile, memberships, school and platform-admin status all come from Supabase. | `AuthContext`, `identityService` |
| Authorisation | **Real and complete.** 37 tables, 197 policies, no table unprotected. | Postgres RLS |
| Domain data | **Mock.** 15 in-memory collections seeded from a file and persisted to `localStorage`. | `DataContext`, `mockData.ts` |

The middle layer is the one nobody has met yet. The frontend has never issued a
domain query that RLS could refuse.

## A.4 A finding that precedes everything else

**The teacher and parent workspaces are already broken against a real sign-in,
and have been since Phase 4.** This is not a future risk; it is the current
state.

Phase 4 wired identity to real UUIDs. The data stayed mock, with short string
ids. The two are compared directly:

```
src/pages/app/teacher/Dashboard.tsx:22
  const myClasses = classes.filter((c) => c.teacherId === activeMembership?.teacher_id)
```

`classes[].teacherId` is `'t1'` through `'t8'` from the seed.
`activeMembership.teacher_id` is a UUID or null. The comparison never matches,
so `myClasses` is always empty. The same pattern appears in all seven teacher
pages. `useSelectedChild` does the same thing with `guardian_id` against mock
parent ids `'p1'`, `'p2'`, so every parent page resolves to no child.

Only the administrator workspace still appears to work, and only because its
pages never filter by identity. They read the whole mock collection.

The practical consequence for planning: this is not a migration from a working
prototype to a working product. Two of the three workspaces must be rebuilt
against real data regardless, so there is little value in preserving their
current data-access shape.

**Does this change which batch goes first?** No, and the reason is worth stating
because the intuition points the other way.

The administrator workspace is the only one that still limps along, and it does
so precisely because it never filters by identity. It reads whole mock
collections. That makes it the *least* informative thing to connect first: it
would exercise no identity predicate, no campus scope, no guardian link, and
none of the `is_thread_participant`, `teaches_class` or `is_guardian_of_student`
helpers that the other two workspaces depend on entirely.

The dependency order in §G is driven by data shape, not by workspace health.
Batches 1 and 2 carry no identity predicate at all, so they are equally safe
whichever workspace is broken. Batch 3 fixes `useSelectedChild` and with it the
parent workspace; batch 4 fixes the teacher class filter and with it the teacher
workspace. Both land as early as their dependencies allow. Reordering to lead
with the administrator screens would defer the first real test of identity-scoped
reading until batch 5 or later, which is the opposite of what §A.4 argues for.

What the finding does change is the acceptance criterion. Each batch is not done
when the administrator screens still render; it is done when a real teacher and a
real guardian sign in and see their own data. That criterion is recorded against
every batch in §G.

## A.5 Decisions locked on 2026-09-13

Five of the twelve product decisions in §I.1 are settled. They are recorded here
once and reflected throughout.

| # | Decision | Effect on this plan |
|---|---|---|
| 1 | **Owner, director and principal get no workspace in this phase.** They stay locked out and see a clear "You don't have access to this" message if they reach a protected route. Administrator, teacher and parent are rebuilt properly first. | Removes principal variants from every batch. Batches 1, 3, 4 and 5 simplify. Their database capability remains real and unreachable through the product, by choice. |
| 2 | **The frontend does not become campus-aware in this phase.** Every school is treated as effectively single-campus. `scope_mode` and `membership_campus_scopes` are read for no UI filtering decision. | `campuses` leaves batch 1. `classes.campus_id` is carried but never filtered on in batch 4. `MembershipRow` does **not** gain `scope_mode`. |
| 3 | **A denied read renders "You don't have access to this."** Not a blank screen, not a crash, not an unexplained redirect. Applies both to RLS returning no rows and to a route the role cannot reach. | Becomes an explicit part of the Batch 0 state contract; see §F.7 and §G. |
| 9 | **Somalia is the target market. `weekend_days` drives the calendar as Friday and Saturday.** | No schema change. The column already exists with the right default and is already fetched. Three frontend sites hardcode Monday to Friday and must stop; see §D.6. |
| 12 | **Demo mode is kept, structurally separated from real data, not removed.** | Mechanism from §H.9 **approved and built in Batch 0**: a real demo tenant marked by `schools.is_demo`, the reserved `demo` shortcode, a persistent indicator, and a compile-time production boundary. |

Six decisions from §I.1 remain open. None blocks Batch 1; each blocks the batch
that touches it.

---

# §B. Mock data inventory

## B.1 The fifteen collections

`DataContext` holds one state object with fifteen slices, seeded from
`mockData.ts` (551 lines) and persisted whole to `localStorage` under
`nomcloud_school_data_v2`.

| Slice | Seed export | Shape notes |
|---|---|---|
| `academicYears` | `academicYears` | 3 years, each with a nested `terms[]` array |
| `settings` | `schoolSettings` | One object, id `sch-001` |
| `teachers` | `teachers` | 8, generated from `teacherSeed` |
| `students` | `students` | 6 per class, generated |
| `parents` | `parents` | Generated, every third student shares one |
| `classes` | `classes` | Generated from `classSeed` |
| `attendance` | `attendanceRecords` | Last 12 school days, all classes |
| `grades` | `gradeRecords` | Generated |
| `homework` | `homeworkList` | Each carries an embedded `submissions[]` |
| `exams` | `exams` | Generated |
| `fees` | `feeRecords` | Each carries an embedded `payments[]` |
| `announcements` | `announcements` | 3 hand-written |
| `notifications` | `notificationSeed` | Mapped onto synthetic scope keys at init |
| `messageThreads` | `messageThreads` | Each carries embedded `messages[]` |
| `timetables` | derived in context | No seed export |

Two further exports are constants rather than collections: `CURRENT_TERM`, the
string `'Term 1'`, and four `find*` helpers.

## B.2 Consumers

Forty files call `useData()`. Grouped by workspace:

| Area | Files | Slices consumed |
|---|---|---|
| Shared dashboard components | `AnnouncementBoard`, `AttendanceMarker`, `GradeBook`, `HomeworkBoard`, `MessagesPanel`, `NotificationsDropdown`, `SchoolBrandLogo`, `Sidebar`, `Topbar` | announcements, students, attendance, grades, homework, messages, notifications, settings |
| Admin pages | `AcademicYears`, `Announcements`, `Attendance`, `Classes`, `Dashboard`, `Exams`, `Fees`, `Grades`, `Homework`, `Reports`, `Settings`, `Students`, `Teachers` | all fifteen |
| Teacher pages | `Announcements`, `Attendance`, `Classes`, `Dashboard`, `Grades`, `Homework`, `Messages` | classes, students, attendance, homework, timetables, messageThreads, teachers, parents |
| Parent pages | `Announcements`, `Attendance`, `Children`, `Dashboard`, `Fees`, `Grades`, `Homework`, `Messages`, `Notifications` | classes, attendance, grades, fees, homework, announcements, notifications, messageThreads, teachers, parents |
| Hooks | `useSelectedChild` | parents, students |

## B.3 Mutators

`DataContext` exposes 33 mutators. Each one is a candidate write path that RLS
will now adjudicate. The ones that matter most are listed in §F.

---

# §C. The gap, table by table

All 37 tables, with what the frontend has today.

## C.1 Already connected to the real database

Five tables are real, from Phase 4 and the application-approval work.

| Table | Frontend | Where |
|---|---|---|
| `profiles` | Real read | `AuthContext`, `identityService` |
| `memberships` | Real read | `AuthContext`, `identityService` |
| `schools` | Real read **and** a competing mock | `identityService` reads the row; `DataContext.settings` holds a parallel mock object |
| `platform_admins` | Real read | `identityService`, `dev/ApprovalPanel` |
| `school_applications` | Real read and write | `public/Signup.tsx` inserts, `dev/ApprovalPanel` lists |
| `invitations` | Real read and write | `invitationService`, `admin/Teachers.tsx` |

`schools` is the one to watch. It is simultaneously real and mocked, and the
two disagree (§D.6).

## C.2 Mock data and UI exist, table not connected

Nineteen tables have a working prototype representation.

| Table | Mock representation | Principal UI |
|---|---|---|
| `academic_years` | `academicYears` | `admin/AcademicYears` |
| `terms` | Nested `AcademicYear.terms[]` plus the `CURRENT_TERM` string | Term selectors across grades, exams, fees |
| `teachers` | `teachers` | `admin/Teachers` |
| `guardians` | `parents` | `admin/Students`, all parent pages |
| `students` | `students` | `admin/Students` |
| `student_guardians` | `Student.parentId` scalar plus `Parent.studentIds[]` | implicit |
| `classes` | `classes` | `admin/Classes`, `teacher/Classes` |
| `class_subjects` | `SchoolClass.subject: string[]` | class editors |
| `class_enrollments` | `Student.classId` scalar plus `SchoolClass.studentIds[]` | rosters everywhere |
| `timetable_slots` | `timetables` | `admin/Classes`, `teacher/Classes` |
| `attendance_records` | `attendance` | `AttendanceMarker`, three Attendance pages |
| `grade_records` | `grades` | `GradeBook`, three Grades pages |
| `homework` | `homework` | `HomeworkBoard`, three Homework pages |
| `homework_submissions` | Embedded `Homework.submissions[]` | `HomeworkBoard`, `parent/Homework` |
| `exams` | `exams` | `admin/Exams` |
| `fee_records` | `fees` | `admin/Fees`, `parent/Fees` |
| `fee_payments` | Embedded `FeeRecord.payments[]` | payment dialogs |
| `announcements` | `announcements` | `AnnouncementBoard`, three Announcements pages |
| `notifications` | `notifications` | `NotificationsDropdown`, `parent/Notifications` |
| `message_threads` | `messageThreads` | `MessagesPanel`, two Messages pages |
| `message_thread_participants` | `MessageThread.participantIds[]` and `participantNames[]` | thread lists |
| `messages` | Embedded `MessageThread.messages[]` | `MessagesPanel` |

Six of those are not tables in the mock at all. They are arrays or scalars
embedded in a parent object, which is the deepest structural difference in this
document and is treated in §D.3.

## C.3 No frontend representation of any kind

Eleven tables have neither mock data nor UI.

| Table | Note |
|---|---|
| `campuses` | The entire campus model is invisible to the frontend. Three files mention the word, none read the table. |
| `membership_campus_scopes` | No concept of a scoped membership. |
| `invitation_campus_scopes` | Invitation UI exists but carries no scope. |
| `subjects` | Subjects exist only as free text on teachers, classes, grades, homework and exams. |
| `school_subscriptions` | No billing UI. |
| `subscription_plans` | `public/Pricing.tsx` is hardcoded marketing copy, not a read. |
| `reserved_shortcodes` | Enforced by trigger; no UI needed. |
| `contact_messages` | `contactService.ts` is a `localStorage` stub with a comment saying to swap it for a real call. |
| `audit_logs` | Nothing writes or reads them anywhere in the system. |
| `class_subjects` | Listed in C.2 as a string array, but there is no entity-level UI. |
| `fee_payments` | Listed in C.2 as an embedded array; no standalone ledger view. |

---

# §D. Shape mismatches

For every table with data on both sides. Real column types were read from the
live catalog.

## D.1 Identifiers — universal, and the single largest mechanical change

Every mock id is a short human-readable string. Every real id is a `uuid`.

| Mock | Example | Real |
|---|---|---|
| Student | `s1` | `uuid` |
| Teacher | `t1` | `uuid` |
| Class | `c1` | `uuid` |
| Parent | `p1` | `uuid` |
| Academic year | `ay-2025` | `uuid` |
| Term | `ay25-t1` | `uuid` |
| School | `sch-001` | `uuid` |
| Attendance | `att-1` | `uuid` |
| Fee | `fee-1` | `uuid` |
| Runtime-created | `makeId('stu')` → `stu-m1k2j3x` | `gen_random_uuid()` |

`src/utils/id.ts` generates base-36 strings and is used by every `add*` mutator.
Nothing in the frontend produces or expects a UUID outside the auth layer.

## D.2 Field naming

| Concept | Mock | Real |
|---|---|---|
| Person name | `name` | `full_name` on students, teachers, guardians, profiles |
| Student number | `admissionNo` | `admission_no` |
| Enrolment date | `enrolledDate` | `enrolled_date` |
| Teacher start | `joinedDate` | `joined_date` |
| Grade timestamp | `date` | `recorded_at` |
| Attendance author | `markedBy` | `marked_by` |
| Grade author | `recordedBy` | `recorded_by` |
| Homework author | `createdBy` | `created_by` |
| Homework dates | `assignedDate`, `dueDate` | `assigned_date`, `due_date` |
| Exam date | `date` | `exam_date` |
| Exam length | `duration` | `duration_minutes` |
| Payment date | `date` | `paid_on` |
| Message time | `date` | `sent_at` |
| Notification read | `read: boolean` | `read_at: timestamptz?` |
| Thread activity | `updatedAt` | `last_message_at` |

Beyond camelCase versus snake_case, three differences change meaning:

- **`read: boolean` versus `read_at: timestamptz`.** The real column records
  when, not whether. `markNotificationRead` would need to write a timestamp,
  and unread is `null` rather than `false`.
- **`duration` versus `duration_minutes`.** The unit is only implied in the mock.
- **The author columns point at different entities.** `AttendanceRecord.markedBy`
  holds a teacher id such as `'t1'`. The real `marked_by` is a foreign key to
  `profiles.id`, a **user** id. A teacher's `teachers.id` and their
  `profiles.id` are different UUIDs. Every author field must be re-sourced from
  the signed-in user, not from the teacher record. The same applies to
  `recorded_by`, `created_by`, `sender_id` and `recorded_by` on payments.

## D.3 Structural — scalars and embedded arrays that are really relations

This is the substantive work, not the renaming.

| Mock shape | Real shape | Consequence |
|---|---|---|
| `Student.classId: string` | `class_enrollments` rows, time-scoped per academic year | A student's class is a query, not a field. Historic classes become visible. |
| `Student.parentId: string` | `student_guardians` rows, many-to-many | One student can have two guardians; one guardian several children. The mock already fakes siblings by sharing a parent id, but cannot express two parents. |
| `Parent.studentIds: string[]` | `student_guardians` | Same relation from the other side. |
| `SchoolClass.studentIds: string[]` | `class_enrollments` | Roster is a query. |
| `SchoolClass.subject: string[]` | `class_subjects` rows referencing `subjects` | Subjects become entities with ids and their own teacher assignment. |
| `SchoolClass.teacherId: string` | `classes.class_teacher_id` **plus** `class_subjects.teacher_id` | The mock has one teaching link. The real model has two, and RLS uses both (§F.1). |
| `Teacher.classIds: string[]` | Derived from the two links above | Not a stored field. |
| `Teacher.subject: string` | `teachers.primary_subject_id: uuid` | Free text becomes a reference. |
| `AcademicYear.terms[]` | `terms` rows | Terms get ids, `sort_order`, and their own lifecycle. |
| `Homework.submissions[]` | `homework_submissions` rows | §C table 25 says this promotion is required so a parent sees their child's submission and not the other twenty-nine. RLS now enforces exactly that. |
| `FeeRecord.payments[]` | `fee_payments` rows | Payments become first-class, with the `amount_paid` trigger behind them. |
| `MessageThread.messages[]` | `messages` rows | |
| `MessageThread.participantIds[]` | `message_thread_participants` rows | This join is the RLS visibility boundary for the whole messaging feature. |

## D.4 Fields the mock stores that the database deliberately does not

`SCHEMA_DESIGN` §F lists data that must not be persisted. The mock persists it
anyway, so each becomes a read-time computation.

| Mock field | Real position |
|---|---|
| `FeeRecord.status` (`paid`/`partial`/`unpaid`/`overdue`) | **No such column.** Derived from `amount`, `amount_paid` and `due_date`. `MIGRATIONS.md` states plainly it must not be "fixed" by adding one, and it cannot be a generated column because `overdue` depends on today. |
| `GradeRecord.grade` (letter) | **No such column.** Derived from score over max under the school's `grading_scale`. |
| `MessageThread.participantNames[]` | Join to `profiles`. |
| `SchoolSettings.logoInitial` | Derive from `name`. |
| `avatarColor` on `Teacher`, `Student`, `Parent` | **No such column** on any of the three. §F recommends deriving it from an id hash. |
| `Homework.attachments: number` | **No such column and no storage bucket.** The concept does not exist in the database at all. |

## D.5 Vocabulary and value-format mismatches

Each of these would pass type-checking and fail at the database.

| Field | Mock | Real | Effect |
|---|---|---|---|
| `Role` | `'admin' \| 'teacher' \| 'parent'` | `user_role`: `owner`, `director`, `administrator`, `principal`, `teacher`, `guardian` | `src/lib/roles.ts` maps DB to workspace correctly, but `src/types/index.ts` still defines the old three and `Announcement.createdByRole` **stores** one in a data record. |
| `Student.gender` | `'Male' \| 'Female'` | CHECK `gender IN ('male','female','other')` | Wrong case, and missing a third value. |
| `Student.status` | `'active' \| 'inactive' \| 'graduated'` | adds `'transferred'` | Missing a state. |
| `Weekday` | `'Monday'…'Friday'` | `day_of_week smallint` ISO 1–7 | String union to integer. The union cannot express a Friday–Saturday weekend at all, which decision 9 now requires. See §D.6. |
| `FeePayment.method` | `card`, `bank_transfer`, `cash`, `mobile_money` | adds `evc_plus`, `edahab` | The two Somali mobile-money providers are missing from the frontend union. |
| `AttendanceStatus` | matches | `attendance_status` enum | The one clean match. |
| `AnnouncementAudience` | matches | CHECK, same five values | Matches, but see §F.8 on what the values now mean for visibility. |

## D.6 School settings — a real row and a mock object that disagree

`SchoolSettings` in the mock and the `schools` row are both live in the running
application, and they do not describe the same school.

| Mock field | Real column | Status |
|---|---|---|
| `id: 'sch-001'` | `id: uuid` | mismatch |
| `academicYearId` | **removed** by Amendment §14 | field no longer exists |
| `logoInitial` | derive from `name` | not persisted |
| `logoDataUrl` | `logo_path` (Storage path) | §F forbids base64 in the row |
| `timezone: 'Africa/Nairobi'` | default `'Africa/Mogadishu'` | different market |
| — | `country`, `currency`, `locale` | absent from the frontend |
| — | `weekend_days` default `{5,6}` | **absent, and the frontend hardcodes Monday–Friday** |
| — | `shortcode`, `status`, `suspended_at` | absent |

`weekend_days` is the consequential one, and **decision 9 settles it: Somalia is
the target market and `weekend_days` drives the calendar as Friday and
Saturday.**

**No schema change is needed, and none should be made.** Verified against the
live catalog:

```text
schools.weekend_days   smallint[]   NOT NULL   DEFAULT '{5,6}'::smallint[]
schools.timezone       text         NOT NULL   DEFAULT 'Africa/Mogadishu'
schools.country        char(2)      NOT NULL   DEFAULT 'SO'
```

Phase 3 already made every one of those correct. `SchoolRow.weekend_days:
number[]` already exists in `src/types/auth.ts`, and `fetchSchoolById` already
selects it. **The column is already being read into memory on every sign-in and
then ignored.**

So Batch 1 does not add a column, a query or a type. It removes three hardcoded
assumptions that currently override the value already in hand:

| Site | What it hardcodes |
|---|---|
| `src/utils/schoolCalendar.ts:23` | `if (day !== 0 && day !== 6)` skips Sunday and Saturday, a Monday–Friday week |
| `src/components/dashboard/TimetableGrid.tsx:5` | `WEEKDAYS` is a fixed five-element Monday–Friday array |
| `src/types/index.ts:50` | The `Weekday` union admits only Monday through Friday, so a Sunday timetable slot is not expressible |

A fourth site depends on the third: `src/pages/app/teacher/Dashboard.tsx:68`
computes `WEEKDAYS[now.getDay() - 1]`, which assumes Monday is index zero and
silently yields `undefined` on a Sunday.

`schoolCalendar.ts` already carries a deferred comment naming this exact problem
and the market it breaks. That comment can be deleted when the fix lands.

**A second bug in the same file should be fixed in the same batch.** The same
comment records that `lastSchoolDays` derives dates from `new Date()` and
`toISOString()`, which is UTC, and ignores `schools.timezone` even though the
field exists. Mogadishu is UTC+3, so between midnight and 03:00 local the
application computes yesterday's date. Attendance is keyed
`(school_id, student_id, date)`, so a marker screen open near midnight would
write to the wrong day. This is a correctness bug in the same function and the
same batch, not a separate concern.

---

# §E. Auth and identity consistency

## E.1 What is correct and needs no change

- `MembershipRole` in `src/types/auth.ts` carries all six database values with a
  comment naming the migration that renamed them.
- `src/lib/roles.ts` translates a database role to a workspace at the identity
  boundary and nowhere else, and maps `owner`, `director` and `principal` to
  `null` deliberately, so `admin` never silently stands in for four roles. This
  matches `CAMPUS_ROLE_DESIGN` §G.
- `ProfileRow` and `SchoolRow` match their tables column for column, including
  `weekend_days` and `grading_scale`.
- `activeRole` is UI state, validated against live memberships on every restore,
  and is never treated as authority. `AUTH_DESIGN` §5 requires exactly this.
- Platform-admin status comes from an unrevoked `platform_admins` row and
  nothing else.

## E.2 What drifted during the campus and RLS work

| Drift | Detail |
|---|---|
| **`MembershipRow` has no `scope_mode`** | Migration `20260911000002` added `memberships.scope_mode`, `'all'` or `'selected'`. The frontend type omits it. **Accepted under decision 2**: the field stays absent this phase, because no UI filtering decision may read it. It must be added when the frontend becomes campus-aware. |
| **No campus concept at all** | `campuses`, `membership_campus_scopes` and `classes.campus_id` are invisible. **Accepted under decision 2**, with one consequence that must be stated rather than discovered: a campus-scoped principal or teacher is still filtered *by the database*. The interface will simply show them fewer classes with no explanation. Since principals have no workspace under decision 1, this can only reach a campus-scoped **teacher**, and §F.1 already requires that teacher's class list to come from their assignments rather than from a campus predicate. The effect is therefore invisible in this phase but is not gone. |
| **Three roles have authority and no interface** | Phase 7 gave `owner`, `director` and `principal` real capability: owner and director alone read `school_subscriptions`, and a principal may create and edit students, teachers, guardians, classes, homework, exams and class announcements within campus scope. **Resolved by decision 1**: all three stay locked out this phase and see "You don't have access to this". Their database capability remains real and unreachable through the product, deliberately. |
| **The `Role` type survives in domain data** | `Announcement.createdByRole: Role` stores a workspace string inside a record. The real `announcements` table has `created_by uuid` and no role column. |
| **Identity is compared against mock ids** | Described in §A.4. `teacher_id` and `guardian_id` from real memberships are matched against `'t1'` and `'p1'`. |

## E.3 Open items from AUTH_DESIGN still unresolved

`AUTH_DESIGN` §13 lists nine open questions. Three now bear directly on Phase 8:
whether `invitations.role` may create a school administrator, which platform
routes exist, and what the audit event vocabulary is. The third matters because
`audit_logs` still has no writer of any kind.

---

# §F. RLS-aware frontend behaviour

Every table now refuses unauthorised rows. Because a policy filters rather than
raises, **a denied read returns an empty set and a denied update returns zero
rows.** Neither throws. Every assumption below would therefore fail silently.

## F.1 Teacher class visibility is narrower in the UI than in the database

The seven teacher pages all filter on `c.teacherId === activeMembership.teacher_id`,
which corresponds to `classes.class_teacher_id` alone. RLS batch 3 defines a
teacher's reach as `class_teacher_id` **or** `class_subjects.teacher_id`, and
batch 4's locked decision depends on it: any teacher who teaches a class, any
subject, may mark its attendance.

So a subject teacher who is not a homeroom teacher would be permitted by the
database and shown nothing by the interface. This is the one mismatch where the
frontend is stricter than RLS, and it silently removes a teacher's whole
workload.

## F.2 Rosters assume a scalar class

`AttendanceMarker` builds its list with `students.filter(s => s.classId === classId)`.
There is no `students.class_id`. The roster must come from `class_enrollments`,
which RLS scopes to classes the caller teaches or manages. The query shape has
to change, not just the field name.

## F.3 Write paths the interface offers that RLS will refuse

Each of these is a live button or form today.

| Mutator | Offered to | RLS position |
|---|---|---|
| `recordPayment` | Parents, in `parent/Fees` | Guardians have **no write** on `fee_payments`. Payment initiation belongs to a payment flow that does not exist. |
| `updateSubmission` | Parents, in `parent/Homework` | Guardians have **no write** on `homework_submissions`, by the locked decision that homework is physical and the teacher records it. |
| `addTimetableSlot`, `deleteTimetableSlot` | Teachers, in `teacher/Classes` | Teachers are **read-only** on `timetable_slots`. |
| `addAnnouncement` | Teachers, via `AnnouncementBoard` on `teacher/Announcements` | Teachers have **no write** on `announcements`. |
| `createThread`, `sendMessage` | Teachers and parents, in both Messages pages | Only owner, director and administrator may create a thread or add a participant. A teacher or parent can post **into** a thread they already belong to, and nothing else. |
| `addStudent`, `addTeacher`, `addClass` | Admin pages | Permitted for administrators. No conflict. |
| `updateSettings` | `admin/Settings` | Permitted, but the payload contains fields that do not exist (§D.6). |

## F.4 Admin aggregate views

`admin/Reports` counts students, teachers, classes, parents and fees across the
whole school, and `admin/Dashboard` does the same in miniature. For an
**administrator** this is all permitted. For a **principal** it would be
partly empty and entirely denied on fees, and the page has no principal variant
because principals have no workspace.

## F.5 Notifications will be permanently empty

Nothing writes `notifications`: no trigger, no function, no edge function, no
client call. `parent/Notifications` and `NotificationsDropdown` would render a
correct, permanent empty state. The feature exists only as seed data.

## F.6 `scopeKey()` has no real counterpart

`DataContext` addresses notifications with synthetic strings such as
`'parent:p3'` and `'admin:all'`. The real table has `user_id uuid` with a
composite tenant-bound foreign key, and `SCHEMA_DESIGN` §C table 31 says
directly: "This is where `scopeKey()` dies." Broadcast notifications fan out to
one row per recipient rather than being addressed to a group string.

## F.7 Empty, loading and denied are three different states shown as one

Every list view renders an `EmptyState` with copy like "No announcements yet".
After connection, the same component would appear for a genuinely empty school,
a still-loading query, and a permission boundary working exactly as designed.
No component distinguishes them, and no loading state exists for domain data
because reading an in-memory array is synchronous.

**Decision 3 settles what the third case renders: "You don't have access to
this."** Not a blank screen, not a crash, not an unexplained redirect. This is
part of the Batch 0 state contract and is specified there rather than left to
each screen.

The contract has four states, and every domain read resolves to exactly one:

| State | When | Renders |
|---|---|---|
| `loading` | The query is in flight | A skeleton or spinner. No domain screen has one today, because reading an array is synchronous. |
| `empty` | Query succeeded, zero rows, and the caller is entitled to rows | The existing `EmptyState` copy, "No announcements yet" and similar. Unchanged. |
| `denied` | The caller is not entitled to this data or this route | **"You don't have access to this."** |
| `error` | The query failed for a reason that is not permission | A retry affordance. Distinct from `denied`. |

Two implementation notes follow from the database rather than from preference.

**`denied` usually cannot be detected from the read itself.** RLS filters rather
than raises, so a forbidden `SELECT` returns an empty set that is
indistinguishable from an empty table, and a forbidden `UPDATE` returns zero rows
without error. The application must therefore derive `denied` from what it
already knows about the caller, chiefly the active membership role and the route
being entered, and not from a failed query. Only a forbidden `INSERT` reliably
raises, with SQLSTATE `42501`.

**A zero row count is therefore never sufficient evidence of denial.** Where a
screen genuinely cannot tell the two apart, it shows `empty`. Guessing `denied`
on an empty result would tell an administrator of a brand-new school that they
lack access to their own students.

Decision 3 also covers routes, not just reads. A member holding only `owner`,
`director` or `principal` reaches no workspace under decision 1, and must land on
the same message rather than a redirect loop or a blank shell.

## F.8 Announcement visibility is now enforced, and differently

RLS batch 6 filters announcements by the `audience` column: a guardian sees
`all`, `parents` and their own child's class notices; a teacher sees `all`,
`teachers` and taught-class notices; `students` is visible to administrators
only. `parent/Announcements` currently filters client-side with its own rule.
The client filter and the policy must agree, or rows will appear to vanish.

## F.9 Demo and reset paths become meaningless

`resetDemoData` clears the `localStorage` blob and reseeds. `Sidebar` exposes
it. Once data is real, it either does nothing or must be redefined.

---

# §G. Proposed connection sequence

Batched in the spirit of the RLS rollout: dependency-ordered, each reviewable
alone, safest first. The order deliberately mirrors the RLS batches, because the
predicates that gate each table were built in that order and can be exercised in
the same sequence.

| Order | Batch | Tables | Why here, and what the locked decisions changed |
|---|---|---|---|
| 0 | **Foundations** — **DONE** 2026-09-13, migration `20260913000002_school_is_demo` | `schools.is_demo` | Applied. The four-state contract lives in `src/lib/resourceState.ts` and `src/components/ui/ResourceGate.tsx`, with the denied copy defined once as `ACCESS_DENIED_MESSAGE` and rendered by `src/components/ui/AccessDenied.tsx`. `RoleRoute` now renders it instead of redirecting to `/login`. Decision 9's weekday and timezone fixes landed here rather than in batch 1, since they are shared utilities. Demo tenant created and marked; indicator in `DemoModeBanner`, boundary in `src/lib/demoSchool.ts`. No screen's data-fetching changed. |
| 1 | **School shell** | `schools` | Replaces the `settings` mock with the real row and retires the duplicate. Read-mostly, one writer (`admin/Settings`), no relations to unwind. Settles `currency` and `locale`. **Decision 2 removed `campuses` from this batch.** **The decision 9 weekday and timezone work moved into batch 0** and is already done: the three hardcoded sites and the UTC date bug are fixed, and `schools.timezone` is now read by the calendar helpers. What remains here is the settings object itself. |
| 2 | **Academic structure** | `academic_years`, `terms`, `subjects` | Kills `CURRENT_TERM` and the nested `terms[]`, and turns subjects into entities. Everything downstream references `term_id` and `subject_id`, so this must precede them. Reference data, no personal information, readable by every member. Unchanged by the locked decisions. |
| 3 | **People** | `teachers`, `guardians`, `students`, `student_guardians` | Unwinds `Student.parentId` and `Parent.studentIds` into the join that is the guardian access boundary. Fixes `useSelectedChild` and so **restores the parent workspace**, which §A.4 shows is currently broken. **Decision 1 removed** the principal-write variants. |
| 4 | **Classes and roster** | `classes`, `class_subjects`, `class_enrollments`, `timetable_slots` | Unwinds `Student.classId`, `SchoolClass.studentIds` and `SchoolClass.subject[]`. Applies the two-link teaching model from §F.1 and so **restores the teacher workspace**. **Decision 2 removed campus filtering**: `classes.campus_id` is carried through the type but never used as a predicate. **Decision 1 removed** principal class management. |
| 5 | **Teaching records** | `attendance_records`, `grade_records`, `homework`, `homework_submissions`, `exams` | Depends on classes, students, subjects and terms all being real. Promotes embedded submissions to rows. Highest row volume. **Decision 1 removed** the principal variants. |
| 6 | **Finance** | `fee_records`, `fee_payments` | Promotes embedded payments to rows, derives `status` at read, and must never write `amount_paid`. Deserves isolation for the same reason RLS batch 5 did. |
| 7 | **Communication** | `announcements`, `notifications`, `message_threads`, `message_thread_participants`, `messages` | Participation-based rather than role-based, and the only batch that may need a new database function before it can work at all (§H.3). |
| 8 | **Retire the prototype** | none | Delete `mockData.ts`, `DataContext`, the `localStorage` blob, `scopeKey`, `resetDemoData`, and the duplicate `Role` type. **Decision 12 changes this batch**: the demo path is preserved behind the boundary agreed in §H.9 rather than deleted with the rest. |

**Acceptance criterion for every batch, per §A.4.** A batch is not done when the
administrator screens still render. It is done when a real teacher and a real
guardian sign in and see their own data, and a user holding only `owner`,
`director` or `principal` sees "You don't have access to this" rather than a
blank shell. The administrator workspace is the weakest signal available, because
it never filtered by identity.

Three tables are deliberately absent from every batch. `audit_logs` and
`school_subscriptions` have no writer and no interface, so connecting them means
building a feature rather than connecting one. `campuses` leaves the plan
entirely under decision 2 and returns when the frontend becomes campus-aware.
`contact_messages` is a one-line swap in `contactService.ts` and can ride along
with any batch.

---

# §H. Risks and open questions

## H.1 Three roles hold authority with nowhere to exercise it — RESOLVED

`owner`, `director` and `principal` have real, probed database capability and
map to no workspace. A principal can create students and classes within campus
scope; owner and director are the only roles that can read billing.

**Decision 1 resolves this by accepting it for now.** They stay locked out this
phase and see "You don't have access to this" on any protected route.
Administrator, teacher and parent are rebuilt properly first.

Two consequences to keep visible rather than forget:

- Those capabilities remain real. They are unreachable through the product but
  fully available to anyone using the API with a valid session for such a role.
  The database, not the interface, is the boundary, which is the correct design
  and the reason locking them out of the UI is safe.
- A school whose only administrative member is an `owner` would have nobody who
  can administer it through the product. Whether that combination can occur in
  practice depends on how schools are provisioned, and `approve_school_application`
  currently creates an `administrator`, so it does not arise from the approval
  path.

## H.2 Five interface features that RLS refuses

Listed in §F.3. Each needs a decision, not a fix: remove the control, or change
the access model, or build the missing path. Parent payment initiation and
guardian homework submission are the two where the database position was taken
deliberately and recently, so the interface is the thing that is out of date.

## H.3 Messaging may need a database function before it can be connected

Only owner, director and administrator may create a thread or add participants,
and thread creation grants no sight of the thread. A teacher or parent starting
a conversation is therefore impossible today. `RLS_FULL_ROLLOUT_PLAN` C.6
anticipates this and calls for a SECURITY DEFINER function that creates a thread
and its initial participants atomically. That function does not exist.

## H.4 Notifications have no producer

Connecting the table yields a permanently empty inbox. Either an emitter is
built, or the notification surfaces are removed until one is.

## H.5 Weekend days and market assumptions — RESOLVED

The database is configured for a Somali school by default; the prototype is
seeded and typed for a Nairobi one. Attendance, timetable and the school-day
calculation in `schoolCalendar.ts` all assume Monday to Friday.

**Decision 9 resolves this: Somalia is the target market and `weekend_days`
drives the calendar as Friday and Saturday.** No schema change. The column
already exists, already defaults to `{5,6}`, and is already fetched on every
sign-in. Batch 1 deletes the three hardcoded assumptions that override it, and
the UTC date bug in the same function. Full detail and the exact sites are in
§D.6.

## H.6 No storage bucket exists

`Homework.attachments` counts files that have nowhere to live.
`students.photo_path` and `schools.logo_path` name Storage objects, but no
bucket, upload path or policy has been created in any phase so far.

## H.7 What "you cannot see this" should look like — RESOLVED

Unresolved by every existing document. A denied read is indistinguishable from
an empty table at the API.

**Decision 3 resolves this: "You don't have access to this."** The four-state
contract, and the reason a zero row count can never by itself be treated as
denial, are specified in §F.7 and belong to Batch 0.

## H.8 Historical data becomes visible for the first time

`class_enrollments` is time-scoped and keeps `left_on`. Real data will contain a
student's previous classes. Every screen currently assumes one current class per
student. Which year a screen means, and whether a parent sees last year's
records, is undecided.

## H.9 Demo mode — DECIDED IN PRINCIPLE, MECHANISM AWAITING APPROVAL

**Decision 12: demo mode is kept for sales and marketing, and must be clearly
and structurally separated from real data rather than quietly mixed in.**

**Approved and built in Batch 0.** The recommendation below was accepted as
written; migration `20260913000002_school_is_demo` implements it. The analysis is
retained because it records why a real tenant was chosen over a client-side mock,
which governs how every later batch is tested.

### What exists today

Three separate things currently serve demo purposes, and they are easy to
conflate:

| Thing | Where | Status |
|---|---|---|
| Marketing dashboard mockups | `src/components/marketing/previews/*.tsx` | Hardcoded JSX with its own inline data. Never touches `DataContext` or Supabase. Not affected by any batch. |
| The prototype seed | `src/data/mockData.ts` via `DataContext` | What every dashboard screen reads today. Batch 8 retires it. |
| Demo credentials | removed after the Phase 4 audit | `AUTH_DESIGN` §8 requires production builds to exclude demo emails, passwords and quick-fill buttons, and the self-registration path that accepted a caller-supplied role was deleted. |

The marketing previews need no decision. They are static presentation and can
stay exactly as they are. The question is only what replaces the prototype seed
for demonstrations.

### Three candidate mechanisms

**Option A — a real demo school in the real database.** A genuine `schools` row
with a reserved shortcode such as `demo`, real seeded students, teachers and
classes, and real member accounts holding ordinary memberships. Demo users sign
in normally. RLS applies to them exactly as to anyone else.

- Separation: by tenant. The strongest kind available, because it is the same
  boundary that separates two real schools, and it is enforced by the database
  rather than by application code.
- Testing: every batch can be exercised end to end against it, including RLS,
  because nothing about it is special.
- Cost: demo data must be seeded and maintained through the same write paths as
  real data. A reset means deleting and reseeding rows.
- Risk: a demo school is a real tenant. If it is ever mistaken for a customer it
  pollutes counts and metrics. Mitigated by the reserved shortcode and by an
  explicit flag, though `schools` has no such column today.

**Option B — a client-side demo mode that bypasses Supabase.** Keep a trimmed
`mockData.ts` behind a build flag or a route, with the data layer returning seed
data instead of querying.

- Separation: by code path. Weaker, because the separation lives in a conditional
  that every future query must remember to respect.
- Testing: actively harmful. It reintroduces exactly the split this phase exists
  to remove, and a demo path that skips RLS cannot show whether RLS works.
- Cost: low initially, high thereafter. Every batch would have to implement its
  reads twice.

**Option C — a separate Supabase project for demos.** Complete isolation at the
infrastructure level.

- Separation: total.
- Cost: a second project to migrate, configure and keep in step, and the
  marketing site would need to point at a different backend depending on context.
- Risk: the two projects drift, and demos start failing for reasons that have
  nothing to do with the product.

### Recommendation, for approval

**Option A, a real demo school in the real database, with three additions.**

1. **A reserved shortcode.** `demo` is already blockable through the existing
   `reserved_shortcodes` table and its trigger, so no new mechanism is needed to
   stop a real school claiming it.
2. **A visible, persistent "Demo Mode" indicator** in the application chrome
   whenever the signed-in user's school is the demo school. Not a subtle badge:
   something a person cannot miss in a screenshot or a screen share, so a demo
   can never be mistaken for a customer's real data or the reverse.
3. **An explicit marker on the school row** rather than inferring demo status
   from the shortcode. Inferring identity from a name is the same mistake
   `AUTH_DESIGN` §7–8 warns about for subdomains. This needs either a new
   `schools.is_demo boolean NOT NULL DEFAULT false` column, which is a small
   additive migration, or a row in a dedicated table. **This is the only part of
   the recommendation that requires a schema change, and it is why the mechanism
   needs approval before Batch 0 rather than after.**

Why Option A over B: the whole purpose of Phase 8 is to make the application read
real data under real policies. A demo path that bypasses that would leave the
project permanently unable to demonstrate the thing it just spent Phase 7
building, and would reintroduce the two-source-of-truth problem in a new place.

Why Option A over C: the cost is ongoing and the benefit is isolation the tenant
boundary already provides. Phase 7 proved that boundary with 197 policies; a
second project would be admitting it is not trusted.

What still needs deciding alongside the mechanism: whether demo accounts may be
signed into from production, who reseeds them and how often, and whether the
demo school should carry a `schools.status` of its own rather than `active`.

---

# §I. What needs your approval, and what does not

## I.1 Product decisions

Five are settled. One is settled in principle with its mechanism awaiting
approval and is now built. Six remain open, each blocking
only the batch that touches it.

### Settled 2026-09-13

| # | Decision | Outcome |
|---|---|---|
| 1 | Do `owner`, `director` and `principal` get workspaces in Phase 8? | **No.** Locked out with "You don't have access to this". Administrator, teacher and parent rebuilt first. Principal variants removed from batches 1, 3, 4 and 5. |
| 2 | Should the frontend become campus-aware? | **No.** Every school treated as effectively single-campus. `scope_mode` and `membership_campus_scopes` drive no UI filtering. `campuses` leaves batch 1; `classes.campus_id` is carried but never filtered on in batch 4; `MembershipRow` does not gain `scope_mode`. |
| 3 | What does a denied read render? | **"You don't have access to this."** Part of the four-state Batch 0 contract in §F.7, covering both denied reads and unreachable routes. |
| 9 | Which market, and does `weekend_days` drive the calendar? | **Somalia; yes, Friday and Saturday.** No schema change. Batch 1 removes three hardcoded Monday–Friday sites and a UTC date bug; see §D.6. |
| 12 | Keep demo mode or delete it? | **Keep, structurally separated.** Mechanism recommended in §H.9. |

### Approved and built

| # | Decision | Delivered |
|---|---|---|
| 12a | The demo-mode separation mechanism: a real demo school in the real database, a reserved shortcode, a persistent "Demo Mode" indicator, and an explicit marker column. | Batch 0, migration `20260913000002_school_is_demo`. Separation is by tenant, so demo data sits behind the same RLS boundary that separates two customers. Production unreachability is a compile-time boundary on `import.meta.env.DEV`. |

### Still open

| # | Decision | Blocks |
|---|---|---|
| 4 | Parent payment initiation: remove the control, or design a payment flow? | Batch 6 |
| 5 | Guardian homework submission: remove the control, given homework is physical? | Batch 5 |
| 6 | Teacher timetable editing and teacher announcement authoring: remove, or widen the policies? | Batches 4 and 7 |
| 7 | Messaging: build the thread-creation function, or restrict conversation-starting to administrators in the interface too? | Batch 7 |
| 8 | Notifications: build an emitter, or remove the surfaces until one exists? | Batch 7 |
| 10 | Homework attachments and photo upload: build Storage, or drop the feature? | Batch 5 |
| 11 | Historical enrolment: which academic year does each screen mean, and do parents see prior years? | Batch 4 |

## I.2 Technical conclusions requiring no approval

These follow from the schema and the policies and can be implemented as stated.

- Every identifier becomes a `uuid`; `src/utils/id.ts` stops generating domain ids.
- Author columns are re-sourced from the signed-in user's `profiles.id`, not from
  a teacher or guardian entity id.
- Embedded arrays become row sets: submissions, payments, messages, participants,
  terms, rosters, class subjects.
- Scalars become relations: student to class, student to guardian.
- `FeeRecord.status`, `GradeRecord.grade`, `participantNames`, `logoInitial` and
  `avatarColor` are computed at read and never stored.
- `read: boolean` becomes `read_at: timestamptz`, with null meaning unread.
- Weekday strings become ISO integers 1 to 7, and the school week is derived from
  `schools.weekend_days` rather than hardcoded. The `Weekday` union, the
  `WEEKDAYS` array and the day filter in `lastSchoolDays` all go.
- `lastSchoolDays` computes dates in the school's timezone rather than UTC, so
  "today" is correct near midnight in Mogadishu.
- `gender` gains `other` and becomes lowercase; `student status` gains
  `transferred`; payment methods gain `evc_plus` and `edahab`.
- `MembershipRow` **does not** gain `scope_mode` this phase, under decision 2. It
  must gain it when the frontend becomes campus-aware, and the omission is
  recorded in §E.2 so it is not mistaken for an oversight.
- The duplicate `Role` type is retired in favour of `MembershipRole` plus the
  workspace mapping already in `src/lib/roles.ts`.
- Teacher class visibility is widened to match RLS: homeroom **or** any subject
  assignment.
- A denied read returns an empty set, not an error, so the application must never
  rely on catching an exception to detect a permission boundary.
- The batch order in §G.

---

**End of discovery. No code, schema, migration or configuration was changed by
this document.**
