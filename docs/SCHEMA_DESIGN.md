# Nom Cloud — Phase 3 Production Schema Design (as amended)

**Status: APPROVED. This document is the authoritative schema design for Phase 3 and beyond.**

Every Phase 3 migration prompt referenced this design by section number (§B, §C, §F, §H, §10, §13).
Until now it existed only in conversation context. This file is the permanent record.

## Provenance and authority

| Layer | Source | Authority |
|---|---|---|
| Original design | Phase 3 schema design response, 34 tables, sections §A–§J | Base text |
| Amendment 1 | 18 approved decisions, sections §1–§18 | **Supersedes the original wherever they differ** |
| Standing rules | Discovered during implementation, Migrations 01–10 | Binding on all future migrations |

**Reading order when two statements conflict: Amendment wins over original §C text. Always.**
Sections superseded by an amendment are marked **⚠ SUPERSEDED** inline with a pointer.

## Numbering note — read this before citing sections

Two numbering quirks caused confusion during Phase 3 and are recorded so they do not recur:

- **The `audit_logs` design is §H, not §E.** Several Phase 3 prompts cited it as "§E". §E is the
  frontend field mapping. This document uses **§H** and cross-references the mistaken alias.
- **The design contains 34 tables, not 35.** §B enumerates 1–34. Some prompts said "tables 1
  through 35". `audit_logs` is table **#6** in the §B inventory but is specified in **§H** rather
  than in the §C run, which is likely the source of the off-by-one.

---

# §A. FOUNDATIONS

## §A.1 Conventions applied to every table (stated once, not repeated per table)

| Element | Convention |
|---|---|
| Primary key | `id uuid NOT NULL DEFAULT gen_random_uuid()` — `pgcrypto` is built into Supabase; no extension needed on PG13+ |
| Timestamps | `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` — **`timestamptz`, never `timestamp`**, so everything is stored UTC and rendered per school timezone |
| `updated_at` maintenance | One shared trigger function applied to every table — never left to the application |
| Text | `text` throughout, never `varchar(n)`; length limits enforced by CHECK where they carry meaning |
| Money | `numeric(12,2)` — never `float`. `currency char(3)` on schools, ISO 4217 |
| Dates | Calendar dates (`date`) for attendance/due dates; `timestamptz` for events |
| Deletion | People and records use **status lifecycles**, not `deleted_at`. Hard deletes are audited |

**Exception:** `audit_logs` has no `updated_at` — it is append-only by design.

> **CRITICAL FOR READING §C:** the per-table column lists in §C **omit** `id`, `created_at` and
> `updated_at` because they are stated here once. A §C table that lists no `id` column but declares
> "**PK** `id`" is not an inconsistency. Likewise §C index lists name required **access paths**, not
> distinct index objects — §C table 10 says so explicitly with "Index `(shortcode)` (unique already)".

## §A.2 The tenancy decision that shapes everything

**Every school-owned table carries `school_id uuid NOT NULL` directly, even when ownership is already derivable through a parent FK.**

This is deliberate denormalisation, and it is the single most consequential structural choice in this design.

**Why:** Phase 7 RLS policies must be a single indexable predicate — `school_id = current_school_id()`. A policy that reaches ownership through a join (`EXISTS (SELECT 1 FROM classes …)`) is re-evaluated per row, cannot use a plain index, and degrades badly as tenants grow. Denormalising `school_id` keeps every policy identical, trivially auditable, and index-backed.

**The risk it creates:** a child row could carry `school_id = A` while its parent belongs to school B — a silent cross-tenant leak that RLS would happily serve.

**The mitigation — composite foreign keys.** For every parent-child relation inside a school, the child references the parent on `(school_id, parent_id)` rather than `parent_id` alone. This requires a redundant `UNIQUE (school_id, id)` on each referenced parent table. Postgres then makes the mismatch *structurally impossible* rather than merely discouraged.

Cost: one extra unique index per referenced table. That is a small price for eliminating an entire class of tenant-isolation bug at the database level rather than in policy review.

## §A.3 How `current_school_id()` will work (Phase 7)

⚠ **Partially superseded by Amendment §2** — the identity model is re-derived for one-school tenancy.

`memberships` is the source of truth. On login and on school-switch, a `SECURITY DEFINER` function verifies the user's membership and stamps the active `school_id` into the JWT's `app_metadata`. RLS reads the claim, never a client-supplied header or the subdomain. **The subdomain `{shortcode}.class.so` is routing and branding only — never an authorisation input.** This must be stated explicitly because the subdomain scheme invites exactly that mistake.

## §A.4 Status vocabularies — split deliberately

| Table | Status values | Reasoning |
|---|---|---|
| `school_applications.status` | `pending`, `approved`, `rejected`, `withdrawn` | The lifecycle of a *request* |
| `schools.status` | `active`, `suspended`, `closed` | The lifecycle of a *tenant* |

Since a `schools` row only comes into existence at approval, `pending` and `rejected` are unrepresentable states for a school — a school row cannot be pending, because pending means it isn't a school yet. Equally, `suspended` is meaningless on an application. Sharing one enum across both tables would create four states that must never occur, and every query would need a defensive filter to exclude them.

Two disjoint enums mean **no illegal state is expressible.** `withdrawn` (applicant pulled out) and `closed` (school left the platform) were added because both occur in practice and would otherwise be misfiled as `rejected` and `suspended`, corrupting the metrics that these columns exist to produce.

---

# §B. TABLE INVENTORY — 34 tables

| # | Table | Classification | How `school_id` is reached |
|---|---|---|---|
| 1 | `subscription_plans` | **PLATFORM** | n/a — no school ownership |
| 2 | `reserved_shortcodes` | **PLATFORM** | n/a |
| 3 | `school_applications` | **PLATFORM** | n/a — pre-tenant by definition |
| 4 | `contact_messages` | **PLATFORM** | n/a — marketing site enquiries |
| 5 | `platform_admins` | **PLATFORM** | n/a |
| 6 | `audit_logs` | **PLATFORM** (school-scoped when applicable) | `school_id` **nullable**; NULL = platform action |
| 7 | `profiles` | **IDENTITY** | ⚠ see Amendment §2 — now carries `school_id` |
| 8 | `memberships` | **IDENTITY** | `school_id` direct — this table *defines* tenancy |
| 9 | `invitations` | **IDENTITY** | `school_id` direct |
| 10 | `schools` | **TENANT ROOT** (⚠ Amendment §12; was "SCHOOL-OWNED (root)") | `id` **is** the school_id |
| 11 | `school_subscriptions` | SCHOOL-OWNED | `school_id` direct |
| 12 | `academic_years` | SCHOOL-OWNED | `school_id` direct |
| 13 | `terms` | SCHOOL-OWNED | `school_id` direct + composite FK to `academic_years` |
| 14 | `subjects` | SCHOOL-OWNED | `school_id` direct |
| 15 | `teachers` | SCHOOL-OWNED | `school_id` direct |
| 16 | `guardians` | SCHOOL-OWNED | `school_id` direct |
| 17 | `students` | SCHOOL-OWNED | `school_id` direct |
| 18 | `student_guardians` | SCHOOL-OWNED | `school_id` direct + composite FKs both sides |
| 19 | `classes` | SCHOOL-OWNED | `school_id` direct |
| 20 | `class_subjects` | SCHOOL-OWNED | `school_id` direct |
| 21 | `class_enrollments` | SCHOOL-OWNED | `school_id` direct |
| 22 | `timetable_slots` | SCHOOL-OWNED | `school_id` direct |
| 23 | `attendance_records` | SCHOOL-OWNED | `school_id` direct |
| 24 | `grade_records` | SCHOOL-OWNED | `school_id` direct |
| 25 | `homework` | SCHOOL-OWNED | `school_id` direct |
| 26 | `homework_submissions` | SCHOOL-OWNED | `school_id` direct |
| 27 | `exams` | SCHOOL-OWNED | `school_id` direct |
| 28 | `fee_records` | SCHOOL-OWNED | `school_id` direct |
| 29 | `fee_payments` | SCHOOL-OWNED | `school_id` direct |
| 30 | `announcements` | SCHOOL-OWNED | `school_id` direct |
| 31 | `notifications` | SCHOOL-OWNED | `school_id` direct |
| 32 | `message_threads` | SCHOOL-OWNED | `school_id` direct |
| 33 | `message_thread_participants` | SCHOOL-OWNED | `school_id` direct |
| 34 | `messages` | SCHOOL-OWNED | `school_id` direct |

**Note on the tenancy rule as applied:** `school_id` is *not* mechanically added to platform tables. `subscription_plans`, `reserved_shortcodes`, `contact_messages`, `platform_admins` and `school_applications` carry none — an application has no school because the school does not exist until it is approved.

⚠ **The original §B note continued:** *"`profiles` carries none because one human may hold roles at several schools; putting `school_id` on `profiles` would force duplicate identities and break Supabase Auth's one-row-per-user model."* **This reasoning is VOID.** Amendment §2 declared the multi-school premise not approved; `profiles` now carries `school_id`. Do not follow the original paragraph.

---

# §C. TABLE-BY-TABLE DETAIL

## PLATFORM-LEVEL

### 1. `subscription_plans` — PLATFORM
Backs the Pricing page (currently hardcoded in `Pricing.tsx`).

| Column | Type | Null | Default |
|---|---|---|---|
| `code` | text | NO | — |
| `name` | text | NO | — |
| `description` | text | YES | — |
| `price_monthly` | numeric(12,2) | NO | — |
| `price_annual` | numeric(12,2) | YES | — |
| `currency` | char(3) | NO | `'USD'` |
| `max_students` | integer | YES | — (NULL = unlimited) |
| `features` | jsonb | NO | `'[]'` |
| `is_public` | boolean | NO | `true` |
| `sort_order` | integer | NO | `0` |

**PK** `id` · **Unique** `(code)` · **Check** `price_monthly >= 0`, `max_students > 0` · **Index** `(is_public, sort_order)` for the pricing page.
**FKs** none.

### 2. `reserved_shortcodes` — PLATFORM
Prevents a school claiming `www`, `api`, `admin`, `mail`, `app`, `status`, `class` etc. as a subdomain.

| Column | Type | Null | Default |
|---|---|---|---|
| `shortcode` | text | NO | — |
| `reason` | text | YES | — |

**PK** `shortcode` (natural key; no surrogate — the value *is* the identity) · **Check** same DNS pattern as `schools.shortcode`.

### 3. `school_applications` — PLATFORM
Receives the BookDemo form. **No `school_id`** — pre-tenant by definition.

