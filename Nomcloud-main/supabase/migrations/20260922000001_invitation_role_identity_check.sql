-- =============================================================================
-- CORRECTIVE — invitation_role_identity_check
-- Nom Cloud
--
-- Closes the gap the production audit named: `memberships` has
-- memberships_role_identity_check, which requires a teacher membership to carry
-- teacher_id and a guardian membership to carry guardian_id, while `invitations`
-- had no equivalent rule.
--
-- WHAT THAT COST. accept_invitation copies teacher_id and guardian_id from the
-- invitation row into the membership it creates. An invitation with role
-- 'teacher' and no teacher_id was therefore accepted by the database when it was
-- WRITTEN, and failed only when the invited person tried to redeem it — at which
-- point the membership insert hit memberships_role_identity_check and the person
-- saw a raw 23514 instead of an account. The invitation is the earliest place the
-- mistake can be caught, so it is caught here.
--
-- The CHECK is the membership rule, restated for this table, and nothing else:
-- same three branches, same columns, same role list. No policy, grant, trigger or
-- function is touched, and no existing row is affected (there are no invitations).
-- =============================================================================

alter table public.invitations
  add constraint invitations_role_identity_check
  check (
    (role = 'teacher'::user_role and teacher_id is not null and guardian_id is null)
    or (role = 'guardian'::user_role and guardian_id is not null and teacher_id is null)
    or (
      role = any (array['owner'::user_role, 'director'::user_role, 'administrator'::user_role, 'principal'::user_role])
      and teacher_id is null
      and guardian_id is null
    )
  );

comment on constraint invitations_role_identity_check on public.invitations is
  'An invitation names the same identity its membership will need: a teacher invitation carries teacher_id, a guardian invitation carries guardian_id, and the four organisational roles carry neither. Mirrors memberships_role_identity_check so accept_invitation can never fail on the membership insert.';
