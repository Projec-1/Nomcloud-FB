# Nom Cloud — Phase 4 Authentication Design

**Status:** Design document only. This document defines the intended authentication
behavior for Phase 4; it does not implement it, alter the database, or change Supabase
configuration.

## §1. Identity model

Nom Cloud uses the following identity chain:

```text
auth.users → profiles → memberships → school_id + role → authorisation → RLS
```

- `auth.users` is the Supabase Auth identity. It owns credentials, email-confirmation
  state, and the session subject (`auth.users.id`).
- `profiles.id` is the same UUID as `auth.users.id`. It stores the human's name,
  email, contact details, and `school_id`.
- `profiles.school_id` is authoritative for the person's school. In V1, one human
  belongs to one school. A platform operator has `profiles.school_id = NULL`; that
  value alone does **not** grant platform authority.
- `memberships` records the person's role at that school (`owner`, `director`,
  `administrator`, `principal`, `teacher`, or `guardian`) and, where applicable,
  the linked teacher or guardian record.
  `memberships.school_id` is a constrained projection of `profiles.school_id`, not
  an independent source of truth.
- An unrevoked `platform_admins` row is the sole determinant of platform-admin
  authority. Platform operators have no school membership on that account.

At login, the frontend obtains the authenticated Supabase user, then fetches that
user's `profiles` row, then all active `memberships` for the user. It resolves the
school from `profiles.school_id`, loads the school record, and derives the available
views from the memberships. The frontend must never infer a school or permission from
the hostname. A subdomain such as `{shortcode}.class.so` is routing and branding
only, never an authorisation boundary.

## §2. Session handling

The authentication provider will initialise Supabase once at application startup:

1. Call `supabase.auth.getSession()` to restore the persisted session.
2. While the session and identity context are unresolved, expose an explicit
   `authState: 'initialising'` state.
3. Register `supabase.auth.onAuthStateChange` and retain its unsubscribe function.
4. On `SIGNED_IN`, `TOKEN_REFRESHED`, or an equivalent session update, reconcile the
   session and reload the profile/memberships context as needed.
5. On `SIGNED_OUT`, `USER_DELETED`, or a session with no user, clear the identity,
   active role, and school context.
6. Unsubscribe on provider unmount.

Supabase manages access-token refresh for the client. A refresh must not be treated as
a new login or reset the active view unnecessarily. If refresh fails, or Supabase
emits an expired/invalid session, the provider clears local identity state, signs out
the client if necessary, and redirects the user to `/login` with a session-expired
message. Unsaved form data is not promised to survive expiry.

The provider must distinguish these states:

- `initialising`: the initial Supabase session check is in progress;
- `loading_profile`: a valid Auth session exists but profile, school, or memberships
  are still being fetched;
- `ready`: all required identity data is present;
- `signed_out`: no valid Auth session exists;
- `error`: identity loading failed and the user must see a recoverable error/retry
  state rather than an authenticated shell.

The current `ProtectedRoute` assumes that a synchronous `currentUser` is enough. It
will be replaced by an auth gate that renders a loader during `initialising` and
`loading_profile`, renders an actionable error state for `error`, redirects only from
`signed_out`, and renders protected children only in `ready`. No dashboard component
may render during the async gap and accidentally interpret missing profile data as
unauthenticated or authorised.

## §3. Login flow

1. The user opens `/login`. The page offers email and password fields. There is no
   public account-creation path; the former self-registration form becomes an
   invitation-acceptance flow.
2. The user submits credentials. The UI disables submission and shows a progress state.
3. The client calls Supabase password sign-in. Supabase verifies the password and
   rejects unknown, incorrect, or unconfirmed credentials.
4. If email confirmation is required but incomplete, the user remains signed out and
   sees instructions to confirm the email, with a resend-confirmation action.
5. Once Supabase returns a session, the provider sets `loading_profile`. It fetches
   `profiles` by `id = session.user.id`.
6. It verifies that the profile exists, reads the authoritative
   `profiles.school_id`, and fetches the corresponding `schools` row.
