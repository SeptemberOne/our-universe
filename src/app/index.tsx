import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelestialBackdrop } from '@/components/CelestialBackdrop';
import { CelestialCard } from '@/components/CelestialCard';
import { LanguageToggle } from '@/components/LanguageToggle';
import { OrbitBadge } from '@/components/OrbitBadge';
import { useAuth } from '@/features/auth/AuthContext';
import { useCouple } from '@/features/couple/CoupleContext';
import { getAppLanguage, setAppLanguage, type AppLanguage } from '@/i18n';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

interface DestinationItem {
  id: 'play' | 'memories' | 'letters' | 'garden';
  symbol: string;
  accentColor: string;
  featured: boolean;
}

const DESTINATIONS: readonly DestinationItem[] = [
  { id: 'play', symbol: '✦', accentColor: colors.accent.starlight, featured: true },
  { id: 'memories', symbol: '☾', accentColor: colors.accent.sky, featured: false },
  { id: 'letters', symbol: '✧', accentColor: colors.accent.rose, featured: false },
  { id: 'garden', symbol: '❀', accentColor: colors.accent.lavender, featured: false },
] as const;

function CelestialEmblem() {
  return (
    <View style={styles.emblemContainer} accessible={false} accessibilityElementsHidden>
      <View style={styles.outerOrbit}>
        <View style={[styles.orbitStar, styles.orbitStarTop]} />
        <View style={[styles.orbitStar, styles.orbitStarBottom]} />
        <View style={styles.innerCore}>
          <View style={styles.twinHeartLeft} />
          <View style={styles.twinHeartRight} />
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isConfigured, status: authStatus } = useAuth();
  const { snapshot } = useCouple();
  const currentLanguage: AppLanguage = getAppLanguage();

  const handleSelectLanguage = useCallback(
    (language: AppLanguage) => {
      if (language !== i18n.language) {
        void setAppLanguage(language);
      }
    },
    [i18n.language],
  );

  const handleOpenMemoryMatch = useCallback(() => {
    router.push('/play/memory-match');
  }, [router]);

  const handleOpenCoupleSpace = useCallback(() => {
    if (isConfigured && authStatus === 'unauthenticated') {
      router.push('/auth');
    } else {
      router.push('/couple');
    }
  }, [authStatus, isConfigured, router]);

  const coupleBadgeLabel = !isConfigured
    ? t('home.coupleCard.badgeLocal')
    : snapshot?.isCoupleFull
      ? t('home.coupleCard.badgeConnected')
      : snapshot?.couple
        ? t('home.coupleCard.badgeWaiting')
        : t('home.coupleCard.badgeSetup');

  const coupleTitle = snapshot?.couple?.title ?? t('home.coupleCard.titleFallback');

  const coupleSubtitle = !isConfigured
    ? t('home.coupleCard.subtitleLocal')
    : snapshot?.isCoupleFull
      ? t('home.coupleCard.subtitleConnected')
      : snapshot?.couple
        ? t('home.coupleCard.subtitleWaiting')
        : t('home.coupleCard.subtitleSetup');

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
              <OrbitBadge label={t('app.privateBadge')} tone="subtle" />
              <LanguageToggle
                currentLanguage={currentLanguage}
                onSelectLanguage={handleSelectLanguage}
                groupAccessibilityLabel={t('language.groupLabel')}
              />
            </View>

            <View style={styles.hero}>
              <CelestialEmblem />
              <Text style={styles.heroTitle} accessibilityRole="header">
                {t('app.name')}
              </Text>
              <Text style={styles.heroTagline}>{t('app.tagline')}</Text>
              <Text style={styles.heroBody}>{t('home.welcomeBody')}</Text>
            </View>

            <Pressable
              onPress={handleOpenCoupleSpace}
              accessibilityRole="button"
              accessibilityLabel={`${coupleTitle}. ${coupleSubtitle}`}
              accessibilityHint={t('home.coupleCard.hint')}
              style={({ pressed }) => [
                styles.coupleCardPressable,
                pressed && styles.cardPressed,
              ]}
            >
              <CelestialCard highlighted={Boolean(snapshot?.isCoupleFull)}>
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.symbolBadge, { borderColor: colors.accent.rose }]}
                    accessibilityElementsHidden
                  >
                    <Text style={[styles.symbolText, { color: colors.accent.rose }]}>
                      ♡
                    </Text>
                  </View>
                  <OrbitBadge
                    label={coupleBadgeLabel}
                    tone={snapshot?.isCoupleFull ? 'accent' : 'subtle'}
                  />
                </View>
                <Text style={styles.cardTitle}>{coupleTitle}</Text>
                <Text style={styles.cardSubtitle}>{coupleSubtitle}</Text>
              </CelestialCard>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t('home.sectionTitle')}
              </Text>
            </View>

            <View style={styles.destinationList}>
              {DESTINATIONS.map((item) => {
                const statusLabel = item.featured
                  ? t('home.statusNext')
                  : t('home.statusPlanned');
                const title = t(`home.destinations.${item.id}.title`);
                const subtitle = t(`home.destinations.${item.id}.subtitle`);

                const cardContent = (
                  <CelestialCard highlighted={item.featured}>
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.symbolBadge,
                          { borderColor: item.accentColor },
                        ]}
                        accessibilityElementsHidden
                      >
                        <Text style={[styles.symbolText, { color: item.accentColor }]}>
                          {item.symbol}
                        </Text>
                      </View>
                      <OrbitBadge
                        label={statusLabel}
                        tone={item.featured ? 'accent' : 'subtle'}
                      />
                    </View>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{subtitle}</Text>
                  </CelestialCard>
                );

                if (item.featured) {
                  return (
                    <Pressable
                      key={item.id}
                      onPress={handleOpenMemoryMatch}
                      accessibilityRole="button"
                      accessibilityLabel={`${title}. ${subtitle}`}
                      accessibilityHint={t('home.openGameHint')}
                      style={({ pressed }) => [pressed && styles.cardPressed]}
                    >
                      {cardContent}
                    </Pressable>
                  );
                }

                return <View key={item.id}>{cardContent}</View>;
              })}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('home.footerNote')}</Text>
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
    marginBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  emblemContainer: {
    marginBottom: spacing.xl,
  },
  outerOrbit: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: colors.border.accent,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitStar: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  orbitStarTop: {
    top: -4,
    backgroundColor: colors.accent.starlight,
  },
  orbitStarBottom: {
    bottom: -4,
    backgroundColor: colors.accent.rose,
  },
  innerCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface.pillActive,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  twinHeartLeft: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent.starlight,
    marginRight: -3,
  },
  twinHeartRight: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent.rose,
    marginLeft: -3,
  },
  heroTitle: {
    ...typography.heroTitle,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroTagline: {
    ...typography.tagline,
    color: colors.text.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  heroBody: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 340,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text.muted,
  },
  destinationList: {
    gap: spacing.md,
  },
  coupleCardPressable: {
    marginBottom: spacing.xl,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  symbolBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surface.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    fontSize: 16,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  footer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
