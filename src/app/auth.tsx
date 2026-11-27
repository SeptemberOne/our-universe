import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { validateAuthInput, type AuthMode } from '@/features/auth/validation';
import { getAppLanguage, setAppLanguage, type AppLanguage } from '@/i18n';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

export default function AuthScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isConfigured, signIn, signUp } = useAuth();
  const currentLanguage: AppLanguage = getAppLanguage();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const handleSelectLanguage = useCallback(
    (language: AppLanguage) => {
      if (language !== i18n.language) {
        void setAppLanguage(language);
      }
    },
    [i18n.language],
  );

  const handleSwitchMode = useCallback((nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setConfirmationEmail(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setErrorMessage(null);

    const validation = validateAuthInput({
      mode,
      email,
      password,
      displayName,
    });

    if (!validation.ok) {
      setErrorMessage(t(`auth.validation.${validation.errorKey}`));
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signIn') {
        const result = await signIn(validation.email, validation.password);
        if (!result.ok) {
          setErrorMessage(t(`auth.errors.${result.errorKey}`));
        }
      } else {
        const result = await signUp({
          email: validation.email,
          password: validation.password,
          displayName: validation.displayName,
          preferredLanguage: getAppLanguage(),
        });
        if (!result.ok) {
          setErrorMessage(t(`auth.errors.${result.errorKey}`));
        } else if (result.data.status === 'confirmation-required') {
          setConfirmationEmail(validation.email);
          setPassword('');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [displayName, email, mode, password, signIn, signUp, t]);

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
                <OrbitBadge label={t('auth.badge')} tone="subtle" />
                <LanguageToggle
                  currentLanguage={currentLanguage}
                  onSelectLanguage={handleSelectLanguage}
                  groupAccessibilityLabel={t('language.groupLabel')}
                />
              </View>

              <View style={styles.header}>
                <Text style={styles.title} accessibilityRole="header">
                  {t('auth.title')}
                </Text>
                <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
              </View>

              {!isConfigured ? (
                <CelestialCard highlighted style={styles.card}>
                  <Text style={styles.cardTitle}>{t('auth.unconfigured.title')}</Text>
                  <Text style={styles.cardBody}>{t('auth.unconfigured.body')}</Text>
                  <CelestialButton
                    label={t('auth.actions.backToHome')}
                    onPress={() => router.replace('/')}
                    variant="secondary"
                  />
                </CelestialCard>
              ) : confirmationEmail ? (
                <CelestialCard highlighted style={styles.card}>
                  <OrbitBadge label={t('auth.tabs.signUp')} tone="accent" />
                  <Text style={styles.cardTitle}>{t('auth.confirmation.title')}</Text>
                  <Text style={styles.cardBody}>
                    {t('auth.confirmation.body', { email: confirmationEmail })}
                  </Text>
                  <CelestialButton
                    label={t('auth.actions.backToSignIn')}
                    onPress={() => handleSwitchMode('signIn')}
                    variant="primary"
                  />
                </CelestialCard>
              ) : (
                <CelestialCard highlighted style={styles.card}>
                  <View style={styles.modeTabs}>
                    {(['signIn', 'signUp'] as const).map((tab) => {
                      const active = mode === tab;
                      return (
                        <Pressable
                          key={tab}
                          onPress={() => handleSwitchMode(tab)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={({ pressed }) => [
                            styles.modeTab,
                            active && styles.modeTabActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                            {t(`auth.tabs.${tab}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <CelestialInput
                    label={t('auth.fields.emailLabel')}
                    placeholder={t('auth.fields.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />

                  <CelestialInput
                    label={t('auth.fields.passwordLabel')}
                    placeholder={t('auth.fields.passwordPlaceholder')}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                  />

                  {mode === 'signUp' ? (
                    <CelestialInput
                      label={t('auth.fields.displayNameLabel')}
                      placeholder={t('auth.fields.displayNamePlaceholder')}
                      value={displayName}
                      onChangeText={setDisplayName}
                      maxLength={80}
                      textContentType="name"
                    />
                  ) : null}

                  {errorMessage ? (
                    <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  <CelestialButton
                    label={mode === 'signIn' ? t('auth.actions.signIn') : t('auth.actions.signUp')}
                    onPress={() => void handleSubmit()}
                    loading={isSubmitting}
                    variant="primary"
                  />
                </CelestialCard>
              )}
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
    marginBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.heroTitle,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  card: {
    gap: spacing.lg,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
  cardBody: {
    ...typography.body,
    color: colors.text.secondary,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface.pill,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: 3,
    gap: spacing.xs,
  },
  modeTab: {
    flex: 1,
    minHeight: layout.minTouchTarget - 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  modeTabActive: {
    backgroundColor: colors.surface.pillActive,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  modeTabText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: colors.text.accent,
  },
  pressed: {
    opacity: 0.82,
  },
  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(242, 167, 198, 0.5)',
    backgroundColor: 'rgba(242, 167, 198, 0.12)',
    padding: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.accent.rose,
  },
});
