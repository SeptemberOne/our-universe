import { getSupabaseClient } from '@/lib/supabase';
import { assembleCoupleSnapshot, mapCoupleRpcErrorToKey } from './coupleLogic';
import type {
  CoupleErrorKey,
  CoupleMemberRecord,
  CoupleSnapshot,
  CoupleSummary,
  GeneratedInvitation,
  PendingInvitationSummary,
  ProfileSummary,
} from './types';

export type CoupleServiceResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly errorKey: CoupleErrorKey };

export async function fetchCoupleSnapshot(
  userId: string,
): Promise<CoupleServiceResult<CoupleSnapshot>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const [membersRes, profilesRes] = await Promise.all([
      client
        .from('couple_members')
        .select('couple_id, user_id, member_slot, role, joined_at')
        .order('member_slot', { ascending: true }),
      client
        .from('profiles')
        .select('id, display_name, preferred_language'),
    ]);

    if (membersRes.error) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(membersRes.error.message) };
    }
    if (profilesRes.error) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(profilesRes.error.message) };
    }

    const profiles: ProfileSummary[] = (profilesRes.data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      preferredLanguage: row.preferred_language,
    }));

    const members: CoupleMemberRecord[] = (membersRes.data ?? []).map((row) => ({
      coupleId: row.couple_id,
      userId: row.user_id,
      memberSlot: row.member_slot,
      role: row.role,
      joinedAt: row.joined_at,
    }));

    const primaryMember = members[0];
    if (!primaryMember) {
      return {
        ok: true,
        data: assembleCoupleSnapshot({
          userId,
          couple: null,
          members: [],
          profiles,
          invitations: [],
        }),
      };
    }

    const [coupleRes, invitationsRes] = await Promise.all([
      client
        .from('couples')
        .select('id, title, created_by, created_at')
        .eq('id', primaryMember.coupleId)
        .maybeSingle(),
      // Explicit column list omits token_hash (never readable by clients).
      client
        .from('couple_invitations')
        .select('id, couple_id, invited_by, status, expires_at, created_at')
        .eq('couple_id', primaryMember.coupleId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (coupleRes.error) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(coupleRes.error.message) };
    }
    if (invitationsRes.error) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(invitationsRes.error.message) };
    }

    const couple: CoupleSummary | null = coupleRes.data
      ? {
          id: coupleRes.data.id,
          title: coupleRes.data.title,
          createdBy: coupleRes.data.created_by,
          createdAt: coupleRes.data.created_at,
        }
      : null;

    const invitations: PendingInvitationSummary[] = (invitationsRes.data ?? []).map((row) => ({
      id: row.id,
      coupleId: row.couple_id,
      invitedBy: row.invited_by,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));

    return {
      ok: true,
      data: assembleCoupleSnapshot({
        userId,
        couple,
        members,
        profiles,
        invitations,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapCoupleRpcErrorToKey(message) };
  }
}

export async function createCoupleSpace(title: string): Promise<CoupleServiceResult<string>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const { data, error } = await client.rpc('create_couple_space', {
      p_title: title,
    });
    if (error || !data) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(error?.message) };
    }
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapCoupleRpcErrorToKey(message) };
  }
}

export async function createCoupleInvitation(
  ttlHours = 24,
): Promise<CoupleServiceResult<GeneratedInvitation>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const { data, error } = await client.rpc('create_couple_invitation', {
      p_ttl_hours: ttlHours,
    });
    const row = data?.[0];
    if (error || !row) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(error?.message) };
    }
    return {
      ok: true,
      data: {
        invitationId: row.invitation_id,
        inviteToken: row.invite_token,
        expiresAt: row.expires_at,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapCoupleRpcErrorToKey(message) };
  }
}

export async function acceptCoupleInvitation(
  inviteToken: string,
): Promise<CoupleServiceResult<string>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const { data, error } = await client.rpc('accept_couple_invitation', {
      p_invite_token: inviteToken,
    });
    if (error || !data) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(error?.message) };
    }
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapCoupleRpcErrorToKey(message) };
  }
}

export async function revokeCoupleInvitation(
  invitationId: string,
): Promise<CoupleServiceResult<boolean>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const { data, error } = await client.rpc('revoke_couple_invitation', {
      p_invitation_id: invitationId,
    });
    if (error) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(error.message) };
    }
    return { ok: true, data: Boolean(data) };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapCoupleRpcErrorToKey(message) };
  }
}

export async function updateOwnDisplayName(
  userId: string,
  displayName: string,
): Promise<CoupleServiceResult<null>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const normalized = displayName.trim();
    const { error } = await client
      .from('profiles')
      .update({ display_name: normalized.length > 0 ? normalized : null })
      .eq('id', userId);
    if (error) {
      return { ok: false, errorKey: mapCoupleRpcErrorToKey(error.message) };
    }
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapCoupleRpcErrorToKey(message) };
  }
}
