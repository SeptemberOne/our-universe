import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelestialBackdrop } from '@/components/CelestialBackdrop';
import { CelestialButton } from '@/components/CelestialButton';
import { CelestialCard } from '@/components/CelestialCard';
import { OrbitBadge } from '@/components/OrbitBadge';
import { useAuth } from '@/features/auth/AuthContext';
import { useCouple } from '@/features/couple/CoupleContext';
import { MemoryCardTile } from '@/features/memoryMatch/MemoryCardTile';
import {
  createInitialGameState,
  createPhotoGameRound,
  extractPlayablePhotoPairIds,
  flipCard,
  formatElapsedTime,
  resolveMismatch,
  shouldRefreshPhotoLibraryOnFocus,
  type FocusRefreshPolicyInput,
} from '@/features/memoryMatch/gameEngine';
import { SAMPLE_MEMORY_IDS } from '@/features/memoryMatch/sampleMemories';
import type {
  MemoryArtworkId,
  MemoryGameState,
  MemoryGameStatus,
  MemoryPairId,
} from '@/features/memoryMatch/types';
import type { PhotoLibraryItem } from '@/features/photos/types';
import { usePhotoLibrary } from '@/features/photos/usePhotoLibrary';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

const MISMATCH_DISPLAY_MS = 850;
const SAMPLE_ARTWORK_SET = new Set<string>(SAMPLE_MEMORY_IDS);

function isSampleArtworkId(id: string): id is MemoryArtworkId {
  return SAMPLE_ARTWORK_SET.has(id);
}

interface ActiveRoundState {
  readonly pairIds: readonly MemoryPairId[];
  readonly game: MemoryGameState;
}

function buildInitialRound(
  mode: 'shared-photos' | 'offline-sample',
  playablePhotos: readonly PhotoLibraryItem[],
): ActiveRoundState {
  if (mode === 'offline-sample') {
    return {
      pairIds: SAMPLE_MEMORY_IDS,
      game: createInitialGameState(SAMPLE_MEMORY_IDS),
    };
  }

  const photoRound = createPhotoGameRound(playablePhotos);
  if (photoRound.ok) {
    return {
      pairIds: photoRound.pairIds,
      game: photoRound.state,
    };
  }

  // Parent screen prevents mounting MemoryMatchBoard with < 2 photos; keep empty safe fallback.
  return {
    pairIds: [],
    game: createInitialGameState([]),
  };
}

interface ElapsedTimeStatProps {
  readonly status: MemoryGameStatus;
  readonly label: string;
}

/**
 * Isolated timer display so 1-second ticks never re-render the card grid or reload images.
 */
const ElapsedTimeStat = memo(function ElapsedTimeStat({ status, label }: ElapsedTimeStatProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const timerId = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [status]);

  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{formatElapsedTime(elapsedSeconds)}</Text>
    </View>
  );
});

interface MemoryMatchBoardProps {
  readonly mode: 'shared-photos' | 'offline-sample';
  readonly playablePhotos: readonly PhotoLibraryItem[];
  readonly isReloadingPhotos: boolean;
  readonly onReloadPhotos: () => void;
  readonly onBack: () => void;
}

