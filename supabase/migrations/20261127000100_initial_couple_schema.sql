-- Phase 2 — Step 1: Initial couple schema, two-member enforcement, invitations, and RLS.
-- No personal photographs or application credentials are stored in migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Timestamp & profile bootstrap triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text CHECK (display_name IS NULL OR char_length(btrim(display_name)) <= 80),
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'zh-CN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lang text;
BEGIN
  v_lang := CASE
    WHEN NEW.raw_user_meta_data ->> 'preferred_language' = 'zh-CN' THEN 'zh-CN'
    ELSE 'en'
  END;

  INSERT INTO public.profiles (id, preferred_language)
  VALUES (NEW.id, v_lang)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Couples & memberships (strictly limited to 2 members per couple)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Our Universe' CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS couples_set_updated_at ON public.couples;
CREATE TRIGGER couples_set_updated_at
  BEFORE UPDATE ON public.couples
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.couple_members (
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_slot smallint NOT NULL CHECK (member_slot IN (1, 2)),
  role text NOT NULL CHECK (role IN ('creator', 'partner')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, user_id),
  CONSTRAINT couple_members_unique_slot UNIQUE (couple_id, member_slot),
  CONSTRAINT couple_members_one_couple_per_user UNIQUE (user_id),
  CONSTRAINT couple_members_slot_role_match CHECK (
    (member_slot = 1 AND role = 'creator') OR
    (member_slot = 2 AND role = 'partner')
  )
);

-- Defense-in-depth trigger in addition to member_slot IN (1, 2) + UNIQUE (couple_id, member_slot).
CREATE OR REPLACE FUNCTION public.enforce_max_two_couple_members()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_member_count integer;
BEGIN
  PERFORM 1
  FROM public.couples
  WHERE id = NEW.couple_id
  FOR UPDATE;

  SELECT COUNT(*)::integer
  INTO v_member_count
  FROM public.couple_members
  WHERE couple_id = NEW.couple_id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'couple_full' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS couple_members_enforce_max_two ON public.couple_members;
CREATE TRIGGER couple_members_enforce_max_two
  BEFORE INSERT ON public.couple_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_two_couple_members();

