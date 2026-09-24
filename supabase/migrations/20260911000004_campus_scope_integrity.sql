-- =============================================================================
-- Campus/role expansion Migration 5 of 8 — campus_scope_integrity
-- Nom Cloud
--
-- Closes docs/CAMPUS_ROLE_DESIGN.md §J open question 6: what happens when a
-- membership declares scope_mode = 'selected' but names no campus.
--
-- Resolution: that state is rejected. "Scoped to specific campuses" naming no
-- campus means the membership can act nowhere, silently. §D already calls an
-- empty join-table set a meaning "that could be mistaken for no access", and a
-- silent nowhere-membership is far more likely a mistake than an intended
-- lockout. An operator who wants to suspend someone has memberships.status for
-- that, which is the explicit and visible way to say it.
--
-- Mechanism: a DEFERRABLE INITIALLY DEFERRED constraint trigger.
--
-- A plain CHECK cannot express "at least one row in another table"; a CHECK
-- sees only its own row. An immediate trigger would fire before any scope row
-- could exist, which breaks the only possible insert order, since scope rows
-- carry a foreign key to the membership they belong to. Deferring to commit
-- makes insert order irrelevant, so Migration 7 (accept_invitation_role_scope)
-- can create a membership and its scope rows in one transaction and be checked
-- once at the end. The cost is that the violation is reported at COMMIT rather
-- than at the offending statement.
--
-- Depends on Migration 3 (memberships.scope_mode, membership_campus_scopes).
-- Does NOT alter the scope_mode role CHECK from Migration 3, which is already
-- correct. Touches no table outside memberships and membership_campus_scopes.
--
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

create function public.assert_selected_scope_names_campus()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_school_id     uuid;
  v_membership_id uuid;
  v_scope_mode    text;
begin
  -- The membership is identified from NEW on memberships and from OLD on the
  -- scope table, because the scope case that can break the rule is removal.
  if tg_table_name = 'memberships' then
    v_school_id     := new.school_id;
    v_membership_id := new.id;
  else
    v_school_id     := old.school_id;
    v_membership_id := old.membership_id;
  end if;

  select m.scope_mode
  into v_scope_mode
  from public.memberships m
  where m.school_id = v_school_id
    and m.id = v_membership_id;

  -- The membership itself was deleted in this transaction, which cascaded its
  -- scope rows. There is nothing left to assert about it.
  if not found then
    return null;
  end if;

  if v_scope_mode is distinct from 'selected' then
    return null;
  end if;

  if not exists (
    select 1
    from public.membership_campus_scopes s
    where s.school_id = v_school_id
      and s.membership_id = v_membership_id
  ) then
    raise exception
      'membership % declares scope_mode ''selected'' but names no campus; add at least one membership_campus_scopes row, or set scope_mode to ''all'', in the same transaction',
      v_membership_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

comment on function public.assert_selected_scope_names_campus() is
  'Constraint-trigger body asserting that a membership with scope_mode = selected names at least one campus. Deferred to commit so a membership and its scope rows can be written together. Security invoker: this reads memberships and membership_campus_scopes as the caller, which is correct while no table has row-level security. Phase 7 must re-evaluate it, because an integrity assertion has to observe the true row set rather than an RLS-filtered view.';

-- Fires when a membership is created or changed into an unscoped selected state.
create constraint trigger memberships_selected_scope_names_campus
  after insert or update on public.memberships
  deferrable initially deferred
  for each row execute function public.assert_selected_scope_names_campus();

-- Fires when the last scope row is removed from, or moved off, a selected
-- membership that still exists.
create constraint trigger membership_campus_scopes_selected_scope_names_campus
  after delete or update on public.membership_campus_scopes
  deferrable initially deferred
  for each row execute function public.assert_selected_scope_names_campus();