function MemoryMatchBoard({
  mode,
  playablePhotos,
  isReloadingPhotos,
  onReloadPhotos,
  onBack,
}: MemoryMatchBoardProps) {
  const { t } = useTranslation();
  const [round, setRound] = useState<ActiveRoundState>(() =>
    buildInitialRound(mode, playablePhotos),
  );
  const [roundGeneration, setRoundGeneration] = useState(0);
  const [failedImageByPair, setFailedImageByPair] = useState<Readonly<Record<string, string>>>({});

  const photoUrlByPath = useMemo(() => {
    const urlMap = new Map<string, string>();
    for (const photo of playablePhotos) {
      urlMap.set(photo.path, photo.signedUrl);
    }
    return urlMap;
  }, [playablePhotos]);

  const pairNumberById = useMemo(() => {
    const numberMap = new Map<string, number>();
    round.pairIds.forEach((pairId, index) => {
      numberMap.set(pairId, index + 1);
    });
    return numberMap;
  }, [round.pairIds]);

  const { game } = round;

  // Temporary mismatched-card display before flipping back face-down.
  useEffect(() => {
    if (!game.isResolvingMismatch) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRound((prev) => ({
        ...prev,
        game: resolveMismatch(prev.game),
      }));
    }, MISMATCH_DISPLAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [game.isResolvingMismatch]);

  const handleCardPress = useCallback((cardId: string) => {
    setRound((prev) => ({
      ...prev,
      game: flipCard(prev.game, cardId).state,
    }));
  }, []);

  const handleReset = useCallback(() => {
    setRound(buildInitialRound(mode, playablePhotos));
    setRoundGeneration((prev) => prev + 1);
    setFailedImageByPair({});
  }, [mode, playablePhotos]);

  const handleImageError = useCallback((pairId: string, failedUrl: string) => {
    setFailedImageByPair((prev) => {
      if (prev[pairId] === failedUrl) {
        return prev;
      }
      return { ...prev, [pairId]: failedUrl };
    });
  }, []);

  const hasFailedImages = useMemo(() => {
    if (mode !== 'shared-photos') {
      return false;
    }
    return round.pairIds.some((pairId) => {
      const currentUrl = photoUrlByPath.get(pairId);
      const failedUrl = failedImageByPair[pairId];
      return !currentUrl || (failedUrl !== undefined && failedUrl === currentUrl);
    });
  }, [failedImageByPair, mode, photoUrlByPath, round.pairIds]);

  const isCompleted = game.status === 'completed';
  const isBoardLocked = game.isResolvingMismatch || isCompleted;
  const useTwoColumnGrid = game.totalPairs === 2;
  const isPhotoMode = mode === 'shared-photos';
  const hiddenHint = t('memoryMatch.card.hiddenHint');
  const imageErrorCardLabel = t('memoryMatch.imageError.cardLabel');

  return (
    <View style={styles.innerColumn}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('memoryMatch.backAccessibility')}
          style={({ pressed }) => [
            styles.actionPill,
            pressed && styles.actionPillPressed,
          ]}
        >
          <Text style={styles.actionPillText}>← {t('memoryMatch.backLabel')}</Text>
        </Pressable>

        <Pressable
          onPress={handleReset}
          accessibilityRole="button"
          accessibilityLabel={t('memoryMatch.resetAccessibility')}
          style={({ pressed }) => [
            styles.actionPill,
            styles.resetPill,
            pressed && styles.actionPillPressed,
          ]}
        >
          <Text style={styles.resetPillText}>↻ {t('memoryMatch.resetLabel')}</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <OrbitBadge
          label={
            isPhotoMode
              ? t('memoryMatch.sharedBadge')
              : t('memoryMatch.sampleBadge')
          }
          tone={isPhotoMode ? 'accent' : 'subtle'}
        />
        <Text style={styles.title} accessibilityRole="header">
          {t('memoryMatch.title')}
        </Text>
        <Text style={styles.instruction}>
          {isPhotoMode
            ? t('memoryMatch.sharedInstruction')
            : t('memoryMatch.instruction')}
        </Text>
      </View>

      <CelestialCard style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t('memoryMatch.stats.moves')}</Text>
            <Text style={styles.statValue}>{game.moves}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t('memoryMatch.stats.pairs')}</Text>
            <Text style={styles.statValue}>
              {game.matchedPairs}/{game.totalPairs}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <ElapsedTimeStat
            key={roundGeneration}
            status={game.status}
            label={t('memoryMatch.stats.time')}
          />
        </View>
      </CelestialCard>

      {hasFailedImages ? (
        <CelestialCard style={styles.imageErrorBanner}>
          <Text style={styles.errorBannerText}>{t('memoryMatch.imageError.bannerText')}</Text>
          <CelestialButton
            label={t('memoryMatch.imageError.reloadLabel')}
            onPress={onReloadPhotos}
            loading={isReloadingPhotos}
            variant="secondary"
          />
        </CelestialCard>
      ) : null}

      {isCompleted ? (
        <CelestialCard highlighted style={styles.completionCard}>
          <OrbitBadge label={t('memoryMatch.completion.badge')} tone="accent" />
          <Text style={styles.completionTitle} accessibilityRole="header">
            {t('memoryMatch.completion.title')}
          </Text>
          <Text style={styles.completionSubtitle}>
            {isPhotoMode
              ? t('memoryMatch.completion.photoSubtitle', { total: game.totalPairs })
              : t('memoryMatch.completion.subtitle', { total: game.totalPairs })}
          </Text>

          <View style={styles.completionActions}>
            <Pressable
              onPress={handleReset}
              accessibilityRole="button"
              accessibilityLabel={t('memoryMatch.completion.playAgain')}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {t('memoryMatch.completion.playAgain')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('memoryMatch.completion.backHome')}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {t('memoryMatch.completion.backHome')}
              </Text>
            </Pressable>
          </View>
        </CelestialCard>
      ) : null}

      <View style={styles.grid}>
        {game.cards.map((card) => {
          const photoNumber = pairNumberById.get(card.pairId) ?? 1;
          const artworkId: MemoryArtworkId = isSampleArtworkId(card.pairId)
            ? card.pairId
            : 'crescentMoon';

          const cardDisplayName = isPhotoMode
            ? t('memoryMatch.card.photoName', { number: photoNumber })
            : t(`memoryMatch.artworks.${artworkId}`);

          const accessibilityLabel = card.isMatched
            ? t('memoryMatch.card.matchedLabel', { name: cardDisplayName })
            : card.isFlipped
              ? t('memoryMatch.card.revealedLabel', { name: cardDisplayName })
              : t('memoryMatch.card.hiddenLabel');

          return (
            <View
              key={card.cardId}
              style={[styles.gridCell, useTwoColumnGrid && styles.gridCellTwoCol]}
            >
              <MemoryCardTile
                cardId={card.cardId}
                pairId={card.pairId}
                isFlipped={card.isFlipped}
                isMatched={card.isMatched}
                visualKind={isPhotoMode ? 'photo' : 'artwork'}
                signedUrl={isPhotoMode ? photoUrlByPath.get(card.pairId) : undefined}
                artworkId={isPhotoMode ? undefined : artworkId}
                artworkLabel={isPhotoMode ? undefined : cardDisplayName}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={hiddenHint}
                imageErrorLabel={imageErrorCardLabel}
                disabled={isBoardLocked}
                onPress={handleCardPress}
                onImageError={isPhotoMode ? handleImageError : undefined}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function MemoryMatchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isConfigured, status: authStatus } = useAuth();
  const {
    status: coupleStatus,
    snapshot,
    errorKey: coupleErrorKey,
    refresh: refreshCouple,
  } = useCouple();
  const {
    status: photoStatus,
    photos,
    errorKey: photoErrorKey,
    refresh: refreshPhotos,
  } = usePhotoLibrary();

  const playablePhotos = useMemo(() => {
    const validIds = new Set(extractPlayablePhotoPairIds(photos));
    const uniquePhotos: PhotoLibraryItem[] = [];
    for (const photo of photos) {
      if (validIds.has(photo.path)) {
        validIds.delete(photo.path);
        uniquePhotos.push(photo);
      }
    }
    return uniquePhotos;
  }, [photos]);

  const coupleId = snapshot?.couple?.id ?? null;

  const focusRefreshContextRef = useRef<{
    policyInput: Omit<FocusRefreshPolicyInput, 'wasBlurred'>;
    refresh: () => Promise<void>;
  }>({
    policyInput: {
      isConfigured,
      isAuthenticated: authStatus === 'authenticated',
      hasCouple: Boolean(coupleId),
      photoStatus,
      playablePhotoCount: playablePhotos.length,
    },
    refresh: refreshPhotos,
  });

  useEffect(() => {
    focusRefreshContextRef.current = {
      policyInput: {
        isConfigured,
        isAuthenticated: authStatus === 'authenticated',
        hasCouple: Boolean(coupleId),
        photoStatus,
        playablePhotoCount: playablePhotos.length,
      },
      refresh: refreshPhotos,
    };
  }, [authStatus, coupleId, isConfigured, photoStatus, playablePhotos.length, refreshPhotos]);

  const wasBlurredRef = useRef(false);

  // Keep the focus callback identity constant ([]) so status updates while focused never re-trigger refreshPhotos().
  useFocusEffect(
    useCallback(() => {
      const wasBlurred = wasBlurredRef.current;
      wasBlurredRef.current = false;

      const current = focusRefreshContextRef.current;
      if (
        shouldRefreshPhotoLibraryOnFocus({
          ...current.policyInput,
          wasBlurred,
        })
      ) {
        void current.refresh();
      }

      return () => {
        wasBlurredRef.current = true;
      };
    }, []),
  );

  const handleReloadPhotos = useCallback(() => {
    void refreshPhotos();
  }, [refreshPhotos]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  let content: React.ReactNode;

  if (!isConfigured) {
    content = (
      <MemoryMatchBoard
        key="offline-sample"
        mode="offline-sample"
        playablePhotos={[]}
        isReloadingPhotos={false}
        onReloadPhotos={handleReloadPhotos}
        onBack={handleBack}
      />
    );
  } else if (coupleStatus === 'error') {
    content = (
      <View style={styles.innerColumn}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('memoryMatch.backAccessibility')}
            style={({ pressed }) => [
              styles.actionPill,
              pressed && styles.actionPillPressed,
            ]}
          >
            <Text style={styles.actionPillText}>← {t('memoryMatch.backLabel')}</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <OrbitBadge label={t('memoryMatch.sharedBadge')} tone="subtle" />
          <Text style={styles.title} accessibilityRole="header">
            {t('memoryMatch.title')}
          </Text>
        </View>

        <CelestialCard highlighted style={styles.statusCard}>
          <Text style={styles.statusTitle} accessibilityRole="header">
            {t('memoryMatch.loadErrorTitle')}
          </Text>
          <Text style={styles.statusBody}>
            {t(`couple.errors.${coupleErrorKey ?? 'unknown'}`)}
          </Text>
          <CelestialButton
            label={t('memoryMatch.retryLabel')}
            onPress={() => void refreshCouple()}
            variant="primary"
          />
        </CelestialCard>
      </View>
    );
  } else if (authStatus === 'loading' || coupleStatus === 'loading' || coupleStatus === 'idle') {
    content = (
      <View style={styles.innerColumn}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('memoryMatch.backAccessibility')}
            style={({ pressed }) => [
              styles.actionPill,
              pressed && styles.actionPillPressed,
            ]}
          >
            <Text style={styles.actionPillText}>← {t('memoryMatch.backLabel')}</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <OrbitBadge label={t('memoryMatch.sharedBadge')} tone="subtle" />
          <Text style={styles.title} accessibilityRole="header">
            {t('memoryMatch.title')}
          </Text>
        </View>

        <CelestialCard style={styles.loadingCard}>
          <View accessibilityLiveRegion="polite" style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.accent.starlight} />
            <Text style={styles.statusBody}>{t('memoryMatch.loading')}</Text>
          </View>
        </CelestialCard>
      </View>
    );
  } else if (!coupleId) {
    content = (
      <View style={styles.innerColumn}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('memoryMatch.backAccessibility')}
            style={({ pressed }) => [
              styles.actionPill,
              pressed && styles.actionPillPressed,
            ]}
          >
            <Text style={styles.actionPillText}>← {t('memoryMatch.backLabel')}</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <OrbitBadge label={t('memoryMatch.sharedBadge')} tone="subtle" />
          <Text style={styles.title} accessibilityRole="header">
            {t('memoryMatch.title')}
          </Text>
        </View>

        <CelestialCard highlighted style={styles.statusCard}>
          <Text style={styles.statusTitle} accessibilityRole="header">
            {t('memoryMatch.noCouple.title')}
          </Text>
          <Text style={styles.statusBody}>{t('memoryMatch.noCouple.body')}</Text>
          <CelestialButton
            label={t('memoryMatch.goToCoupleLabel')}
            onPress={() => router.replace('/couple')}
            variant="primary"
          />
        </CelestialCard>
      </View>
    );
  } else if (photoStatus === 'error') {
    content = (
      <View style={styles.innerColumn}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('memoryMatch.backAccessibility')}
            style={({ pressed }) => [
              styles.actionPill,
              pressed && styles.actionPillPressed,
            ]}
          >
            <Text style={styles.actionPillText}>← {t('memoryMatch.backLabel')}</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <OrbitBadge label={t('memoryMatch.sharedBadge')} tone="subtle" />
          <Text style={styles.title} accessibilityRole="header">
            {t('memoryMatch.title')}
          </Text>
        </View>

        <CelestialCard highlighted style={styles.statusCard}>
          <Text style={styles.statusTitle} accessibilityRole="header">
            {t('memoryMatch.loadErrorTitle')}
          </Text>
          <Text style={styles.statusBody}>
            {t(`photos.errors.${photoErrorKey ?? 'unknown'}`)}
          </Text>
          <CelestialButton
            label={t('memoryMatch.retryLabel')}
            onPress={handleReloadPhotos}
            variant="primary"
          />
        </CelestialCard>
      </View>
    );
  } else if (
    (photoStatus === 'loading' || photoStatus === 'idle') &&
    playablePhotos.length < 2
  ) {
    content = (
      <View style={styles.innerColumn}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('memoryMatch.backAccessibility')}
            style={({ pressed }) => [
              styles.actionPill,
              pressed && styles.actionPillPressed,
            ]}
          >
            <Text style={styles.actionPillText}>← {t('memoryMatch.backLabel')}</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <OrbitBadge label={t('memoryMatch.sharedBadge')} tone="subtle" />
          <Text style={styles.title} accessibilityRole="header">
            {t('memoryMatch.title')}
          </Text>
        </View>

        <CelestialCard style={styles.loadingCard}>
          <View accessibilityLiveRegion="polite" style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.accent.starlight} />
            <Text style={styles.statusBody}>{t('memoryMatch.loading')}</Text>
          </View>
        </CelestialCard>
      </View>
    );
  } else if (playablePhotos.length < 2) {
    const isEmpty = playablePhotos.length === 0;
    content = (
      <View style={styles.innerColumn}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('memoryMatch.backAccessibility')}
            style={({ pressed }) => [
              styles.actionPill,
              pressed && styles.actionPillPressed,
            ]}
          >
            <Text style={styles.actionPillText}>← {t('memoryMatch.backLabel')}</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <OrbitBadge label={t('memoryMatch.sharedBadge')} tone="subtle" />
          <Text style={styles.title} accessibilityRole="header">
            {t('memoryMatch.title')}
          </Text>
        </View>

        <CelestialCard highlighted style={styles.statusCard}>
          <Text style={styles.statusTitle} accessibilityRole="header">
            {isEmpty ? t('memoryMatch.empty.title') : t('memoryMatch.insufficient.title')}
          </Text>
          <Text style={styles.statusBody}>
            {isEmpty
              ? t('memoryMatch.empty.body')
              : t('memoryMatch.insufficient.body', { count: playablePhotos.length })}
          </Text>
          <View style={styles.statusActions}>
            <CelestialButton
              label={t('memoryMatch.openPhotosLabel')}
              onPress={() => router.push('/photos')}
              variant="primary"
            />
            <CelestialButton
              label={t('memoryMatch.refreshLabel')}
              onPress={handleReloadPhotos}
              loading={photoStatus === 'loading'}
              variant="secondary"
            />
          </View>
        </CelestialCard>
      </View>
    );
  } else {
    const boardKey = `${coupleId}:${playablePhotos.map((item) => item.path).join('|')}`;
    content = (
      <MemoryMatchBoard
        key={boardKey}
        mode="shared-photos"
        playablePhotos={playablePhotos}
        isReloadingPhotos={photoStatus === 'loading'}
        onReloadPhotos={handleReloadPhotos}
        onBack={handleBack}
      />
    );
  }

  return (
    <View style={styles.root}>
      <CelestialBackdrop />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  actionPill: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetPill: {
    backgroundColor: colors.surface.pillActive,
    borderColor: colors.border.accent,
  },
  actionPillPressed: {
    opacity: 0.78,
  },
  actionPillText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  resetPillText: {
    ...typography.caption,
    color: colors.text.accent,
    fontWeight: '600',
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text.primary,
  },
  instruction: {
    ...typography.body,
    color: colors.text.secondary,
  },
  statsCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.subtle,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  loadingCard: {
    paddingVertical: spacing.xxl,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  statusCard: {
    gap: spacing.md,
  },
  statusTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
  statusBody: {
    ...typography.body,
    color: colors.text.secondary,
  },
  statusActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  imageErrorBanner: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderColor: 'rgba(242, 167, 198, 0.5)',
    backgroundColor: 'rgba(242, 167, 198, 0.12)',
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.accent.rose,
  },
  completionCard: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  completionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  completionSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  completionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minWidth: 132,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.accent.starlight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 132,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  gridCell: {
    width: '33.3333%',
    padding: spacing.xs,
  },
  gridCellTwoCol: {
    width: '50%',
  },
});