-- ---------------------------------------------------------------------------
-- Single-use, expiring, hashed invitations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.couple_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couple_invitations_expiry_window CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '7 days'
  ),
  CONSTRAINT couple_invitations_acceptance_consistency CHECK (
    (status = 'accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL) OR
    (status <> 'accepted' AND accepted_by IS NULL AND accepted_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS couple_invitations_one_pending_per_couple_idx
  ON public.couple_invitations (couple_id)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS membership helpers (SECURITY DEFINER avoids recursive RLS evaluation)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_couple_member(p_couple_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_couple_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.couple_id = p_couple_id
        AND cm.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.shares_couple_with(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_other_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.couple_members me
      JOIN public.couple_members partner
        ON partner.couple_id = me.couple_id
      WHERE me.user_id = auth.uid()
        AND partner.user_id = p_other_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_couple_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_couple_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.shares_couple_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_couple_with(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security & least-privilege table grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (display_name, preferred_language) ON TABLE public.profiles TO authenticated;

REVOKE ALL ON TABLE public.couples FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (title) ON TABLE public.couples TO authenticated;

REVOKE ALL ON TABLE public.couple_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.couple_members TO authenticated;

-- Intentionally omit token_hash from authenticated SELECT grant.
REVOKE ALL ON TABLE public.couple_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  couple_id,
  invited_by,
  status,
  expires_at,
  accepted_by,
  accepted_at,
  revoked_at,
  created_at
) ON TABLE public.couple_invitations TO authenticated;

DROP POLICY IF EXISTS profiles_select_self_or_partner ON public.profiles;
CREATE POLICY profiles_select_self_or_partner
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.shares_couple_with(id));

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS couples_select_member ON public.couples;
CREATE POLICY couples_select_member
  ON public.couples
  FOR SELECT
  TO authenticated
  USING (public.is_couple_member(id));

DROP POLICY IF EXISTS couples_update_member ON public.couples;
CREATE POLICY couples_update_member
  ON public.couples
  FOR UPDATE
  TO authenticated
  USING (public.is_couple_member(id))
  WITH CHECK (public.is_couple_member(id));

DROP POLICY IF EXISTS couple_members_select_member ON public.couple_members;
CREATE POLICY couple_members_select_member
  ON public.couple_members
  FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS couple_invitations_select_member ON public.couple_invitations;
CREATE POLICY couple_invitations_select_member
  ON public.couple_invitations
  FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Audited SECURITY DEFINER RPCs for couple creation & invitation lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_couple_space(p_title text DEFAULT 'Our Universe')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_clean_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.couple_members cm
    WHERE cm.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'already_in_couple' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (v_user_id)
  ON CONFLICT (id) DO NOTHING;

  v_clean_title := COALESCE(NULLIF(btrim(p_title), ''), 'Our Universe');
  IF char_length(v_clean_title) > 80 THEN
    RAISE EXCEPTION 'invalid_couple_title' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.couples (title, created_by)
  VALUES (v_clean_title, v_user_id)
  RETURNING id INTO v_couple_id;

  INSERT INTO public.couple_members (couple_id, user_id, member_slot, role)
  VALUES (v_couple_id, v_user_id, 1, 'creator');

  RETURN v_couple_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_couple_invitation(p_ttl_hours integer DEFAULT 24)
RETURNS TABLE (
  invitation_id uuid,
  invite_token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_member_count integer;
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz;
  v_invitation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_ttl_hours IS NULL OR p_ttl_hours < 1 OR p_ttl_hours > 168 THEN
    RAISE EXCEPTION 'invalid_ttl_hours' USING ERRCODE = '22023';
  END IF;

  SELECT cm.couple_id
  INTO v_couple_id
  FROM public.couple_members cm
  WHERE cm.user_id = v_user_id;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'couple_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize concurrent invitation creation / acceptance for this couple.
  PERFORM 1
  FROM public.couples c
  WHERE c.id = v_couple_id
  FOR UPDATE;

  SELECT COUNT(*)::integer
  INTO v_member_count
  FROM public.couple_members cm
  WHERE cm.couple_id = v_couple_id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'couple_already_full' USING ERRCODE = 'P0001';
  END IF;

  -- Close any prior pending invitation before issuing a replacement.
  UPDATE public.couple_invitations ci
  SET
    status = CASE WHEN ci.expires_at <= now() THEN 'expired' ELSE 'revoked' END,
    revoked_at = CASE WHEN ci.expires_at <= now() THEN ci.revoked_at ELSE now() END
  WHERE ci.couple_id = v_couple_id
    AND ci.status = 'pending';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  v_expires_at := now() + make_interval(hours => p_ttl_hours);

  INSERT INTO public.couple_invitations (
    couple_id,
    invited_by,
    token_hash,
    status,
    expires_at
  )
  VALUES (
    v_couple_id,
    v_user_id,
    v_token_hash,
    'pending',
    v_expires_at
  )
  RETURNING id INTO v_invitation_id;

  invitation_id := v_invitation_id;
  invite_token := v_token;
  expires_at := v_expires_at;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_couple_invitation(p_invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_token text;
  v_token_hash text;
  v_invite public.couple_invitations%ROWTYPE;
  v_member_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_clean_token := btrim(COALESCE(p_invite_token, ''));
  IF v_clean_token = '' THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = 'P0001';
  END IF;

  v_token_hash := encode(extensions.digest(convert_to(v_clean_token, 'UTF8'), 'sha256'), 'hex');

  SELECT *
  INTO v_invite
  FROM public.couple_invitations ci
  WHERE ci.token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation_not_usable' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation_expired' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.invited_by = v_user_id THEN
    RAISE EXCEPTION 'cannot_accept_own_invitation' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the couple row to prevent concurrent third-account race conditions.
  PERFORM 1
  FROM public.couples c
  WHERE c.id = v_invite.couple_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.couple_members cm
    WHERE cm.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'already_in_couple' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_member_count
  FROM public.couple_members cm
  WHERE cm.couple_id = v_invite.couple_id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'couple_already_full' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.couple_members (couple_id, user_id, member_slot, role)
  VALUES (v_invite.couple_id, v_user_id, 2, 'partner');

  UPDATE public.couple_invitations
  SET
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.couple_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_couple_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invite public.couple_invitations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.couple_invitations ci
  WHERE ci.id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT public.is_couple_member(v_invite.couple_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN false;
  END IF;

  UPDATE public.couple_invitations
  SET
    status = 'revoked',
    revoked_at = now()
  WHERE id = v_invite.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_couple_space(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_couple_space(text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_couple_invitation(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_couple_invitation(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_couple_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_couple_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_couple_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_couple_invitation(uuid) TO authenticated;