| Column | Type | Null | Default |
|---|---|---|---|
| `school_name` | text | NO | — |
| `administrator_name` | text | NO | — |
| `email` | citext | NO | — |
| `phone` | text | NO | — |
| `school_size_band` | text | NO | — |
| `message` | text | YES | — |
| `country` | char(2) | YES | — |
| `status` | `application_status` | NO | `'pending'` |
| `reviewed_by` | uuid | YES | — |
| `reviewed_at` | timestamptz | YES | — |
| `rejection_reason` | text | YES | — |
| `approved_school_id` | uuid | YES | — |
| `source_ip` | inet | YES | — |

**PK** `id`
**FKs**
- `reviewed_by → profiles(id) ON DELETE SET NULL` — the decision record must survive a platform admin leaving; losing who-approved is worse than a dangling name.
- `approved_school_id → schools(id) ON DELETE SET NULL` — if a school is ever purged, the application history stays as a business record.

**Check** `status='approved'` requires `approved_school_id IS NOT NULL`; `status='rejected'` requires `rejection_reason IS NOT NULL`. This makes "approved but no school created" unrepresentable — the failure mode most likely to occur if approval is ever done in two steps instead of one transaction.
**Indexes** `(status, created_at DESC)` for the review queue; `(email)` for duplicate-application detection.

### 4. `contact_messages` — PLATFORM
From `contactService.ts`. Deliberately separate from applications — a general enquiry is not a school application, and conflating them pollutes the approval queue.

| Column | Type | Null | Default |
|---|---|---|---|
| `name` · `email` · `topic` · `message` | text / citext / text / text | NO | — |
| `status` | text | NO | `'new'` |
| `handled_by` | uuid | YES | — |
| `handled_at` | timestamptz | YES | — |
| `source_ip` | inet | YES | — |

**FK** `handled_by → profiles(id) ON DELETE SET NULL` · **Index** `(status, created_at DESC)`.

> **Implementation note:** the design defines **no vocabulary** for `status`. Under the clarified
> standing rule it is plain text with **no CHECK**. A CHECK added during Migration 02 was removed
> by corrective `20260904000001`.

### 5. `platform_admins` — PLATFORM
Who may approve schools. Kept as an explicit table rather than a role string on `profiles`, so platform privilege is a deliberate row insertion, auditable and revocable, never a value an application bug could set.

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` | uuid | NO | — |
| `granted_by` | uuid | YES | — |
| `granted_at` | timestamptz | NO | `now()` |
| `revoked_at` | timestamptz | YES | — |

**PK** `id` · **Unique** `(user_id) WHERE revoked_at IS NULL` (partial — one active grant per person, history preserved)
**FKs** `user_id → profiles(id) ON DELETE CASCADE`; `granted_by → profiles(id) ON DELETE SET NULL`.

### 6. `audit_logs` — PLATFORM (school-scoped when applicable)
**Specified in full in §H below**, not in this run.

## IDENTITY

### 7. `profiles` — IDENTITY
⚠ **SUPERSEDED by Amendment §2.** The original said *"Platform-level: no `school_id`"*. It now carries `school_id`. **Use the amended table 7 in §2, not the text below.**

*Original, retained for provenance only:* one row per authenticated human, `id` equal to `auth.users.id`. Columns `full_name`, `email` citext, `phone`, `locale` default `'en'`, `avatar_url`, `last_seen_at`. PK `id`; FK `id → auth.users(id) ON DELETE CASCADE`; Unique `(email)`; Index `(email)`. No password column — ever.

### 8. `memberships` — IDENTITY · the tenancy join
⚠ **SUPERSEDED by Amendments §2 and §16.** **Use the amended table 8 in §2.**

*Original, retained for provenance only:* one row per (person, school, role). Unique `(user_id, school_id, role)`. FKs `teacher_id → teachers(id) ON DELETE SET NULL`, `guardian_id → guardians(id) ON DELETE SET NULL`. Prohibitive CHECK (`role='teacher'` ⇒ `guardian_id IS NULL`, etc.).

**What changed:** uniqueness became `(user_id, role)`; the CHECK became **positive**; those two FKs became **composite CASCADE**.

### 9. `invitations` — IDENTITY
The missing link between "admin adds a teacher" and "teacher has an account".

| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `email` | citext | NO | — |
| `role` | `user_role` | NO | — |
| `teacher_id` / `guardian_id` | uuid | YES | — |
| `token_hash` | text | NO | — |
| `expires_at` | timestamptz | NO | — |
| `accepted_at` | timestamptz | YES | — |
| `accepted_by` | uuid | YES | — |
| `invited_by` | uuid | NO | — |
| `revoked_at` | timestamptz | YES | — |

**Unique** `(school_id, email, role) WHERE accepted_at IS NULL AND revoked_at IS NULL` — one live invite per person per role.
**FKs** ⚠ **SUPERSEDED by Amendment §17** — all FKs are now CASCADE, no SET NULL anywhere.
**Index** `(token_hash)`, `(school_id, email)`.

**Store only a hash of the token, never the token itself** — an invitation token is a bearer credential, and a database dump must not yield working invites.

## TENANT ROOT

### 10. `schools` — TENANT ROOT
⚠ Reclassified from "SCHOOL-OWNED (tenant root)" by Amendment §12. `school_id` is reached as `id` itself.

| Column | Type | Null | Default |
|---|---|---|---|
| `shortcode` | text | NO | — |
| `name` | text | NO | — |
| `status` | `school_status` | NO | `'active'` |
| `address` / `phone` / `email` / `website` | text / text / citext / text | YES | — |
| `logo_path` | text | YES | — (Storage object path — **not** base64) |
| `primary_color` | text | NO | `'#FF5A1F'` |
| `timezone` | text | NO | `'Africa/Mogadishu'` |
| `country` | char(2) | NO | `'SO'` |
| `currency` | char(3) | NO | `'USD'` |
| `locale` | text | NO | `'en'` |
| `weekend_days` | smallint[] | NO | `'{5,6}'` (Fri–Sat) |
| `grading_scale` | text | NO | `'percentage'` |
| `attendance_cutoff_time` | time | NO | `'08:00'` |
| `email_notifications` / `sms_notifications` / `parent_portal_enabled` | boolean | NO | `true` |
| ~~`active_academic_year_id`~~ | ~~uuid~~ | — | ⚠ **REMOVED by Amendment §14** |
| `suspended_at` / `suspension_reason` | timestamptz / text | YES | — |

**PK** `id` · **Unique** `(shortcode)`.
**Check** `shortcode ~ '^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$'` (DNS-safe, 3–63 chars, no leading/trailing hyphen) and `shortcode NOT IN (SELECT …)` enforced by **trigger** against `reserved_shortcodes` (a CHECK cannot subquery).
**Check** `grading_scale IN ('letter','percentage','gpa')`; `array_length(weekend_days,1) BETWEEN 1 AND 3`.
**FK** ⚠ **NONE.** Amendment §14 removed the only outbound FK. `schools` has **zero outbound foreign keys**.
**Index** `(shortcode)` (unique already), `(status)`.

`weekend_days` defaults to Friday–Saturday for the Somali market rather than the Monday–Friday assumption hardcoded in `schoolCalendar.ts`.

## SCHOOL-OWNED

### 11. `school_subscriptions` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `plan_id` | uuid | NO | — |
| `status` | text | NO | ⚠ **NO DEFAULT** — Amendment §9 removed `'trialing'` |
| `current_period_start` / `current_period_end` | timestamptz | NO / YES | — |
| `trial_ends_at` / `cancelled_at` | timestamptz | YES | — |
| `external_ref` | text | YES | — (payment-provider id, Phase 11) |

**Unique** `(school_id) WHERE cancelled_at IS NULL` — one live subscription per school.
**FKs** `school_id → schools(id) ON DELETE CASCADE`; `plan_id → subscription_plans(id) ON DELETE RESTRICT` — **RESTRICT**, because deleting a plan that schools are paying for must be blocked; plans are retired via `is_public=false`, never deleted.
**Status vocabulary:** `trialing` / `active` / `past_due` / `cancelled` / `expired` — **text + CHECK, never an enum.** Billing vocabularies evolve, and `ALTER TYPE` against a live database is far worse than altering a CHECK.

### 12. `academic_years` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `label` | text | NO | — |
| `start_date` / `end_date` | date | NO | — |
| `status` | text | NO | `'upcoming'` (`upcoming`/`active`/`closed`) |

**Unique** `(school_id, label)`; **`UNIQUE (school_id, id)`** — the composite-FK guard target.
**Check** `end_date > start_date`; `status IN (…)`.
**Partial unique** `(school_id) WHERE status='active'` — **at most one active year per school**, enforced by the database rather than hoped for by the application.
**FK** `school_id → schools(id) ON DELETE CASCADE` · **Index** `(school_id, status)`.

### 13. `terms` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `academic_year_id` | uuid | NO | — |
| `name` | text | NO | — |
| `start_date` / `end_date` | date | NO | — |
| `sort_order` | smallint | NO | `1` |

**Unique** `(school_id, academic_year_id, name)`; **`UNIQUE (school_id, id)`**.
**FK** `(school_id, academic_year_id) → academic_years(school_id, id) ON DELETE CASCADE` — **the composite form**, so a term can never belong to another school's year.
**Check** `end_date > start_date` · **Index** `(school_id, academic_year_id, sort_order)`.

**This table is what finally kills `CURRENT_TERM = 'Term 1'`.**

### 14. `subjects` — SCHOOL-OWNED
Replaces free-text subject strings scattered across six frontend types.

| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `name` | text | NO | — |
| `code` | text | YES | — |
| `is_active` | boolean | NO | `true` |

**Unique** `(school_id, name)`; **`UNIQUE (school_id, id)`** · **FK** `school_id → schools(id) ON DELETE CASCADE` · **Index** `(school_id, is_active)`.

### 15. `teachers` — SCHOOL-OWNED
Employment record. **Exists before an account does** — this is why `user_id` is nullable and lives on `memberships`, not here.

| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `full_name` | text | NO | — |
| `email` | citext | YES | — |
| `phone` | text | YES | — |
| `staff_no` | text | YES | — |
| `primary_subject_id` | uuid | YES | — |
| `status` | text | NO | `'active'` (`active`/`inactive`) |
| `joined_date` | date | NO | `CURRENT_DATE` |

**Unique** `(school_id, email) WHERE email IS NOT NULL`; `(school_id, staff_no) WHERE staff_no IS NOT NULL`; **`UNIQUE (school_id, id)`**.
**FKs** `school_id → schools(id) ON DELETE CASCADE`; `(school_id, primary_subject_id) → subjects(school_id, id) ON DELETE SET NULL` — losing a subject must not delete staff.
**Indexes** `(school_id, status)`, `(school_id)`.

### 16. `guardians` — SCHOOL-OWNED
Named `guardians`, not `parents` — many are grandparents, aunts, or legal guardians. Renaming now is free; renaming after launch is not.

| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `full_name` | text | NO | — |
| `email` | citext | YES | — |
| `phone` | text | NO | — |
| `status` | text | NO | `'active'` |

**Unique** `(school_id, email) WHERE email IS NOT NULL`; **`UNIQUE (school_id, id)`** · **FK** `school_id → schools(id) ON DELETE CASCADE` · **Index** `(school_id)`.

> **Implementation note:** the design defines **no vocabulary** for `guardians.status`, unlike
> `teachers.status`. It is therefore plain text with **no CHECK**.

### 17. `students` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `full_name` | text | NO | — |
| `admission_no` | text | NO | — |
| `gender` | text | YES | — |
| `date_of_birth` | date | YES | — |
| `status` | text | NO | `'active'` (`active`/`inactive`/`graduated`/`transferred`) |
| `enrolled_date` | date | NO | `CURRENT_DATE` |
| `photo_path` | text | YES | — |

**Unique** `(school_id, admission_no)` — per-school; two schools may both issue `001`. **`UNIQUE (school_id, id)`**.
**Check** `gender IN ('male','female','other')`; `date_of_birth < CURRENT_DATE`.
**FK** `school_id → schools(id) ON DELETE CASCADE` · **Indexes** `(school_id, status)`, `(school_id, admission_no)`, `(school_id)`.

**No `class_id` column** — class membership is time-scoped and lives in `class_enrollments`. This is the largest divergence from the frontend.

### 18. `student_guardians` — SCHOOL-OWNED (join)
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `student_id` / `guardian_id` | uuid | NO | — |
| `relationship` | text | YES | — |
| `is_primary` | boolean | NO | `false` |
| `can_pickup` | boolean | NO | `true` |

**PK** `id` · **Unique** `(school_id, student_id, guardian_id)`; **partial unique** `(school_id, student_id) WHERE is_primary` — one primary contact per student.
**FKs** `(school_id, student_id) → students(school_id, id) ON DELETE CASCADE`; `(school_id, guardian_id) → guardians(school_id, id) ON DELETE CASCADE` — both composite.
**Indexes** `(school_id, guardian_id)` — drives the entire parent portal; `(school_id, student_id)`.

Replaces the frontend's one-parent-per-student (`Student.parentId`) with the many-to-many reality of two parents, separated households, and siblings.

### 19. `classes` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `academic_year_id` | uuid | NO | — |
| `name` / `grade` / `section` | text | NO / NO / YES | — |
| `class_teacher_id` | uuid | YES | — |
| `capacity` | integer | YES | — |
| `room` | text | YES | — |

**Unique** `(school_id, academic_year_id, name)`; **`UNIQUE (school_id, id)`**.
**FKs** `(school_id, academic_year_id) → academic_years(school_id, id) ON DELETE CASCADE`; `(school_id, class_teacher_id) → teachers(school_id, id) ON DELETE RESTRICT` — **RESTRICT deliberately**: removing a teacher who still owns a class must fail loudly and force reassignment, rather than silently orphaning a class mid-term.
**Check** `capacity > 0` · **Indexes** `(school_id, academic_year_id)`, `(school_id)`.

### 20. `class_subjects` — SCHOOL-OWNED (join)
Replaces `SchoolClass.subject: string[]`.

| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` / `class_id` / `subject_id` | uuid | NO | — |
| `teacher_id` | uuid | YES | — |

