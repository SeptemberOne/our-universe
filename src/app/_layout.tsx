import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CelestialBackdrop } from '@/components/CelestialBackdrop';
import { CelestialButton } from '@/components/CelestialButton';
import { CelestialCard } from '@/components/CelestialCard';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { resolveProtectedRoute } from '@/features/auth/routeGuard';
import { CoupleProvider, useCouple } from '@/features/couple/CoupleContext';
import { hydrateLanguagePreference, i18n } from '@/i18n';
import { colors, layout, spacing, typography } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

function AuthNavigationShell() {
  const { t } = useTranslation();
  const { isConfigured, status: authStatus, errorKey, retrySessionHydration } = useAuth();
  const { status: coupleStatus, snapshot } = useCouple();
  const pathname = usePathname();
  const router = useRouter();

  const hasCouple = Boolean(snapshot?.couple);

  useEffect(() => {
    const target = resolveProtectedRoute({
      isSupabaseConfigured: isConfigured,
      authStatus,
      coupleStatus,
      hasCouple,
      pathname,
    });

    if (target && target !== pathname) {
      router.replace(target);
    }
  }, [authStatus, coupleStatus, hasCouple, isConfigured, pathname, router]);

  const showSessionLoader = isConfigured && authStatus === 'loading';
  const showSessionError = isConfigured && authStatus === 'error';

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.deepSpace },
        }}
      />
      {showSessionLoader ? (
        <View style={styles.loadingOverlay} accessibilityLiveRegion="polite">
          <CelestialBackdrop />
          <ActivityIndicator size="large" color={colors.accent.starlight} />
          <Text style={styles.loadingText}>{t('auth.loadingSession')}</Text>
        </View>
      ) : null}
      {showSessionError ? (
        <View style={styles.loadingOverlay} accessibilityLiveRegion="polite">
          <CelestialBackdrop />
          <CelestialCard highlighted style={styles.errorCard}>
            <Text style={styles.errorTitle} accessibilityRole="header">
              {t('auth.sessionError.title')}
            </Text>
            <Text style={styles.loadingText}>
              {t(`auth.errors.${errorKey ?? 'unknown'}`)}
            </Text>
            <CelestialButton
              label={t('auth.sessionError.retry')}
              onPress={() => void retrySessionHydration()}
              variant="primary"
            />
          </CelestialCard>
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    let isMounted = true;

    async function prepare() {
      try {
        await hydrateLanguagePreference();
      } finally {
        if (isMounted) {
          await SplashScreen.hideAsync();
        }
      }
    }

    void prepare();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <CoupleProvider>
            <StatusBar style="light" />
            <AuthNavigationShell />
          </CoupleProvider>
        </AuthProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.deepSpace,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.deepSpace,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorCard: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
    textAlign: 'center',
  },
});
