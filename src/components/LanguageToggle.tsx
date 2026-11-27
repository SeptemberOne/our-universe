import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

interface LanguageToggleProps {
  currentLanguage: AppLanguage;
  onSelectLanguage: (language: AppLanguage) => void;
  groupAccessibilityLabel: string;
}

export function LanguageToggle({
  currentLanguage,
  onSelectLanguage,
  groupAccessibilityLabel,
}: LanguageToggleProps) {
  return (
    <View
      style={styles.container}
      accessible={false}
      accessibilityLabel={groupAccessibilityLabel}
    >
      {SUPPORTED_LANGUAGES.map((option) => {
        const isSelected = option.code === currentLanguage;
        return (
          <Pressable
            key={option.code}
            onPress={() => onSelectLanguage(option.code)}
            accessibilityRole="button"
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.option,
              isSelected && styles.optionSelected,
              pressed && styles.optionPressed,
            ]}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {option.nativeLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.pill,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: 3,
    gap: 2,
  },
  option: {
    minHeight: layout.minTouchTarget - 6,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  optionSelected: {
    backgroundColor: colors.surface.pillActive,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  optionPressed: {
    opacity: 0.8,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  labelSelected: {
    color: colors.text.accent,
    fontWeight: '600',
  },
});
