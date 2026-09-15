# Nom Cloud — File Storage Plan

**Status:** Light investigation, read-only. Nothing built.
**Checked live, 2026-09-15:** the `public` schema's columns, `storage.buckets`,
`storage.objects`, the Storage policies, the RLS on `students`, `schools` and
`profiles`, and the access helper functions. Also read `SCHEMA_DESIGN.md` and
every file input and Storage call in `src/`.

**Current state.** There are **0 buckets, 0 objects and 0 Storage policies.**
Supabase keeps RLS on `storage.objects` enabled, so with no policies no client can
read or write any file today. That is a safe starting point.

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

## Decisions for you (yes / no)

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
