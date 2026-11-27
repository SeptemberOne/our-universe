import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelestialBackdrop } from '@/components/CelestialBackdrop';
import { CelestialButton } from '@/components/CelestialButton';
import { CelestialCard } from '@/components/CelestialCard';
import { CelestialInput } from '@/components/CelestialInput';
import { LanguageToggle } from '@/components/LanguageToggle';
import { OrbitBadge } from '@/components/OrbitBadge';
import { useAuth } from '@/features/auth/AuthContext';
import { useCouple } from '@/features/couple/CoupleContext';
import {
  validateCoupleTitle,
  validateDisplayName,
  validateInviteToken,
} from '@/features/couple/coupleLogic';
import {
  shareInvitationToken,
  type WebDocumentLike,
  type WebNavigatorLike,
} from '@/features/couple/inviteShare';
import { getAppLanguage, setAppLanguage, type AppLanguage } from '@/i18n';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

export default function CoupleSpaceScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const {
    isConfigured,
    status: authStatus,
    user,
    profileSetupWarningKey,
    dismissProfileSetupWarning,
    signOut,
  } = useAuth();
  const {
    status: coupleStatus,
    snapshot,
    errorKey: loadErrorKey,
    generatedInvitation,
    refresh,
    createSpace,
    createInvitation,
    acceptInvitation,
    revokeInvitation,
    saveDisplayName,
  } = useCouple();

  const currentLanguage: AppLanguage = getAppLanguage();

  const [spaceTitle, setSpaceTitle] = useState('');
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    'create' | 'join' | 'invite' | 'share' | 'revoke' | 'profile' | 'signOut' | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{
    invitationId: string;
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const displayNameInput = displayNameDraft ?? (snapshot?.myProfile?.displayName ?? '');

  const handleSelectLanguage = useCallback(
    (language: AppLanguage) => {
      if (language !== i18n.language) {
        void setAppLanguage(language);
      }
    },
    [i18n.language],
  );

  const handleBackHome = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const handleSignOut = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);
    setBusyAction('signOut');
    try {
      const result = await signOut();
      if (!result.ok) {
        setActionError(t(`auth.errors.${result.errorKey}`));
      }
    } finally {
      setBusyAction(null);
    }
  }, [signOut, t]);

  const handleCreateSpace = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);

    const validation = validateCoupleTitle(spaceTitle);
    if (!validation.ok) {
      setActionError(t(`couple.validation.${validation.errorKey}`));
      return;
    }

    setBusyAction('create');
    try {
      const result = await createSpace(validation.title);
      if (result.ok) {
        setSpaceTitle('');
        setActionSuccess(t('couple.invitation.createdSuccess'));
      } else {
        setActionError(t(`couple.errors.${result.errorKey}`));
      }
    } finally {
      setBusyAction(null);
    }
  }, [createSpace, spaceTitle, t]);

  const handleJoinWithToken = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);

    const validation = validateInviteToken(inviteTokenInput);
    if (!validation.ok) {
      setActionError(t(`couple.validation.${validation.errorKey}`));
      return;
    }

    setBusyAction('join');
    try {
      const result = await acceptInvitation(validation.token);
      if (result.ok) {
        setInviteTokenInput('');
        setActionSuccess(t('couple.invitation.joinedSuccess'));
      } else {
        setActionError(t(`couple.errors.${result.errorKey}`));
      }
    } finally {
      setBusyAction(null);
    }
  }, [acceptInvitation, inviteTokenInput, t]);

  const handleGenerateInvite = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);
    setShareFeedback(null);
    setBusyAction('invite');
    try {
      const result = await createInvitation(24);
      if (result.ok) {
        setActionSuccess(t('couple.invitation.generatedSuccess'));
      } else {
        setActionError(t(`couple.errors.${result.errorKey}`));
      }
    } finally {
      setBusyAction(null);
    }
  }, [createInvitation, t]);

  const handleShareInvite = useCallback(async () => {
    if (!generatedInvitation) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setShareFeedback(null);
    setBusyAction('share');

    const webNavigator =
      'navigator' in globalThis
        ? ((globalThis as { navigator?: WebNavigatorLike }).navigator ?? null)
        : null;
    const webDocument =
      'document' in globalThis
        ? ((globalThis as { document?: WebDocumentLike }).document ?? null)
        : null;

    try {
      const outcome = await shareInvitationToken({
        platformOS: Platform.OS,
        title: t('couple.invitation.shareTitle'),
        message: t('couple.invitation.shareMessage', {
          token: generatedInvitation.inviteToken,
        }),
        token: generatedInvitation.inviteToken,
        nativeShare: (content) => Share.share(content),
        webNavigator,
        webDocument,
      });

      if (outcome.status === 'shared') {
        setShareFeedback({
          invitationId: generatedInvitation.invitationId,
          tone: 'success',
          message: t('couple.invitation.sharedSuccess'),
        });
      } else if (outcome.status === 'copied') {
        setShareFeedback({
          invitationId: generatedInvitation.invitationId,
          tone: 'success',
          message: t('couple.invitation.copiedSuccess'),
        });
      } else if (outcome.status === 'failed') {
        setShareFeedback({
          invitationId: generatedInvitation.invitationId,
          tone: 'error',
          message: t('couple.invitation.shareFailed'),
        });
      }
    } finally {
      setBusyAction(null);
    }
  }, [generatedInvitation, t]);

  const handleRevokeInvite = useCallback(
    async (invitationId: string) => {
      setActionError(null);
      setActionSuccess(null);
      setShareFeedback(null);
      setBusyAction('revoke');
      try {
        const result = await revokeInvitation(invitationId);
        if (result.ok) {
          setActionSuccess(t('couple.invitation.revokedSuccess'));
        } else {
          setActionError(t(`couple.errors.${result.errorKey}`));
        }
      } finally {
        setBusyAction(null);
      }
    },
    [revokeInvitation, t],
  );

  const handleSaveDisplayName = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);

    const validation = validateDisplayName(displayNameInput);
    if (!validation.ok) {
      setActionError(t(`couple.validation.${validation.errorKey}`));
      return;
    }

    setBusyAction('profile');
    try {
      const result = await saveDisplayName(validation.displayName);
      if (result.ok) {
        setDisplayNameDraft(null);
        dismissProfileSetupWarning();
        setActionSuccess(t('couple.profile.savedSuccess'));
      } else {
        setActionError(t(`couple.errors.${result.errorKey}`));
      }
    } finally {
      setBusyAction(null);
    }
  }, [dismissProfileSetupWarning, displayNameInput, saveDisplayName, t]);

  const couple = snapshot?.couple ?? null;
  const canNavigateHome = !isConfigured || Boolean(couple);
  const statusBadgeLabel = !couple
    ? t('couple.status.emptyBadge')
    : snapshot?.isCoupleFull
      ? t('couple.status.connectedBadge')
      : t('couple.status.waitingBadge');

  const formatExpiry = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  };

  return (
    <View style={styles.root}>
      <CelestialBackdrop />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.innerColumn}>
              <View style={styles.topBar}>
                <View style={styles.topActions}>
                  {canNavigateHome ? (
                    <Pressable
                      onPress={handleBackHome}
                      accessibilityRole="button"
                      accessibilityLabel={t('couple.backAccessibility')}
                      style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.pillButtonText}>← {t('couple.backLabel')}</Text>
                    </Pressable>
                  ) : null}

                  {isConfigured && authStatus === 'authenticated' ? (
                    <Pressable
                      onPress={() => void handleSignOut()}
                      disabled={busyAction === 'signOut'}
                      accessibilityRole="button"
                      accessibilityLabel={t('couple.signOutAccessibility')}
                      style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.pillButtonText}>{t('couple.signOutLabel')}</Text>
                    </Pressable>
                  ) : null}
                </View>

                <LanguageToggle
                  currentLanguage={currentLanguage}
                  onSelectLanguage={handleSelectLanguage}
                  groupAccessibilityLabel={t('language.groupLabel')}
                />
              </View>

              <View style={styles.header}>
                <OrbitBadge
                  label={statusBadgeLabel}
                  tone={snapshot?.isCoupleFull ? 'accent' : 'subtle'}
                />
                <Text style={styles.title} accessibilityRole="header">
                  {couple ? couple.title : t('couple.title')}
                </Text>
                <Text style={styles.subtitle}>{t('couple.subtitle')}</Text>
              </View>

              {actionError ? (
                <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                  <Text style={styles.errorText}>{actionError}</Text>
                </View>
              ) : null}

              {profileSetupWarningKey ? (
                <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                  <Text style={styles.errorText}>
                    {t('couple.profile.initialSaveWarning', {
                      reason: t(`auth.errors.${profileSetupWarningKey}`),
                    })}
                  </Text>
                </View>
              ) : null}

              {actionSuccess ? (
                <View style={styles.successBanner} accessibilityLiveRegion="polite">
                  <Text style={styles.successText}>{actionSuccess}</Text>
                </View>
              ) : null}

              {!isConfigured ? (
                <CelestialCard highlighted style={styles.card}>
                  <Text style={styles.cardTitle}>{t('couple.unconfigured.title')}</Text>
                  <Text style={styles.cardBody}>{t('couple.unconfigured.body')}</Text>
                  <CelestialButton
                    label={t('couple.backLabel')}
                    onPress={handleBackHome}
                    variant="secondary"
                  />
                </CelestialCard>
              ) : coupleStatus === 'loading' && !snapshot ? (
                <CelestialCard style={styles.centerCard}>
                  <ActivityIndicator size="large" color={colors.accent.starlight} />
                  <Text style={styles.cardBody}>{t('couple.loading')}</Text>
                </CelestialCard>
              ) : coupleStatus === 'error' && !snapshot ? (
                <CelestialCard style={styles.card}>
                  <Text style={styles.cardTitle}>{t('couple.loadErrorTitle')}</Text>
                  <Text style={styles.errorText}>
                    {t(`couple.errors.${loadErrorKey ?? 'unknown'}`)}
                  </Text>
                  <CelestialButton
                    label={t('couple.retryLabel')}
                    onPress={() => void refresh()}
                    variant="secondary"
                  />
                </CelestialCard>
              ) : !couple ? (
                <View style={styles.sectionStack}>
                  <CelestialCard style={styles.card}>
                    <Text style={styles.cardTitle}>{t('couple.empty.title')}</Text>
                    <Text style={styles.cardBody}>{t('couple.empty.body')}</Text>
                  </CelestialCard>

                  <CelestialCard highlighted style={styles.card}>
                    <Text style={styles.cardTitle}>{t('couple.createForm.heading')}</Text>
                    <CelestialInput
                      label={t('couple.createForm.titleLabel')}
                      placeholder={t('couple.createForm.titlePlaceholder')}
                      value={spaceTitle}
                      onChangeText={setSpaceTitle}
                      maxLength={80}
                    />
                    <CelestialButton
                      label={t('couple.createForm.submit')}
                      onPress={() => void handleCreateSpace()}
                      loading={busyAction === 'create'}
                      disabled={busyAction !== null}
                      variant="primary"
                    />
                  </CelestialCard>

                  <CelestialCard style={styles.card}>
                    <Text style={styles.cardTitle}>{t('couple.joinForm.heading')}</Text>
                    <Text style={styles.cardBody}>{t('couple.joinForm.body')}</Text>
                    <CelestialInput
                      label={t('couple.joinForm.tokenLabel')}
                      placeholder={t('couple.joinForm.tokenPlaceholder')}
                      value={inviteTokenInput}
                      onChangeText={setInviteTokenInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <CelestialButton
                      label={t('couple.joinForm.submit')}
                      onPress={() => void handleJoinWithToken()}
                      loading={busyAction === 'join'}
                      disabled={busyAction !== null}
                      variant="secondary"
                    />
                  </CelestialCard>
                </View>
              ) : (
                <View style={styles.sectionStack}>
                  <Text style={styles.sectionTitle} accessibilityRole="header">
                    {t('couple.members.heading')}
                  </Text>

                  {snapshot?.members.map((member) => {
                    const isMe = member.userId === user?.id;
                    const displayName = member.profile?.displayName?.trim() || t('couple.members.unnamed');
                    const roleLabel =
                      member.role === 'creator'
                        ? t('couple.members.creatorRole')
                        : t('couple.members.partnerRole');
                    const languageLabel =
                      member.profile?.preferredLanguage === 'zh-CN'
                        ? t('couple.members.languageZh')
                        : t('couple.members.languageEn');

                    return (
                      <CelestialCard key={member.userId} highlighted={isMe} style={styles.memberCard}>
                        <View style={styles.memberHeader}>
                          <OrbitBadge
                            label={roleLabel}
                            tone={member.role === 'creator' ? 'accent' : 'subtle'}
                          />
                          {isMe ? (
                            <Text style={styles.youTag}>{t('couple.members.youTag')}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.cardTitle}>{displayName}</Text>
                        <Text style={styles.memberMeta}>{languageLabel}</Text>
                      </CelestialCard>
                    );
                  })}

                  {!snapshot?.isCoupleFull ? (
                    <CelestialCard style={styles.card}>
                      <Text style={styles.cardTitle}>{t('couple.members.emptySlotTitle')}</Text>
                      <Text style={styles.cardBody}>{t('couple.members.emptySlotBody')}</Text>
                    </CelestialCard>
                  ) : null}

                  {!snapshot?.isCoupleFull ? (
                    <View style={styles.sectionStack}>
                      <Text style={styles.sectionTitle} accessibilityRole="header">
                        {t('couple.invitation.heading')}
                      </Text>

                      <CelestialCard highlighted style={styles.card}>
                        <Text style={styles.cardBody}>{t('couple.invitation.body')}</Text>

                        {generatedInvitation ? (
                          <View style={styles.tokenBox}>
                            <Text style={styles.tokenLabel}>
                              {t('couple.invitation.tokenLabel')}
                            </Text>
                            <Text selectable style={styles.tokenValue}>
                              {generatedInvitation.inviteToken}
                            </Text>
                            <Text style={styles.tokenMeta}>
                              {t('couple.invitation.expiresAt', {
                                date: formatExpiry(generatedInvitation.expiresAt),
                              })}
                            </Text>
                            <Text style={styles.tokenNotice}>
                              {t('couple.invitation.oneTimeNotice')}
                            </Text>
                            <View style={styles.buttonRow}>
                              <CelestialButton
                                label={t('couple.invitation.share')}
                                onPress={() => void handleShareInvite()}
                                loading={busyAction === 'share'}
                                disabled={busyAction !== null}
                                variant="primary"
                                style={styles.rowButton}
                              />
                              <CelestialButton
                                label={t('couple.invitation.revoke')}
                                onPress={() =>
                                  void handleRevokeInvite(generatedInvitation.invitationId)
                                }
                                loading={busyAction === 'revoke'}
                                disabled={busyAction !== null}
                                variant="subtle"
                                style={styles.rowButton}
                              />
                            </View>
                            {shareFeedback?.invitationId === generatedInvitation.invitationId ? (
                              <View
                                style={
                                  shareFeedback.tone === 'success'
                                    ? styles.successBanner
                                    : styles.errorBanner
                                }
                                accessibilityLiveRegion="polite"
                              >
                                <Text
                                  style={
                                    shareFeedback.tone === 'success'
                                      ? styles.successText
                                      : styles.errorText
                                  }
                                >
                                  {shareFeedback.message}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ) : snapshot?.activeInvitation ? (
                          <View style={styles.tokenBox}>
                            <Text style={styles.cardBody}>
                              {t('couple.invitation.pendingActive')}
                            </Text>
                            <Text style={styles.tokenMeta}>
                              {t('couple.invitation.expiresAt', {
                                date: formatExpiry(snapshot.activeInvitation.expiresAt),
                              })}
                            </Text>
                            <CelestialButton
                              label={t('couple.invitation.revoke')}
                              onPress={() =>
                                void handleRevokeInvite(snapshot.activeInvitation!.id)
                              }
                              loading={busyAction === 'revoke'}
                              disabled={busyAction !== null}
                              variant="subtle"
                            />
                          </View>
                        ) : null}

                        <CelestialButton
                          label={
                            generatedInvitation || snapshot?.activeInvitation
                              ? t('couple.invitation.regenerate')
                              : t('couple.invitation.generate')
                          }
                          onPress={() => void handleGenerateInvite()}
                          loading={busyAction === 'invite'}
                          disabled={busyAction !== null}
                          variant="secondary"
                        />
                      </CelestialCard>
                    </View>
                  ) : null}
                </View>
              )}

              {isConfigured && authStatus === 'authenticated' && snapshot ? (
                <View style={[styles.sectionStack, styles.profileSection]}>
                  <Text style={styles.sectionTitle} accessibilityRole="header">
                    {t('couple.profile.heading')}
                  </Text>

                  <CelestialCard style={styles.card}>
                    <CelestialInput
                      label={t('couple.profile.label')}
                      placeholder={t('couple.profile.placeholder')}
                      value={displayNameInput}
                      onChangeText={setDisplayNameDraft}
                      maxLength={80}
                    />
                    <CelestialButton
                      label={t('couple.profile.save')}
                      onPress={() => void handleSaveDisplayName()}
                      loading={busyAction === 'profile'}
                      disabled={busyAction !== null}
                      variant="secondary"
                    />
                  </CelestialCard>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.deepSpace,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  innerColumn: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pillButton: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillButtonText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  sectionStack: {
    gap: spacing.md,
  },
  profileSection: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  memberCard: {
    gap: spacing.xs + 2,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  youTag: {
    ...typography.caption,
    color: colors.accent.starlight,
    fontWeight: '700',
  },
  memberMeta: {
    ...typography.caption,
    color: colors.text.muted,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
  cardBody: {
    ...typography.body,
    color: colors.text.secondary,
  },
  tokenBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.accent,
    backgroundColor: 'rgba(7, 11, 26, 0.72)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tokenLabel: {
    ...typography.caption,
    color: colors.text.accent,
    fontWeight: '600',
  },
  tokenValue: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tokenMeta: {
    ...typography.caption,
    color: colors.text.muted,
  },
  tokenNotice: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  rowButton: {
    flex: 1,
    minWidth: 120,
  },
  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(242, 167, 198, 0.5)',
    backgroundColor: 'rgba(242, 167, 198, 0.12)',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.accent.rose,
  },
  successBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.accent,
    backgroundColor: colors.surface.pillActive,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.caption,
    color: colors.text.accent,
  },
});
