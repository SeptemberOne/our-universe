import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import { DEFAULT_LANGUAGE, isSupportedLanguage, type AppLanguage } from './types';

const LANGUAGE_STORAGE_KEY = 'our-universe.language';

export function detectDeviceLanguage(): AppLanguage {
  try {
    const locales = getLocales();
    const primary = locales[0];
    if (primary?.languageCode?.toLowerCase().startsWith('zh')) {
      return 'zh-CN';
    }
  } catch {
    // Fall back to default language if locale inspection is unavailable.
  }
  return DEFAULT_LANGUAGE;
}

export async function loadSavedLanguage(): Promise<AppLanguage | null> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function saveLanguage(language: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Preference persistence is best-effort in local prototype mode.
  }
}
