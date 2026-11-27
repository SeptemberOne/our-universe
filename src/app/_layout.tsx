import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { hydrateLanguagePreference, i18n } from '@/i18n';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

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
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background.deepSpace },
          }}
        />
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
