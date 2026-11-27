-- PostgreSQL RLS & two-member security verification script.
-- Run inside a transaction against a live Supabase Postgres instance after applying migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_security_verification.sql
-- Everything runs inside BEGIN ... ROLLBACK so no test rows persist.
-- Role transitions (SET LOCAL ROLE / RESET ROLE) occur strictly at top level between DO blocks.

BEGIN;

-- ---------------------------------------------------------------------------
-- Block 1 (owner role): Seed mock users and verify initial setup
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user_a uuid := '11111111-1111-4111-8111-111111111111';
  v_user_b uuid := '22222222-2222-4222-8222-222222222222';
  v_user_c uuid := '33333333-3333-4333-8333-333333333333';
  v_user_d uuid := '44444444-4444-4444-8444-444444444444';
  v_count integer;
  v_bucket_public boolean;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_a@example.test', '{"preferred_language":"en"}', now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_b@example.test', '{"preferred_language":"zh-CN"}', now(), now()),
    (v_user_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_c@example.test', '{"preferred_language":"en"}', now(), now()),
    (v_user_d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_d@example.test', '{"preferred_language":"en"}', now(), now());

  SELECT COUNT(*) INTO v_count
  FROM public.profiles
  WHERE id IN (v_user_a, v_user_b, v_user_c, v_user_d);
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Expected on_auth_user_created to create 4 profiles, saw %', v_count;
  END IF;

  SELECT public INTO v_bucket_public
  FROM storage.buckets
  WHERE id = 'couple-photos';
  IF v_bucket_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expected couple-photos bucket to exist with public = false, got %', v_bucket_public;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Block 2 (authenticated role): Couple linking, RLS isolation, direct-write
-- bypass prevention, and full Storage CRUD checks
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_user_a uuid := '11111111-1111-4111-8111-111111111111';
  v_user_b uuid := '22222222-2222-4222-8222-222222222222';
  v_user_c uuid := '33333333-3333-4333-8333-333333333333';
  v_user_d uuid := '44444444-4444-4444-8444-444444444444';
  v_couple_1 uuid;
  v_couple_2 uuid;
  v_invite_id uuid;
  v_token text;
  v_joined_couple uuid;
  v_count integer;
  v_row_count integer;
  v_photo_path text;
BEGIN
  -- Ensure legacy parameterized public helpers are not present in public schema.
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('is_couple_member', 'shares_couple_with');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected no legacy public membership helpers, found %', v_count;
  END IF;

  -- Verify User A cannot bypass RPCs with direct writes on any table.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

  BEGIN
    INSERT INTO public.couples (title, created_by) VALUES ('Bypass', v_user_a);
    RAISE EXCEPTION 'Expected direct INSERT into couples to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (id) VALUES (gen_random_uuid());
    RAISE EXCEPTION 'Expected direct INSERT into profiles to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.profiles WHERE id = v_user_a;
    RAISE EXCEPTION 'Expected direct DELETE on profiles to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- User A creates couple_1 (slot 1 creator).
  v_couple_1 := public.create_couple_space('Starlight Home');
  IF v_couple_1 IS NULL THEN
    RAISE EXCEPTION 'Expected couple_1 UUID from create_couple_space';
  END IF;
  PERFORM set_config('our_universe_test.couple_1', v_couple_1::text, true);

  IF private.current_user_couple_id() IS DISTINCT FROM v_couple_1 THEN
    RAISE EXCEPTION 'Expected private.current_user_couple_id() = % for User A', v_couple_1;
  END IF;

  -- Direct DELETE on couples must fail.
  BEGIN
    DELETE FROM public.couples WHERE id = v_couple_1;
    RAISE EXCEPTION 'Expected direct DELETE on couples to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Self-acceptance is blocked.
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

  -- Revoking an invitation blocks later acceptance.
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

  -- User A issues a fresh invite; User B accepts (slot 2 partner).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  SELECT ci.invitation_id, ci.invite_token
  INTO v_invite_id, v_token
  FROM public.create_couple_invitation(24) ci;

  -- Direct column read of token_hash and direct writes on couple_invitations must fail.
  BEGIN
    PERFORM token_hash FROM public.couple_invitations LIMIT 1;
    RAISE EXCEPTION 'Expected SELECT token_hash on couple_invitations to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.couple_invitations SET status = 'revoked' WHERE id = v_invite_id;
    RAISE EXCEPTION 'Expected direct UPDATE on couple_invitations to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  v_joined_couple := public.accept_couple_invitation(v_token);
  IF v_joined_couple <> v_couple_1 THEN
    RAISE EXCEPTION 'Expected User B to join couple %', v_couple_1;
  END IF;

  IF private.current_user_couple_id() IS DISTINCT FROM v_couple_1 THEN
    RAISE EXCEPTION 'Expected private.current_user_couple_id() = % for User B', v_couple_1;
  END IF;

  -- User A and User B see each other's profiles and both couple_members rows.
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id IN (v_user_a, v_user_b);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected User B to see 2 couple profiles, saw %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.couple_members WHERE couple_id = v_couple_1;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 couple members, saw %', v_count;
  END IF;

  -- User A cannot issue another invitation once the couple has 2 members.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM * FROM public.create_couple_invitation(24);
    RAISE EXCEPTION 'Expected create_couple_invitation on full couple to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'couple_already_full' THEN
      RAISE;
    END IF;
  END;

  -- User B cannot directly UPDATE or DELETE their own couple_members row.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE public.couple_members SET member_slot = 1 WHERE user_id = v_user_b;
    RAISE EXCEPTION 'Expected direct UPDATE on couple_members to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.couple_members WHERE user_id = v_user_b;
    RAISE EXCEPTION 'Expected direct DELETE on couple_members to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- User C (uncoupled outsider) cannot read couple_1 data, update it, or reuse the accepted invite.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_c, 'role', 'authenticated')::text, true);

  IF private.current_user_couple_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Expected private.current_user_couple_id() IS NULL for User C';
  END IF;

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
    RAISE EXCEPTION 'Leakage: User C read % couple profiles', v_count;
  END IF;

  UPDATE public.couples SET title = 'Hijacked' WHERE id = v_couple_1;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C updated % rows in couples', v_row_count;
  END IF;

  BEGIN
    PERFORM public.accept_couple_invitation(v_token);
    RAISE EXCEPTION 'Expected accepted invitation reuse to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'invitation_not_usable' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.revoke_couple_invitation(v_invite_id);
    RAISE EXCEPTION 'Expected outsider revoke_couple_invitation to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'not_authorized' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO public.couple_members (couple_id, user_id, member_slot, role)
    VALUES (v_couple_1, v_user_c, 2, 'partner');
    RAISE EXCEPTION 'Expected direct INSERT into couple_members to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- User D creates separate couple_2 and cannot read couple_1 data.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_d, 'role', 'authenticated')::text, true);
  v_couple_2 := public.create_couple_space('Second Space');
  PERFORM set_config('our_universe_test.couple_2', v_couple_2::text, true);

  SELECT COUNT(*) INTO v_count FROM public.couples WHERE id = v_couple_1;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-couple leakage: User D read couple_1';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id IN (v_user_a, v_user_b);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-couple leakage: User D read User A/B profiles';
  END IF;

  -- Storage RLS verification on couple-photos bucket (INSERT, SELECT, UPDATE, DELETE).
  v_photo_path := v_couple_1::text || '/sunset.jpg';

  -- Member User A uploads a photo into couple_1 folder; path traversal is rejected.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES ('couple-photos', v_photo_path, v_user_a, '{"mimetype":"image/jpeg"}'::jsonb);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('couple-photos', v_couple_1::text || '/../escape.jpg', v_user_a, '{"mimetype":"image/jpeg"}'::jsonb);
    RAISE EXCEPTION 'Expected path traversal upload to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Member User B reads and updates couple_1 photo.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected partner User B to read couple-photos object, saw %', v_count;
  END IF;

  UPDATE storage.objects
  SET metadata = '{"mimetype":"image/jpeg","caption":"updated"}'::jsonb
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'Expected partner User B to update 1 couple-photos object, updated %', v_row_count;
  END IF;

  -- Uncoupled outsider User C cannot INSERT, SELECT, UPDATE, or DELETE couple_1 photos.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_c, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('couple-photos', v_couple_1::text || '/intruder.jpg', v_user_c, '{"mimetype":"image/jpeg"}'::jsonb);
    RAISE EXCEPTION 'Expected User C storage INSERT into couple_1 to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C read % couple_1 photos', v_count;
  END IF;

  UPDATE storage.objects
  SET metadata = '{"hacked":true}'::jsonb
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C updated % couple_1 photos', v_row_count;
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'Leakage: User C deleted % couple_1 photos', v_row_count;
  END IF;

  -- Cross-couple user User D cannot INSERT, SELECT, UPDATE, or DELETE couple_1 photos.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_d, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('couple-photos', v_couple_1::text || '/cross-couple.jpg', v_user_d, '{"mimetype":"image/jpeg"}'::jsonb);
    RAISE EXCEPTION 'Expected User D storage INSERT into couple_1 to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-couple leakage: User D read % couple_1 photos', v_count;
  END IF;

  UPDATE storage.objects
  SET metadata = '{"hacked":true}'::jsonb
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'Cross-couple leakage: User D updated % couple_1 photos', v_row_count;
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'Cross-couple leakage: User D deleted % couple_1 photos', v_row_count;
  END IF;

  -- Partner User B can delete couple_1 photo.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  DELETE FROM storage.objects
  WHERE bucket_id = 'couple-photos' AND name = v_photo_path;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'Expected partner User B to delete 1 couple-photos object, deleted %', v_row_count;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Block 3 (owner role): Verify DB-level 2-member cap & seed expired invite
-- ---------------------------------------------------------------------------
RESET ROLE;

DO $$
DECLARE
  v_user_c uuid := '33333333-3333-4333-8333-333333333333';
  v_user_d uuid := '44444444-4444-4444-8444-444444444444';
  v_couple_1 uuid := current_setting('our_universe_test.couple_1')::uuid;
  v_couple_2 uuid := current_setting('our_universe_test.couple_2')::uuid;
  v_expired_token text := 'expired-test-token-value-only';
BEGIN
  -- Even as table owner, inserting a 3rd member into full couple_1 fails in trigger/constraints.
  BEGIN
    INSERT INTO public.couple_members (couple_id, user_id, member_slot, role)
    VALUES (v_couple_1, v_user_c, 2, 'partner');
    RAISE EXCEPTION 'Expected couple_members_enforce_max_two trigger to block 3rd member';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'couple_full' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO public.couple_members (couple_id, user_id, member_slot, role)
    VALUES (v_couple_2, v_user_c, 3, 'partner');
    RAISE EXCEPTION 'Expected member_slot CHECK constraint to block slot 3';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Seed an expired pending invitation for 1-member couple_2.
  INSERT INTO public.couple_invitations (couple_id, invited_by, token_hash, status, expires_at, created_at)
  VALUES (
    v_couple_2,
    v_user_d,
    encode(extensions.digest(convert_to(v_expired_token, 'UTF8'), 'sha256'), 'hex'),
    'pending',
    now() - interval '1 minute',
    now() - interval '2 hours'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Block 4 (authenticated role): Verify expired invitation rejection
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_user_c uuid := '33333333-3333-4333-8333-333333333333';
  v_expired_token text := 'expired-test-token-value-only';
BEGIN
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

RESET ROLE;

ROLLBACK;