7. It fetches the user's `memberships`, including `role`, `status`, and role-specific
   teacher/guardian links. Suspended memberships are not active views.
8. The provider stores the resulting identity context and sets `ready`.
9. For one active membership, the user is sent to that role's default view. For
   multiple active roles, the user is sent to the last valid active role if it is
   still available; otherwise the deterministic default role is used and the user
   can switch views from the top bar.
10. A protected redirect requested before login is honored only if the path is
    compatible with one of the user's active memberships. Otherwise the role's
    default view is used.

The user sees a loading screen between successful sign-in and completed profile and
membership resolution. They never see a partially populated dashboard. Database or
network errors produce a clear retry/sign-out state and do not create a synthetic
local user.

## §4. Invitation flow

### Creating an invitation

1. An authorised school admin creates an invitation for an existing school person
   record or creates the pending teacher/guardian record required by the approved
   schema.
2. The application generates a cryptographically random, high-entropy, single-use
   bearer token. The raw token is placed only in the email link and is never stored.
3. The application hashes the token with a modern one-way hash before inserting the
   invitation. The database stores `invitations.token_hash` only, plus
   `school_id`, case-normalised `email`, `role`, optional `teacher_id` or
   `guardian_id`, `expires_at`, `invited_by`, and unset `accepted_at`,
   `accepted_by`, and `revoked_at`.
4. The live-invitation uniqueness rule prevents more than one unaccepted,
   unrevoked invitation for the same school, email, and role. Sending a replacement
   requires revoking or expiring the old invitation first.
5. The email contains the raw token in a one-time acceptance URL. It does not expose
   the hash or internal IDs.

### Accepting an invitation

1. The recipient opens the link. The server-side acceptance operation hashes the
   supplied token and looks up the hash.
2. It rejects the invitation if no hash matches, `revoked_at` is set, `accepted_at`
   is set, or `expires_at` is in the past. Expiry is checked at acceptance time, not
   only by a cleanup job.
3. The recipient supplies a password and any profile fields still required. The
   email must match the invitation's normalised email. The client calls
   `auth.signUp` with email confirmation enabled and includes only non-sensitive
   invitation context needed to finish the flow.
4. The account is not considered working until the confirmation link is completed.
   This is intentional even though the invitation was delivered to the invited
   address: invitation possession and email confirmation are separate controls.
5. After confirmation and sign-in, the acceptance operation runs transactionally:
   it revalidates the invitation, creates or completes `profiles`, creates the
   membership, sets `accepted_at = now()` and `accepted_by = auth.users.id`, and
   prevents a second acceptance. The operation must be safe against concurrent
   clicks.
6. The frontend then reloads profile and memberships through the normal login flow.

An accepted invitation cannot be accepted twice: the user sees that it has already
been used and is directed to log in. An expired or revoked invitation cannot be
reactivated; an administrator must issue a new one. Revocation is explicit and
prevents acceptance even if the raw link has not expired. The raw token must not be
logged, included in analytics, or returned by ordinary invitation queries.

An invitation to an email that already has an account does not create a second
`auth.users` record. After the existing user authenticates and confirms the
invitation, the system adds the missing membership if the invitation is valid and
the role is not already present. Existing credentials are retained. Duplicate role
membership is reported as already satisfied rather than creating a duplicate.
Whether an existing account may accept an invitation into a different school is
unresolved by the one-school design and is listed in §13.

## §5. Role resolution and the switcher

The provider maps each active membership to a view:

| Membership role | View |
|---|---|
| `owner` | none yet |
| `director` | none yet |
| `administrator` | `/app/admin` |
| `principal` | none yet |
| `teacher` | `/app/teacher` |
| `guardian` | `/app/parent` |

