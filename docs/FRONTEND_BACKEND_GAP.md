# Frontend and Supabase integration status

This snapshot describes the current frontend wiring to the existing Supabase
schema. It does not propose schema changes or imply that unsupported actions
persist.

## Connected workflows

- Authentication reads Supabase sessions, active memberships, profiles and the
  unrevoked `platform_admins` row. Existing Administrator, Teacher, Parent /
  Guardian and Operator routes use those records for access and destination
  selection.
- Parent and Teacher workspace routes for dashboard data, classes, attendance,
  grades, homework, announcements, messages, notifications and timetable use
  existing service/query paths where those schemas and RLS policies exist.
- Administrator student and guardian records use scoped Supabase services.
  Student bulk import uses the existing validated importer and writes to the
  database; it no longer adds local-only student or guardian records.
- Administrator timetable reads and writes use `timetable_slots`, assigned
  classes, subjects and teachers with the existing class-management policies.
- Operator school directory reads schools, current subscriptions, administrator
  profiles, student/teacher counts and recent audit events. School suspension
  and reactivation updates the existing school row.
- Operator audit views read the append-only `audit_logs` table. The UI does not
  try to insert, update or delete audit rows from the browser.
- School registration review reads the complete existing
  `school_applications` record. Approval continues through the
  `approve-school-application` Edge Function.
- Operator directory reads the existing platform-admin grants. The contact
  inbox reads `contact_messages`; marking an enquiry handled updates its
  existing status and handler fields.
- Sign-out waits for Supabase Auth sign-out and reports failures rather than
  clearing the UI session as though the operation succeeded.

## Remaining backend boundaries

- The V1 membership schema has no student role, so there is no student login or
  student workspace to route to.
- `audit_logs` is append-only and has no client insert policy. Operator actions
  must not fabricate successful audit entries; trusted server-side audit
  writing is needed for actions that require audit attribution.
- The schema has no operator role tiers/permission matrix beyond active
  platform-admin grants. The role and permission preview must not be treated as
  enforceable account-level permissions.
- No backend model currently exists for maintenance state, service health,
  feature flags, operator notes, or several other operator settings. Those
  controls remain preview-only.
- The database does not currently provide a school-scoped generic request
  entity. Public contact enquiries are connected to the contact inbox; school
  registration applications are reviewed separately through the approval
  flow.
- Profile/settings screens may include frontend-only controls where no existing
  account or security endpoint supports persistence.

## Local verification

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the
repository-root `.env` file. Do not commit `.env` or put service-role credentials
in browser code. Use real, authorized test accounts to verify authenticated
routes; the repository does not define shared demo credentials.
