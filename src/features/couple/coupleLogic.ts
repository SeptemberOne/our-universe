import type {
  CoupleErrorKey,
  CoupleMemberRecord,
  CoupleSnapshot,
  CoupleSummary,
  CoupleValidationErrorKey,
  PendingInvitationSummary,
  ProfileSummary,
} from './types';

const MAX_TITLE_LENGTH = 80;
const MAX_DISPLAY_NAME_LENGTH = 80;

export function validateCoupleTitle(
  rawTitle: string,
): { readonly ok: true; readonly title: string } | { readonly ok: false; readonly errorKey: CoupleValidationErrorKey } {
  const trimmed = rawTitle.trim();
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { ok: false, errorKey: 'titleTooLong' };
  }
  return {
    ok: true,
    title: trimmed.length === 0 ? 'Our Universe' : trimmed,
  };
}

export function validateInviteToken(
  rawToken: string,
): { readonly ok: true; readonly token: string } | { readonly ok: false; readonly errorKey: CoupleValidationErrorKey } {
  const trimmed = rawToken.trim();
  if (!trimmed) {
    return { ok: false, errorKey: 'inviteTokenRequired' };
  }
  return { ok: true, token: trimmed };
}

export function validateDisplayName(
  rawName: string,
): { readonly ok: true; readonly displayName: string } | { readonly ok: false; readonly errorKey: CoupleValidationErrorKey } {
  const trimmed = rawName.trim();
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, errorKey: 'displayNameTooLong' };
  }
  return { ok: true, displayName: trimmed };
}

export interface AssembleCoupleSnapshotInput {
  readonly userId: string;
  readonly couple: CoupleSummary | null;
  readonly members: readonly CoupleMemberRecord[];
  readonly profiles: readonly ProfileSummary[];
  readonly invitations: readonly PendingInvitationSummary[];
  readonly nowMs?: number;
}

export function assembleCoupleSnapshot(input: AssembleCoupleSnapshotInput): CoupleSnapshot {
  const profileMap = new Map<string, ProfileSummary>();
  for (const profile of input.profiles) {
    profileMap.set(profile.id, profile);
  }

  const myProfile = profileMap.get(input.userId) ?? null;

  if (!input.couple) {
    return {
      couple: null,
      members: [],
      myProfile,
      activeInvitation: null,
      isCoupleFull: false,
      isCreator: false,
    };
  }

  const members = [...input.members]
    .sort((a, b) => a.memberSlot - b.memberSlot)
    .map((member) => ({
      ...member,
      profile: profileMap.get(member.userId) ?? null,
    }));

  const nowMs = input.nowMs ?? Date.now();
  const activeInvitation =
    input.invitations.find((invitation) => {
      if (invitation.status !== 'pending') {
        return false;
      }
      const expiresAtMs = Date.parse(invitation.expiresAt);
      return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
    }) ?? null;

  const isCoupleFull = members.length >= 2;
  const isCreator = members.some(
    (member) => member.userId === input.userId && member.role === 'creator',
  );

  return {
    couple: input.couple,
    members,
    myProfile,
    activeInvitation,
    isCoupleFull,
    isCreator,
  };
}

export function mapCoupleRpcErrorToKey(message: string | undefined): CoupleErrorKey {
  const normalized = (message ?? '').trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('not_configured')) {
    return 'notConfigured';
  }
  if (normalized.includes('not_authenticated')) {
    return 'notAuthenticated';
  }
  if (normalized.includes('already_in_couple')) {
    return 'alreadyInCouple';
  }
  if (normalized.includes('invalid_couple_title')) {
    return 'invalidCoupleTitle';
  }
  if (normalized.includes('couple_not_found')) {
    return 'coupleNotFound';
  }
  if (normalized.includes('couple_already_full') || normalized.includes('couple_full')) {
    return 'coupleFull';
  }
  if (normalized.includes('invalid_invitation')) {
    return 'invalidInvitation';
  }
  if (normalized.includes('invitation_not_usable')) {
    return 'invitationNotUsable';
  }
  if (normalized.includes('invitation_expired')) {
    return 'invitationExpired';
  }
  if (normalized.includes('cannot_accept_own_invitation')) {
    return 'cannotAcceptOwnInvitation';
  }
  if (normalized.includes('not_authorized')) {
    return 'notAuthorized';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('failed to fetch')
  ) {
    return 'networkError';
  }

  return 'unknown';
}
