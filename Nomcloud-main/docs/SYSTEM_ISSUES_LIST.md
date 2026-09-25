# Nom Cloud — System Issues List

**Status:** Read-only bug sweep, 2026-09-15. The sweep itself changed nothing.
**Fixes since:** B1, S1, S6, S8, S9 (2026-09-15); S2, S3, S4, S5 (in full), S7, S10, S11, K3, the academic-calendar batch K1, K2, K4, K5, K6, M1, M2, M3, the attribution-and-scope batch M6, M7, M8, the parent-visibility-and-people-UI batch M4, M5, C1, C2, the accounts-and-ownership batch M13, M14, M15, M16, and the messaging-and-finance batch M9, M10, M11 (2026-09-16) resolved. **29 of 30 resolved; only M12 remains open.** Marked in place below; original evidence kept.
**New capability:** *Revoke access* / *Restore access* for a teacher or guardian — suspends the login only, keeping the employment or family record (see S4).
This list is the input for small fix batches, worked top to bottom.

## How this was tested

Every finding below was **reproduced**, not inferred from reading policies or code.

- **Five rolled-back transactions** against the live database (`fxdnkdyqdwxtgtbylxcr`), one per
  group of areas. Each created temporary users, profiles and memberships (administrator, three
  teachers, two guardians, a principal, an administrator of the second school `hgs`), then acted
  as each one with `SET LOCAL ROLE authenticated` and that user's JWT claims. Every statement's
  actual result was logged. Destructive steps were additionally undone inside the transaction,
  after measuring their effect. Each transaction ended in `ROLLBACK`.
- **One real HTTP check** with the installed supabase-js (2.112.4) for the blocker, using a
  temporary account created and deleted through the Auth Admin API.
- **UI reachability** was checked in the source for every finding, so severity reflects whether a
  person can hit it from a screen or only through the API with their own session.

**Database restored to its exact starting state.** Row counts for all 42 public tables,
`auth.users`, `auth.identities`, `storage.objects` and `storage.buckets` were captured before the
sweep and are identical after it (e.g. students=5, teachers=4, fee_payments=3, payment_events=10,
storage.objects=2). No probe table or function remains; storage still has 11 policies.

**Probe mistakes, disclosed.** Three steps in my own scripts were wrong and are not counted as
evidence: a placeholder step (`G3` first line, a no-op), a first ordering of the approval tests in
which one success consumed the only test application (re-run with one application per case), and
one run that aborted on a missing required column before any probe executed (nothing applied;
re-run). The measurement for R4 did not capture the post-state, so R4 is reported only as
"accepted".

## Severity key

| Level | Meaning |
|---|---|
| **BLOCKER** | Stops real use |
| **SERIOUS** | Wrong or unsafe behaviour with no error |
| **MINOR** | Edge case, unlikely in practice, or attribution/hardening |
| **COSMETIC** | UI mismatch, no data risk |

## Already found — referenced, not re-reported

From the academic-year investigation. Where this sweep touched them again it is noted.

| Ref | Issue |
|---|---|
| ~~**K1**~~ | ~~No way to create an academic year from the app~~ — **✅ RESOLVED 2026-09-16** |
| ~~**K2**~~ | ~~Switching the active year is two unsafe steps with a window of zero active years~~ — **✅ RESOLVED 2026-09-16** |
| ~~**K3**~~ | ~~A teacher can mark attendance for a student not enrolled in their class~~ — **✅ RESOLVED 2026-09-16** with S10/S11 (enrolment check on all three teaching tables) |
| ~~**K4**~~ | ~~Attendance can be dated outside any valid academic year~~ — **✅ RESOLVED 2026-09-16** |
| ~~**K5**~~ | ~~A student can end up with two open enrolments~~ — **✅ RESOLVED 2026-09-16** |
| ~~**K6**~~ | ~~Screens mix every year's classes together~~ — **✅ RESOLVED 2026-09-16** |

> **✅ K1, K2, K4, K5, K6 RESOLVED 2026-09-16** — academic-calendar batch, migration
> `20260916000003_academic_calendar_integrity` plus the new Academic Years screen. Details below
> each row.
>
> - **K1:** the Academic Years page is no longer read-only. "Add academic year" sits in the page
>   header, and a school with **no** years sees *Set up your first academic year* with a
>   *Create your first academic year* button. Defaults: September to June of the current school
>   year, named "2026 / 2027"; later years default to the September after the latest year ends,
>   so the suggestion never overlaps. A school's first year is created **active** (nothing to
>   close, and no class can exist without one); every later year is created **upcoming**. Each
>   year card also has *Add term*, with defaults that follow on from the previous term.
> - **K2:** `activate_academic_year(school, year)` — SECURITY DEFINER, empty `search_path`,
>   explicit `has_school_management_role` check. It closes the current year and activates the
>   chosen one in **one transaction**, never leaving a moment with zero active years. Each year
>   card offers *Set as current*, with a confirmation that says what will close.
> - **K5:** in the same transaction, every still-open enrolment of the outgoing year gets
>   `left_on` = the year's end date, or today if the switch happens mid-year, never before the
>   pupil enrolled. A new guard also requires an enrolment to name **its class's own year**;
>   without that, closing a year would miss enrolments filed under another.
> - **K6:** class lists default to the **current year**. `fetchManagedClasses` and
>   `fetchTeacherWorkspace` take a year, and `useRecordableClasses` defaults to the active one, so
>   Attendance, Grades, Homework, Exams, Students and Classes stop mixing years. The Classes page
>   has a year selector: current year, any single year, or **All years** — history stays reachable
>   and nothing is hidden. Also found and fixed: editing a class used to send the active year, which
>   silently moved a historical class into the current year; a class's year is now fixed at
>   creation.
> - **K4:** `attendance_records_assert_within_year` refuses a date outside the class's academic
>   year (PT422).
>
> **Verified in a real browser** on a throwaway school with zero years (removed afterwards):
> created the first year from the empty state (defaults 2026-09-01 → 2027-06-30, "2026 / 2027",
> saved as active), added Term 1, created Grade 1A; added a second year (defaulted to 2027/2028,
> saved as upcoming) and switched to it through the confirmation — 2026/2027 closed and 2027/2028
> active; the Classes page then defaulted to "No classes in the current year yet", and **All
> years** showed Grade 1A. No console errors.
>
> **Verified with rolled-back probes** (before / dry run / after apply): the switch returned
> `switched` with 4 enrolments closed, exactly one active year after, no pupil with two open
> enrolments; re-activating the active year is a no-op; another school's year is refused;
> switching back works. K4 dates in the closed year, in no year, and a moved date are all PT422,
> while an in-year date is accepted. A teacher, a guardian and another school's administrator get
> 42501; anonymous callers have no execute permission.
>
> **Behaviour to know:** switching *back* to a year re-activates it but does **not** reopen the
> enrolments that were closed when it was closed; those pupils need re-enrolling.

---

## Summary

| Severity | Count | Resolved |
|---|---|---|
| BLOCKER | 1 | 1 (B1) |
| SERIOUS | 11 | **11 — all resolved** |
| MINOR | 16 | 15 (M1–M11, M13–M16) — **M12 open** |
| COSMETIC | 2 | **2 — all resolved** |
| **Total new** | **30** | **29** |

---

## BLOCKER

### B1 · Messaging · New conversations cannot be started — NEW — ✅ RESOLVED 2026-09-15

> **Resolved.** Client reorder, no migration. `createThread` now generates the thread id itself
> (`crypto.randomUUID()`, allowed by the existing column grant on `id`) and inserts the thread
> **without** `.select()`, so nothing is read back before the creator is a participant.
> Participants and the opening message follow as before. No policy, grant or table changed.
>
> **Why not a database function:** every individual write was already permitted in this order;
> only the premature read failed. An atomic function would also cover the separate half-built
> thread case (M12), which was out of scope and stays open.
>
> **Verified:**
> - Rolled back: creator reads the thread, 2 participants and the message immediately.
>   Uninvited teacher, guardian and principal read 0 rows, and a post is refused `42501`.
>   The old `INSERT … RETURNING` shape still fails `42501`.
> - Real HTTP: steps 201/201/201, and the creator reads thread and message. An uninvited
>   administrator reads 0 thread, message and participant rows, and a post gets 403 `42501`.
>   Everything was cleaned up.

