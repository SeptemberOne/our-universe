export type AppLanguage = 'en' | 'zh-CN';

export interface LanguageOption {
  code: AppLanguage;
  nativeLabel: string;
  shortLabel: string;
  accessibilityLabel: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  {
    code: 'en',
    nativeLabel: 'English',
    shortLabel: 'EN',
    accessibilityLabel: 'Switch language to English',
  },
  {
    code: 'zh-CN',
    nativeLabel: '简体中文',
    shortLabel: '中文',
    accessibilityLabel: '切换语言为简体中文',
  },
] as const;

export const DEFAULT_LANGUAGE: AppLanguage = 'en';

export function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'en' || value === 'zh-CN';
}
