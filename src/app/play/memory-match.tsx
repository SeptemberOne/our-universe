import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelestialBackdrop } from '@/components/CelestialBackdrop';
import { CelestialCard } from '@/components/CelestialCard';
import { OrbitBadge } from '@/components/OrbitBadge';
import { MemoryCardTile } from '@/features/memoryMatch/MemoryCardTile';
import {
  createInitialGameState,
  flipCard,
  formatElapsedTime,
  resolveMismatch,
} from '@/features/memoryMatch/gameEngine';
import { SAMPLE_MEMORY_IDS } from '@/features/memoryMatch/sampleMemories';
import type { MemoryGameState } from '@/features/memoryMatch/types';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

const MISMATCH_DISPLAY_MS = 850;

export default function MemoryMatchScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [game, setGame] = useState<MemoryGameState>(() =>
    createInitialGameState(SAMPLE_MEMORY_IDS),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed timer: runs only while actively playing, stops on completion.
  useEffect(() => {
    if (game.status !== 'playing') {
      return;
    }

    const timerId = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [game.status]);

  // Temporary mismatched-card display before flipping back face-down.
  useEffect(() => {
    if (!game.isResolvingMismatch) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setGame((prev) => resolveMismatch(prev));
    }, MISMATCH_DISPLAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [game.isResolvingMismatch]);

  const handleCardPress = useCallback((cardId: string) => {
    setGame((prev) => flipCard(prev, cardId).state);
  }, []);

  const handleReset = useCallback(() => {
    setGame(createInitialGameState(SAMPLE_MEMORY_IDS));
    setElapsedSeconds(0);
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const formattedTime = formatElapsedTime(elapsedSeconds);
  const isCompleted = game.status === 'completed';

  return (
    <View style={styles.root}>
      <CelestialBackdrop />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
              <OrbitBadge label={t('memoryMatch.sampleBadge')} tone="subtle" />
              <Text style={styles.title} accessibilityRole="header">
                {t('memoryMatch.title')}
              </Text>
              <Text style={styles.instruction}>{t('memoryMatch.instruction')}</Text>
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

                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>{t('memoryMatch.stats.time')}</Text>
                  <Text style={styles.statValue}>{formattedTime}</Text>
                </View>
              </View>
            </CelestialCard>

            {isCompleted ? (
              <CelestialCard highlighted style={styles.completionCard}>
                <OrbitBadge label={t('memoryMatch.completion.badge')} tone="accent" />
                <Text style={styles.completionTitle} accessibilityRole="header">
                  {t('memoryMatch.completion.title')}
                </Text>
                <Text style={styles.completionSubtitle}>
                  {t('memoryMatch.completion.subtitle', { total: game.totalPairs })}
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
                    onPress={handleBack}
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
                const artworkName = t(`memoryMatch.artworks.${card.pairId}`);
                const accessibilityLabel = card.isMatched
                  ? t('memoryMatch.card.matchedLabel', { name: artworkName })
                  : card.isFlipped
                    ? t('memoryMatch.card.revealedLabel', { name: artworkName })
                    : t('memoryMatch.card.hiddenLabel');

                return (
                  <View key={card.cardId} style={styles.gridCell}>
                    <MemoryCardTile
                      card={card}
                      artworkName={artworkName}
                      accessibilityLabel={accessibilityLabel}
                      accessibilityHint={t('memoryMatch.card.hiddenHint')}
                      disabled={game.isResolvingMismatch || isCompleted}
                      onPress={handleCardPress}
                    />
                  </View>
                );
              })}
            </View>
          </View>
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
});