Migration `20260908000002_membership_role_expansion` renamed `admin` to
`administrator` and `parent` to `guardian`, and added `owner`, `director` and
`principal`. The Phase 4 workspaces were deliberately not expanded
(CAMPUS_ROLE_DESIGN.md section G), so `src/lib/roles.ts` translates a database
role to a workspace at the identity boundary and nowhere else. Owner, Director
and Principal map to no workspace on purpose: `admin` must never silently stand
in for all four organisational roles. A member holding only those roles reaches
the no-workspace message rather than an administrator view.

A platform operator holds no membership at all. Sign-in checks the unrevoked
`platform_admins` row first and routes to `/platform`; that check is the sole
determinant of platform authority and never depends on a null `school_id`.

The active role is UI state, not identity state. It is stored in the auth provider
and may be persisted in a non-authoritative browser preference so a reload can
restore the last view. On every restore it is validated against the freshly fetched
active memberships; an invalid or suspended role is discarded.

A user with one active role never sees a switcher. A user with two or more active
roles sees a role switcher in the top bar. Switching changes the view and navigation
only; it does not change `profiles.school_id`, issue privileges, modify the JWT
authority, or bypass database checks. The switcher is a convenience and **never a
permission**. Every protected operation and Phase 7 RLS policy must independently
verify the claimed user, school, membership, and role.

## §6. Bootstrap procedures

### First platform admin — one-time manual procedure

This is performed once in the Supabase dashboard by the deployment owner. It is
never scripted, committed, or placed in a migration.

1. In **Authentication → Users**, create a user manually with the operator's real
   email and a temporary strong password. Require the operator to change it through
   the normal password flow.
2. Record the generated Auth user UUID.
3. In the SQL editor or table editor, create the matching `profiles` row with:
   - `id`: the Auth user UUID;
   - `school_id`: `NULL`;
   - `full_name`: the operator's name;
   - `email`: the exact normalised Auth email;
   - `phone`: optional;
   - `locale`: the chosen supported locale, normally `en`;
   - `avatar_url`: optional;
   - `last_seen_at`: `NULL` initially.
4. Insert one `platform_admins` row with:
   - `user_id`: the profile/Auth UUID;
   - `granted_by`: `NULL` for the initial grant;
   - `granted_at`: the current timestamp;
   - `revoked_at`: `NULL`.
5. Confirm the account's email through the dashboard or the normal confirmation
   workflow, then test a real login and a logout.
6. Verify that this account has no school membership and that platform access is
   present only because the `platform_admins` row is unrevoked.

### First school admin after approval

The platform owner performs this manually after approving a school application.

1. Confirm the application is approved and create the `schools` row with every
   required field: `shortcode`, `name`, `status = 'active'`, optional
   `address`, `phone`, `email`, and `website`, optional `logo_path`, `primary_color`,
   `timezone`, `country`, `currency`, `locale`, `weekend_days`,
   `grading_scale`, `attendance_cutoff_time`, `email_notifications`,
   `sms_notifications`, and `parent_portal_enabled`. The shortcode must be
   DNS-safe and not reserved.
2. Identify the approved administrator's email and ensure the person has exactly
   one Auth account. If not, create the Auth user manually in the dashboard and
   require email confirmation.
3. Create the matching `profiles` row with:
   - `id`: the Auth user UUID;
   - `school_id`: the new school's UUID;
   - `full_name`, `email`, and optional `phone`;
   - `locale`: the chosen locale;
   - optional `avatar_url`;
   - `last_seen_at`: `NULL`.
4. Create the first `memberships` row with:
   - `user_id`: the profile UUID;
   - `school_id`: the new school UUID;
   - `role`: `admin`;
   - `status`: `active`;
   - `teacher_id`: `NULL`;
   - `guardian_id`: `NULL`;
   - `invited_by`: the approving platform-admin profile UUID when applicable;
   - `joined_at`: the current timestamp.
5. Set the application's approval record fields, including `reviewed_by`,
   `approved_school_id`, and the approval timestamp/reason fields defined by the
   schema. Do not create a second school admin through a bootstrap script.
6. Send the administrator the normal confirmation/login instructions, then verify
   that the profile, active membership, school status, and admin landing page all
   resolve correctly.

