import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectDeviceLanguage, loadSavedLanguage, saveLanguage } from './languageStorage';
import { en } from './locales/en';
import { zhCN } from './locales/zh-CN';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type AppLanguage } from './types';

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
} as const;

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  compatibilityJSON: 'v4',
  interpolation: {
    escapeValue: false,
  },
});

export async function hydrateLanguagePreference(): Promise<AppLanguage> {
  const saved = await loadSavedLanguage();
  const target = saved ?? detectDeviceLanguage();

  if (i18n.language !== target) {
    await i18n.changeLanguage(target);
  }

  return target;
}

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await saveLanguage(language);
}

export function getAppLanguage(): AppLanguage {
  return isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

export { i18n };
export { SUPPORTED_LANGUAGES, type AppLanguage } from './types';