**Unique** `(school_id, class_id, subject_id)` · **FKs** all composite, `ON DELETE CASCADE`, except `teacher_id … ON DELETE SET NULL`.

### 21. `class_enrollments` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` / `class_id` / `student_id` | uuid | NO | — |
| `academic_year_id` | uuid | NO | — |
| `enrolled_on` | date | NO | `CURRENT_DATE` |
| `left_on` | date | YES | — |

**Partial unique** `(school_id, student_id, academic_year_id) WHERE left_on IS NULL` — a student sits in **one active class per year**, enforced structurally.
**FKs** composite to `classes`, `students`, `academic_years`, all `ON DELETE CASCADE`.
**Indexes** `(school_id, class_id) WHERE left_on IS NULL` — the class roster query; `(school_id, student_id)`.

### 22. `timetable_slots` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` / `class_id` | uuid | NO | — |
| `teacher_id` / `subject_id` | uuid | YES | — |
| `day_of_week` | smallint | NO | — (ISO 1=Mon … 7=Sun) |
| `period` | smallint | NO | — |
| `start_time` / `end_time` | time | NO | — |
| `room` | text | YES | — |

**Unique** `(school_id, class_id, day_of_week, period)`; **partial unique** `(school_id, teacher_id, day_of_week, period) WHERE teacher_id IS NOT NULL` — **prevents double-booking a teacher**, which the frontend cannot currently detect.
**Check** `day_of_week BETWEEN 1 AND 7`; `end_time > start_time`.
**Note:** storing ISO 1–7 rather than the frontend's `'Monday'|…|'Friday'` string union is what allows Friday–Saturday weekends to work at all.

### 23. `attendance_records` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` / `student_id` / `class_id` | uuid | NO | — |
| `date` | date | NO | — |
| `status` | `attendance_status` | NO | — (`present`/`absent`/`late`/`excused`) |
| `note` | text | YES | — |
| `marked_by` | uuid | YES | — |
| `marked_at` | timestamptz | NO | `now()` |

**Unique** `(school_id, student_id, date)` — **one record per student per day**. See §J for the per-period caveat.
**FKs** composite to `students`/`classes` `ON DELETE CASCADE`; `marked_by → profiles(id) ON DELETE SET NULL` — who marked it must survive staff turnover.
**Indexes** `(school_id, class_id, date)` — the marker screen; `(school_id, student_id, date DESC)` — the parent view; `(school_id, date)`.

Highest-volume table: ~200 students × 200 school days ≈ 40k rows/school/year. Indexing here matters more than anywhere else.

### 24. `grade_records` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` / `student_id` / `class_id` / `subject_id` / `term_id` | uuid | NO | — |
| `assessment` | text | NO | — |
| `score` | numeric(6,2) | NO | — |
| `max_score` | numeric(6,2) | NO | `100` |
| `comment` | text | YES | — |
| `recorded_by` | uuid | YES | — |
| `recorded_at` | timestamptz | NO | `now()` |

**Unique** `(school_id, student_id, subject_id, term_id, assessment)` — re-entering a score updates rather than duplicates.
**Check** `score >= 0 AND score <= max_score`; `max_score > 0`.
**Indexes** `(school_id, student_id, term_id)`, `(school_id, class_id, subject_id, term_id)`.

**No `grade` letter column** — derived. See §F.

### 25. `homework` / 26. `homework_submissions` — SCHOOL-OWNED
`homework`: `school_id`, `class_id`, `subject_id`, `title`, `description`, `assigned_date date`, `due_date date`, `created_by`, plus `UNIQUE (school_id, id)`. Check `due_date >= assigned_date`. FK `created_by → profiles ON DELETE SET NULL`.

`homework_submissions`: `school_id`, `homework_id`, `student_id`, `status` (`pending`/`submitted`/`late`/`graded`), `submitted_at timestamptz NULL`, `grade text NULL`, `feedback text NULL`.
**Unique** `(school_id, homework_id, student_id)` · FKs composite, `ON DELETE CASCADE`.
Promotes the frontend's embedded `HomeworkSubmission[]` array into rows — necessary for per-student RLS, since a parent must see their child's submission and not the other 29.

### 27. `exams` — SCHOOL-OWNED
`school_id`, `class_id`, `subject_id`, `term_id`, `name`, `exam_date date`, `start_time time`, `duration_minutes integer`, `max_score numeric(6,2)`, `status` (`scheduled`/`completed`/`cancelled`), `room`.
**Unique** `(school_id, class_id, subject_id, term_id, name)` · **Check** `duration_minutes > 0`, `max_score > 0` · **Index** `(school_id, exam_date)`.

### 28. `fee_records` — SCHOOL-OWNED
| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` / `student_id` / `term_id` | uuid | NO | — |
| `category` | text | NO | — |
| `amount` | numeric(12,2) | NO | — |
| `amount_paid` | numeric(12,2) | NO | `0` |
| `currency` | char(3) | NO | `'USD'` |
| `due_date` | date | NO | — |

**Unique** `(school_id, student_id, term_id, category)` · **Check** `amount > 0`, `amount_paid >= 0`, `amount_paid <= amount`.
**FK** `(school_id, student_id) → students(school_id, id) ON DELETE CASCADE`.
**Indexes** `(school_id, student_id)`, `(school_id, due_date)`.

`amount_paid` is **trigger-maintained** from `fee_payments`, never written by the application. `status` is **not stored** — see §F.

### 29. `fee_payments` — SCHOOL-OWNED
`school_id`, `fee_record_id`, `amount numeric(12,2)`, `currency`, `method` (`card`/`bank_transfer`/`cash`/`mobile_money`/`evc_plus`/`edahab`), `reference text`, `paid_on date`, `recorded_by`, `external_ref text NULL`.
**Unique** `(school_id, reference)` — prevents double-recording the same transaction.
**Check** `amount > 0`.
**FK** `(school_id, fee_record_id) → fee_records(school_id, id)` **ON DELETE RESTRICT** — **the one place the cascade pattern is deliberately broken.** A fee record with payments against it must not be deletable; money movement is never collateral damage. Removing a fee requires voiding its payments first, explicitly and auditably.

### 30. `announcements` — SCHOOL-OWNED
> **NOT YET IMPLEMENTED — required by Migration 11.**

`school_id`, `title`, `body`, `audience` (`all`/`teachers`/`parents`/`students`/`class`), `class_id NULL`, `priority` (`normal`/`important`/`urgent`), `created_by`, `published_at timestamptz`, `pinned boolean DEFAULT false`.
**Check** `audience='class'` ⇒ `class_id IS NOT NULL`, and `audience<>'class'` ⇒ `class_id IS NULL` — the mismatched pair is unrepresentable.
**Index** `(school_id, published_at DESC)`, `(school_id, pinned) WHERE pinned`.

### 31. `notifications` — SCHOOL-OWNED
> **NOT YET IMPLEMENTED — required by Migration 11.**

| Column | Type | Null | Default |
|---|---|---|---|
| `school_id` | uuid | NO | — |
| `user_id` | uuid | NO | — |
| `title` / `body` | text | NO | — |
| `type` | text | NO | — |
| `link` | text | YES | — |
| `read_at` | timestamptz | YES | — |
| `entity_type` / `entity_id` | text / uuid | YES | — |

**FKs** `user_id → profiles(id) ON DELETE CASCADE`; `school_id → schools(id) ON DELETE CASCADE`.
⚠ **Amended by §13 row 77:** the user reference is **composite** — `(user_id, school_id) → profiles (id, school_id)`, because it is **access-granting**.
**Index** `(user_id, school_id, created_at DESC)`; partial `(user_id) WHERE read_at IS NULL` for the unread badge.

**This is where `scopeKey()` dies.** The frontend stores `userId: 'parent:p3'` — a synthetic string. Here it becomes a real FK. Broadcasts fan out to rows per recipient rather than being addressed to `'admin:all'`.

### 32. `message_threads` / 33. `message_thread_participants` / 34. `messages` — SCHOOL-OWNED
> **NOT YET IMPLEMENTED — required by Migration 11.**

`message_threads`: `school_id`, `subject`, `student_id NULL` (the child under discussion), `created_by`, `last_message_at timestamptz`. Index `(school_id, last_message_at DESC)`.

`message_thread_participants`: `school_id`, `thread_id`, `user_id`, `last_read_at timestamptz NULL`. **Unique** `(school_id, thread_id, user_id)`. Index `(user_id, school_id)` — this is the RLS predicate for "threads I can see".
⚠ **Amended by §13 row 78:** the user reference is **composite** — `(user_id, school_id) → profiles (id, school_id)`, because it is **access-granting**.

`messages`: `school_id`, `thread_id`, `sender_id`, `body text`, `sent_at timestamptz`. FK `thread_id … ON DELETE CASCADE`; `sender_id → profiles ON DELETE SET NULL` (message survives, attributed to a deleted user). Index `(school_id, thread_id, sent_at)`.

**`participant_names` is not stored** — derived by join. See §F.

---

# §D. ENTITY RELATIONSHIP SUMMARY

```
PLATFORM
  subscription_plans 1 ──< school_subscriptions >── 1 schools
  reserved_shortcodes (standalone guard)
  school_applications 0..1 ──> 1 schools        (approved_school_id)
  contact_messages (standalone)
  platform_admins >── 1 profiles