## §7. What Phase 4 does not secure

**Authentication alone does not protect data.** At the end of Phase 4, all 34 tables
created by Phase 3 still have no Row Level Security policies, and the application
roles retain broad/full DML grants as currently documented. A valid Supabase session
therefore does not, by itself, stop a client from reading, changing, deleting, or
truncating rows outside the user's school if the database is queried directly.

**Current verified posture (Phase 4 audit, 2026-09-07):** live REST probing returned
HTTP 200 for all 34 public tables using the publishable anonymous key. There are zero
RLS policies. `anon`, `authenticated`, and `service_role` retain broad DML grants on
33 of 34 tables; `audit_logs` is the exception because UPDATE, DELETE, and TRUNCATE
were revoked. The publishable key ships in the frontend bundle, so anyone who can use
the application can currently read and modify data belonging to any school through
the REST API. **No real school data may be entered before Phase 7 closes this exposure.**

Phase 4 protects identity and session handling only. It does not claim tenant
isolation, role enforcement, or safe CRUD authorization. Phase 7 is the separate
RLS and grant-hardening phase that must close this exposure. No Phase 4 UI guard,
subdomain, active-role value, or hidden button is a substitute for Phase 7.

## §8. Demo mode

Demo credentials and self-registration were part of the prototype and are not an
authentication path. The development self-registration implementation that accepted
a caller-supplied role and created a synthetic membership was removed after the Phase
4 audit. No code path may create a profile or membership from a caller-selected role.

Production builds must exclude:

- demo credential constants and seeded demo passwords;
- demo quick-fill buttons and their imports;
- any demo-only login branch or seed-user fallback.

The production build must use only Supabase authentication and invitation-created
accounts. Removal is verified by building with production mode, inspecting the
generated assets for demo email addresses/passwords and demo labels, and manually
confirming that `/login` has no demo controls. The demo path is deleted entirely
before launch, not merely hidden with CSS. **Audit finding carried forward:** as of
2026-09-07, `demo1234` and demo-account instructions still exist in `README.md`,
`docs/GETTING_STARTED.md`, translations, and mock data. Task 10 therefore remains
incomplete until those artifacts are removed or isolated into an explicitly separate
fixture package.

## §9. Supabase configuration

The following dashboard settings must be reviewed and changed as part of rollout.
This document names them only; it does not change them.

### Authentication providers

- **Authentication → Providers → Email**: enable email/password sign-in.
- **Email provider → Confirm email**: enable required email confirmation.
- Set the project-level signup setting to disabled (`disable_signup=true`) once
  invitation acceptance is the only account-creation path. Frontend gating is not
  sufficient: the live project currently reports `disable_signup=false`.
- Disable every social/OAuth provider not explicitly approved for launch. No provider
  may create a public self-registration path around invitations.
- Configure password reset and email-change security consistently with the required
  confirmed-email policy.

### URL configuration

- **Authentication → URL Configuration → Site URL**: set the canonical production
  HTTPS origin.
- **Authentication → URL Configuration → Redirect URLs**: allow only the exact
  production origin and approved development/staging origins, including the login,
  invitation-acceptance, confirmation, and password-reset callback paths. Do not use
  a wildcard broader than the environments require.
- If subdomains are used for routing, list the approved callback origins explicitly;
  a subdomain still never authorises a school.

### Email and confirmation

- **Authentication → Email Templates → Confirm signup**: use the approved Nom Cloud
  confirmation link and explain that confirmation is required before account access.
- **Authentication → Email Templates → Invite user**: use the invitation acceptance
  URL, expiry wording, school name, and support contact. The template must not expose
  `token_hash`.
- **Authentication → Email Templates → Reset password** and **Change email
  address**: set approved callback URLs and security wording.
- Configure the email sender name, sender address, reply-to address, SMTP provider
  and rate limits for the production environment.
- The Phase 4 transactional email Edge Function and its repository implementation
  were removed as out-of-scope work. Invitation delivery therefore remains an open
  follow-up for a later email-delivery phase.
