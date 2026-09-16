# Nom Cloud — System Issues List

**Status:** Read-only bug sweep, 2026-09-15. The sweep itself changed nothing.
**Fixes since:** B1, S1, S6, S8 and S9 resolved; S5 partly resolved (the "moved" half) — all 2026-09-15, marked in place below; original evidence kept.
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
| **K1** | No way to create an academic year from the app (the API accepts it — sweep A9 — but no screen offers it) |
| **K2** | Switching the active year is two unsafe steps with a window of zero active years |
| **K3** | A teacher can mark attendance for a student not enrolled in their class (also after the student has **left** the class — sweep L4) |
| **K4** | Attendance can be dated outside any valid academic year |
| **K5** | A student can end up with two open enrolments |
| **K6** | Screens mix every year's classes together |

---

## Summary

| Severity | Count | Resolved |
|---|---|---|
| BLOCKER | 1 | 1 (B1) |
| SERIOUS | 11 | 4 (S1, S6, S8, S9) + S5 partly |
| MINOR | 16 | 0 |
| COSMETIC | 2 | 0 |
| **Total new** | **30** | **5** (+ S5 partly) |

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

### S2 · People · Adding a "New" guardian to a student who already has a primary guardian silently does nothing — NEW
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

### S3 · People · Deleting a teacher silently removes their login access and class assignments — NEW
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

### S4 · People · Marking a teacher "inactive" changes nothing about their access — NEW
- **Table:** `teachers.status` (not consulted by `current_teacher_id` or `teaches_class`)
- **Steps:** Administrator sets Faysal to `inactive`. Faysal then acts.
- **Actual result:**
  - Faysal marked attendance for Yusuf in 5A: `OK rows=1`.
  - He still read all 4 students and all 4 guardians, including phone numbers.
  - Only suspending the **membership** removes access; the teacher form's status does not.
- **Reach:** UI (Admin → Teachers → Status).

### S5 · Finance · Provider-confirmed (WaafiPay) payments can be edited or moved after the fact — NEW — ◐ PARTLY RESOLVED 2026-09-15

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
> **"Edited" (F9 amount, F16 external_ref/reference) — STILL OPEN.** Those columns remain
> updatable and were deliberately not touched in this task. Deciding whether a provider-confirmed
> payment may be edited at all (and how corrections are voided) needs its own fix.

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

### S7 · Finance · Currency is not enforced between a fee and its payments — NEW
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

### S10 · Grades & homework · Same "no enrolment check" gap as attendance — NEW (same class as K3)
- **Tables:** `grade_records`, `homework_submissions`
- **Steps and actual results:**
  - **G1:** Sahra (5A Mathematics) records a grade for **Layla**, who is enrolled in 6B, under
    5A. `OK rows=1`.
  - **H2:** Sahra records a homework submission on 5A homework for **Layla**. `OK rows=1`.
- **Still refused:** a teacher of another class (`42501`, sweep G5 and H3).
- **Reach:** API (the screens list only enrolled students).

### S11 · Attendance · A teacher can rewrite another teacher's record, erase who marked it, and move it to a different student — NEW (extends K3)
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

**M1 · Terms and years are not validated against each other — NEW**
- **Steps and results:**
  - **S1:** a term dated **2030** inside academic year 2026/2027. `OK rows=1`.
  - **S2:** a term overlapping Term 1. `OK rows=1`.
  - **S3:** an academic year overlapping 2026/2027. `OK rows=1`.
- **Why it matters:** the current term is derived from dates, so overlaps make it ambiguous.
- **Reach:** API only (no term or year editor exists).

**M2 · Classes can be created in, and students enrolled into, a closed year — NEW**
- **S4:** class created in closed year 2025/2026. `OK rows=1`.
- **S5:** a student enrolled into it. `OK rows=1`.
- **Reach:** API. Related to K5 and K6.

**M3 · Grades and exams may use a term from a different academic year — NEW**
- **G3:** a grade on a 2026/2027 class using a 2027/2028 term. `OK rows=1`.
- **E1:** an exam in a 2027/2028 term dated **2031**. `OK rows=1`.
- **Reach:** API.

### People

**M4 · Deleting a student who has fee payments fails, contradicting the dialog — NEW**
- **P6:** the dialog says the delete removes "attendance, grades and fees". Actual result:
  `23503 ... violates foreign key constraint "fee_payments_school_id_fee_record_id_fkey"`, shown
  as a generic readable error.
- The block itself is correct money protection; the dialog is wrong. **Reach:** UI.