IDENTITY
  auth.users 1 ──1 profiles 1 ──< memberships >── 1 schools
  memberships 0..1 ──> teachers | guardians
  invitations >── 1 schools

SCHOOL (all rows carry school_id)
  schools 1 ──< academic_years 1 ──< terms
  schools 1 ──< subjects, teachers, guardians, students, classes

  students   M ──< student_guardians >── M guardians      (many-to-many)
  students   M ──< class_enrollments >── M classes        (time-scoped, per year)
  classes    M ──< class_subjects    >── M subjects
  classes    1 ──< timetable_slots   >── 0..1 teachers

  students 1 ──< attendance_records  (1 per student per day)
  students 1 ──< grade_records       >── 1 subjects, 1 terms
  classes  1 ──< homework 1 ──< homework_submissions >── 1 students
  classes  1 ──< exams
  students 1 ──< fee_records 1 ──< fee_payments

  schools  1 ──< announcements, notifications
  schools  1 ──< message_threads 1 ──< messages
  message_threads M ──< message_thread_participants >── M profiles

  audit_logs 0..1 ──> schools (NULL = platform action)
```

**Cardinality changes from the frontend:** student↔guardian becomes M:M (was 1:M); student↔class becomes M:M-over-time (was 1:1); homework submissions become rows (were an embedded array).

> ⚠ **Amendment note.** The IDENTITY block reads `profiles 1 ──< memberships >── 1 schools`. Under
> Amendment §2 a `profiles` row belongs to exactly **one** school, so the many-side of `memberships`
> is now **many roles at one school**, not many schools. `profiles` also gained `school_id`, which
> this diagram predates. §13 is authoritative over this diagram wherever they differ.

---

# §E. FRONTEND FIELD MAPPING

> Cited correctly here. Several Phase 3 prompts used "§E" to mean the `audit_logs` design; that is §H.

## Maps cleanly — direct, no transformation

`Teacher` (name, email, phone, status, joinedDate) · `Parent` → `guardians` (name, email, phone) · `Student` (name, admissionNo, gender, dateOfBirth, status, enrolledDate) · `SchoolClass` (name, grade, section, capacity, room) · `AttendanceRecord` (date, status, note) · `GradeRecord` (score, maxScore, assessment, comment) · `Homework` (title, description, assignedDate, dueDate) · `Exam` (name, date, startTime, duration, maxScore, status, room) · `FeeRecord` (category, amount, dueDate) · `FeePayment` (amount, date, method, reference) · `Announcement` (title, body, audience, priority, pinned) · `ChatMessage` (body, date) · most of `SchoolSettings`.

## Does **not** map cleanly — requires transformation

| Frontend | Problem | Resolution |
|---|---|---|
| `Student.parentId: string` | Single guardian | → `student_guardians` M:M |
| `Parent.studentIds: string[]` | Array FK | → `student_guardians` rows |
| `Student.classId: string` | No year dimension; loses history | → `class_enrollments` |
| `SchoolClass.studentIds: string[]` | Array FK | → `class_enrollments` |
| `SchoolClass.subject: string[]` | Free-text array | → `class_subjects` + `subjects` |
| `Teacher.classIds: string[]` | Array FK | → `class_subjects` / `classes.class_teacher_id` |
| `*.subject: string` (6 types) | Free text; typos fragment reports | → `subject_id` FK |
| `*.term: string` (`'Term 1'`) | Free text | → `term_id` FK |
| `Homework.submissions[]` | Embedded array | → `homework_submissions` rows (required for per-student RLS) |
| `TimetableSlot.day: 'Monday'…'Friday'` | English string union; Mon–Fri only | → `day_of_week smallint` 1–7 |
| `MessageThread.participantIds/Names[]` | Parallel arrays | → `message_thread_participants` |
| `NotificationItem.userId: 'parent:p3'` | Synthetic composite string | → real `user_id` uuid FK |
| `AuthUser.{schoolId,teacherId,parentId}` | Flattened onto the user | → `memberships` |
| `SchoolSettings.logoDataUrl` | base64 in state | → `logo_path` + Supabase Storage |
| `Homework.attachments: number` | A count, not the files | → attachments table + Storage (Phase 10) |
| `AcademicYear.terms[]` | Nested array | → `terms` rows |

> ⚠ **Two rows added by Amendment §18**, which lists them as additive to this section:
>
> | Frontend | Problem | Resolution |
> |---|---|---|
> | `SchoolSettings.academicYearId` | Was a stored pointer on `schools` | → **derived lookup**: the `academic_years` row for this school with `status='active'` (§14) |
> | `AuthUser.schoolId` | Hardcoded constant | → resolves from `profiles.school_id` (§2). `StoredUser.password` has **no destination by design** (§7) |

---

# §F. FRONTEND DATA THAT SHOULD **NOT** BE PERSISTED

| Item | Why not | Instead |
|---|---|---|
| `StoredUser.password` (plaintext, localStorage) | Credentials never enter our tables | Supabase Auth |
| `DEMO_CREDENTIALS` / `demo1234` / `demo-admin` | Demo fixtures; a live tenant must never contain them | Dev seed only, env-guarded |
| `logoDataUrl` base64 | Bloats every row; a ~1 MB logo joins every settings read, blows past TOAST thresholds, and is uncacheable by CDN | Storage object + path |
| `FeeRecord.status` | Derived from `amount`/`amount_paid`/`due_date`; **stored copies drift and produce wrong money** | View / computed at read (`overdue` depends on today, so it cannot be a generated column) |
| `FeeRecord.amountPaid` as app-written | Same drift risk | Trigger-maintained from `fee_payments` |
| `GradeRecord.grade` (letter) | Derived from score ÷ max_score under the school's scale; storing it means a scale change silently invalidates history | Compute at read; snapshot only onto issued report cards |
| `MessageThread.participantNames[]` | Denormalised names go stale on rename | Join `profiles` |
| `SchoolSettings.logoInitial` | Derivable from `name` | Compute |
| `avatarColor` | Pure presentation | Derive deterministically from `id` hash — **recommended**; storing it is defensible for stability, but it is 34 bytes of design system in every people row |
| `schoolDays` | A computed function, not data | `weekend_days` + calendar util |
| `nomcloud_school_data_v2` blob | Entire client-side DB | Deleted at Phase 8 |

---

# §G. ROADMAP REQUIREMENTS THE FRONTEND LACKS ENTIRELY

| Need | Roadmap | Schema impact |
|---|---|---|
| Tenant isolation | 6, 7 | `memberships`, `school_id` everywhere, composite FKs |
| Approval workflow | 20 | `school_applications`, `schools.status` |
| Invitations | 4, 5 | `invitations` — the frontend *promises* this in UI copy but has no mechanism |
| MFA | security | Supabase `auth.mfa_factors` — not modelled by us |
| Audit logging | security | `audit_logs` (§H) |
| Subscriptions / billing | 11 | `subscription_plans`, `school_subscriptions` |
| File storage | 10 | `logo_path`, `photo_path`, future `attachments` |
| Notifications delivery | 12 | Future `notification_deliveries`, `device_tokens` |
| Subjects as entities | — | `subjects` |
| Per-year class history | — | `class_enrollments` |
| Multi-guardian | — | `student_guardians` |
| Teacher double-booking prevention | — | partial unique on `timetable_slots` |
| Reserved subdomains | 1 | `reserved_shortcodes` |
| Consent / policy acceptance | 17 | **Deferred** — flagged in §J |
| Analytics / AI | 13, 14 | **Deferred** — no tables yet, by design |

---

# §H. `audit_logs` DESIGN

> **Cited as "§E" in several Phase 3 prompts. That is an error — §E is the frontend field mapping.
> This is the audit design.**
>
> **NOT YET IMPLEMENTED — required by Migration 11.**

**Classification: PLATFORM-level, optionally school-scoped.** `school_id` is **nullable** — NULL means a platform action (approving a school, granting platform admin) that belongs to no tenant. This is the one place the "every school-owned table carries NOT NULL school_id" rule is deliberately relaxed, because forcing a school onto a pre-tenant action would be a lie.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `school_id` | uuid | **YES** | — (NULL = platform action) |
| `actor_user_id` | uuid | YES | — (NULL = system/cron) |
| `actor_role` | text | YES | — (**snapshot**, not a FK) |
| `actor_email` | citext | YES | — (**snapshot**) |
| `action` | text | NO | — (`student.created`, `school.approved`) |
| `entity_type` | text | NO | — |
| `entity_id` | uuid | YES | — |
| `summary` | text | YES | — |
| `changes` | jsonb | YES | — (`{before, after}`, redacted) |
| `ip_address` | inet | YES | — |
| `user_agent` | text | YES | — |
| `request_id` | uuid | YES | — |
| `created_at` | timestamptz | NO | `now()` |

**No `updated_at`. Append-only** — `UPDATE` and `DELETE` revoked from all application roles, including `service_role`. An audit log that can be edited is not an audit log.

**FKs** `school_id → schools(id) ON DELETE SET NULL`; `actor_user_id → profiles(id) ON DELETE SET NULL` — **never CASCADE**. Deleting a user must not erase the record of what they did; that is precisely the scenario auditing exists for. This is why `actor_role` and `actor_email` are denormalised snapshots: the log must stay readable after the actor is gone.

**Indexes** `(school_id, created_at DESC)` — per-tenant log view; `(entity_type, entity_id, created_at DESC)` — record history; `(actor_user_id, created_at DESC)` — investigations; `(action, created_at DESC)`.

**Growth:** the fastest-growing table in the system. Design for monthly range partitioning on `created_at` from the start, even if partitioning is enabled later — retrofitting onto a large unpartitioned table means downtime.

**Redaction:** `changes` must never capture password hashes, tokens, or full payment instruments. Write-side redaction, not read-side filtering.

> **Column-naming warning.** The columns are **`actor_user_id`**, **`actor_role`** and
> **`actor_email`**. Some Phase 3 prompts referred to "`actor_id`" and "`actor_name`". Neither
> exists in this design. `actor_role` + `actor_email` are confirmed as the snapshot pair by §H,
> §10 and Amendment §15 independently.

---

# §I. MIGRATION FILE PLAN — 11 migrations

| # | Migration | Contents | Why here |
|---|---|---|---|
| 01 | `extensions_and_enums` | `pgcrypto`, `citext`; enums `user_role`, `school_status`, `application_status`, `attendance_status`; shared `set_updated_at()` | Everything depends on these |
| 02 | `platform_core` | `subscription_plans`, `reserved_shortcodes`, `contact_messages` | No FKs outward |
| 03 | `schools` | `schools`, `school_subscriptions` | Needs 02 (plans). The tenant root |
| 04 | `identity` | `profiles`, `platform_admins`, `memberships`, `invitations` | Needs `auth.users` + 03 |
| 05 | `school_applications` | applications table + `approved_school_id` FK | Needs 03 and 04 |
| 06 | `academic_structure` | `academic_years`, `terms`, `subjects` | ⚠ §14: no longer touches `schools` |
| 07 | `people` | `teachers`, `guardians`, `students`, `student_guardians` | Needs 06 |
| 08 | `classes_and_timetable` | `classes`, `class_subjects`, `class_enrollments`, `timetable_slots` | Needs 07 |
| 09 | `teaching_records` | `attendance_records`, `grade_records`, `homework`, `homework_submissions`, `exams` | Needs 08 |
| 10 | `finance` | `fee_records`, `fee_payments` + `amount_paid` trigger | Needs 07 and 06 |
| 11 | `communication_and_audit` | `announcements`, `notifications`, `message_threads`, `message_thread_participants`, `messages`, `audit_logs` | Needs everything above |

**Explicitly NOT in this plan: RLS policies.** They belong to **Phase 7** as their own migration series, applied after the schema is stable and verified.

⚠ **Amendment §14 changed 03 and 06:** 03 creates `schools` complete with no deferred column and no outbound FKs; 06 creates the academic tables only and **does not touch `schools`**. The word "deferrable" no longer appears anywhere in the design.

---

# §J. RISKS, AMBIGUITIES, ASSUMPTIONS

## Risks

1. **Composite FKs add real cost.** Every school-owned child needs `UNIQUE (school_id, id)` on its parent — ~15 extra unique indexes, more write amplification, more verbose DDL. **I judge this worth it**: it converts cross-tenant leakage from a policy-review problem into a structural impossibility. If you disagree, the fallback is single-column FKs plus a Phase 16 test suite proving isolation — weaker, but cheaper.

2. **Denormalised `school_id` can drift** if any write path forgets it. Mitigated by composite FKs and `NOT NULL`, but a BEFORE INSERT trigger deriving `school_id` from the parent would be belt-and-braces. I lean toward not adding it (triggers hide behaviour) — flagging for your call.

3. **`audit_logs` growth is unbounded.** Without partitioning and a retention policy it becomes the largest table within a year. Needs a decision before Phase 19.

4. **`attendance_records` volume** is the main scale risk: ~40k rows/school/year. At 100 schools that is 4M rows/year — fine for Postgres, but only with the composite indexes specified.

5. **The subdomain-as-authorisation trap.** `{shortcode}.class.so` makes it tempting to derive tenancy from the Host header. Anyone can send any Host header. RLS must read the verified JWT claim only. This is the single most likely security mistake in Phase 6/7.

## Ambiguities resolved in the design (flagged in case you disagree)

- **`parents` → `guardians`.** A naming change from the frontend, made now because renaming post-launch touches every layer.
- **One attendance row per student per day.** Matches the frontend. Per-period attendance would need `(student_id, date, period)` — a change that is cheap now and expensive after data exists.
  > This is the caveat §C table 23 refers to with "See §J for the per-period caveat."
- **No `deleted_at` anywhere.** Lifecycle `status` columns plus `audit_logs` cover it, and soft-delete would force every unique constraint to become partial and every RLS policy to carry an extra predicate.
- **`grade` letter and `fee status` not stored.** Both derived. The counter-argument — historical report cards must not change when a school edits its grading scale — is addressed by snapshotting at issuance rather than storing per row.

## Assumptions stated plainly

- Supabase Auth owns credentials and MFA; `auth.users` is not ours to model.
- One database, one `public` schema, shared by all tenants — per your constraint.
- Students do not receive logins (no `user_id` on `students`). If student portals are ever planned, say so now — it changes `memberships` and several policies.
- ⚠ ~~A person may hold roles at multiple schools; the active school comes from a verified JWT claim, not the subdomain.~~
  **VOID — SUPERSEDED BY AMENDMENT §2.** V1 is **one human, one school**. A person may hold multiple
  roles at the **same** school only. The second half of the sentence still stands: the active school
  comes from a verified JWT claim, never the subdomain.
- Currency is per school, single-currency. Multi-currency schools would need it per fee record.
- `/staff` in the URL scheme maps to role `teacher`. Worth confirming the vocabulary split is intentional — two names for one concept is a durable source of confusion.

## What could not be decided from the repository

Two items genuinely lack evidence, and both are Phase 17 compliance concerns rather than Phase 3 blockers:

1. **Data retention periods** — how long attendance, grades, and audit logs must be kept. This is a legal/regulatory question about Somali and future jurisdictions that the repo cannot answer. §10 specifies what the schema must *support* so durations can be configured later without schema change.
2. **Consent records** — the frontend has a cookie banner and legal pages, but nothing captures per-user acceptance of Terms/Privacy with a version and timestamp. If compliance requires provable consent, that is a `policy_acceptances` table. It is **not** included, because guessing at a compliance requirement is worse than naming the gap.

Both are restated as the two open non-blocking items in the Amendment §18 verdict.

---

# AMENDMENTS §1–§18 (all approved; these supersede the original)

## §1. Membership vs subscription — terminology

Two relationships that are frequently conflated. They share no table, no lifecycle, and no vocabulary.

| | MEMBERSHIP | SUBSCRIPTION |
|---|---|---|
| Connects | an authenticated **human** ↔ a **school** | a **school tenant** ↔ a Nom Cloud **plan** |
| Table | `memberships` | `school_subscriptions` |
| Carries | `role` (admin / teacher / parent) | billing status, period, plan |
| Answers | "what may this person do here?" | "is this school paying, and for what?" |
| Lifecycle | `active` / `suspended` | `trialing` / `active` / `past_due` / `cancelled` / `expired` |
| Governs | authorisation, RLS | feature limits, invoicing |

**Worked example — membership.** Fadumo Ahmed teaches Mathematics at Imam School and her son also attends. Her single `profiles` row has `school_id = <Imam School>`. She holds **two memberships**, both at Imam School: one `role='teacher'` linked to her `teachers` row, one `role='parent'` linked to her `guardians` row. She signs in once and switches between the `/staff` and `/parent` areas. She has no subscription — people do not have subscriptions.

**Worked example — subscription.** Imam School was approved on 12 March, received the shortcode `imam`, and reached `class.so` at `imam.class.so`. Its tenant status became `active` immediately. Six weeks later it agreed commercial terms and a `school_subscriptions` row was created against the Standard plan. The school has **one subscription**; its 340 users have **340+ memberships** between them. The school does not have a membership, and Fadumo does not have a subscription.

**Prohibited phrasing:** "the school's membership", "the user's subscription", "membership plan", "subscribed users". These appear nowhere in this design and must not appear in code, comments, or UI copy.

## §2. Identity model — re-derived for one-school tenancy
**Replaces §A.3, §B rows 7–8, and §C tables 7–8.**

**The premise that changed:** the original omitted `school_id` from `profiles` on the grounds that "one human may hold roles at several schools." **That premise is void.** V1 is one human, one school.

```
profiles.school_id  uuid NULL
UNIQUE (id, school_id) on profiles
memberships (user_id, school_id) → profiles (id, school_id)   composite FK
```

**It works, and the enforcement is total.** `memberships.user_id` and `memberships.school_id` are both `NOT NULL`, so the composite FK is *always* checked (no MATCH SIMPLE null-skip escape). A membership row can therefore only exist where `(user_id, school_id)` matches an actual `profiles` row's `(id, school_id)`. Since `id` is the primary key, exactly one `profiles` row can match — the user's own — so `memberships.school_id` **cannot** be any value other than that user's assigned school. Cross-school membership is not "prevented"; it is **unrepresentable**.

**It handles platform operators for free.** If `profiles.school_id IS NULL`, no `(id, school_id)` pair with a non-null school exists for that user, so *no membership can be created at all*.

**Cost:** one redundant unique index. `UNIQUE (id, school_id)` is logically implied by `PRIMARY KEY (id)`, but Postgres requires an explicit unique constraint on the exact referenced column list for a composite FK.

**`ON UPDATE NO ACTION`** on that composite FK, stated explicitly rather than left implicit. Changing `profiles.school_id` while memberships exist fails. `ON UPDATE CASCADE` would have silently dragged a teacher's memberships into a different school — a catastrophic and near-invisible failure.

### Amended table 7 — `profiles` (IDENTITY)

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | — (mirrors `auth.users.id`) |
| **`school_id`** | **uuid** | **YES** | — |
| `full_name` | text | NO | — |
| `email` | citext | NO | — |
| `phone` | text | YES | — |
| `locale` | text | NO | `'en'` |
| `avatar_url` | text | YES | — |
| `last_seen_at` | timestamptz | YES | — |

**PK** `id` · **Unique** `(email)`, **`(id, school_id)`** ← composite-FK target
**FKs** `id → auth.users(id) ON DELETE CASCADE`; **`school_id → schools(id) ON DELETE RESTRICT`**
**Indexes** `(school_id)` — every tenant user list and RLS resolution path; `(email)`

**`school_id IS NULL` means: no school assignment yet.** It does **not** mean platform operator. Platform-operator status is determined **solely** by an unrevoked `platform_admins` row.

### Amended table 8 — `memberships` (IDENTITY)

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` | uuid | NO | — |
| `school_id` | uuid | NO | — |
| `role` | `user_role` | NO | — |
| `status` | text | NO | `'active'` |
| `teacher_id` | uuid | YES | — |
| `guardian_id` | uuid | YES | — |
| `invited_by` | uuid | YES | — |
| `joined_at` | timestamptz | NO | `now()` |

