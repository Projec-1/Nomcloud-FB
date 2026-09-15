# Nom Cloud — File Storage Plan

**Status:** **BUILT 2026-09-15** — migration `20260915000004_file_storage`. The investigation below is kept as written; section 5 records what was built and where it differs.
**Checked live, 2026-09-15:** the `public` schema's columns, `storage.buckets`,
`storage.objects`, the Storage policies, the RLS on `students`, `schools` and
`profiles`, and the access helper functions. Also read `SCHEMA_DESIGN.md` and
every file input and Storage call in `src/`.

**State before the build.** There were **0 buckets, 0 objects and 0 Storage
policies.** Supabase keeps RLS on `storage.objects` enabled, so with no policies no
client could read or write any file. Section 5 describes the state now.

---

## 1. Where files are needed

Three columns in the live schema expect a file. No others do: no teacher or
guardian photo, no document column, and no attachments table.

| Column | Type | What the design says | UI today |
|---|---|---|---|
| `schools.logo_path` | text, nullable | "Storage object path — **not** base64" (`SCHEMA_DESIGN` table 2); §F forbids storing the old base64 `logoDataUrl` | Upload **removed** in Phase 8 batch 1. `SchoolBrandLogo` always shows the school's initial. |
| `students.photo_path` | text, nullable | Plain nullable path (table 17). §10 lists it as PII that is nulled when a student is anonymised. | No upload and no display. |
| `profiles.avatar_url` | text, nullable | Listed in amended table 7 with no further guidance. The name says URL, not path. | Typed in `types/auth.ts`, never shown or written. |

**Named in the design but not in the schema.** `SCHEMA_DESIGN` §F maps the
prototype's `Homework.attachments` count to "attachments table + Storage
(Phase 10)". No such table exists, and Phase 8 removed the counter. It is out of
scope here and would get its own bucket later.

The rest of this plan resolves the batch 1 logo item. The column was always
meant to hold a Storage path; the only missing piece was the bucket.

## 2. Storage structure

**Two private buckets now**, one per sensitivity level:

| Bucket | Holds | Path | Stored in |
|---|---|---|---|
| `school-branding` | School logos | `{school_id}/logo/{random-uuid}.{ext}` | `schools.logo_path` |
| `student-photos` | Student photos | `{school_id}/{student_id}/{random-uuid}.{ext}` | `students.photo_path` |

**Why separate buckets.** Child photos are personal data subject to anonymisation;
logos are not. Separate buckets give each its own size and type limits. A mistake
in one bucket's policy also cannot expose the other.

**The first folder is always `school_id`.** On tables every school-owned row
carries `school_id`, and in Storage the path's first segment plays the same role.
Every policy below checks that segment first, so one school's files are separated
from another's by the same key as its rows.

**File names are random, not the student's id.** Replacing a photo uploads a new
object, updates the column, then deletes the old object. That avoids stale cached
images, and nobody can fetch a photo by guessing a predictable name.

**The column stores the path within the bucket, not a URL.** The bucket follows
from the column. Downloads use short-lived signed URLs created at read time, which
are never saved in the database.

## 3. Access control — the table model, carried over

Storage policies are written on `storage.objects`, with the bucket id and the
object path as inputs. They call the same SECURITY DEFINER helpers the table
policies already use. Every helper below is executable by `authenticated` today.
**Each bucket mirrors the policy of the table its column lives on**, so seeing a
photo can never be broader than seeing its student row.

| Bucket | Read | Write (upload, replace, delete) | Mirrors |
|---|---|---|---|
| `student-photos` | `has_school_staff_role(school)` — owner, director, administrator, principal, teacher — **or** `is_guardian_of_student(school, student)` — or platform admin | `has_school_management_role(school)` — owner, director, administrator, principal | `students_staff_select`, `students_guardian_select`, `students_management_*` |
| `school-branding` | `school = current_school_id()` — any member of that school — or platform admin | `has_school_admin_role(school)` — owner, director, administrator | `schools_member_select`, `schools_admin_update` |

Here `school` and `student` are the first and second path segments.

What this gives, stated as the cases in the brief:

- **A guardian can't read another family's student photo.** The read requires
  `is_guardian_of_student` for the student in the path, the same check that hides
  that student's row.