**M5 · A guardian keeps seeing a class after their child leaves it — NEW**
- **Cause:** `guardian_has_student_in_class` ignores `left_on`.
- **Steps:** close Yusuf's 5A enrolment, then act as guardian Amina.
- **Actual result (L2):** she still sees 5A homework (2), timetable (1), class subjects (2) and
  the class row (1). The same helper gates class exams and class announcements.
- **Reach:** UI (parent screens).

### Grades / homework / attendance attribution

**M6 · Attribution can be erased or forged — NEW**
- **G4:** a subject teacher overwrites an **administrator's** mark (score 90 → 10) and clears
  `recorded_by`. `OK rows=1`.
- **H4:** management creates homework with `created_by` set to another teacher. `OK rows=1`.
- **I2:** management creates an invitation with `invited_by` set to another user. `OK rows=1`.
- **Reach:** API.

**M7 · A grade can be recorded in a subject the class does not take — NEW**
- **G6:** administrator records an Arabic grade in 5A, which has no Arabic. `OK rows=1`.
- **Reach:** API (the screen lists only class subjects).

**M8 · One conflicting student fails a whole class's attendance save — NEW to this list**
- **Evidence:** reproduced in the academic-year investigation (its probe G2), **not re-run in
  this sweep**.
- **Cause:** attendance is unique per student per day across classes, and the class saves in one
  upsert. A student in two rosters (K5) makes the second teacher's entire save fail with `42501`.
- **Reach:** UI once K5 occurs.

### Finance

**M9 · Payments can be dated in the future — NEW**
- **F15:** `paid_on = 2030-01-01` accepted, `OK rows=1`.
- **Reach:** UI date field and API.

### Messaging & announcements

**M10 · A participant can post anonymously or back-date a message — NEW**
- **M6:** message with `sender_id = NULL`. `OK rows=1`.
- **M8:** `sent_at = 2020-01-01`. `OK rows=1`.
- **Still refused:** impersonating another user (`42501`, sweep M7).
- **Reach:** API.

**M11 · "All Students" announcements reach nobody — NEW**
- **N1:** an administrator creates an announcement with audience `students`.
- **Actual result:** guardian sees **0**, teacher sees **0**. No student role exists and no
  policy reads `students`, but the form offers "All Students" and reports success.
- **Reach:** UI.

**M12 · A failed conversation cannot clean itself up — NEW (masked by B1 today)**
- **M16:** administrator deletes a thread: `OK rows=0`, because there is no DELETE policy.
- `createThread`'s cleanup after a failed participant or message insert therefore silently
  leaves an empty thread nobody can see. It will surface once B1 is fixed.

### Invitations & accounts

**M13 · Every staff member can read pending invitations, including token hashes — NEW**
- **I6:** a teacher reads 5 invitations, token hashes visible.
- **I7:** redeeming one with the hash is still refused (`email_mismatch`), because acceptance
  checks the signed-in email. So this is hardening, not a working exploit.
- **Reach:** API.

**M14 · Only `demo` is a reserved shortcode — NEW**
- **A2:** a platform admin approves a school with shortcode **`www`**: `OK rows=1`.
- `www`, `app`, `api`, `admin`, `login` and `mail` are all unreserved.
- The login page treats `www`, `app` and `api` as non-school hosts, so such a school's login
  branding would never load.
- **Reach:** platform admin UI.

**M15 · Newly approved schools have no owner, so nobody has billing access — NEW (needs a decision)**
- **A6:** the new school gets only an `administrator` membership, 0 academic years (K1) and
  0 subjects.
- **A8:** that administrator has `has_school_billing_role = false`. Billing is owner/director
  only, and nobody can become one except through S8.
- **Reach:** UI (platform approval).

**M16 · An administrator can suspend their own membership — NEW**
- **R4:** update accepted, `OK rows=1`.
- If they are the school's only administrator, the school is locked out of administration.
- **Reach:** API.

---

## COSMETIC

**C1 · Student status form offers 3 of the 4 database values**
- `students_status_check` allows `active`, `inactive`, `graduated`, `transferred`; the form omits
  `transferred`.
- A transferred student opens with the wrong option shown. The saved value is not changed unless
  the field is touched.

**C2 · Guardian relationship can never be set from the UI**
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
2. ~~**S1**~~ (resolved), **S2, S3** (silent data loss and silent failure through the UI).
3. ~~**S6**~~ (resolved), **S5** (moved: resolved; edited: open), **S7** (money integrity).
4. ~~**S8, S9**~~ (resolved).
5. **S4, S10, S11**, with K3 (one enrolment and attendance authority batch).
6. The academic-year batch: K1, K2, K4, K5, K6, M1, M2, M3.
7. Remaining MINOR and COSMETIC items.