**Positive role/identity CHECK (per §16), replacing the prohibitive version:**
```
(role='teacher' AND teacher_id IS NOT NULL AND guardian_id IS NULL)
OR (role='parent'  AND guardian_id IS NOT NULL AND teacher_id IS NULL)
OR (role='admin'   AND teacher_id IS NULL AND guardian_id IS NULL)
```

**`UNIQUE (user_id, school_id, role)` is replaced by `UNIQUE (user_id, role)`.** Under the one-school rule, `school_id` is functionally dependent on `user_id`, so including it adds nothing. This still permits Fadumo's teacher **and** parent memberships.

**Indexes on `memberships`:** `(user_id)` — the hot path for every authorisation check; `(school_id, role)` — school member lists; `(school_id, status)`.

## §3. Single source of truth for a user's school

**Authoritative: `profiles.school_id`.** One column, one row per human, one answer.

**`memberships.school_id` is not a second source of truth.** It is a *declaratively constrained projection* of `profiles.school_id`, pinned by the composite FK. It cannot hold a different value — not through application error, not through a bad migration, not through direct SQL. Divergence is not detected and corrected; it is impossible.

**Why keep the column at all:** (1) RLS performance — policies must filter on `school_id` without a join; (2) composite-FK target for `teacher_id`/`guardian_id`; (3) uniform tenancy — an exception here would be the one place a policy author must think differently.

