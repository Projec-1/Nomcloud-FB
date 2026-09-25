-- =============================================================================
-- PAYMENT INTEGRATION 3 of 3 — apply_payment_event
-- Nom Cloud
--
-- The transactional core of provider payments, per
-- docs/PAYMENT_EDGE_FUNCTION_PLAN.md section 1. Depends on 20260915000002
-- (payment_events) and 20260915000001 (fee_payments UNIQUE (school_id, id)).
--
-- WHY A DATABASE FUNCTION. supabase-js cannot run several statements in one
-- transaction, and recording a provider message must be all-or-nothing: an
-- approved event and the fee_payments row it creates either both exist or
-- neither does. This mirrors approve-school-application, which does its atomic
-- work through the approve_school_application database function.
--
-- WHAT IT DOES, IN ONE TRANSACTION
--
--   1. Mock gate. When p_is_mock is true, refuse (42501) unless the school has
--      schools.is_demo = true. The Edge Functions already enforce this; the
--      check is repeated here so the rule holds even if a future caller forgets
--      it. Mock money can never reach a real school.
--   2. Insert the event with ON CONFLICT (provider, provider_event_id, event_type)
--      DO NOTHING. If nothing was inserted this exact message was already
--      recorded: return outcome 'duplicate' and change nothing.
--   3. For a newly inserted 'approved' event only: insert one fee_payments row
--      (external_ref = provider_event_id) and mark the event 'applied' with its
--      fee_payment_id and processed_at.
--      If the insert is refused because it would take amount_paid above amount,
--      or because the payment reference already exists, mark the event
--      'rejected'. The inner block's rollback removes the attempted payment row
--      and anything its trigger did, so no payment is left behind.
--   4. Any other newly inserted event (pending, declined, cancelled) is marked
--      'ignored'.
--
-- ERRORS THAT ARE NOT CAUGHT, ON PURPOSE. Only the overpayment CHECK and the
-- reference collision are turned into 'rejected'. Anything else — a bad fee id,
-- a currency the fee does not use, an unexpected constraint — re-raises and
-- rolls back the WHOLE call, event row included. Recording the event as
-- rejected would burn its idempotency key, so a message that failed for a
-- transient or programming reason could never be applied on retry.
--
-- =============================================================================
-- DECISION 2: PARTIAL PAYMENTS NEED NO NEW CONSTRAINT
-- =============================================================================
-- Two existing Phase 3 constraints already express exactly "any amount up to
-- the remaining balance":
--
--   fee_payments_amount_check              amount > 0
--   fee_records_amount_paid_not_over_check amount_paid <= amount
--
-- Nothing anywhere requires a payment to equal the balance. A partial payment
-- is simply a positive fee_payments row whose sum stays within the fee. The
-- ceiling is enforced when the trigger writes the new total, so two payments
-- started concurrently against the same balance cannot both land: the second
-- is refused here and its event is marked 'rejected'.
--
-- =============================================================================
-- METHOD MAPPING
-- =============================================================================
-- payment_events.payment_method uses the four channels WaafiPay distinguishes
-- (decision 4): mobile_money, card, ussd, bank_agent. fee_payments.method is
-- the older Phase 3 vocabulary and has no 'ussd' or 'bank_agent'. Rather than
-- widen fee_payments (outside this task's scope), the payment row records the
-- nearest existing method and payment_events keeps the exact channel:
--
--   mobile_money -> mobile_money     ussd       -> mobile_money
--   card         -> card             bank_agent -> bank_transfer
--
-- USSD in Somalia is the dial-code route into the same mobile wallets, and a
-- bank agent deposit is a bank transfer from the school's point of view.
--
-- =============================================================================
-- THE amount_paid GUARD IS NOT TOUCHED
-- =============================================================================
-- This function never writes fee_records. Its only finance write is one INSERT
-- into fee_payments; the existing fee_payments_sync_amount_paid trigger then
-- recalculates the balance exactly as it does for a cash payment. Migration 13
-- and the H.13 corrective are unchanged.
--
-- Because this function is SECURITY DEFINER it bypasses the column grants that
-- stop clients writing amount_paid. The guard on this path is therefore that
-- the function contains no such write, enforced by review and by the grep check
-- recorded in docs/PAYMENT_EDGE_FUNCTION_PLAN.md.
--
-- =============================================================================
-- ACCESS
-- =============================================================================
-- service_role only. Supabase's default privileges grant EXECUTE on every new
-- public function to anon and authenticated, and REVOKE ... FROM PUBLIC does not
-- remove those explicit grants, so both are revoked by name. A signed-in parent
-- or administrator cannot call this directly; only the Edge Functions can.
-- =============================================================================


create function public.apply_payment_event(
  p_school_id          uuid,
  p_provider           text,
  p_provider_event_id  text,
  p_payment_method     text,
  p_event_type         text,
  p_amount             numeric,
  p_currency           char(3),
  p_fee_record_id      uuid,
  p_raw_payload        jsonb,
  p_is_mock            boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id        uuid;
  v_payment_id      uuid;
  v_fee_currency    char(3);
  v_timezone        text;
  v_is_demo         boolean;
  v_fee_method      text;
  v_constraint      text;
  v_existing        record;
begin
  -- 1. Mock gate. A hard rule, repeated from the Edge Functions on purpose.
  select s.is_demo, s.timezone
    into v_is_demo, v_timezone
    from public.schools s
   where s.id = p_school_id;

  if not found then
    raise exception 'School not found' using errcode = '23503';
  end if;

  if p_is_mock and v_is_demo is distinct from true then
    raise exception 'Mock payments are only permitted for the demo school'
      using errcode = '42501';
  end if;

  -- The event must belong to a real fee of the same school, in its currency.
  -- The composite foreign key would also refuse a cross-school fee; checking
  -- here produces a clear message and keeps a mismatched currency from ever
  -- becoming money.
  select fr.currency
    into v_fee_currency
    from public.fee_records fr
   where fr.school_id = p_school_id
     and fr.id = p_fee_record_id;

  if not found then
    raise exception 'Fee record not found in this school' using errcode = '23503';
  end if;

  if v_fee_currency <> p_currency then
    raise exception 'Payment currency % does not match fee currency %', p_currency, v_fee_currency
      using errcode = '22023';
  end if;

  -- 2. Idempotent insert.
  insert into public.payment_events (
    school_id, provider, provider_event_id, payment_method, event_type,
    amount, currency, fee_record_id, raw_payload
  )
  values (
    p_school_id, p_provider, p_provider_event_id, p_payment_method, p_event_type,
    p_amount, p_currency, p_fee_record_id, coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id, event_type) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select pe.id, pe.processing_status, pe.fee_payment_id
      into v_existing
      from public.payment_events pe
     where pe.provider = p_provider
       and pe.provider_event_id = p_provider_event_id
       and pe.event_type = p_event_type;

    return jsonb_build_object(
      'outcome', 'duplicate',
      'event_id', v_existing.id,
      'processing_status', v_existing.processing_status,
      'fee_payment_id', v_existing.fee_payment_id
    );
  end if;

  -- 4. Anything that is not an approval records the message and stops.
  if p_event_type <> 'approved' then
    update public.payment_events
       set processing_status = 'ignored',
           processed_at = now()
     where id = v_event_id;

    return jsonb_build_object(
      'outcome', 'ignored',
      'event_id', v_event_id,
      'processing_status', 'ignored',
      'fee_payment_id', null
    );
  end if;

  -- 3. An approval becomes exactly one payment row.
  v_fee_method := case p_payment_method
    when 'mobile_money' then 'mobile_money'
    when 'ussd'         then 'mobile_money'
    when 'card'         then 'card'
    when 'bank_agent'   then 'bank_transfer'
  end;

  begin
    insert into public.fee_payments (
      school_id, fee_record_id, amount, currency, method,
      reference, paid_on, external_ref, recorded_by
    )
    values (
      p_school_id, p_fee_record_id, p_amount, p_currency, v_fee_method,
      p_provider || '-' || p_provider_event_id,
      (now() at time zone coalesce(v_timezone, 'Africa/Mogadishu'))::date,
      p_provider_event_id,
      null
    )
    returning id into v_payment_id;

    update public.payment_events
       set processing_status = 'applied',
           fee_payment_id = v_payment_id,
           processed_at = now()
     where id = v_event_id;

    return jsonb_build_object(
      'outcome', 'applied',
      'event_id', v_event_id,
      'processing_status', 'applied',
      'fee_payment_id', v_payment_id
    );
  exception
    when check_violation or unique_violation then
      get stacked diagnostics v_constraint = constraint_name;

      if v_constraint not in (
        'fee_records_amount_paid_not_over_check',
        'fee_payments_school_id_reference_key'
      ) then
        raise;
      end if;

      -- The block's implicit savepoint has already removed the attempted
      -- payment row and the trigger's balance change. Only the event remains.
      update public.payment_events
         set processing_status = 'rejected',
             processed_at = now()
       where id = v_event_id;

      return jsonb_build_object(
        'outcome', 'rejected',
        'event_id', v_event_id,
        'processing_status', 'rejected',
        'fee_payment_id', null,
        'reason', case v_constraint
          when 'fee_records_amount_paid_not_over_check' then 'exceeds_balance'
          else 'duplicate_reference'
        end
      );
  end;
end;
$$;

comment on function public.apply_payment_event(uuid, text, text, text, text, numeric, char, uuid, jsonb, boolean) is
  'Records one payment-provider message and, for a new approval, creates exactly one fee_payments row in the same transaction. Idempotent on (provider, provider_event_id, event_type). Never writes fee_records.amount_paid; the fee_payments trigger does. Mock calls are refused outside the demo school. Callable by service_role only.';

revoke all on function public.apply_payment_event(uuid, text, text, text, text, numeric, char, uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_payment_event(uuid, text, text, text, text, numeric, char, uuid, jsonb, boolean)
  to service_role;