**Original finding:**

- **Table:** `message_threads` (service `communicationService.createThread`)
- **Steps:** As a school administrator, start a new conversation. `createThread` first runs
  `insert(...).select('id').single()`, which is `INSERT ... RETURNING id`. At that moment the
  creator is not yet a participant, and `message_threads_participant_select` only lets
  participants see a thread, so the returned row fails the SELECT policy.
- **Actual result:**
  - SQL (rolled back): `42501: new row violates row-level security policy for table "message_threads"`.
    The same insert **without** RETURNING succeeds (`OK rows=1`).
  - Real HTTP, supabase-js: `{"code":"42501","message":"new row violates row-level security policy for table \"message_threads\""}`.
    Nothing was created.
- **Impact:** No conversation can ever be opened from the app, so messaging is unusable for new
  threads. Replies to existing threads are unaffected (none exist yet).
- **Reach:** UI (Admin → Messages → new conversation).

---

## SERIOUS

### S1 · Academic structure · Deleting a class silently deletes its attendance, grades, homework and enrolments — the dialog says it cannot — NEW — ✅ RESOLVED 2026-09-15

> **Resolved.** Migration `20260915000005_class_records_restrict` changes the `class_id` foreign
> key of `attendance_records`, `grade_records`, `exams`, `class_enrollments` and `homework` from
> `CASCADE` to `RESTRICT`. `timetable_slots`, `class_subjects` and class announcements stay
> `CASCADE` (configuration).
>
> **Not a new product decision.** It aligns the database with two existing ones:
> - SCHEMA_DESIGN §10 classifies these records as archival.
> - The UI already promised a class with records cannot be removed.
>
> **Message changes.** The confirm dialog now says exactly what blocks removal and what is
> removed with the class. `deleteClass` explains the 23503 refusal.
>
> **Verified (rolled back):**
> - Delete refused `23503` for a class with attendance + grade + homework, and for each of
>   attendance, grade, homework, exam and a closed enrolment alone. Records stayed intact.
> - An empty class still deletes, together with its timetable, subject assignment and class
>   announcement.
> - An academic year whose class has records is now refused too. An empty year still deletes,
>   and deleting a whole school still works.
> - Real HTTP: deleting Grade 5A returns 409 `23503`; the class and its 2 enrolments remain.
>
> **Still open, needs a decision:** there is no archive or force-remove path for a class that
> really must go.

**Original finding:**

- **Table:** `classes` → `attendance_records`, `grade_records`, `homework`, `class_enrollments`,
  `timetable_slots`, `class_subjects` (all `ON DELETE CASCADE` on `class_id`)
- **Steps:** Grade 6B has one attendance record, one grade, one homework and an enrolment.
  Administrator deletes Grade 6B (Admin → Classes → Remove). The confirm dialog reads:
  *"A class with records attached to it cannot be removed."*
- **Actual result:** `OK rows=1`.
  - Before: attendance 1, grades 1, enrolments 1, homework 1, timetable 2, class subjects 3.
  - After: attendance **0**, grades **0**, enrolments **0**, homework **0**, timetable **1**, class subjects **2**.
- **Reach:** UI.

### S2 · People · Adding a "New" guardian to a student who already has a primary guardian silently does nothing — NEW — ✅ RESOLVED 2026-09-16