**Prevented from diverging by:** the composite FK (insert/update), and `ON UPDATE NO ACTION` (blocking a school change on `profiles` that would strand existing memberships). No trigger, no reconciliation job.

## §4. Platform operators under the one-school rule

| Question | Answer |
|---|---|
| **What `school_id` does a platform operator carry?** | `profiles.school_id = NULL` |
| **How are they excluded from tenant-scoped constraints?** | Structurally. With `school_id IS NULL`, the composite FK admits no membership row, so they hold zero memberships, receive no `school_id` JWT claim, and match no tenant RLS policy. |
| **How is their authority established?** | An unrevoked `platform_admins` row — the sole determinant. Phase 7 platform policies test `platform_admins` membership, never `school_id IS NULL`. |

**May a platform operator also hold a school account? Decision: not on the same account. Structurally permitted, prohibited by operating policy, and detectable by audit.**

A denormalised `profiles.is_platform_operator` column was **rejected**, because it creates exactly the second source of truth for platform-operator status that item 4 forbids. A cross-table trigger is worse.

- A staff member who also needs a school account uses **a second email address and a separate account**.
- Granting `platform_admins` is a rare, manual, audited action.
- **Standing audit control:** any `profiles` row with a non-null `school_id` whose `id` appears in `platform_admins` with `revoked_at IS NULL` is a finding, surfaced in Phase 15 monitoring. Zero expected occurrences.

**This is the one place in the design where a rule is enforced by process rather than by the database.** A deliberate trade, made to preserve the single-source-of-truth requirement.

## §5. V2 reversibility — multi-school users

**Nothing in V1 makes multi-school users impossible later. The path is constraint relaxation only — no data rewrite, no destructive change, no backfill.**

| Step | Change | Destructive? |
|---|---|---|
| 1 | Drop composite FK `memberships(user_id, school_id) → profiles(id, school_id)` | No |
| 2 | Add plain FK `memberships.user_id → profiles(id) ON DELETE CASCADE` | No |
| 3 | Change `UNIQUE (user_id, role)` → `UNIQUE (user_id, school_id, role)` | No — every existing row already satisfies the wider key |
| 4 | Repoint `notifications` and `message_thread_participants` user FKs from composite to single-column | No |
| 5 | Either drop `profiles.school_id`, or **keep it, redefined as "home school"** — recommended | No |
| 6 | Drop `UNIQUE (id, school_id)` on `profiles` (or retain harmlessly) | No |

**Unchanged by V2:** every school-owned table, every composite `(school_id, id)` FK, every RLS policy, and the audit design.

**Application-side change:** login gains a school picker when membership count exceeds one; the JWT school claim becomes settable per session. A UI and session-function change, not a schema one.

## §6. Product rationale — single-school user tenancy

> **Nom Cloud V1 uses single-school user tenancy.** One authenticated account belongs to exactly one school. This matches the current business model and materially simplifies the system: tenant isolation becomes a declarative constraint rather than a policy to be reviewed; login resolves to one school with no picker; RLS policies reduce to a single `school_id` predicate; and there is no cross-school authorisation surface to reason about or attack.
>
> Multi-school users will be introduced **only if a real business requirement emerges**, not on speculation.

**Practical consequence:** Supabase Auth enforces globally unique email addresses. One email maps to one account, and — under V1 — one account maps to one school. **A person who needs access at two schools requires two email addresses in V1.** This is a known and accepted V1 limitation, not a defect. It does not affect holding multiple roles at the *same* school.

## §7–8. Authentication and URL boundary (restated, unchanged)

**Authentication chain:** `auth.users` → `profiles` → `memberships` → `school_id` + `role` → authorisation → RLS.

Supabase Auth is the sole source of truth for credentials and MFA factors. **No `password`, `password_hash`, `salt`, or equivalent column exists anywhere in the application schema, and none may be added.**

**`{shortcode}.class.so` is routing and branding only.** It is **never** the authorisation boundary. A Host header is client-controlled and trivially forged; RLS must read only the verified JWT claim. This remains the single most likely security mistake in Phases 6–7.

## §9. Three lifecycles — amended subscription initial state

| Lifecycle | Table | States |
|---|---|---|
| **Application** | `school_applications.status` | `pending` → `approved` / `rejected` / `withdrawn` |
| **Tenant** | `schools.status` | `active` / `suspended` / `closed` |
| **Commercial** | `school_subscriptions.status` | `trialing` / `active` / `past_due` / `cancelled` / `expired` |

**`DEFAULT 'trialing'` is wrong and is removed.** It asserts a **commercial fact** — that a trial has begun — as a side effect of tenant creation, and presumes a `school_subscriptions` row exists at approval.

- **No `school_subscriptions` row is created at approval.** The absence of a row is the correct representation of "approved tenant, no commercial relationship yet."
- **`status` has no DEFAULT.** A column whose value asserts a commercial fact should never be filled in by omission.
- **`schools.status = 'active'` must never be read as "paying".** Phase 11 billing must treat *no row* as a first-class state, not an error.

## §10. Data lifecycle classification

Categories: **OP** operational · **AR** archival · **FIN** financial-retention · **AUD** audit-retention · **DEL** deletion/anonymisation candidate.

**No legal durations are invented.** Each row states only what the *schema* must provide so durations can be configured later.

| Table | Category | What the schema must support |
|---|---|---|
| `students` | OP → AR, **DEL** | PII columns isolated and nullable-in-principle (`full_name`, `date_of_birth`, `photo_path`) so a student can be anonymised while `id`, `admission_no`, and aggregate history survive. `status='graduated'` marks the archival transition without deleting rows. |
| `guardians` | OP → AR, **DEL** | Same anonymisation shape. Must be anonymisable **independently of the student** — a guardian may exercise erasure while the child's record persists. |
| `teachers` | OP → AR, **DEL** | May carry longer retention than student data. `status='inactive'` is the archival marker. Anonymisation must not break `classes.class_teacher_id` (RESTRICT already forces reassignment first). |
| `attendance_records` | OP → AR | Highest volume. `date` + `school_id` present, so range-based archival or partitioning is available without schema change. No PII of its own. |
| `grade_records` | OP → AR | Likely the **longest** academic retention (transcripts). `term_id` gives a stable period anchor. |
| `homework` / `homework_submissions` | OP, **DEL** | Lowest long-term academic value. `assigned_date` supports age-based purging. `feedback` is free text and potentially PII-bearing. |
| `exams` | OP → AR | Schedule metadata; no PII. Retained with grades for context. |
| `fee_records` | **FIN** | Retained on a financial clock, independent of student anonymisation — a fee record must remain provable after a student is erased. Anonymisation nulls student PII but **must not** delete fee rows. |
| `fee_payments` | **FIN** | Strictest retention. Already `ON DELETE RESTRICT` from `fee_records`. **Never a deletion candidate while inside the financial window.** |
| `school_applications` | AR, **DEL** | Applicant PII for people who may never become customers. Rejected/withdrawn are strong deletion candidates. `approved_school_id` must survive as `NULL` if purged. |
| `messages` / `message_threads` | OP, **DEL** | Free-text personal communication — the highest-sensitivity content in the system. `sender_id` already `ON DELETE SET NULL`. |
| `contact_messages` | **DEL** | Marketing enquiries from non-customers. Shortest justifiable retention. |
| `notifications` | OP, **DEL** | Ephemeral by nature. Aggressive age-based purging with no downstream impact — nothing references them. |
| `audit_logs` | **AUD** | Append-only, deletion-resistant by design. Must outlive the records it describes, which is why actor identity is **snapshotted** (`actor_role`, `actor_email`) rather than only referenced. Retention applied by **dropping whole time partitions**, never row deletes. |

**Cross-cutting requirements — all already satisfied:** `created_at timestamptz` on every table; `school_id` on every school-owned table; status lifecycles rather than `deleted_at`; PII concentrated in named columns rather than scattered through jsonb; financial and audit tables structurally protected from cascade deletion.

**Deliberately not specified:** any duration. Those are legal determinations for Somalia and future jurisdictions.

## §11. Payment events — deferred (verbatim)

> **"payment_events (provider event id, event type, received_at, verification status, processed_at, idempotency guard) is DEFERRED from Phase 3 and REQUIRED before production payment integration in Phase 11."**

**Nothing in the current schema prevents adding it later.** Purely additive:

- New table, no changes to existing ones. `fee_payments.external_ref` already exists as the join point and is unconstrained in form.
- `fee_payments` has no unique constraint that would conflict with a later idempotency key.
- It is school-owned and would carry `school_id` plus a composite FK to **`fee_payments(school_id, id)`** — which means Phase 11 must first add `UNIQUE (school_id, id)` to `fee_payments`.
- No existing FK, unique constraint, or check would need to be dropped or altered.

**Not created now.**

## §12. `schools` reclassified — TENANT ROOT

Reclassified from "SCHOOL-OWNED (root)" to **TENANT ROOT**. The classification set is now:

**PLATFORM-LEVEL · TENANT ROOT · SCHOOL-OWNED · IDENTITY**

A `schools` row **establishes** a tenant; it is not owned by one. `schools` has **no** `school_id` column and — after §14 — **no outbound FKs at all**.