- **A teacher can't read another school's files.** Every helper takes the path's
  `school_id` and checks the caller's membership in that school.
- **Knowing a path isn't enough.** The policy judges the object path itself, not
  the database column, so a leaked or guessed path still gets nothing.
- **Nobody can upload into another school's folder.** The write check on the
  object name requires management rights in the school named in the path. For
  student photos it also requires that the student exists in that school.

**Four implementation rules** (for the build task, not decisions):

1. **Both buckets private.** A public bucket serves reads without any policy.
2. **Validate path segments as UUIDs before casting.** A malformed name must fail
   the policy, not raise an error.
3. **Keep signed URLs short**, around an hour. A signed URL works for anyone who
   holds it until it expires.
4. **Files don't delete themselves.** Storage objects aren't linked to rows by
   foreign keys. Deleting a student or anonymising them under §10 must also delete
   the photo object, or it outlives the record.

## 4. Upload size and type limits

Set as bucket limits, which Storage enforces on every upload, including from
clients:

| Bucket | Max size | Allowed types |
|---|---|---|
| `school-branding` | 1 MB | `image/png`, `image/jpeg`, `image/webp` |
| `student-photos` | 2 MB | `image/jpeg`, `image/png`, `image/webp` |
| *(future documents)* | 10 MB | `application/pdf` |

- **SVG is excluded.** An SVG can carry script and becomes dangerous if a browser
  ever renders it inline.
- **Resize in the browser before upload** (for example, photos to about 512 px and
  logos to about 256 px, re-encoded as JPEG or WebP). Uploads stay small, and HEIC
  photos from phones become an allowed type.
- **The type check is based on the declared content type,** not the file's bytes.
  Re-encoding in the browser is what guarantees each upload really is an image.

---

## Decisions (asked here, LOCKED 2026-09-15 — answers in section 5)

1. **Should a school's logo show before sign-in,** for example on a school-specific
   login page? If yes, `school-branding` becomes a public bucket holding logos only,
   with writes still restricted. If no, it stays private and the logo appears only
   after sign-in, which is the only place it's shown today.
2. **Should every teacher in a school see every student's photo?** Mirroring the
   `students` table means yes, because any teacher can already read every student
   row. If no, photos would be narrowed to teachers of that student's class, which
   would be tighter than the student record itself.
3. **Should profile avatars be built now?** `profiles.avatar_url` exists but nothing
   uses it. If yes, add a third bucket where each user writes only their own avatar
   and members of their school can read it. If no, leave it unused for now.

---

## 5. As built (2026-09-15)

### Decisions as locked

1. **Logo visible before sign-in — YES.** `school-branding` is a **public** bucket.
2. **Teachers see only the photos of students in classes they teach — YES.** Tighter
   than the `students` table, which still lets any teacher read every row (and its
   `photo_path`). The path alone opens nothing; probes e1/e2/e5 show exactly that.
3. **Avatars built now — YES.** Third bucket `profile-avatars`; staff and admins upload
   their own; guardians cannot.

### Buckets

| Bucket | Public | Limit | Types | Path | Column |
|---|---|---|---|---|---|
| `school-branding` | **yes** | 1 MB | png, jpeg, webp | `{school_id}/logo/{uuid}.{png\|jpg\|webp}` | `schools.logo_path` |
| `student-photos` | no | 2 MB | png, jpeg, webp | `{school_id}/{student_id}/{uuid}.{ext}` | `students.photo_path` |
| `profile-avatars` | no | 1 MB | png, jpeg, webp | `{user_id}/{uuid}.{ext}` | `profiles.avatar_url` (a path, despite the name) |

### How the public logo stays narrow

A public bucket means one thing: Storage serves `GET /object/public/school-branding/<exact path>`
without consulting RLS. Everything else is still policy-controlled, and four facts bound it:

1. **Logos only.** The insert policy accepts only `{uuid}/logo/{uuid}.(png|jpg|webp)`, the bucket
   accepts only png/jpeg/webp up to 1 MB, and it is the only public bucket.
