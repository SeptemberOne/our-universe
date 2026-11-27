-- PostgreSQL RLS & two-member security verification script.
-- Run inside a transaction against a Supabase Postgres instance after applying migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_security_verification.sql
-- Everything runs inside BEGIN ... ROLLBACK so no test rows persist.

BEGIN;

DO $$
DECLARE
  v_user_a uuid := '11111111-1111-4111-8111-111111111111';
  v_user_b uuid := '22222222-2222-4222-8222-222222222222';
  v_user_c uuid := '33333333-3333-4333-8333-333333333333';
  v_couple_id uuid;
  v_invite_id uuid;
  v_token text;
  v_expired_token text := 'expired-test-token-value-only';
  v_count integer;
  v_joined_couple uuid;
BEGIN
  -- 1. Seed three test auth.users (profile rows auto-created via on_auth_user_created trigger).
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_a@example.test', '{"preferred_language":"en"}', now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_b@example.test', '{"preferred_language":"zh-CN"}', now(), now()),
    (v_user_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_c@example.test', '{"preferred_language":"en"}', now(), now());

  -- Switch to authenticated role for RLS enforcement.
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- 2. User A creates a couple space (slot 1 creator).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  v_couple_id := public.create_couple_space('Starlight Home');
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Expected couple_id from create_couple_space';
  END IF;

  -- Verify self-acceptance is blocked.
  SELECT ci.invitation_id, ci.invite_token
  INTO v_invite_id, v_token
  FROM public.create_couple_invitation(24) ci;

  BEGIN
    PERFORM public.accept_couple_invitation(v_token);
    RAISE EXCEPTION 'Expected self-acceptance to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'cannot_accept_own_invitation' THEN
      RAISE;
    END IF;
  END;

  -- Verify revocation blocks acceptance.
  IF NOT public.revoke_couple_invitation(v_invite_id) THEN
    RAISE EXCEPTION 'Expected revoke_couple_invitation to return true';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.accept_couple_invitation(v_token);
    RAISE EXCEPTION 'Expected revoked invitation to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'invitation_not_usable' THEN
      RAISE;
    END IF;
  END;

  -- 3. User A creates a fresh invitation; User B accepts (slot 2 partner).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  SELECT ci.invitation_id, ci.invite_token
  INTO v_invite_id, v_token
  FROM public.create_couple_invitation(24) ci;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  v_joined_couple := public.accept_couple_invitation(v_token);
  IF v_joined_couple <> v_couple_id THEN
    RAISE EXCEPTION 'Expected User B to join couple %', v_couple_id;
  END IF;

  -- Verify User A and User B see each other's profiles and both membership rows.
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id IN (v_user_a, v_user_b);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected User B to see 2 couple profiles, saw %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.couple_members WHERE couple_id = v_couple_id;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 couple members, saw %', v_count;
  END IF;

  -- 4. Verify User C (unrelated authenticated user) cannot read couple data or reuse invite.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_c, 'role', 'authenticated')::text, true);

  SELECT COUNT(*) INTO v_count FROM public.couples;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C read % rows from couples', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.couple_members;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C read % rows from couple_members', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.couple_invitations;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C read % rows from couple_invitations', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id IN (v_user_a, v_user_b);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C read % private profiles', v_count;
  END IF;

  -- Reuse of accepted token must fail.
  BEGIN
    PERFORM public.accept_couple_invitation(v_token);
    RAISE EXCEPTION 'Expected accepted invitation reuse to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'invitation_not_usable' THEN
      RAISE;
    END IF;
  END;

  -- Direct INSERT/UPDATE/DELETE on couple_members must fail.
  BEGIN
    INSERT INTO public.couple_members (couple_id, user_id, member_slot, role)
    VALUES (v_couple_id, v_user_c, 2, 'partner');
    RAISE EXCEPTION 'Expected direct INSERT into couple_members to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- 5. Verify User A cannot issue a new invite once the couple already has 2 members.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM * FROM public.create_couple_invitation(24);
    RAISE EXCEPTION 'Expected create_couple_invitation on full couple to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'couple_already_full' THEN
      RAISE;
    END IF;
  END;

  -- Verify User B cannot arbitrarily UPDATE or DELETE couple_members.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  BEGIN
    DELETE FROM public.couple_members WHERE user_id = v_user_b;
    RAISE EXCEPTION 'Expected direct DELETE on couple_members to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- 6. Verify Storage RLS isolation on couple-photos bucket.
  EXECUTE 'RESET ROLE';
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES (
    'couple-photos',
    v_couple_id::text || '/sample-test.jpg',
    v_user_a,
    '{"mimetype":"image/jpeg"}'::jsonb
  );

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- User B (member) can read the couple photo object.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'couple-photos'
    AND name = v_couple_id::text || '/sample-test.jpg';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected partner User B to read couple-photos object, saw %', v_count;
  END IF;

  -- User C (outsider) cannot read or insert into User A/B couple-photos folder.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_c, 'role', 'authenticated')::text, true);
  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'couple-photos'
    AND name = v_couple_id::text || '/sample-test.jpg';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C read % objects from couple-photos', v_count;
  END IF;

  -- Verify expired invitation rejection for User C (using a fresh uncoupled couple).
  EXECUTE 'RESET ROLE';
  DELETE FROM public.couple_members WHERE couple_id = v_couple_id AND user_id = v_user_b;
  INSERT INTO public.couple_invitations (id, couple_id, invited_by, token_hash, status, expires_at, created_at)
  VALUES (
    gen_random_uuid(),
    v_couple_id,
    v_user_a,
    encode(extensions.digest(convert_to(v_expired_token, 'UTF8'), 'sha256'), 'hex'),
    'pending',
    now() - interval '1 minute',
    now() - interval '2 hours'
  )
  ON CONFLICT DO NOTHING;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_c, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.accept_couple_invitation(v_expired_token);
    RAISE EXCEPTION 'Expected expired invitation to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'invitation_expired' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'ALL RLS & TWO-MEMBER SECURITY CHECKS PASSED';
END;
$$;

ROLLBACK;