## §13. Complete foreign key audit — see the dedicated section below

## §14. `schools.active_academic_year_id` — REMOVED

**Column deleted entirely.** The active year derives from `academic_years WHERE school_id = X AND status = 'active'`, already guaranteed at most one per school by the partial unique index `(school_id) WHERE status='active'`.

**This eliminates the only circular dependency in the design.** `schools` ↔ `academic_years` was the sole cycle. `schools` now has zero outbound foreign keys, making it a true root in both the tenancy and the dependency sense.

| | Before | After |
|---|---|---|
| **03 `schools`** | Created `schools` *without* the column, deferring the FK | Creates `schools` complete. **No outbound FKs.** |
| **06 `academic_structure`** | Created the academic tables **and** added the FK back onto `schools` | Creates the academic tables only. **Does not touch `schools`.** |

**Also amended — frontend mapping:** `SchoolSettings.academicYearId` no longer maps to a `schools` column. It maps to *"the `academic_years` row for this school with `status='active'`"* — a derived lookup, not a stored pointer.

## §15. `platform_admins.user_id` — CASCADE retained, documented

`platform_admins.user_id → profiles(id) ON DELETE CASCADE` is **kept**.

`revoked_at` is the **normal** mechanism for removing platform access — it preserves grant history and records when authority ended. Hard deletion of a `profiles` row is **exceptional**, and cascading the grant away is then correct: a grant to a non-existent principal is meaningless.

**No audit history is lost by this cascade.** `audit_logs` preserves every platform action independently, via the snapshotted `actor_role` and `actor_email` columns and `actor_user_id → profiles(id) ON DELETE SET NULL`.

## §16. Memberships — positive enforcement, contradiction resolved

**The contradiction:** the positive CHECK requires `role='teacher' ⇒ teacher_id IS NOT NULL`. `ON DELETE SET NULL` would attempt to null that column on teacher deletion, violating the CHECK and failing the delete with a confusing error naming the wrong problem.

**Resolution: `ON DELETE CASCADE`** on both `memberships.teacher_id` and `memberships.guardian_id` (as composite FKs).

- Deleting a `teachers` row **ends that teacher membership**. The membership had no meaning without the employment record it describes.
- The person's `profiles` row **survives**.
- **Any other role membership at the same school survives.**
- **`status='inactive'` on the `teachers`/`guardians` row is the normal path.**
- **Hard deletion is exceptional and audited.**

## §17. Invitations — FK consistency resolved

| FK | Original | Contradiction? | **Decision** |
|---|---|---|---|
| `invited_by → profiles(id)` | `NOT NULL` + `SET NULL` | **YES** — nulling a NOT NULL column is impossible | **`NOT NULL` + `ON DELETE CASCADE`** — an invitation is a **bearer credential**; when the issuer is removed, outstanding invitations should die with them rather than remain redeemable with no accountable issuer |
| `teacher_id → teachers` | nullable + `SET NULL` | No | **nullable + `ON DELETE CASCADE`** (composite) — an invitation to claim a specific teacher record is meaningless once that record is gone |
| `guardian_id → guardians` | nullable + `SET NULL` | No | **nullable + `ON DELETE CASCADE`** (composite) |
| `accepted_by → profiles(id)` | nullable + `SET NULL` | Latent | **nullable + `ON DELETE CASCADE`** — `SET NULL` would leave `accepted_at` populated with `accepted_by` null, a half-state asserting "accepted by nobody" |
| `school_id → schools(id)` | `NOT NULL` + `CASCADE` | No | **unchanged** |

**Consequence:** `invitations` has **no `SET NULL` behaviour at all**, so no NOT-NULL conflict is possible now or after future edits.

## §18. Final internal-consistency check

| Check | Result |
|---|---|
| **NOT NULL vs SET NULL contradictions** | **Clear.** Every `SET NULL` target is nullable. `invitations.invited_by` resolved to CASCADE (§17); `memberships.teacher_id`/`guardian_id` resolved to CASCADE (§16). |
| **Duplicated sources of truth** | **Clear.** `profiles.school_id` is sole authority; `memberships.school_id` is a declaratively pinned projection (§3). `schools.active_academic_year_id` removed (§14). Platform-operator status has exactly one source: `platform_admins` (§4). |
| **Circular dependencies** | **Clear.** The only cycle (`schools` ↔ `academic_years`) is gone. `schools` has **zero outbound FKs**. |
| **Ambiguous school-ownership paths** | **Clear.** Every school-owned table carries `school_id NOT NULL`; every school-owned → school-owned reference is composite; `audit_logs.school_id` is the sole nullable case and is documented as intentional. |
| **Illegal role/identity states** | **Clear.** The positive CHECK admits exactly three combinations. `announcements` audience/class_id pairing is bidirectionally checked. `school_applications` approved⇒school_id and rejected⇒reason are checked. |
| **One-user/one-school violations** | **Clear.** Structurally impossible via FK #9. |
| **Approval / tenant / payment lifecycle confusion** | **Clear.** Three disjoint vocabularies, three tables, no shared values. |
| **Missed composite FKs** | **Clear.** All 87 audited; 35 composite. |
| **Frontend assumptions now in conflict** | **Two new conflicts:** `SchoolSettings.academicYearId` becomes a derived lookup (§14); `AuthUser.schoolId` resolves from `profiles.school_id`, and `StoredUser.password` has no destination by design (§7). |

### Verdict: **A. READY FOR SQL**

**Two items remain open but are not blockers**, and neither affects DDL:
1. **Retention durations** — legal determinations, configurable without schema change.
2. **Consent/policy-acceptance records** — deliberately absent; purely additive if Phase 17 requires them.

**One item enforced by process rather than schema:** a platform operator holding a school account on the same profile is *structurally permitted* and prevented by policy and audit (§4).

---

# §13. COMPLETE FOREIGN KEY AUDIT — all 87

**Rule adopted:** *whenever a school-owned relationship references another school-owned record, the relationship MUST be tenant-bound by the composite `(school_id, id)` key.* Applied without exception.

**Extension to user references:** `profiles` carries `school_id` with `UNIQUE (id, school_id)`, so school-owned tables referencing a *user* can also be tenant-bound. This is applied to **access-granting** user references and left **single-column** for **attribution-only** references.

Legend — **C** = composite, **S** = single-column.

## Platform-level

| # | Source | Target | C/S | ON DELETE | Reason if single |
|---|---|---|---|---|---|
| 1 | `school_applications.reviewed_by` | `profiles.id` | S | SET NULL | Platform-level identity; a reviewer has no tenant to bind to |
| 2 | `school_applications.approved_school_id` | `schools.id` | S | SET NULL | `schools` is the TENANT ROOT — no parent tenant to bind against |
| 3 | `contact_messages.handled_by` | `profiles.id` | S | SET NULL | Platform identity; enquiry is pre-tenant |
| 4 | `platform_admins.user_id` | `profiles.id` | S | **CASCADE** | Platform identity; §15 |
| 5 | `platform_admins.granted_by` | `profiles.id` | S | SET NULL | Platform identity |
| 6 | `school_subscriptions.plan_id` | `subscription_plans.id` | S | **RESTRICT** | `subscription_plans` is platform-level with no `school_id`; RESTRICT blocks deleting a plan schools are billed against |

## Identity

| # | Source | Target | C/S | ON DELETE | Reason if single |
|---|---|---|---|---|---|
| 7 | `profiles.id` | `auth.users.id` | S | CASCADE | Supabase-managed; auth owns the identity lifecycle |
| 8 | `profiles.school_id` | `schools.id` | S | **RESTRICT** | TENANT ROOT — no parent tenant. RESTRICT blocks hard-deleting a school with users assigned |
| 9 | **`memberships (user_id, school_id)`** | **`profiles (id, school_id)`** | **C** | CASCADE (`ON UPDATE NO ACTION`) | — **the one-school enforcement** |
| 10 | `memberships.school_id` | `schools.id` | S | CASCADE | TENANT ROOT; guarantees the school is real |
| 11 | `memberships (school_id, teacher_id)` | `teachers (school_id, id)` | **C** | **CASCADE** | — §16 |
| 12 | `memberships (school_id, guardian_id)` | `guardians (school_id, id)` | **C** | **CASCADE** | — §16 |
| 13 | `memberships.invited_by` | `profiles.id` | S | SET NULL | Attribution only; grants no access |
| 14 | `invitations.school_id` | `schools.id` | S | CASCADE | TENANT ROOT |
| 15 | `invitations (school_id, teacher_id)` | `teachers (school_id, id)` | **C** | CASCADE | — §17 |
| 16 | `invitations (school_id, guardian_id)` | `guardians (school_id, id)` | **C** | CASCADE | — §17 |
| 17 | `invitations.invited_by` | `profiles.id` | S | **CASCADE** | Platform identity; §17 |
| 18 | `invitations.accepted_by` | `profiles.id` | S | **CASCADE** | Platform identity; §17 |

## School-owned → TENANT ROOT

| # | Source | Target | C/S | ON DELETE | Reason |
|---|---|---|---|---|---|
| 19–41 | `school_subscriptions`, `academic_years`, `terms`, `subjects`, `teachers`, `guardians`, `students`, `student_guardians`, `classes`, `class_subjects`, `class_enrollments`, `timetable_slots`, `attendance_records`, `grade_records`, `homework`, `homework_submissions`, `exams`, `fee_records`, `fee_payments`, `announcements`, `notifications`, `message_threads`, `message_thread_participants`, `messages` — each `.school_id` | `schools.id` | S | CASCADE | TENANT ROOT — `school_id` **is** the tenant key; there is nothing to compose it with |

> **Note on this row:** the approved design records rows 19–41 as a **single grouped entry** covering
> all 24 listed tables, not as 23 individually numbered rows. Reproduced as written.

## School-owned → school-owned (all composite)