- Confirm that confirmation links, invitation links, and reset links expire according
  to the approved security policy and that expired links produce actionable errors.

## §10. Migration from the current prototype

The current prototype stores users in `localStorage` under
`nomcloud_auth_users` and the current session under `nomcloud_auth_session`.
`DataContext` also persists its mock school data locally. These values are not
credentials or authoritative accounts and cannot be imported into Supabase.

On the first real-auth build:

- existing localStorage users are ignored by the Supabase provider;
- existing localStorage session IDs are ignored and do not create sessions;
- the user is treated as signed out and must use an invitation;
- mock school records are not migrated as production data;
- a one-time, non-blocking cleanup may remove the obsolete keys after the new
  provider is confirmed, but no password or token is copied anywhere.

Nothing in localStorage needs preserving for authentication. If product owners need
to preserve prototype content for demonstrations, it must be exported as a separate
fixture, never interpreted as identity or membership data.

### Phase 4 audit carry-forward

The authenticated shell now reads identity from Supabase, but school application data
still comes from the mock `DataContext` and is persisted in browser localStorage.
This is not real backend authorization or tenant data access. Replacing that mock data
path is a separate application-data migration and must not be mistaken for Phase 4
identity work.

Invitation creation currently hashes and stores the token, but discards the generated
acceptance URL. The transactional email function was removed as out-of-scope
work, so invitations cannot currently be delivered.

The platform-admin area was also removed as out-of-scope work. The existing platform
admin account (`nomcloud.inc@gmail.com`) has no school and no membership, so it will
return to the "Your account is not assigned an active school workspace" state. This
is an accepted known open item; no fallback route or special case is permitted.

The uncommitted changes present during the 2026-09-07 audit were:

- `src/pages/public/Login.tsx`: changes the email placeholder from
  `you@school.ac.ke` to `you@school.nclass.ac`.
- `src/pages/public/Signup.tsx`: supplies `school_size_band: 'not provided'`
  when inserting a school application.

These are incidental changes, not authentication design decisions.

## §10A. Application-level identifiers

The schema already supports some human-facing identifiers:

| Person type | Existing support | Meaning |
|---|---|---|
| Teacher | `teachers.staff_no`, nullable, unique per school when present | Persistent employment/staff identifier; already supported. |
| Student | `students.admission_no`, required, unique per school | Persistent student admission identifier; already supported. |
| Guardian | No identifier column | A value such as `SNS-GDN-001` would require a new `guardians` column and migration. |
| School admin | No separate admin-person identifier column | Admin identity is `profiles.id` plus an `admin` membership. A display label may be derived from the school shortcode plus an existing profile or membership identifier, but a persistent `SNS-ADM-001` field would require a new column and policy. |

The `SNS-*` forms are therefore not uniformly schema-backed. Teacher and student
identifiers can use existing fields. Guardian identifiers require schema work.
School-admin identifiers are display-only if derived from existing values and must not
be treated as authoritative identifiers without an approved schema change.

## §11. Edge cases

- **Suspended membership:** the session may remain valid, but the membership is
  excluded from active roles. The user sees an access-suspended message and can
  sign out; a second active role may remain available if independently valid.
- **Closed school:** school status is checked while resolving identity and on
  refresh/re-entry. Tenant views are blocked, even if the Auth session has not
  expired. The user sees that the school is closed and is signed out or placed in a
  read-blocked state according to the final UX decision.
- **Revoked platform admin while live:** the next identity refresh or privileged
  operation rechecks the unrevoked `platform_admins` row. Platform access is removed
  immediately from application state; the user must sign in again after any
  appropriate account remediation.
- **Deleted user:** Supabase emits or returns an invalid user/session. The provider
  clears all local identity and active-role state, signs out, and redirects to login.
  Cascading profile/membership cleanup follows the database design.
- **Invitation to an existing account:** no second Auth identity is created. The
  existing user authenticates, confirms the invitation, and receives only the valid
  missing membership. A duplicate role, revoked invite, expired invite, or
  cross-school conflict is surfaced explicitly.
