export type PreferredLanguage = 'en' | 'zh-CN';
export type CoupleMemberRole = 'creator' | 'partner';
export type CoupleInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface ProfileSummary {
  readonly id: string;
  readonly displayName: string | null;
  readonly preferredLanguage: PreferredLanguage;
}

export interface CoupleSummary {
  readonly id: string;
  readonly title: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface CoupleMemberRecord {
  readonly coupleId: string;
  readonly userId: string;
  readonly memberSlot: 1 | 2;
  readonly role: CoupleMemberRole;
  readonly joinedAt: string;
}

export interface CoupleMemberWithProfile extends CoupleMemberRecord {
  readonly profile: ProfileSummary | null;
}

export interface PendingInvitationSummary {
  readonly id: string;
  readonly coupleId: string;
  readonly invitedBy: string;
  readonly status: CoupleInvitationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface GeneratedInvitation {
  readonly invitationId: string;
  readonly inviteToken: string;
  readonly expiresAt: string;
}

export interface CoupleSnapshot {
  readonly couple: CoupleSummary | null;
  readonly members: readonly CoupleMemberWithProfile[];
  readonly myProfile: ProfileSummary | null;
  readonly activeInvitation: PendingInvitationSummary | null;
  readonly isCoupleFull: boolean;
  readonly isCreator: boolean;
}

export type CoupleValidationErrorKey =
  | 'titleTooLong'
  | 'inviteTokenRequired'
  | 'displayNameTooLong';

export type CoupleErrorKey =
  | 'notConfigured'
  | 'notAuthenticated'
  | 'alreadyInCouple'
  | 'invalidCoupleTitle'
  | 'coupleNotFound'
  | 'coupleFull'
  | 'invalidInvitation'
  | 'invitationNotUsable'
  | 'invitationExpired'
  | 'cannotAcceptOwnInvitation'
  | 'notAuthorized'
  | 'networkError'
  | 'unknown';