| # | Source | Target | C/S | ON DELETE |
|---|---|---|---|---|
| 42 | `terms (school_id, academic_year_id)` | `academic_years (school_id, id)` | C | CASCADE |
| 43 | `teachers (school_id, primary_subject_id)` | `subjects (school_id, id)` | C | SET NULL |
| 44 | `student_guardians (school_id, student_id)` | `students (school_id, id)` | C | CASCADE |
| 45 | `student_guardians (school_id, guardian_id)` | `guardians (school_id, id)` | C | CASCADE |
| 46 | `classes (school_id, academic_year_id)` | `academic_years (school_id, id)` | C | CASCADE |
| 47 | `classes (school_id, class_teacher_id)` | `teachers (school_id, id)` | C | **RESTRICT** |
| 48 | `class_subjects (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 49 | `class_subjects (school_id, subject_id)` | `subjects (school_id, id)` | C | CASCADE |
| 50 | `class_subjects (school_id, teacher_id)` | `teachers (school_id, id)` | C | SET NULL |
| 51 | `class_enrollments (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 52 | `class_enrollments (school_id, student_id)` | `students (school_id, id)` | C | CASCADE |
| 53 | `class_enrollments (school_id, academic_year_id)` | `academic_years (school_id, id)` | C | CASCADE |
| 54 | `timetable_slots (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 55 | `timetable_slots (school_id, teacher_id)` | `teachers (school_id, id)` | C | SET NULL |
| 56 | `timetable_slots (school_id, subject_id)` | `subjects (school_id, id)` | C | SET NULL |
| 57 | `attendance_records (school_id, student_id)` | `students (school_id, id)` | C | CASCADE |
| 58 | `attendance_records (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 59 | `grade_records (school_id, student_id)` | `students (school_id, id)` | C | CASCADE |
| 60 | `grade_records (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 61 | `grade_records (school_id, subject_id)` | `subjects (school_id, id)` | C | **RESTRICT** |
| 62 | `grade_records (school_id, term_id)` | `terms (school_id, id)` | C | **RESTRICT** |
| 63 | `homework (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 64 | `homework (school_id, subject_id)` | `subjects (school_id, id)` | C | **RESTRICT** |
| 65 | `homework_submissions (school_id, homework_id)` | `homework (school_id, id)` | C | CASCADE |
| 66 | `homework_submissions (school_id, student_id)` | `students (school_id, id)` | C | CASCADE |
| 67 | `exams (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 68 | `exams (school_id, subject_id)` | `subjects (school_id, id)` | C | **RESTRICT** |
| 69 | `exams (school_id, term_id)` | `terms (school_id, id)` | C | **RESTRICT** |
| 70 | `fee_records (school_id, student_id)` | `students (school_id, id)` | C | CASCADE |
| 71 | `fee_records (school_id, term_id)` | `terms (school_id, id)` | C | **RESTRICT** |
| 72 | `fee_payments (school_id, fee_record_id)` | `fee_records (school_id, id)` | C | **RESTRICT** |
| 73 | `announcements (school_id, class_id)` | `classes (school_id, id)` | C | CASCADE |
| 74 | `message_threads (school_id, student_id)` | `students (school_id, id)` | C | SET NULL |
| 75 | `message_thread_participants (school_id, thread_id)` | `message_threads (school_id, id)` | C | CASCADE |
| 76 | `messages (school_id, thread_id)` | `message_threads (school_id, id)` | C | CASCADE |

## School-owned → user (the extension)

| # | Source | Target | C/S | ON DELETE | Reason if single |
|---|---|---|---|---|---|
| 77 | **`notifications (user_id, school_id)`** | **`profiles (id, school_id)`** | **C** | CASCADE | — **access-granting**: this row determines who reads it. Tenant-bound. |
| 78 | **`message_thread_participants (user_id, school_id)`** | **`profiles (id, school_id)`** | **C** | CASCADE | — **access-granting**: this table *is* the RLS predicate for thread visibility. Tenant-bound. |
| 79 | `attendance_records.marked_by` | `profiles.id` | S | SET NULL | Attribution only, grants no access. Composite would force `ON DELETE SET NULL (marked_by)` column-list syntax to avoid nulling the `NOT NULL school_id` |
| 80 | `grade_records.recorded_by` | `profiles.id` | S | SET NULL | As #79 |
| 81 | `homework.created_by` | `profiles.id` | S | SET NULL | As #79 |
| 82 | `fee_payments.recorded_by` | `profiles.id` | S | SET NULL | As #79 |
| 83 | `announcements.created_by` | `profiles.id` | S | SET NULL | As #79 |
| 84 | `message_threads.created_by` | `profiles.id` | S | SET NULL | As #79; visibility comes from #78, not from authorship |
| 85 | `messages.sender_id` | `profiles.id` | S | SET NULL | As #79; a message must survive its sender's erasure in anonymised form |

## Audit

| # | Source | Target | C/S | ON DELETE | Reason if single |
|---|---|---|---|---|---|
| 86 | `audit_logs.school_id` | `schools.id` | S | SET NULL | Nullable by design (platform actions); TENANT ROOT |
| 87 | `audit_logs.actor_user_id` | `profiles.id` | S | SET NULL | **Never CASCADE** — the record of what someone did must outlive them; identity preserved via snapshots |

**Total: 87 foreign keys — 35 composite, 52 single-column, every single-column one justified above. The composite strategy is applied completely, with no partial application remaining.**

---

# STANDING IMPLEMENTATION RULES

These emerged during Migrations 01–10 and are binding on all future migrations. They are not part of
the original design text; they are how the design is correctly implemented.

## 1. Scoped `SET NULL` on composite foreign keys

**Every composite FK with `ON DELETE SET NULL` MUST name the column subset:**

```sql
on delete set null (the_reference_column)
```

**Why plain composite `SET NULL` fails.** It nulls *every* referencing column, `school_id` included.
Because `school_id` is `NOT NULL` on all school-owned tables, the parent delete then fails with:

```
SQLSTATE 23502: null value in column "school_id" violates not-null constraint
```

That is **RESTRICT behaviour wearing a SET NULL label** — the delete is blocked rather than the
reference cleared, contradicting what the design says the FK does.

**Measured on this database** using temp tables reproducing the exact shape:

| Form | Result |
|---|---|
| plain `ON DELETE SET NULL` | `DELETE FAILED -> 23502` |
| scoped `ON DELETE SET NULL (ref_id)` | `DELETE SUCCEEDED` — child row survives, `school_id` intact, `ref_id` NULL |

The column-list syntax requires **PostgreSQL 15+**; this project runs 17.

**This is not a design change** — it is the only way to implement what §13 describes. Applies to
audit rows **43, 50, 55, 56, 74** and any future composite SET NULL. **Single-column SET NULL FKs
are unaffected and need no subset.**

*History: discovered after Migration 07 applied row 43 in the plain form; fixed by corrective
`20260904000007`. Migration 08 applied rows 50, 55, 56 correctly from the start.*

## 2. Access-granting vs attribution-only user references

This distinction drives Phase 7 RLS and determines whether a user reference is tenant-bound.

| | **ACCESS-GRANTING** | **ATTRIBUTION-ONLY** |
|---|---|---|
| Meaning | The row determines **who may see it** | The row records **who did something** |
| Binding | **Composite** — `(user_id, school_id) → profiles (id, school_id)` | **Single-column** — `→ profiles(id)` |
| ON DELETE | CASCADE | SET NULL |
| Members | `notifications.user_id` (#77), `message_thread_participants.user_id` (#78) | `memberships.invited_by` (#13), `attendance_records.marked_by` (#79), `grade_records.recorded_by` (#80), `homework.created_by` (#81), `fee_payments.recorded_by` (#82), `announcements.created_by` (#83), `message_threads.created_by` (#84), `messages.sender_id` (#85), `audit_logs.actor_user_id` (#87) |

**Test to apply:** *does being named in this column let the user see data they otherwise could not?*
If yes, it is access-granting and must be tenant-bound. If it only records authorship, it is
attribution-only and stays single-column — which also avoids needing the scoped SET NULL form.

`message_threads.created_by` is the instructive case: authoring a thread does **not** grant sight
of it. Visibility comes from `message_thread_participants` (#78). So it is attribution-only.

## 3. Migration numbering convention

- **Design numbers 01–11 are reserved** for the §I plan and mean only that. `03` always means
  `schools`, `11` always means `communication_and_audit`. A design number is never reused.
- **Corrective migrations carry no design number.** They are labelled `CORRECTIVE`, identified by
  timestamp, and name the design migration they correct.
- **Applied migration files are never edited.** An applied file is a historical record. Errors in
  one are corrected by a new migration and, where the error is only in a comment, by documentation.
  `docs/MIGRATIONS.md` is the authority on migration identity; a header comment inside an applied
  file is not.

## 4. Status columns get a CHECK only where the design defines a vocabulary

Where the design **enumerates values**, express them as `text` + `CHECK` — never a Postgres enum,
unless Migration 01 already created one. Where the design gives a column and a default but **names
no vocabulary**, the column stays plain `text` with **no CHECK**.

Currently unconstrained by this rule: `contact_messages.status`, `guardians.status`.

*History: a CHECK inferred for `contact_messages.status` in Migration 02 was removed by corrective
`20260904000001`. Inference is not approval.*

## 5. Index lists name access paths, not index objects

§C index lists state required **access paths**. Where a constraint's own backing index already serves
a listed path as its **leading columns**, no duplicate object is created. The design states this
itself in §C table 10: *"Index `(shortcode)` (unique already)"*.

**Counter-case:** PostgreSQL indexes only the **referenced** side of a foreign key, never the
referencing side. Where a trigger or hot query filters on a referencing FK's columns, that index
must be created explicitly — as corrective `20260904000011` did for
`fee_payments (school_id, fee_record_id)`.

---

# EXPORT COMPLETENESS

**Every section of the approved design is now exported. Nothing is MISSING.**

| Section | Title | Status |
|---|---|---|
| §A | Foundations (A.1 conventions, A.2 tenancy, A.3 `current_school_id()`, A.4 status vocabularies) | ✅ Exported |
| §B | Table inventory — 34 tables with classification | ✅ Exported |
| §C | Table-by-table detail, tables 1–34 | ✅ Exported |
| §D | Entity relationship summary | ✅ Exported (second pass) |
| §E | Frontend field mapping | ✅ Exported (second pass) |
| §F | Frontend data that should NOT be persisted | ✅ Exported |
| §G | Roadmap requirements the frontend lacks entirely | ✅ Exported (second pass) |
| §H | `audit_logs` design | ✅ Exported |
| §I | Migration file plan — 11 migrations | ✅ Exported |
| §J | Risks, ambiguities, assumptions | ✅ Exported (second pass) |
| §1–§18 | All 18 approved amendments | ✅ Exported |
| §13 | Complete FK audit — all 87 | ✅ Exported |
| §10 | Data lifecycle classification | ✅ Exported |
| — | Standing implementation rules (Migrations 01–10) | ✅ Exported |

**Nothing in this document is reconstructed, inferred, redesigned or gap-filled.** Every section is
transcribed from the approved design and amendment text. Where the original text is superseded by an
amendment, the original is retained and marked ⚠ rather than deleted, so the provenance of every
decision stays visible.

**Three passages are marked VOID or superseded in place**, because following them would produce a
wrong schema:

| Where | What is void | Superseded by |
|---|---|---|
| §B closing note | "one human may hold roles at several schools" as the reason `profiles` has no `school_id` | Amendment §2 |
| §C tables 7, 8, 9, 10, 11 | Original identity columns, membership uniqueness, prohibitive CHECK, invitation SET NULLs, `active_academic_year_id`, subscription default | Amendments §2, §9, §14, §16, §17 |
| §J assumptions | "A person may hold roles at multiple schools" | Amendment §2 |