2. **No listing, no anonymous writes.** There is no `anon` policy on `storage.objects`. Signed out,
   a list returns `[]` and an upload is refused (probes a5–a7). Signed in, only that school's
   administrators can list its folder (b5).
3. **Unguessable names.** Every object name is a fresh random UUID.
4. **One school per login page.** The login page resolves a shortcode from the school's subdomain
   (`{shortcode}.class.so`) or `?school=`, and calls `school_login_branding(shortcode)`, which
   returns `name`, `primary_color` and `logo_path` for the one active school with that shortcode
   and nothing else (a3, a8, b3, b4). The `schools` table itself stays unreadable to `anon` (a9).

A logo is public information by decision: whoever knows a school's shortcode can see its logo, as
they can see its login page.

### How the teacher rule reuses attendance access

`teaches_student(school, student)` has no teaching logic. It takes the student's open enrolments
(`class_enrollments.left_on IS NULL`, the signal every roster read uses) and asks the existing
`teaches_class(school, class)` about each: the function behind
`attendance_records_teacher_insert/select/update`. "Teaches" is therefore
`classes.class_teacher_id` or `class_subjects.teacher_id`, never `timetable_slots`. Probes d1
(homeroom), d3 (subject teacher) and e1–e3 (a teacher of another class) cover both paths.

### Access, as enforced

| Bucket | Read | Upload | Delete |
|---|---|---|---|
| `school-branding` | anyone, by exact path (public); list: that school's admins | `has_school_admin_role` | `has_school_admin_role` |
| `student-photos` | `has_school_management_role` **or** `teaches_student` **or** `is_guardian_of_student` | `has_school_management_role`, student exists in that school | `has_school_management_role` |
| `profile-avatars` | whoever can read the owner's `profiles` row (subquery under the caller's RLS: self, the school's admins, platform admins) | own folder; staff in current school or platform admin | own folder |

Platform admins have all operations on `school-branding` and `student-photos`. There is no UPDATE
policy on any bucket: a replacement is a new object. **No policy on a `public` table changed.**

### Storage policies and the existing helpers

Storage runs each request as the caller's database role with the request's JWT claims set, so
`auth.uid()` inside the SECURITY DEFINER helpers resolves to the caller. This was verified by the
live probes rather than assumed. Path segments are read through `storage_path_uuid(name, i)`,
which returns NULL for anything that is not a lower-case UUID, so a malformed name fails the policy
instead of raising.

### Application

| Point | Upload | Display |
|---|---|---|
| Logo | Admin → Settings: upload, replace, remove; saved immediately | Sidebar `SchoolBrandLogo`, Settings preview, login page (public URL) |
| Student photo | Admin → Students → Edit: upload, replace, remove; saved immediately | Admin Students list and edit modal (one batch of signed URLs per load); Parent → My Children (signed URL) |
| Avatar | Top bar menu: add, change, remove (hidden for guardian-only accounts) | Top bar (signed URL) |

- **Client checks before any request** (`src/lib/imageUpload.ts`): type must be png/jpeg/webp,
  size within the bucket limit, then the image is decoded into a canvas, downscaled (logo and
  avatar 256 px, photo 512 px) and re-encoded (logo PNG to keep transparency, photo and avatar
  JPEG), and the result is checked again. No dependency: canvas APIs are built in.
- **Replacement order:** upload new object → update column → remove old object. If the column
  update fails or is refused, the new object is removed instead.
- **Deleting a student removes the photo object** (`deleteStudent` reads the deleted row's
  `photo_path`), per rule 4 in section 3.
- **Signed URLs last one hour** and are renewed a minute before expiry by `useSignedImageUrl`.
- **Not wired, by scope:** teacher-facing screens do not display student photos yet. The access
  is in place (probes d1–d3); showing them is a presentation change for a later task.

### Known limits

- The size limit applies to the file the user picks, before resizing. A large phone photo is
  refused rather than downscaled. Relaxing that is a client-only change; the bucket limit would
  still hold.
- `profiles.avatar_url` is writable by every user on their own row (existing column grant). A
  guardian could store any string there, but cannot upload an object, so it resolves to nothing.
- Anonymising a student (SCHEMA_DESIGN §10) must also remove the photo object. No anonymisation
  routine exists yet; when one is built it must call the Storage API.