> **Resolved.** Migration `20260916000001_people_access_guards` adds two SECURITY INVOKER
> functions, and `guardianService` no longer swallows 23505.
>
> **UX decision: demote-and-promote, on an explicit tick — not a rejection.** The Students form
> now carries a **Primary contact** checkbox, ticked by default only when the student has no
> primary yet, and it names who would be replaced ("Amina Yusuf will stop being the primary
> contact"). Telling the admin to "unset the existing primary first" would be a dead end: no
> screen unsets one, so the only way out would be the very failure being reported. The swap is
> therefore allowed, but only when the admin asks for it, and it happens in one transaction
> (`link_guardian_to_student`) so the student is never left with two primaries or none.
>
> **Nothing is hidden any more.** The blind `if (error && error.code !== '23505') throw error` is
> gone. Re-linking a pair that already exists returns `already_linked` (reported in the toast);
> every other failure reaches the user.
>
> **Orphans cannot recur.** The "New guardian" path is now one call,
> `create_and_link_guardian`, which creates the guardian and the link in a single transaction.
> Measured: a refused link left **0** new guardian rows. (One orphan from earlier testing still
> exists; historical test data, left alone as agreed.)
>
> **Verified (rolled back, before / dry run / after apply):** the old direct insert still fails
> 23505; the new path returns `linked_primary`, `already_linked`, `linked`, `promoted`; exactly
> one primary after every step; a refused cross-school create left no guardian; a teacher calling
> the RPC gets `42501: only school management may link a guardian to a student`, and a guardian
> gets 42501 on `guardians`. Over real HTTP an administrator got `already_linked` and a teacher
> got 403/42501.
>
> **One flaw of my own, found and fixed mid-task:** the first version of the function relied on
> RLS alone, so for a teacher the demote UPDATE was filtered to zero rows *silently* and the
> function returned success — rebuilding the bug it was meant to remove. It now checks
> `has_school_management_role` up front and asserts the promotion touched exactly one row.

**Original finding:**

- **Table:** `student_guardians` (unique index `student_guardians_school_id_student_id_primary_idx`,
  one primary per student)
- **Steps:** Admin → Students → Edit Yusuf (already has a primary guardian) → Link a guardian →
  **New** → save. The page calls `linkGuardianToStudent(..., isPrimary = true)`.
- **Actual result:**
  - The link insert fails with `23505: duplicate key value violates unique constraint "student_guardians_school_id_student_id_primary_idx"`,
    and the guardian stays unlinked (link count 0).
  - `linkGuardianToStudent` swallows every `23505` (`if (error && error.code !== '23505') throw error`),
    so the page shows **"Student updated"**.
  - The new guardian row is created but belongs to no student.
- **Reach:** UI. Linking an **Existing** guardian is unaffected (`is_primary = false`).

### S3 · People · Deleting a teacher silently removes their login access and class assignments — NEW — ✅ RESOLVED 2026-09-16

> **Resolved** with the S1 pattern. The same migration changes four foreign keys from CASCADE or
> SET NULL to **RESTRICT**:
>
> | Link | Was | Now |
> |---|---|---|
> | `memberships (school_id, teacher_id)` → teachers | CASCADE | RESTRICT |
> | `memberships (school_id, guardian_id)` → guardians | CASCADE | RESTRICT |
> | `class_subjects (school_id, teacher_id)` → teachers | SET NULL | RESTRICT |
> | `student_guardians (school_id, guardian_id)` → guardians | CASCADE | RESTRICT |
>
> **Guardians are treated exactly like teachers**, as the brief asked me to decide: a guardian row
> carries the same two things — a login and a relationship record — and SCHEMA_DESIGN §10 makes
> anonymisation, not deletion, the erasure path. Unlinking the children first is the same
> deliberate step as unassigning a teacher's classes.
>
> **The dialog now matches reality:** "It is refused while they are the homeroom of a class, teach
> a subject, or still have an app login — unassign their classes and revoke their access first. To
> block their login only, use Revoke access instead." `deleteTeacher` says the same on 23503.
>
> **Unchanged, deliberately:** `timetable_slots.teacher_id` stays SET NULL (schedule configuration;
> `teaches_class` never consulted it) and `invitations` stays CASCADE (a pending invitation to
> become someone who no longer exists is meaningless).
>
> **Verified (rolled back):** deleting Sahra (login + subject) → 23503, her row, membership and
> 5A Mathematics assignment all intact; homeroom teacher still 23503; a login-only teacher → 23503,
> and after removing the membership the delete succeeds; an unassigned teacher with no login still
> deletes; guardian with a login → 23503; guardian with only child links → 23503, and after
> unlinking, deletes. Over real HTTP both teacher deletes returned 409/23503 and nothing was
> removed. **Whole-school deletion still works** once the pre-existing `profiles` RESTRICT is
> satisfied — the four new keys do not block it.

**Original finding:**

- **Table:** `teachers` → `memberships` (`ON DELETE CASCADE`), `class_subjects.teacher_id`
  (`SET NULL`)
- **Steps:** Administrator deletes teacher Sahra, who has a login and teaches 5A Mathematics.
  The dialog says *"A teacher still assigned to a class cannot be removed until they are
  unassigned."*
- **Actual result:** `OK rows=1`. Sahra's membership count went from 1 to **0**, so her account
  can no longer reach the school. 5A Mathematics teacher became **NULL**. The dialog's claim only
  holds for a homeroom teacher (`23503`, sweep P5).
- **Same behaviour, guardians:** deleting guardian Amina removed her membership (1 → 0) and her
  link to Yusuf (sweep P4). There is no guardian delete in the UI, so that half is API only.
- **Reach:** UI for teachers.

### S4 · People · Marking a teacher "inactive" changes nothing about their access — NEW — ✅ RESOLVED 2026-09-16

> **Decision: the two stay separate, and the interface now shows both.** `teachers.status` is an
> employment record; `memberships.status` is login access. Reasons: most teachers have no login at
> all, so status cannot stand in for access; a trigger tying them would make re-activating
> employment silently *restore* a login, a regression in the opposite direction; and a hidden side
> effect is exactly what S3 was about.
>
> **What changed in the UI (`Teachers.tsx`):**
> - The table's "Status" column is now **Staff status**, with a new **App access** column showing
>   `Active`, `Revoked`, or `No login` for someone never invited.
> - The edit form shows both, with the note "On its own this does not affect whether they can sign
>   in."
> - Marking someone inactive while their login is active offers an explicit toggle, **"Also revoke
>   their app access"** (on by default). It is an offer, never silent — the toast says when access
>   was revoked too.
>
> **New capability — Revoke access / Restore access** (`src/services/accessService.ts`, shield
> action in the Teachers table): suspends the membership only, keeping the employment record, class
> assignments and history. Restoring re-activates the same membership. **Granting access is
> unchanged**: an invitation accepted through `accept_invitation` is still the only thing that
> creates a membership, and this module can only suspend or re-activate one that already exists.
> It needs no new privilege — `memberships_admin_update` already allowed it.
>
> **Verified (rolled back and over real HTTP):** an inactive teacher whose access was not revoked
> still reads students (the decided behaviour, both states shown); after Revoke access the same
> teacher reads 0 students, 0 guardians, 0 classes, `teaches_class` is false,
> `current_teacher_id` is NULL, and marking attendance is refused 42501; the teacher row, homeroom
> assignment, membership and profile all survive; Restore access brings the reads back. The same
> works for a guardian: reads drop to 0 while their `student_guardians` links stay. Over HTTP:
> revoke → 4 students becomes 0, restore → back to 4, employment record untouched.
>
> **Guardians have no management screen yet**, so the action is wired into the Teachers page;
> `accessService` exposes `fetchGuardianAccess` for the guardian screen when it exists.

**Original finding:**

- **Table:** `teachers.status` (not consulted by `current_teacher_id` or `teaches_class`)
- **Steps:** Administrator sets Faysal to `inactive`. Faysal then acts.
- **Actual result:**
  - Faysal marked attendance for Yusuf in 5A: `OK rows=1`.
  - He still read all 4 students and all 4 guardians, including phone numbers.
  - Only suspending the **membership** removes access; the teacher form's status does not.
- **Reach:** UI (Admin → Teachers → Status).

### S5 · Finance · Provider-confirmed (WaafiPay) payments can be edited or moved after the fact — NEW — ✅ RESOLVED (moved 2026-09-15, edited 2026-09-16)

> **"Moved" (F10) — resolved.** Migration `20260915000006_payment_reassignment_guards` revokes
> table-level UPDATE on `fee_payments` from `anon` and `authenticated` and re-grants UPDATE on
> seven columns only (`amount, currency, method, reference, paid_on, recorded_by, external_ref`).
> `fee_record_id` (and `id`, `school_id`) can no longer be changed by any client. This is the same
> column-grant instrument that guards `amount_paid`.
>
> **Verified:**
> - Rolled back: the exact F10 update, the same move through an upsert, and a `school_id` change
>   are each refused `42501`. The payment stays on Yusuf's fee (60 / 0 unchanged).
> - Real HTTP: 403 `42501`, nothing changed. `anon` UPDATE refused.
>
> **"Edited" (F9 amount, F16 external_ref/reference) — resolved 2026-09-16.** Migration
> `20260916000002_teaching_and_finance_guards` adds `fee_payments_prevent_confirmed_edit`, a
> `BEFORE UPDATE OF amount, currency, external_ref, reference` trigger that refuses (PT409) when a
> `payment_events` row points at the payment. "Provider-confirmed" is not a new flag: it is exactly
> that link, which is unique per payment.
>
> **The manual-correction path is preserved by construction.** A cash, bank or card payment
> recorded in the office has no `payment_events` row, so the trigger never fires for it.
>
> **Verified (rolled back, before / dry run / after apply):** editing a confirmed payment's amount
> (F9) and its external_ref + reference (F16) are both refused PT409, and its currency too; the
> payment still reads 30.00 USD with its original `waafipay-MOCK-APPROVE-…` reference and the fee
> still shows 60.00 paid. A non-money field (method) is still editable. A **manual** payment can
> still have its amount corrected (30 → 40, `amount_paid` followed to 40.00), its reference and
> date corrected, and be deleted (`amount_paid` back to 0.00).

**Original finding:**

- **Table:** `fee_payments` rows referenced by `payment_events.fee_payment_id`
- **Steps and actual results** (administrator; each undone):
  - **F9:** change a WaafiPay payment's amount 30 → 5. `OK rows=1`. The payment now reads
    **5.00**, its `payment_events` row still says **30.00**, and the fee's `amount_paid` dropped
    60 → **35.00**.
  - **F10:** move that payment from Yusuf's fee to Layla's. `OK rows=1`. Yusuf paid **30**,
    Layla paid **30**, and the event still points at **Yusuf's** fee.
  - **F16:** rewrite its `external_ref` and `reference`. `OK rows=1`. The event keeps the original
    provider id, so the link to the provider is broken.
- **Still protected:** deleting such a payment fails with `23503` (sweep F11).
- **Reach:** API only (no payment-edit screen). Any administrator session can do it.

### S6 · Finance · A fee with payments can be re-assigned to a different student — NEW — ✅ RESOLVED 2026-09-15

> **Resolved.** The same migration adds `fee_records_prevent_paid_student_change`, a
> `BEFORE UPDATE OF student_id` trigger (SECURITY DEFINER, empty `search_path`) that refuses a
> real change of `student_id` whenever any `fee_payments` row exists for the fee. It raises
> `PT409`, which PostgREST returns as HTTP 409.
>
> **Why a trigger here, not a grant:** the rule depends on another table. A grant cannot allow
> the change on an unpaid fee while refusing it on a paid one.
>
> **UI.** The Edit Fee form disables Student once `amountPaid > 0`, with a note, and validates the
> same rule. `updateFeeRecord` maps `PT409` to a clear message.
>
> **Verified:**
> - Rolled back: the exact updateFeeRecord payload with a new student is refused `PT409` and the
>   student is unchanged. It is also refused for the table owner (`postgres`).
> - Real HTTP: 409 `PT409`, nothing changed.
> - Still allowed: amount, due date and category edits on unpaid and paid fees (student re-sent
>   unchanged); a student change on a fee with **zero** payments; a student change again after
>   its last manual payment is deleted.
> - `amount_paid` trigger unaffected: payment 25 → 25.00, edit to 40 → 40.00, delete → 0.00.
>   Overpayment still `23514`, direct forgery still `42501`, amount below paid still `23514`, and
>   a fee with payments still cannot be deleted (`23503`). The guardian read is unchanged.
>
> **Workflow gap, not built:** a fee raised against the wrong pupil *after* money was taken has no
> correction path in the app. Manual payments can be deleted first; WaafiPay-applied ones cannot
> (`payment_events` RESTRICT). A void or re-issue workflow is needed.

**Original finding:**

- **Table:** `fee_records.student_id`
- **Steps:** Admin → Fees → Edit Yusuf's fee (60 already paid) → change **Student** to Hodan → save.
  `updateFeeRecord` sends `student_id`.
- **Actual result:** `OK rows=1`. The fee, and its 60 paid, now belong to Hodan (sweep F12).
- **Reach:** UI (the Student field is editable on an existing fee).

### S7 · Finance · Currency is not enforced between a fee and its payments — NEW — ✅ RESOLVED 2026-09-16

> **Resolved from both ends** by `20260916000002_teaching_and_finance_guards`:
> - `fee_payments_currency_matches_fee` — a `BEFORE INSERT OR UPDATE` trigger comparing the
>   payment's currency with its fee's. A CHECK cannot read another table, so this is the same
>   instrument and shape as `sync_fee_record_amount_paid`.
> - `fee_records_prevent_paid_currency_change` — the S6 pattern applied to `currency`: once any
>   payment exists, the fee's currency is frozen. A **separate** trigger from S6's student guard so
>   each rule reads and can be dropped on its own.
>
> **Verified:** a 25 EUR payment against a USD fee is refused PT409 and `amount_paid` stays 0.00
> (F14); changing a paid fee USD → SOS is refused PT409 and it stays USD (F13). Still allowed:
> changing the currency of a fee with **no** payments, then recording a matching-currency payment
> (SOS 30 → `amount_paid` 30.00). Editing a manual payment's currency to a mismatching one is also
> refused.
>
> **UI:** `recordPayment` surfaces the trigger's message; `updateFeeRecord`'s PT409 message now
> covers both the student and the currency guard.

**Original finding:**

- **Table:** `fee_payments.currency`, `fee_records.currency`
- **Steps and actual results:**
  - **F14:** record a **25 EUR** payment against Layla's **USD** fee. `OK rows=1`. Her
    `amount_paid` became **25.00** in a USD fee.
  - **F13:** change Yusuf's fee currency USD → **SOS** while it has USD payments. `OK rows=1`
    (the fee is now SOS, the payments USD).
- **Reach:** API only (the payment form always sends the fee's currency).

### S8 · Roles · An administrator can create an owner, and suspend or delete the owner — NEW — ✅ RESOLVED 2026-09-15

> **Resolved** under the locked decision "only an existing owner may create or remove an owner".
> Migration `20260915000007_owner_and_thread_self_add_guards` **refines the existing policies**
> (`ALTER POLICY`, none added or dropped) on `memberships` and `invitations`, for INSERT, UPDATE
> (old and new row) and DELETE. Each keeps `has_school_admin_role(school_id)` and adds
> `role <> 'owner' OR has_school_owner_role(school_id)`, where the new helper
> `has_school_owner_role` means an **active** owner membership.
>
> **Why invitations too:** `accept_invitation` turns an invitation's role into a membership
> without passing through memberships RLS, so an owner invitation is an owner membership in waiting.
>
> **Verified (rolled back, before, as a dry run, and after apply):**
> - Administrator **and** director creating an owner membership, an owner invitation, or promoting
>   a principal to owner: each refused `42501`.
> - Administrator or director deleting, suspending or demoting the owner, or touching the owner
>   invitation: 0 rows each. Owner row confirmed `owner/active`, invitation intact.
> - The owner creating and revoking or deleting owner invitations, and removing or suspending an
>   owner membership: allowed.
> - Unchanged: administrator and director still create, edit and remove teacher, guardian and
>   principal memberships and non-owner invitations. Cross-school and teacher writes still refused.
>
> **One-owner rule unchanged (CAMPUS_ROLE_DESIGN J2).** An owner creating a *second* owner
> membership passes the policy and is refused by `memberships_school_id_owner_idx` (`23505`), as
> J2 intends.
>
> **Open, needs decisions:**
> - Ownership **transfer** has no path except a platform admin.
> - The first owner of a new school can only be set by a platform admin (see M15).

**Original finding:**

- **Tables:** `invitations`, `memberships`. The policies check only `has_school_admin_role`,
  which includes administrator, so the role hierarchy is not enforced.
- **Steps and actual results:**
  - **I3 → I16:** an *administrator* invites an email as **owner** (`OK rows=1`). The invitee
    accepts (`accepted`), gets role `owner` and billing access (`has_school_billing_role = true`).
  - **R1:** administrator converts a guardian account (Amina) into an **administrator**.
    `OK rows=1`.
  - **R2:** administrator **suspends the owner's** membership. `OK rows=1`, now `suspended`.
  - **R3:** administrator **deletes the owner's** membership. `OK rows=1`, 0 remain.
- **Reach:** API only (no invitation or member-management screen exists yet). This must be
  settled before one is built.
- **Needs a decision:** which roles may grant, change or remove which roles.

### S9 · Messaging · An administrator can join any private conversation and read it — NEW — ✅ RESOLVED 2026-09-15

> **Resolved** under the locked decision "no role may add itself to a thread it was not part of".
>
> **It was a gap, not a design choice.** Migration 14 states the self-add prohibition and relies on
> having no self-insert policy. But `message_thread_participants_admin_insert` checked only
> `has_school_admin_role`, so the prohibition held for teachers and guardians and not for owner,
> director or administrator.
>
> **The refined policy** (same migration, `ALTER POLICY`) allows a participant row only when
> either:
> - it is for **someone else** and the actor is **already a participant**; or
> - the actor is **setting up their own new thread**, via the new DEFINER helper
>   `can_seed_thread_participants`: `created_by` is the caller, and there are no participants and
>   no messages yet.
>
> That is exactly how `createThread` works, so opening a conversation is unaffected.
>
> **Verified (rolled back, dry run and after apply):**
> - The exact S9 exploit is refused `42501`, and the administrator reads 0 messages. Director and
>   owner self-add are refused too.
> - Also refused: adding a colleague to a thread the actor is not in; self-add to a thread whose
>   `created_by` was forged; self-add to a thread already set up without the actor; re-entering a
>   thread the creator emptied of participants but that still has message history (helper returns
>   `false`).
> - Allowed: a new thread with self + two others in one statement, then the opening message, read
>   back immediately. Adding another person to a thread the administrator is in also works.
> - Teacher, guardian and cross-school inserts are still refused. The real HTTP createThread flow
>   still returns 201/201/201, with the uninvited administrator reading 0.
>
> **M14 (removing participants), measured:** with self-add closed, a non-participant administrator
> removing people from a thread now affects **0 rows**, because rows you cannot see cannot be
> deleted. The DELETE policy itself was not changed. An administrator who is a participant can still
> remove others; decide separately whether that should stay.

**Original finding:**

- **Table:** `message_thread_participants` (`message_thread_participants_admin_insert` checks
  only `has_school_admin_role`)
- **Steps:** A private thread exists between teacher Faysal and guardian Bashir; the
  administrator is not in it.
- **Actual result:**
  - **M13a:** administrator reads the thread's messages: **0** (correctly hidden).
  - **M13b:** administrator inserts **himself** as a participant: `OK rows=1`.
  - **M13c:** administrator reads it again: `"private note from parent"`.
  - **M14:** administrator removes the parent from the thread: `OK rows=1`.
- **Reach:** API only. It undoes the participant-only model for administrators.
- **Needs a decision:** is administrator oversight of conversations intended?

### S10 · Grades & homework · Same "no enrolment check" gap as attendance — NEW (same class as K3) — ✅ RESOLVED 2026-09-16

> **Resolved together with S11 and K3.** `20260916000002_teaching_and_finance_guards` adds the
> enrolment half of `teaches_class`:
> - `student_enrolled_in_class(school, class, student)` — an OPEN enrolment (`left_on IS NULL`),
>   the same signal `teaches_student` and every roster read already use.
> - `homework_class_has_student(school, homework, student)` — resolves the homework's class and
>   delegates, because `homework_submissions` carries `homework_id`, not `class_id`.
>
> Both are SECURITY DEFINER with an empty `search_path`, like `teaches_class`, so the check is not
> narrowed by the caller's own RLS. The teacher INSERT and UPDATE policies on `grade_records` and
> `homework_submissions` now require it in addition to the existing subject-exact check.
>
> **Verified:** Sahra recording a 5A Maths grade (G1) or a 5A homework submission (H2) for Layla,
> who is enrolled in 6B, are both refused 42501. Recording both for Yusuf, who *is* in 5A, still
> works, as does editing that submission to graded.
>
> **Deliberately unchanged:** the management policies (`can_manage_class`, `can_manage_homework`).
> Owner, director, administrator and principal keep school-wide authority here. Whether management
> should also be held to the enrolment check is a real question — **open, needs a decision**
> (measured: an administrator can still mark attendance for a pupil of another class).

**Original finding:**

- **Tables:** `grade_records`, `homework_submissions`
- **Steps and actual results:**
  - **G1:** Sahra (5A Mathematics) records a grade for **Layla**, who is enrolled in 6B, under
    5A. `OK rows=1`.
  - **H2:** Sahra records a homework submission on 5A homework for **Layla**. `OK rows=1`.
- **Still refused:** a teacher of another class (`42501`, sweep G5 and H3).
- **Reach:** API (the screens list only enrolled students).

### S11 · Attendance · A teacher can rewrite another teacher's record, erase who marked it, and move it to a different student — NEW (extends K3) — ✅ RESOLVED 2026-09-16

> **Three separate holes, three fixes**, all in `20260916000002_teaching_and_finance_guards`:
>
> 1. **Enrolment (K3).** The teacher INSERT/UPDATE policies on `attendance_records` now require
>    `student_enrolled_in_class`. Measured: marking a 6B pupil in 5A is refused 42501, and so is
>    marking a pupil **after** they left the class (the L4 case).
> 2. **Attribution can no longer be erased.** The policy check was
>    `(marked_by IS NULL OR marked_by = auth.uid())`; it is now `marked_by = auth.uid()`, so an
>    edit re-attributes to the editor instead of blanking. **NOT NULL on the column was considered
>    and rejected:** `marked_by` is `ON DELETE SET NULL` to profiles so that "who marked it must
>    survive staff turnover" (SCHEMA_DESIGN table 19), so it must stay nullable; the policy is what
>    stops a live client writing NULL. Measured: AT1 refused 42501, and attributing an edit to a
>    *colleague* is refused too.
> 3. **The record cannot move to another pupil.** `attendance_records_prevent_student_change`, a
>    `BEFORE UPDATE OF student_id` trigger, refuses PT409. **A trigger, not a column grant**, and
>    the difference is load-bearing: `saveAttendance` upserts, and PostgREST puts every payload
>    column in `ON CONFLICT DO UPDATE SET`, `student_id` included, so a grant would refuse every
>    legitimate re-mark of a register. Measured: AT2 refused, including to a classmate of the same
>    class, while the ordinary re-mark still works.
>
> **Co-teaching — decision, with reasoning.** Kept: **any teacher who currently teaches the class
> may edit the record.** RLS batch 4 decision 1 made attendance deliberately class-level ("one row
> per pupil per day, so any teacher of the class may mark it") so a homeroom teacher who teaches no
> subject can still mark the register; creator-only would break co-taught classes and leave a wrong
> mark uncorrectable while the marker is away. What changed is that the edit is now **attributed**:
> the register always names who last set it. Measured: Sahra (co-teaches 5A) may correct the status
> as herself; Guled (6B only) still cannot touch it. Tightening this to creator-only is a one-line
> change to the USING clause and remains **a product decision, open** if the school wants it.
>
> **Verified end state:** after the refused AT1–AT2 attempts the row still reads
> `Hodan Warsame / late / marked_by = Faysal`. (Read as postgres — a teacher cannot read a
> colleague's `profiles` row, so an RLS-filtered join prints NULL for the name either way.)

**Original finding:**

- **Table:** `attendance_records` (`attendance_records_teacher_update`: USING `teaches_class`;
  CHECK allows `marked_by IS NULL`)
- **Steps and actual results** (Faysal marked Hodan present on 2026-09-15; Sahra teaches the same
  class):
  - **AT1:** Sahra sets it `absent` with `marked_by = NULL`. `OK rows=1`, record now
    `absent / marked_by=NULL`.
  - **AT2:** Sahra changes the record's `student_id` to **Layla** (6B). `OK rows=1`.
- **Reach:** API for AT2 and the NULL attribution. Overwriting status also happens through the UI
  when a second teacher saves the same register.

---

## MINOR

### Academic structure

**M1 · Terms and years are not validated against each other — NEW — ✅ RESOLVED 2026-09-16**
> `terms_assert_within_year` (a term inside its year, not overlapping another term of that year) and
> `academic_years_assert_no_overlap` (years of one school do not overlap), both PT422. Measured:
> the 2030 term, the overlapping term, the overlapping year and moving Term 1 outside its year are
> all refused; a non-overlapping year and a valid Term 4 are accepted.

- **Steps and results:**
  - **S1:** a term dated **2030** inside academic year 2026/2027. `OK rows=1`.
  - **S2:** a term overlapping Term 1. `OK rows=1`.
  - **S3:** an academic year overlapping 2026/2027. `OK rows=1`.
- **Why it matters:** the current term is derived from dates, so overlaps make it ambiguous.
- **Reach:** API only (no term or year editor exists).

**M2 · Classes can be created in, and students enrolled into, a closed year — NEW — ✅ RESOLVED 2026-09-16**
> `classes_assert_year_open` and `class_enrollments_assert_year` (PT422). Measured: creating a class
> in closed 2025/2026, moving a class into it, and enrolling a pupil into a class of it are all
> refused — including for the table owner, so "closed means closed" holds everywhere. The closed
> year and its classes stay fully readable.

- **S4:** class created in closed year 2025/2026. `OK rows=1`.
- **S5:** a student enrolled into it. `OK rows=1`.
- **Reach:** API. Related to K5 and K6.

**M3 · Grades and exams may use a term from a different academic year — NEW — ✅ RESOLVED 2026-09-16**
> `grade_records_assert_term_year` and `exams_assert_term_year` (one shared function, PT422).
> Measured: the G3 grade and the E1 exam using a 2027/2028 term on a 2026/2027 class are both
> refused; the same grade with the class's own term is accepted.

- **G3:** a grade on a 2026/2027 class using a 2027/2028 term. `OK rows=1`.
- **E1:** an exam in a 2027/2028 term dated **2031**. `OK rows=1`.
- **Reach:** API.

### People

**M4 · Deleting a student who has fee payments fails, contradicting the dialog — NEW — ✅ RESOLVED 2026-09-16**
> The block stays: it protects the school's financial records. The wording now matches what happens.
> **Dialog, as rendered in a real browser:** "A student with fee payments on record cannot be
> removed: payment history must be kept for the school's financial records, so set their status to
> Inactive or Transferred instead. For any other student, this permanently deletes their record
> together with their attendance, grades, homework submissions, class enrolments, guardian links
> and unpaid fee records. This cannot be undone." The cascade list was checked against the live
> foreign keys.
> **Confirming on a student with a payment** now gives *Student not removed — This student has fee
> payments on record, so they cannot be deleted: payment history must be kept for the school's
> financial records. Set their status to Inactive or Transferred instead.* `deleteStudent` maps
> 23503 to that sentence. The student is still in the database. Probes: delete with payments →
> 23503 (unchanged); delete without payments → cascades (unchanged).

- **P6:** the dialog says the delete removes "attendance, grades and fees". Actual result:
  `23503 ... violates foreign key constraint "fee_payments_school_id_fee_record_id_fkey"`, shown
  as a generic readable error.
- The block itself is correct money protection; the dialog is wrong. **Reach:** UI.

**M5 · A guardian keeps seeing a class after their child leaves it — NEW — ✅ RESOLVED 2026-09-16**
> Migration `20260916000005_guardian_visibility_and_relationship`. `guardian_has_student_in_class`
> gains `ce.left_on is null`, exactly the line `teaches_student` and `student_enrolled_in_class`
> already use. Same signature, security and grants, so every policy that uses it tightens at once:
> classes, class subjects, timetable, homework, exams and class announcements.
> **Measured, before → after apply:** with Yusuf's 5A enrolment closed, Amina sees
> `homework=4 timetable=1 subjects=2 class=1 exams=2 announcements=1` → all `0`. She still sees her
> own child (student row, enrolment history, and `is_guardian_of_student` true, which gates grades,
> attendance, submissions and fees) and the school-wide parents notice. **No regression:** Bashir,
> whose child is still in 6B, sees `1/1/1/1/1/1` before and after, and nothing of 5A. Parent
> screens read classes only through open enrolments, so none relied on the old behaviour.

- **Cause:** `guardian_has_student_in_class` ignores `left_on`.
- **Steps:** close Yusuf's 5A enrolment, then act as guardian Amina.
- **Actual result (L2):** she still sees 5A homework (2), timetable (1), class subjects (2) and
  the class row (1). The same helper gates class exams and class announcements.
- **Reach:** UI (parent screens).

### Grades / homework / attendance attribution

**M6 · Attribution can be erased or forged — NEW — ✅ RESOLVED 2026-09-16**
> Migration `20260916000004_attribution_and_subject_scope`, using the S11 attendance mechanism:
> the attribution column must equal `auth.uid()` in the WITH CHECK of every policy that writes the
> row. `grade_records.recorded_by` and `homework.created_by`: teacher insert/update tightened from
> "NULL or self" to "self", and management insert/update, which had no check, gained the same one.
> As with attendance, whoever edits a record becomes its attribution. `invitations.invited_by`:
> must be the caller on insert. On update it is **immutable**, removed from the UPDATE column grant
> (the S5 mechanism), because it means *who sent* the invitation, and revoking it (possibly by a
> different administrator) must not rewrite that.
> **Measured, before → after apply:** G4 (teacher clears `recorded_by`) OK → 42501; teacher NULL or
> forged grade → 42501; admin forged or NULL grade OK → 42501; H4 OK → 42501; admin NULL
> homework, teacher NULL homework, teacher clearing `created_by` OK → 42501; I2 OK → 42501;
> rewriting `invited_by` OK → `42501 permission denied`; a different administrator revoking still
> OK, and the invitation still names its original sender. Normal self-attributed writes: OK
> throughout.
> **Found, not in this batch:** the attendance **management** policies still have no attribution
> check. An administrator can mark attendance with `marked_by` set to a teacher (`OK rows=1`).
> S11 tightened only the teacher policies. A one-line follow-up using the same mechanism.

- **G4:** a subject teacher overwrites an **administrator's** mark (score 90 → 10) and clears
  `recorded_by`. `OK rows=1`.
- **H4:** management creates homework with `created_by` set to another teacher. `OK rows=1`.
- **I2:** management creates an invitation with `invited_by` set to another user. `OK rows=1`.
- **Reach:** API.

**M7 · A grade can be recorded in a subject the class does not take — NEW — ✅ RESOLVED 2026-09-16**
> **Same gap on homework and exams: investigated and confirmed.** All three tables name
> (class, subject). The teacher policies were already safe (`teaches_class_subject` needs a
> `class_subjects` row), but the management policies check only `can_manage_class`, which does
> not look at the subject. Before the fix, an Arabic grade, moving a grade to Arabic, Arabic
> homework and an Arabic exam in 5A were **all** `OK rows=1`.
> **Fix:** one SECURITY DEFINER trigger function `assert_subject_taught_in_class()` on all three
> tables, firing BEFORE INSERT OR UPDATE OF subject_id, class_id, raising **PT422**
> `class "Grade 5A" does not take subject "Arabic"`. This follows the M3 pattern. After apply, all
> four are refused. English grade and homework (a subject the class takes but with no teacher
> assigned) and a Maths exam are still accepted.

- **G6:** administrator records an Arabic grade in 5A, which has no Arabic. `OK rows=1`.
- **Reach:** API (the screen lists only class subjects).

**M8 · One conflicting student fails a whole class's attendance save — NEW to this list — ✅ RESOLVED 2026-09-16**
> **Verified against K5 first, as asked.** The original setup can no longer happen. Enrolling a pupil
> who is open in 5A into 6B under another year → PT422 (K5 year guard); under the same year → 23505
> (unique open enrolment); no pupil holds two open enrolments; both whole-class saves succeed.
> **But the symptom still occurred through a legitimate route: a same-day transfer.** The 5A
> register is taken in the morning, then the office ends the pupil's 5A enrolment and enrols them
> in 6B. The 6B teacher's whole-register save → `42501 (USING expression)`, and **every** 6B
> pupil's mark was lost. The database refusal is correct: that day's row belongs to 5A, which the
> 6B teacher does not teach. The loss of the rest of the class is the bug.
> **Fix (application only, no guard widened):** `saveAttendance` still tries one upsert. On a
> `42501` for a multi-pupil save, it retries each pupil on their own, saves everyone the database
> accepts, and returns the refused pupils. It still throws if every pupil is refused or on any
> other error. The register screen shows a warning, "Attendance saved for N of M. Not saved for
> <names>…", pointing to the school office, which can correct it.
> **Verified over real HTTP**, running the real bundled `saveAttendance` as two real teachers on a
> throwaway school (removed afterwards). Normal saves return no refusals. After a same-day
> transfer, the old single upsert → 42501 with the other pupils' changes lost. The new
> `saveAttendance` returns `refused: [the transferred pupil]`, the other two pupils are saved and
> attributed to that teacher, and the transferred pupil's 5A mark is untouched. A save where every
> pupil is refused still throws, and nothing changes.

- **Evidence:** reproduced in the academic-year investigation (its probe G2), **not re-run in
  this sweep**.
- **Cause:** attendance is unique per student per day across classes, and the class saves in one
  upsert. A student in two rosters (K5) makes the second teacher's entire save fail with `42501`.
- **Reach:** UI once K5 occurs.

### Finance

**M9 · Payments can be dated in the future — NEW — ✅ RESOLVED 2026-09-16**
> Migration `20260916000007_messaging_and_finance_dates`: trigger `fee_payments_assert_not_future_dated`
> (BEFORE INSERT OR UPDATE OF paid_on) refuses a `paid_on` after the school's **local** today with
> PT422. It uses `school_local_today()`, the same expression `apply_payment_event` uses to stamp
> provider payments, so a provider payment can never be refused. The payment form also sets
> `max` to today and says so. **Measured:**
> - F15 (2030-01-01) and tomorrow: OK → **PT422**
> - editing a payment's date to next year: OK → **PT422**
> - today and last week: still OK
> - `amount_paid` sync unchanged; the S5 forgery is still 42501 and the S6 move still PT409
>
> **Real HTTP:** `recordPayment` dated 2030-01-01 is refused with the sentence; dated today it saves.
>
> **Also requested (not a listed item): a fee cannot be CREATED already overdue.** Trigger
> `fee_records_assert_not_created_overdue` (BEFORE INSERT) refuses a `due_date` before the school's
> local today with PT422; the fee form sets `min` to today for new fees. **Editing an existing fee's
> due date to a past date stays allowed**, deliberately:
> - the locked S5/S7 finance decision keeps due-date edits allowed;
> - an edit is the correction path, and a record must be able to state its true due date;
> - `updateFeeRecord` re-sends `due_date` on every edit, so an update rule would also block amount
>   and category edits on any fee whose due date has passed.
>
> Measured: due yesterday **PT422**; due today, due in 30 days, editing a due date to last month,
> and editing the amount of a past-due fee are all OK. Real HTTP: `createFeeRecord` due yesterday
> refused, today and +30 saved.

- **F15:** `paid_on = 2030-01-01` accepted, `OK rows=1`.
- **Reach:** UI date field and API.

### Messaging & announcements

**M10 · A participant can post anonymously or back-date a message — NEW — ✅ RESOLVED 2026-09-16**
> **Sender:** the attendance/grade attribution mechanism. `messages_participant_insert` now requires
> `sender_id = auth.uid()` (it was "NULL or self"). The same change on the two sibling attribution
> columns: `message_threads_admin_insert` gains `created_by = auth.uid()` (it had no check), and
> `announcements_admin_insert` / `announcements_class_management_insert` tighten "NULL or self" to
> "self".
> **Timestamp:** the S5 column-grant mechanism. `sent_at`, `created_at` and `updated_at` are removed
> from the messages INSERT grant, so only the database default can set them.
> **Measured, before → after:**
> - M6 (sender NULL): OK → **42501**
> - M7 (forged sender): 42501 → 42501
> - M8 (`sent_at` 2020) and `created_at` 2020: OK → **42501 permission denied**
> - thread `created_by` NULL / forged: OK → **42501**
> - announcement `created_by` NULL: OK → **42501**
> - the legitimate message, thread and announcement: still OK
>
> **Real HTTP:** a dual-role administrator's `createThread` (the B1 path) and a guardian's
> `sendMessage` both work; raw NULL, forged and back-dated inserts are refused; `fetchMessages` shows
> both messages stamped today.

- **M6:** message with `sender_id = NULL`. `OK rows=1`.
- **M8:** `sent_at = 2020-01-01`. `OK rows=1`.
- **Still refused:** impersonating another user (`42501`, sweep M7).
- **Reach:** API.

**M11 · "All Students" announcements reach nobody — NEW — ✅ RESOLVED 2026-09-16**
> Students hold no logins, and migration 14 deliberately made `students` readable by management
> only; the parent screens already record that treating it as a parents audience would redirect a
> message meant for children. So the audience has no readership by design, and the fix is to stop
> offering it rather than invent one. `announcements_audience_check` no longer admits `students`
> (0 rows used it), and the form, the type and the labels no longer include it. **Measured:** N1 OK
> (guardian 0, teacher 0) → **23514**; changing an existing notice to `students` → **23514**; All
> Parents / All Teachers / Entire School still publish. Real HTTP: refused, shown as "The value
> entered for audience is not accepted."
>
> **Also requested (not a listed item): a class announcement to a class with no enrolled students.**
> The only "message the whole class" feature is a `class` announcement. Families read it only
> through an open enrolment (M5), so for an empty class it reached no family while the screen said
> "Announcement published". Trigger `announcements_assert_class_has_recipients` (BEFORE INSERT OR
> UPDATE OF audience, class_id) now refuses it with PT422: *class "…" currently has no enrolled
> students, so this announcement would reach no families; it was not published.*
> **Measured:**
> - empty class: OK → **PT422**
> - moving a notice to the empty class: OK → **PT422**
> - a class whose pupils have all left: OK → **PT422**
> - a class with pupils: OK
> - pinning an existing notice after its class emptied: still OK
>
> **Real HTTP:** `createAnnouncement` to an empty class is refused with that sentence; to a class
> with a pupil it publishes and the guardian reads it. Fee reminders already handled zero
> recipients (the send button is disabled).

- **N1:** an administrator creates an announcement with audience `students`.
- **Actual result:** guardian sees **0**, teacher sees **0**. No student role exists and no
  policy reads `students`, but the form offers "All Students" and reports success.
- **Reach:** UI.

**M12 · A failed conversation cannot clean itself up — NEW (masked by B1 today)**
- **M16:** administrator deletes a thread: `OK rows=0`, because there is no DELETE policy.
- `createThread`'s cleanup after a failed participant or message insert therefore silently
  leaves an empty thread nobody can see. It will surface once B1 is fixed.

### Invitations & accounts

**M13 · Every staff member can read pending invitations, including token hashes — NEW — ✅ RESOLVED 2026-09-16**
> Migration `20260916000006_accounts_and_ownership`: `invitations_staff_select` (all staff) is replaced
> by `invitations_admin_select` on `has_school_admin_role`, covering owner, director and
> administrator. That is the group the invitation insert/update/delete policies already use.
> (In this schema, `has_school_management_role` also includes principal.) Accepting an
> invitation goes through the SECURITY DEFINER `accept_invitation` and is unaffected.
> **Measured, before → after:**
> - I6 teacher: 2 rows with hashes → **0**
> - principal: 2 → **0**
> - guardian and the other school's administrator: 0 → 0
> - administrator, director, owner and platform admin: still read them
> - an administrator creating an invitation with read-back: still OK

- **I6:** a teacher reads 5 invitations, token hashes visible.
- **I7:** redeeming one with the hash is still refused (`email_mismatch`), because acceptance
  checks the signed-in email. So this is hardening, not a working exploit.
- **Reach:** API.

**M14 · Only `demo` is a reserved shortcode — NEW — ✅ RESOLVED 2026-09-16**
> The existing mechanism (`reserved_shortcodes` plus the `schools_reject_reserved_shortcode`
> trigger, which binds the approval RPC and a school rename alike) gains eight entries:
> - `www`, `app`, `api`: the login resolver treats these hosts as non-school; `www` and `app` are
>   the live `nomcloud.academy` hosts.
> - `admin`, `login`, `mail`: the standard set; `admin` and `mail` are also in SCHEMA_DESIGN §2.
> - `status`, `class`: documented in SCHEMA_DESIGN §2; `class` is also the school domain,
>   `class.so`.
>
> The repository has no vercel.json or DNS configuration naming any other host.
> **Measured, before → after:**
> - A2, approving with `www`: approved → **23514** "shortcode "www" is reserved…"
> - the same for all eight new entries and `demo`, and an administrator renaming their school to
>   `admin`
> - the application stays pending with no school created
> - a genuine unique shortcode still approves
>
> The approval edge function already deletes the auth user it created when the RPC refuses.

- **A2:** a platform admin approves a school with shortcode **`www`**: `OK rows=1`.
- `www`, `app`, `api`, `admin`, `login` and `mail` are all unreserved.
- The login page treats `www`, `app` and `api` as non-school hosts, so such a school's login
  branding would never load.
- **Reach:** platform admin UI.

**M15 · Newly approved schools have no owner, so nobody has billing access — NEW — ✅ RESOLVED 2026-09-16 (decision: the approved administrator becomes Owner)**
> **Implemented as TWO membership rows, `administrator` and `owner`, not one `owner` row.**
> - The six-role model is multi-role by construction: the key is `UNIQUE (user_id, role)`, and the
>   interface unions roles into workspaces.
> - `owner` has **no frontend workspace** (`src/lib/roles.ts` maps it to null by design), so an
>   owner-only membership would lock the approved person out of the application.
> - In the database, owner already includes every administrator permission and adds billing and
>   owner management.
>
> `approve_school_application` now inserts both rows; nothing else in it changed. **One owner per
> school holds:** the school is created in the same transaction, so this is its first owner.
> **Measured, before → after:**
> - A6/A8, the applicant's memberships: `administrator` → **`owner` + `administrator`**
> - owners at the new school: 0 → **1**
> - billing / owner / admin / management checks as the applicant: false → **all true**
> - a second owner at that school → **23505** `memberships_school_id_owner_idx`, so the one-owner
>   rule still applies
>
> **Not changed:** existing schools are not backfilled. A migration cannot know who owns a running
> school; S8's owner path or a platform administrator can name one.
> ~~**Found, messaging batch:** `fetchMessageableUsers` lists one entry per active membership without
> de-duplicating, so a person holding owner + administrator would appear twice in the message
> recipient picker.~~ **✅ Closed 2026-09-16:** one entry per person with combined roles, e.g.
> "Owner / Administrator" (real HTTP: 2 membership rows → 1 entry).

- **A6:** the new school gets only an `administrator` membership, 0 academic years (K1) and
  0 subjects.
- **A8:** that administrator has `has_school_billing_role = false`. Billing is owner/director
  only, and nobody can become one except through S8.
- **Reach:** UI (platform approval).

**M16 · An administrator can suspend their own membership — NEW — ✅ RESOLVED 2026-09-16**
> **Rule:** a person may not suspend, delete or re-role **their own** active owner, director or
> administrator membership when no **other** active owner, director or administrator membership
> would remain at the school. The refusal is PT409 (HTTP 409). A trigger enforces it:
> `memberships_keep_school_administered`, BEFORE UPDATE OR DELETE.
> - **Why this group:** owner, director and administrator are the only roles that can manage
>   memberships, invitations and settings. A school left with only a principal is still locked out.
> - **Why "other membership":** someone holding administrator + owner (every newly approved school)
>   may give up one role, because the school is still administered through the other.
> - **Why only one's own membership:** anyone changing someone else's membership is an active member
>   of the group, so they can never leave zero. Platform administrators, the service role and
>   cascades are not affected.
> - **Concurrency:** the school row is locked before counting, so two sole-pair administrators
>   leaving at once are handled one after the other.
>
> **Measured, before → after:**
> - R4, the sole administrator (the second school's real administrator suspended inside the
>   rolled-back probe): suspends self OK → **PT409**; deletes own membership OK → **PT409**; changes
>   own role to principal OK → **PT409**
> - a harmless self-edit: OK → OK
> - a platform admin suspending that administrator: OK → OK
> - suspending self with a director also active, or at the demo school with others active: OK → OK
> - the approved owner-administrator: can suspend their administrator row, then **cannot** suspend
>   their owner row (PT409)
> - S8 (an administrator suspending the owner): still 0 rows

- **R4:** update accepted, `OK rows=1`.
- If they are the school's only administrator, the school is locked out of administration.
- **Reach:** API.

---

## COSMETIC

**C1 · Student status form offers 3 of the 4 database values — ✅ RESOLVED 2026-09-16**
> The form now builds its options from `STUDENT_STATUSES` (studentService), which holds exactly the
> four `students_status_check` values. If a saved value is ever outside that list, it is shown as
> itself rather than silently as the first option. **Real browser:** an already-transferred student
> opens with `transferred` / "Transferred" selected. Choosing Transferred for another student saves
> `transferred`, and reopening shows it selected.

- `students_status_check` allows `active`, `inactive`, `graduated`, `transferred`; the form omits
  `transferred`.
- A transferred student opens with the wrong option shown. The saved value is not changed unless
  the field is touched.

**C2 · Guardian relationship can never be set from the UI — ✅ RESOLVED 2026-09-16**
> Both linking paths (existing guardian and new guardian, on the student form, the only place a
> guardian is linked) now have a required **Relationship to student** field: Mother / Father /
> Other, the values the demo data and bulk-import plan use. The RPCs `link_guardian_to_student` and
> `create_and_link_guardian` gained `p_relationship` (migration `20260916000005`):
> - a new link stores it;
> - an existing link given a different relationship is updated (`relationship_updated`, row count
>   asserted);
> - blank is stored as NULL;
> - the old call shape still works;
> - the S2 guards are unchanged (a teacher gets 42501, anon has no execute permission).
>
> The directory and the "Already linked" line show "Name (Relationship)". **Real browser:**
> - saving without a relationship shows *Choose the guardian's relationship to the student.* and
>   links nothing;
> - linking with Father stores `Father` and the table shows "Existing Guardian (Father)";
> - re-picking that guardian pre-fills Father; changing to Other stores `Other`, with the toast
>   "…relationship is now Other";
> - a new guardian added as Mother stores `Mother` and shows "New Probe Mother (Mother)".
>
> The column stays free text; no CHECK was added.

- `student_guardians.relationship` exists (free text), but no form has the field, so every
  UI-created link stores NULL.

**Every other form matches its CHECK or enum exactly:**

| Field | Values |
|---|---|
| Teacher status | 2/2 |
| Student gender | 3/3 |
| Attendance status | 4/4 |
| Exam status | 3/3 |
| Homework submission status | 4/4 |
| Payment method | 6/6 |
| Announcement priority | 3/3 |
| Announcement audience | 5/5 (see M11) |
| Grading scale | 3/3 |

---

## Suspected, not confirmed

These follow from the schema, but I did not reproduce them, so they are **not** counted above.

- ~~Deleting a class also deletes its exams and class announcements.~~ **Settled by the S1 fix:**
  exams are now RESTRICT (measured `23503`); class announcements still cascade by design (measured
  removed with an empty class).
- ~~Deleting an academic year cascades through classes to attendance.~~ **Settled by the S1 fix:**
  measured `23503` for a year whose class has attendance and homework.
- **A principal with `scope_mode = 'selected'` cannot create or manage classes without a
  campus.** Read from `has_campus_scoped_management`; no selected-scope principal was tested.
- **`accept_invitation` refuses a user whose profile belongs to another school (`23514`).**
  Not reached: I15 stopped earlier at `email_mismatch`. Phase 4 probed it originally.

---

## Re-verified — no issue found

Regression checks that passed. Listed so the fix batches know what not to re-open.

- **Finance protections (earlier batches) intact.**
  - `amount_paid` not writable on insert or update (`42501`, F1–F2).
  - Overpayment refused (`23514`, F3).
  - A fee with payments cannot be deleted (`23503`, F4) or reduced below paid (`23514`, F5).
  - `recorded_by` cannot be forged (`42501`, F6).
  - `payment_events` and `apply_payment_event` are closed to sessions (`42501`, F7–F8).
  - Principal and teacher see 0 finance rows (F17–F18). A guardian sees only their own child's
    fee and payments and 0 events (F19), and cannot pay directly (F20).
- **Messaging isolation.**
  - Non-participants cannot read, post or self-join (M3–M5).
  - Participants cannot impersonate (M7), edit or delete messages (M9–M10), or touch others'
    read markers (M11); they cannot see other threads (M12).
  - Cross-school participants are refused (`23503`, M15). Notifications cannot be created by any
    session (N3). Teachers cannot post announcements (N4, by design).
- **File storage unchanged.**
  - A school sees only its own logo and avatar (ST1, ST3).
  - Cross-school upload refused (ST2). Class teacher sees the photo; a non-teaching teacher does
    not (ST5–ST6).
  - Signed-out users list nothing (ST7). 11 policies and 3 buckets with the same limits (ST8).
- **Invitations.** `accept_invitation` returns the correct outcome for:
  - wrong email (I8) and someone else's user id (`22023`, I9);
  - valid acceptance, which creates the right profile and teacher membership (I10–I11);
  - replay (I12), expired (I13) and revoked (I14).
  - Also: no cross-school invitation (I5); a principal cannot invite (R6); a membership cannot be
    moved to another school (R5).
- **School approval.**
  - Non-platform callers refused (A1). A taken shortcode is refused and the application stays
    pending (A3, A3b). A mismatched auth user is refused (A4).
  - Correct approval works (A5). Re-approval refused (A7).
  - Anonymous users cannot submit an already-approved application (A9); a pending one is
    accepted (A10).
- **People and structure.**
  - Teachers cannot edit students (P2d). Unlinking a guardian removes all their access (P7b).
  - A subject with grades cannot be deleted (S7). A homeroom teacher cannot be deleted (P5).
  - A guardian cannot write attendance (AT4). A score above max is refused (G2).
  - The demo school, despite its reserved shortcode, can still save settings (S8).
- **Cross-school regression (area 9).** Every public table with a `school_id` column was queried
  and updated as the other school's administrator, a teacher, a guardian and an anonymous caller.
  - **0 rows visible and 0 rows updatable in every direction.**
  - Direct inserts of a student, teacher, academic year, announcement, membership, attendance
    record, fee record and message thread into the other school were each refused (`42501`).
  - So were a school rename (0 rows), a student delete (0 rows), a profile school change and
    re-pointing a student to the other school (X1–X13).

---

## Suggested batch order

1. ~~**B1**~~ (messaging unusable). **Resolved.**
2. ~~**S1, S2, S3**~~ (all resolved).
3. ~~**S5, S6, S7**~~ (all resolved — money integrity).
4. ~~**S8, S9**~~ (resolved).
5. ~~**S4, S10, S11, K3**~~ (all resolved).
6. ~~The academic-year batch: K1, K2, K4, K5, K6, M1, M2, M3.~~ (all resolved — this also clears the precondition for M8).
6a. ~~Attribution and scope: M6, M7, M8.~~ (all resolved; follow-up found: attendance management policies lack the attribution check).
6b. ~~Parent visibility and people UI: M4, M5, C1, C2.~~ (all resolved).
6c. ~~Accounts and ownership: M13, M14, M15, M16.~~ (all resolved; the recipient-picker de-duplication it found is closed in 6d).
6d. ~~Messaging and finance: M9, M10, M11, plus recipient de-duplication, empty-class announcements and fees created overdue.~~ (all resolved).
7. **Still open:** M12 (a failed conversation cannot clean itself up), plus the follow-ups below, which are not numbered items.

### Final state (2026-09-16)

| Severity | Found | Resolved | Open |
|---|---|---|---|
| BLOCKER | 1 | 1 | 0 |
| SERIOUS | 11 | 11 | 0 |
| MINOR | 16 | 15 | **1 (M12)** |
| COSMETIC | 2 | 2 | 0 |
| **Total** | **30** | **29** | **1** |

**Follow-ups found while fixing, not numbered items and not yet fixed:**
- The attendance **management** policies have no `marked_by` attribution check (found in the M6 batch).
- A different administrator cannot pin or unpin another administrator's announcement: 42501 before
  and after this batch, because the announcement UPDATE policies keep "created_by is NULL or self".
- `sendMessage` updates `message_threads.last_message_at`, but that table has no UPDATE policy for
  school roles, so the update affects no rows and a thread's position does not move. Found by policy
  inspection; not measured.
- Teachers and guardians see other people as "School member" in the recipient picker and in threads,
  because only administrators can read other profiles (real HTTP).