- **Profile missing or inconsistent:** do not infer identity from an email, role,
  localStorage, or subdomain. Show an account-setup/error state and require operator
  repair.

## §12. Implementation plan

Tasks are deliberately sequential so the prototype remains usable after each step.
The six high-risk files are not changed in one batch: `AuthContext.tsx`,
`Login.tsx`, `Signup.tsx`, `ProtectedRoute.tsx`, `RoleRoute.tsx`, and `App.tsx`.

| Order | Task and files touched | Risk | Deliberately does not touch |
|---|---|---|---|
| 1 | Add the Supabase auth/profile/membership types and a small identity service around the existing `src/lib/supabase.ts`. | Medium | No route behavior, schema, migrations, grants, or UI. |
| 2 | Replace `AuthContext.tsx` session state with explicit initialising/loading/ready/error states and `getSession`/`onAuthStateChange`, while retaining a development fallback behind a dev-only boundary. | High | No login page, route tree, DataContext, or database migration. |
| 3 | Update `ProtectedRoute.tsx` to use the explicit auth gate and async loading state. | High | No role resolution, RLS, or dashboard components. |
| 4 | Update `RoleRoute.tsx` to validate active memberships rather than a single local role. | High | No top-bar switcher or data CRUD. |
| 5 | Update `Login.tsx` for password sign-in, confirmation-required errors, profile-loading feedback, and safe redirects. | High | No invitation creation/acceptance and no production configuration changes. |
| 6 | Replace `Signup.tsx` with invitation acceptance and confirmation handoff. | High | No public self-registration, school approval workflow, or migrations. |
| 7 | Add role resolution and the validated active-role state, then update `dashboard/Topbar.tsx` with the switcher only for multi-role users. | High | No permission grants; no RLS policy is delegated to UI state. |
| 8 | Add invitation service/UI behavior, including hashed single-use token handling, expiry, revocation, and existing-account acceptance. | High | No password storage, token plaintext storage, or bootstrap script. |
| 9 | Retire localStorage auth reads/writes and keep only an explicitly documented cleanup/fixture path for the prototype. | Medium | No migration of credentials or mock data into production. |
| 10 | Gate and then remove demo credentials/buttons from production build paths; run the production-asset verification described in §8. | Medium | No Supabase dashboard changes and no RLS changes. |
| 11 | Perform manual dashboard bootstrap and configured-environment verification. | Medium | No committed bootstrap script, migration, or repository-side admin creation. |
| 12 | Handoff the verified identity contract to Phase 7 for RLS and grant hardening. | Low for Phase 4 | No Phase 7 policies or grant changes in Phase 4. |

After each high-risk change, the development prototype must still start, public pages
must render, demo mode must work when intentionally enabled, and unauthenticated
protected routes must resolve to the login/loading/error state appropriate to the
current phase.

## §13. Open questions

The following decisions are not resolved by the approved schema or the decisions in
this document:

1. Should an invitation whose email already belongs to a user with a non-null
   `profiles.school_id` be rejected permanently, or may the one-school assignment
   be transferred by an operator?
2. May `invitations.role = 'admin'` ever be used for a school admin, or must all
   school-admin creation remain the manual approval procedure in §6?
3. What exact expiry duration applies to invitations, confirmation links, reset
   links, and idle sessions?
4. Which exact staging and development origins are allowed in Supabase redirect
   URLs, and what is the canonical production domain?
5. Should a closed school's live session be immediately signed out, or show a
   read-blocked explanatory screen until the operator intervenes?
6. What is the final deterministic default ordering when a multi-role user has no
   previously selected active role?
7. Which platform-admin UI routes exist in Phase 4, and how should they be
   distinguished from school-admin `/app/admin` routes?
8. What email provider, sender identity, templates, rate limits, and support address
   will be approved for production?
9. What is the approved audit event vocabulary for sign-in, invitation creation,
   acceptance, revocation, membership suspension, and platform-admin revocation?
